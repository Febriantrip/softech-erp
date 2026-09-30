package finance

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// InvoiceLineInput identifies a physical Shipment line, never an item/SKU aggregate.
// Two SO lines may legally contain the same SKU at different discounts or tax rates.
type InvoiceLineInput struct {
	ShipmentLineID string  `json:"shipmentLineId"`
	Qty            float64 `json:"qty"`
}

type invoiceSourceLine struct {
	shipmentLineID, salesOrderLineID, itemID, sku, name, uom, description, taxCode string
	qty, allocated, price, discountPercent, taxRate                                float64
}

const invoiceSourceLineSQL = `SELECT sl.id::text,sol.id::text,sl.item_id::text,i.sku,i.name,
    COALESCE(sol.uom,i.base_uom),COALESCE(sol.description,''),COALESCE(tc.code,''),
    sl.qty::float8,
    COALESCE((SELECT SUM(il.qty) FROM erp.sales_invoice_lines il
      JOIN erp.sales_invoices iv ON iv.id=il.sales_invoice_id
      WHERE il.shipment_line_id=sl.id AND iv.status<>'VOID'),0)::float8,
    sol.unit_price::float8,sol.discount_percent::float8,sol.tax_rate::float8
    FROM erp.shipment_lines sl
    JOIN erp.sales_order_lines sol ON sol.id=sl.sales_order_line_id AND sol.item_id=sl.item_id
    JOIN erp.items i ON i.id=sl.item_id
    LEFT JOIN erp.tax_codes tc ON tc.id=sol.tax_code_id
    WHERE sl.shipment_id=$1::uuid ORDER BY sl.line_no`

func validInvoiceQty(qty float64) bool {
	return qty > 0 && !math.IsNaN(qty) && !math.IsInf(qty, 0) && math.Abs(qty) < 1e12
}

func invoiceAmounts(qty, price, discountPercent, taxRate float64) (gross, discount, dpp, tax, total float64) {
	gross = round2(qty * price)
	discount = round2(gross * discountPercent / 100)
	dpp = round2(gross - discount)
	tax = round2(dpp * taxRate / 100)
	total = round2(dpp + tax)
	return
}

func readInvoiceSourceLines(ctx context.Context, q rowQuerier, shipmentID string) ([]invoiceSourceLine, error) {
	rows, err := q.Query(ctx, invoiceSourceLineSQL, shipmentID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	lines := []invoiceSourceLine{}
	for rows.Next() {
		var x invoiceSourceLine
		if err := rows.Scan(&x.shipmentLineID, &x.salesOrderLineID, &x.itemID, &x.sku, &x.name, &x.uom,
			&x.description, &x.taxCode, &x.qty, &x.allocated, &x.price, &x.discountPercent, &x.taxRate); err != nil {
			return nil, err
		}
		lines = append(lines, x)
	}
	return lines, rows.Err()
}

// ListSalesInvoiceSources exposes only POD-confirmed Shipment quantity still unbilled.
// Old SO-level invoices without shipment provenance lock their entire SO until reconciled.
func (s Service) ListSalesInvoiceSources(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT sh.id::text,sh.document_no,GREATEST(sh.delivered_at::date,COALESCE(sh.pod_received_at,sh.delivered_at)::date)::text,c.code,c.name,st.code,
       COALESCE(SUM((sl.qty-COALESCE(a.allocated,0))*sol.unit_price*(1-sol.discount_percent/100)*(1+sol.tax_rate/100)),0)::float8,
       so.document_no,sh.status,COALESCE(SUM(sl.qty-COALESCE(a.allocated,0)),0)::float8
       FROM erp.shipments sh
       JOIN erp.sales_orders so ON so.id=sh.sales_order_id
       JOIN erp.entities e ON e.id=sh.entity_id
       JOIN erp.sites st ON st.id=sh.site_id
       JOIN erp.customers c ON c.id=so.customer_id
       JOIN erp.shipment_lines sl ON sl.shipment_id=sh.id AND sl.sales_order_line_id IS NOT NULL
       JOIN erp.sales_order_lines sol ON sol.id=sl.sales_order_line_id AND sol.item_id=sl.item_id
       LEFT JOIN LATERAL (
         SELECT COALESCE(SUM(il.qty),0) AS allocated FROM erp.sales_invoice_lines il
         JOIN erp.sales_invoices iv ON iv.id=il.sales_invoice_id
         WHERE il.shipment_line_id=sl.id AND iv.status<>'VOID'
       ) a ON TRUE
       WHERE e.code=$1 AND sh.status='DELIVERED'
         AND NOT EXISTS (SELECT 1 FROM erp.sales_invoices old
                         WHERE old.sales_order_id=so.id AND old.shipment_id IS NULL AND old.status<>'VOID')`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY sh.id,so.document_no,c.code,c.name,st.code
       HAVING SUM(sl.qty-COALESCE(a.allocated,0))>0.000001
       ORDER BY sh.delivered_at DESC,sh.document_no DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "date", "partyCode", "partyName", "siteCode", "total", "salesOrderNo", "status", "availableQty"}, args...)
}

// SalesInvoiceSource provides selectable per-shipment-line quantities for partial billing.
func (s Service) SalesInvoiceSource(ctx context.Context, entityCode, siteCode, shipmentID string) (map[string]any, error) {
	var docNo, soNo, customerName, status, site, podDate string
	q := `SELECT sh.document_no,so.document_no,c.name,sh.status,st.code,GREATEST(sh.delivered_at::date,COALESCE(sh.pod_received_at,sh.delivered_at)::date)::text
          FROM erp.shipments sh JOIN erp.sales_orders so ON so.id=sh.sales_order_id
          JOIN erp.customers c ON c.id=so.customer_id JOIN erp.entities e ON e.id=sh.entity_id
          JOIN erp.sites st ON st.id=sh.site_id
          WHERE sh.id=$1::uuid AND e.code=$2 AND sh.status='DELIVERED'
          AND NOT EXISTS(SELECT 1 FROM erp.sales_invoices old WHERE old.sales_order_id=so.id AND old.shipment_id IS NULL AND old.status<>'VOID')`
	args := []any{shipmentID, entityCode}
	if siteCode != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	if err := s.DB.QueryRow(ctx, q, args...).Scan(&docNo, &soNo, &customerName, &status, &site, &podDate); err != nil {
		return nil, errors.New("POD-confirmed Shipment not found, or legacy SO invoice requires reconciliation")
	}
	lines, err := readInvoiceSourceLines(ctx, s.DB, shipmentID)
	if err != nil {
		return nil, err
	}
	out := []map[string]any{}
	for _, l := range lines {
		available := l.qty - l.allocated
		if available < 0.000001 {
			continue
		}
		gross, discount, dpp, tax, total := invoiceAmounts(available, l.price, l.discountPercent, l.taxRate)
		out = append(out, map[string]any{"shipmentLineId": l.shipmentLineID, "salesOrderLineId": l.salesOrderLineID,
			"sku": l.sku, "itemName": l.name, "uom": l.uom, "shippedQty": l.qty, "invoicedQty": l.allocated,
			"availableQty": available, "unitPrice": l.price, "discountPercent": l.discountPercent, "taxRate": l.taxRate,
			"taxCode": l.taxCode, "gross": gross, "discount": discount, "dpp": dpp, "tax": tax, "total": total})
	}
	return map[string]any{"id": shipmentID, "documentNo": docNo, "salesOrderNo": soNo, "customerName": customerName, "status": status, "siteCode": site, "podDate": podDate, "lines": out}, nil
}

func (s Service) CreateSalesInvoice(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreateInvoiceInput, requestID string) (map[string]any, error) {
	if strings.TrimSpace(input.SourceID) == "" {
		return nil, errors.New("shipment sourceId is required")
	}
	date, err := time.Parse("2006-01-02", strings.TrimSpace(input.Date))
	if err != nil {
		return nil, errors.New("invoice date must be YYYY-MM-DD")
	}
	var shipmentNo, soID, soNo, siteID, customerID, terms, po, billAddr, shipAddr string
	var podDate string
	q := `SELECT sh.document_no,so.id::text,so.document_no,sh.site_id::text,so.customer_id::text,
        COALESCE(NULLIF(so.payment_terms,''),c.payment_terms),COALESCE(so.customer_po,''),
        COALESCE(so.billing_address,''),COALESCE(so.shipping_address,''),GREATEST(sh.delivered_at::date,COALESCE(sh.pod_received_at,sh.delivered_at)::date)::text
        FROM erp.shipments sh JOIN erp.sales_orders so ON so.id=sh.sales_order_id
        JOIN erp.customers c ON c.id=so.customer_id
        WHERE sh.id=$1::uuid AND sh.entity_id=$2::uuid AND sh.status='DELIVERED'
        AND sh.delivered_at IS NOT NULL FOR UPDATE OF sh,so`
	err = tx.QueryRow(ctx, q, input.SourceID, rs.EntityID).Scan(&shipmentNo, &soID, &soNo, &siteID, &customerID, &terms, &po, &billAddr, &shipAddr, &podDate)
	if err != nil {
		return nil, errors.New("POD-confirmed Shipment not found in current entity")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Shipment outside current site scope")
	}
	rs.SiteID = siteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	if input.Date < podDate {
		return nil, errors.New("invoice date cannot precede POD delivery date")
	}
	var legacy bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.sales_invoices WHERE entity_id=$1::uuid AND sales_order_id=$2::uuid AND shipment_id IS NULL AND status<>'VOID')`, rs.EntityID, soID).Scan(&legacy); err != nil {
		return nil, err
	}
	if legacy {
		return nil, errors.New("legacy SO-level invoice exists; reconcile invoice allocation before partial billing")
	}
	sourceLines, err := readInvoiceSourceLines(ctx, tx, input.SourceID)
	if err != nil {
		return nil, err
	}
	if len(input.Lines) == 0 {
		return nil, errors.New("select at least one Shipment line to invoice")
	}
	requested := map[string]float64{}
	for _, line := range input.Lines {
		key := strings.TrimSpace(line.ShipmentLineID)
		if key == "" || !validInvoiceQty(line.Qty) {
			return nil, errors.New("each invoice line requires shipmentLineId and qty > 0")
		}
		if _, duplicate := requested[key]; duplicate {
			return nil, errors.New("duplicate Shipment line in invoice request")
		}
		requested[key] = line.Qty
	}
	type selectedLine struct {
		row                                   invoiceSourceLine
		qty, gross, discount, dpp, tax, total float64
	}
	selected := []selectedLine{}
	var gross, discount, dpp, tax, total float64
	for _, l := range sourceLines {
		remaining := l.qty - l.allocated
		if remaining < 0.000001 {
			continue
		}
		qty := remaining
		var found bool
		qty, found = requested[l.shipmentLineID]
		if !found {
			continue
		}
		if !validInvoiceQty(qty) || qty > remaining+0.000001 {
			return nil, fmt.Errorf("invoice qty for %s exceeds unbilled Shipment qty %.6f", l.sku, remaining)
		}
		g, disc, net, t, ttl := invoiceAmounts(qty, l.price, l.discountPercent, l.taxRate)
		selected = append(selected, selectedLine{l, qty, g, disc, net, t, ttl})
		gross += g
		discount += disc
		dpp += net
		tax += t
		total += ttl
		delete(requested, l.shipmentLineID)
	}
	if len(requested) > 0 {
		return nil, errors.New("one or more Shipment lines are unavailable for billing")
	}
	if len(selected) == 0 {
		return nil, errors.New("no unbilled shipped quantity for this Shipment")
	}
	gross = round2(gross)
	discount = round2(discount)
	dpp = round2(dpp)
	tax = round2(tax)
	total = round2(total)
	if total <= 0 {
		return nil, errors.New("invoice total must be positive")
	}
	var docNo string
	err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'SALES_INVOICE',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "INV", date)).Scan(&docNo)
	if err != nil {
		return nil, err
	}
	var invID string
	err = tx.QueryRow(ctx, `INSERT INTO erp.sales_invoices(document_no,entity_id,site_id,customer_id,sales_order_id,shipment_id,
        invoice_date,due_date,created_by,subtotal,discount_amount,dpp_amount,tax_amount,total_amount,payment_terms,customer_po,billing_address,shipping_address)
        VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7,$8,$9::uuid,$10,$11,$12,$13,$14,$15,$16,$17,$18)
        RETURNING id::text`, docNo, rs.EntityID, siteID, customerID, soID, input.SourceID, date, dueDate(date, terms), rs.UserID,
		gross, discount, dpp, tax, total, terms, po, billAddr, shipAddr).Scan(&invID)
	if err != nil {
		return nil, err
	}
	for i, l := range selected {
		r := l.row
		_, err = tx.Exec(ctx, `INSERT INTO erp.sales_invoice_lines(sales_invoice_id,line_no,item_id,qty,unit_price,tax_rate,
           line_subtotal,tax_amount,shipment_line_id,sales_order_line_id,discount_percent,discount_amount,dpp_amount,
           tax_code_id,uom,description,line_total)
           VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9::uuid,$10::uuid,$11,$12,$13,
           (SELECT id FROM erp.tax_codes WHERE code=$14),$15,$16,$17)`,
			invID, i+1, r.itemID, l.qty, r.price, r.taxRate, l.gross, l.tax, r.shipmentLineID, r.salesOrderLineID,
			r.discountPercent, l.discount, l.dpp, r.taxCode, r.uom, r.description, l.total)
		if err != nil {
			return nil, err
		}
	}
	body := map[string]any{"id": invID, "documentNo": docNo, "shipmentId": input.SourceID, "shipmentNo": shipmentNo,
		"salesOrderNo": soNo, "status": "DRAFT", "subtotal": gross, "discount": discount, "dpp": dpp, "tax": tax, "total": total}
	audit(ctx, tx, rs, requestID, "receivable", "create", "sales_invoice", invID, body)
	outbox(ctx, tx, rs, "sales_invoice", invID, "sales_invoice.created", body)
	return body, nil
}

func (s Service) DeleteSalesInvoiceDraft(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, requestID string) (map[string]any, error) {
	var docNo, siteID, soID, shipmentID string
	err := tx.QueryRow(ctx, `SELECT document_no,site_id::text,sales_order_id::text,COALESCE(shipment_id::text,'')
        FROM erp.sales_invoices WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT' FOR UPDATE`, id, rs.EntityID).
		Scan(&docNo, &siteID, &soID, &shipmentID)
	if err != nil {
		return nil, errors.New("draft invoice not found or already posted")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("invoice outside current site scope")
	}
	if shipmentID == "" {
		return nil, errors.New("legacy invoice draft requires separate reconciliation")
	}
	rs.SiteID = siteID
	_, err = tx.Exec(ctx, `DELETE FROM erp.sales_invoices WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT'`, id, rs.EntityID)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": docNo, "salesOrderId": soID, "shipmentId": shipmentID, "status": "DELETED"}
	audit(ctx, tx, rs, requestID, "receivable", "delete", "sales_invoice", id, body)
	outbox(ctx, tx, rs, "sales_invoice", id, "sales_invoice.deleted", body)
	return body, nil
}

func (s Service) SalesInvoiceDetail(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT iv.id::text,iv.document_no,iv.status,iv.invoice_date::text,iv.due_date::text,
         iv.subtotal::float8,iv.discount_amount::float8,(CASE WHEN iv.shipment_id IS NULL THEN (iv.subtotal-iv.discount_amount) ELSE iv.dpp_amount END)::float8,iv.tax_amount::float8,
         iv.total_amount::float8,iv.paid_amount::float8,COALESCE(iv.payment_terms,''),COALESCE(iv.customer_po,''),
         COALESCE(iv.billing_address,''),COALESCE(iv.shipping_address,''),so.document_no,
         COALESCE(sh.document_no,''),c.code,c.name,e.code,e.legal_name,COALESCE(e.tax_id,''),st.code,st.name,
         COALESCE(j.document_no,'')
         FROM erp.sales_invoices iv JOIN erp.sales_orders so ON so.id=iv.sales_order_id
         LEFT JOIN erp.shipments sh ON sh.id=iv.shipment_id JOIN erp.customers c ON c.id=iv.customer_id
         JOIN erp.entities e ON e.id=iv.entity_id JOIN erp.sites st ON st.id=iv.site_id
         LEFT JOIN erp.journal_entries j ON j.id=iv.journal_entry_id
         WHERE iv.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if siteCode != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var invID, docNo, status, invoiceDate, dueDateText, terms, po, billAddr, shipAddr, soNo, shipmentNo, customerCode, customerName, entity, legal, taxID, site, siteName, journalNo string
	var gross, disc, dpp, tax, total, paid float64
	err := s.DB.QueryRow(ctx, q, args...).Scan(&invID, &docNo, &status, &invoiceDate, &dueDateText,
		&gross, &disc, &dpp, &tax, &total, &paid, &terms, &po, &billAddr, &shipAddr, &soNo, &shipmentNo,
		&customerCode, &customerName, &entity, &legal, &taxID, &site, &siteName, &journalNo)
	if err != nil {
		return nil, errors.New("sales invoice not found in current entity/site scope")
	}
	lines, err := queryRows(s.DB, ctx, `SELECT il.id::text,il.line_no,i.sku,i.name,COALESCE(il.uom,i.base_uom),
      il.qty::float8,il.unit_price::float8,il.discount_percent::float8,il.line_subtotal::float8,
      il.discount_amount::float8,(CASE WHEN il.shipment_line_id IS NULL THEN il.line_subtotal-il.discount_amount ELSE il.dpp_amount END)::float8,il.tax_rate::float8,il.tax_amount::float8,
      (CASE WHEN il.shipment_line_id IS NULL THEN il.line_subtotal+il.tax_amount ELSE il.line_total END)::float8,COALESCE(tc.code,''),COALESCE(il.shipment_line_id::text,''),COALESCE(il.sales_order_line_id::text,'')
      FROM erp.sales_invoice_lines il JOIN erp.items i ON i.id=il.item_id
      LEFT JOIN erp.tax_codes tc ON tc.id=il.tax_code_id
      WHERE il.sales_invoice_id=$1::uuid ORDER BY il.line_no`, []string{
		"id", "lineNo", "sku", "itemName", "uom", "qty", "unitPrice", "discountPercent", "gross", "discount", "dpp", "taxRate", "tax", "total", "taxCode", "shipmentLineId", "salesOrderLineId"}, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": invID, "documentNo": docNo, "status": status, "invoiceDate": invoiceDate, "dueDate": dueDateText,
		"subtotal": gross, "discount": disc, "dpp": dpp, "tax": tax, "total": total, "paidAmount": paid,
		"paymentTerms": terms, "customerPo": po, "billingAddress": billAddr, "shippingAddress": shipAddr,
		"salesOrderNo": soNo, "shipmentNo": shipmentNo, "journalNo": journalNo,
		"customer": map[string]any{"code": customerCode, "name": customerName},
		"company":  map[string]any{"code": entity, "legalName": legal, "taxId": taxID},
		"site":     map[string]any{"code": site, "name": siteName}, "lines": lines}, nil
}
