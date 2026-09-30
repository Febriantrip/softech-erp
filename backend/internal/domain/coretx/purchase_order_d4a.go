package coretx

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// Purchase Order D4-A is intentionally separate from the existing Goods Receipt module.
// The net unit_price is the canonical procurement cost used by existing receiving and AP.
func poMoney(v float64) float64 { return math.Round(v*100) / 100 }
func poUnit(v float64) float64  { return math.Round(v*1000000) / 1000000 }
func poDate(value, field string) (time.Time, error) {
	t, err := time.Parse("2006-01-02", strings.TrimSpace(value))
	if err != nil {
		return time.Time{}, fmt.Errorf("%s must use YYYY-MM-DD", field)
	}
	return t, nil
}

type UpdatePurchaseOrderInput struct {
	WarehouseCode     string                   `json:"warehouseCode"`
	SupplierCode      string                   `json:"supplierCode"`
	OrderDate         string                   `json:"orderDate"`
	ETADate           string                   `json:"etaDate"`
	SupplierReference string                   `json:"supplierReference"`
	PaymentTerms      string                   `json:"paymentTerms"`
	Notes             string                   `json:"notes"`
	RevisionNo        *int                     `json:"revisionNo"`
	Lines             []PurchaseOrderLineInput `json:"lines"`
}
type CancelPurchaseOrderInput struct {
	Reason string `json:"reason"`
}

type lockedPO struct {
	No, Status, SiteID string
	Revision           int
}

func lockPurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string) (lockedPO, error) {
	var row lockedPO
	q := `SELECT document_no,status,site_id::text,revision_no FROM erp.purchase_orders WHERE id=$1::uuid AND entity_id=$2::uuid`
	args := []any{id, rs.EntityID}
	if rs.SiteID != "" {
		q += ` AND site_id=$3::uuid`
		args = append(args, rs.SiteID)
	}
	q += ` FOR UPDATE`
	if err := tx.QueryRow(ctx, q, args...).Scan(&row.No, &row.Status, &row.SiteID, &row.Revision); err != nil {
		return row, errors.New("purchase order not found in current entity/site scope")
	}
	return row, nil
}

func poParties(ctx context.Context, tx pgx.Tx, rs ResolvedScope, site, wh, supplier string) (string, string, string, string, error) {
	var siteID, whID, supplierID, terms string
	if rs.SiteID != "" {
		if site != "" && site != rs.SiteCode {
			return "", "", "", "", errors.New("purchase order site does not match selected scope")
		}
		siteID = rs.SiteID
	} else {
		if site == "" {
			// All Sites selection: derive destination site from the chosen warehouse.
			if err := tx.QueryRow(ctx, `SELECT w.site_id::text FROM erp.warehouses w JOIN erp.sites st ON st.id=w.site_id WHERE w.entity_id=$1::uuid AND w.code=$2 AND w.status='ACTIVE' AND st.status='ACTIVE'`, rs.EntityID, wh).Scan(&siteID); err != nil {
				return "", "", "", "", errors.New("warehouse is invalid for entity")
			}
		} else if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, site).Scan(&siteID); err != nil {
			return "", "", "", "", errors.New("site is invalid for entity")
		}
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.warehouses WHERE entity_id=$1::uuid AND site_id=$2::uuid AND code=$3 AND status='ACTIVE'`, rs.EntityID, siteID, wh).Scan(&whID); err != nil {
		return "", "", "", "", errors.New("warehouse is invalid for selected site")
	}
	if err := tx.QueryRow(ctx, `SELECT id::text,payment_terms FROM erp.suppliers WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, supplier).Scan(&supplierID, &terms); err != nil {
		return "", "", "", "", errors.New("supplier is invalid for entity")
	}
	return siteID, whID, supplierID, terms, nil
}

func purchaseOrderLinesD4A(ctx context.Context, tx pgx.Tx, poID string, date time.Time, lines []PurchaseOrderLineInput) (float64, float64, float64, float64, error) {
	if len(lines) == 0 {
		return 0, 0, 0, 0, errors.New("purchase order requires at least one line")
	}
	if len(lines) > 200 {
		return 0, 0, 0, 0, errors.New("purchase order may contain at most 200 lines")
	}
	seen := map[string]bool{}
	subtotal, discount, dpp, tax := 0.0, 0.0, 0.0, 0.0
	for index, l := range lines {
		sku := strings.TrimSpace(l.SKU)
		if sku == "" || seen[sku] {
			return 0, 0, 0, 0, fmt.Errorf("line %d has empty or duplicate SKU: %s", index+1, sku)
		}
		seen[sku] = true
		if math.IsNaN(l.Qty) || math.IsInf(l.Qty, 0) || l.Qty <= 0 || l.Qty > 1e9 {
			return 0, 0, 0, 0, fmt.Errorf("line %d qty is invalid", index+1)
		}
		if math.IsNaN(l.UnitPrice) || math.IsInf(l.UnitPrice, 0) || l.UnitPrice < 0 || l.UnitPrice > 1e12 {
			return 0, 0, 0, 0, fmt.Errorf("line %d unit price is invalid", index+1)
		}
		if math.IsNaN(l.DiscountPercent) || math.IsInf(l.DiscountPercent, 0) || l.DiscountPercent < 0 || l.DiscountPercent > 100 {
			return 0, 0, 0, 0, fmt.Errorf("line %d discount must be between 0 and 100", index+1)
		}
		var itemID string
		var standardCost, rate float64
		if err := tx.QueryRow(ctx, `SELECT id::text,standard_cost::float8,tax_rate::float8 FROM erp.items WHERE sku=$1 AND status='ACTIVE'`, sku).Scan(&itemID, &standardCost, &rate); err != nil {
			return 0, 0, 0, 0, fmt.Errorf("line %d item %s not found", index+1, sku)
		}
		grossUnit := l.UnitPrice
		if grossUnit == 0 {
			grossUnit = standardCost
		}
		if grossUnit <= 0 {
			return 0, 0, 0, 0, fmt.Errorf("line %d unit price / standard cost must be positive", index+1)
		}
		var taxID any
		if code := strings.TrimSpace(l.TaxCode); code != "" {
			var id string
			if err := tx.QueryRow(ctx, `SELECT id::text,rate::float8 FROM erp.tax_codes WHERE code=$1 AND status='ACTIVE' AND (valid_from IS NULL OR valid_from<=$2::date) AND (valid_to IS NULL OR valid_to>=$2::date)`, code, date).Scan(&id, &rate); err != nil {
				return 0, 0, 0, 0, fmt.Errorf("line %d tax code %s is invalid on PO date", index+1, code)
			}
			taxID = id
		}
		// Existing GRN cost and supplier-invoice matching use pol.unit_price directly.
		// Store discounted NET unit price there and snapshot gross price separately.
		netUnit := poUnit(grossUnit * (100 - l.DiscountPercent) / 100)
		gross := poMoney(l.Qty * grossUnit)
		net := poMoney(l.Qty * netUnit)
		disc := poMoney(gross - net)
		lineTax := poMoney(net * rate / 100)
		lineTotal := poMoney(net + lineTax)
		if net < 0 || lineTotal < 0 || math.IsInf(lineTotal, 0) {
			return 0, 0, 0, 0, fmt.Errorf("line %d value invalid", index+1)
		}
		_, err := tx.Exec(ctx, `INSERT INTO erp.purchase_order_lines(purchase_order_id,line_no,item_id,qty,unit_price,tax_rate,description,list_unit_price,discount_percent,discount_amount,dpp_amount,tax_code_id,tax_amount,line_total)
    VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12::uuid,$13,$14)`, poID, index+1, itemID, l.Qty, netUnit, rate, strings.TrimSpace(l.Description), grossUnit, l.DiscountPercent, disc, net, taxID, lineTax, lineTotal)
		if err != nil {
			return 0, 0, 0, 0, err
		}
		subtotal += gross
		discount += disc
		dpp += net
		tax += lineTax
	}
	return poMoney(subtotal), poMoney(discount), poMoney(dpp), poMoney(tax), nil
}

func (s Service) createPurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreatePurchaseOrderInput, requestID string) (map[string]any, error) {
	date, err := poDate(input.OrderDate, "orderDate")
	if err != nil {
		return nil, err
	}
	eta, err := poDate(input.ETADate, "etaDate")
	if err != nil {
		return nil, err
	}
	if eta.Before(date) {
		return nil, errors.New("ETA must not precede order date")
	}
	siteCode := strings.TrimSpace(input.SiteCode)
	if siteCode == "" {
		siteCode = rs.SiteCode
	}
	siteID, whID, supplierID, defaultTerms, err := poParties(ctx, tx, rs, siteCode, input.WarehouseCode, input.SupplierCode)
	if err != nil {
		return nil, err
	}
	rs.SiteID = siteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	terms := strings.TrimSpace(input.PaymentTerms)
	if terms == "" {
		terms = defaultTerms
	}
	var docNo string
	if err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'PURCHASE_ORDER',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "PO", date)).Scan(&docNo); err != nil {
		return nil, err
	}
	var id string
	if err = tx.QueryRow(ctx, `INSERT INTO erp.purchase_orders(document_no,entity_id,site_id,warehouse_id,supplier_id,order_date,eta_date,supplier_reference,payment_terms,notes,created_by)
   VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11::uuid) RETURNING id::text`, docNo, rs.EntityID, siteID, whID, supplierID, date, eta, strings.TrimSpace(input.SupplierReference), terms, strings.TrimSpace(input.Notes), rs.UserID).Scan(&id); err != nil {
		return nil, err
	}
	sub, disc, dpp, tax, err := purchaseOrderLinesD4A(ctx, tx, id, date, input.Lines)
	if err != nil {
		return nil, err
	}
	total := poMoney(dpp + tax)
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_orders SET subtotal=$2,discount_amount=$3,dpp_amount=$4,tax_amount=$5,total_amount=$6,updated_at=now() WHERE id=$1::uuid`, id, sub, disc, dpp, tax, total); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": docNo, "status": "DRAFT", "revisionNo": 0, "subtotal": sub, "discount": disc, "dpp": dpp, "tax": tax, "total": total}
	audit(ctx, tx, rs, requestID, "procurement", "create", "purchase_order", id, body)
	outbox(ctx, tx, rs, "purchase_order", id, "purchase_order.created", body)
	return body, nil
}

func (s Service) UpdatePurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string, input UpdatePurchaseOrderInput, requestID string) (map[string]any, error) {
	row, err := lockPurchaseOrderD4A(ctx, tx, rs, id)
	if err != nil {
		return nil, err
	}
	if row.Status != "DRAFT" {
		return nil, errors.New("only DRAFT purchase orders can be edited")
	}
	if input.RevisionNo == nil || *input.RevisionNo != row.Revision {
		return nil, fmt.Errorf("purchase order revision conflict: current %d; reload detail", row.Revision)
	}
	date, err := poDate(input.OrderDate, "orderDate")
	if err != nil {
		return nil, err
	}
	eta, err := poDate(input.ETADate, "etaDate")
	if err != nil {
		return nil, err
	}
	if eta.Before(date) {
		return nil, errors.New("ETA must not precede order date")
	}
	rs.SiteID = row.SiteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	_, whID, supplierID, defaultTerms, err := poParties(ctx, tx, rs, rs.SiteCode, input.WarehouseCode, input.SupplierCode)
	if err != nil {
		return nil, err
	}
	terms := strings.TrimSpace(input.PaymentTerms)
	if terms == "" {
		terms = defaultTerms
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_orders SET warehouse_id=$2::uuid,supplier_id=$3::uuid,order_date=$4,eta_date=$5,supplier_reference=$6,payment_terms=$7,notes=$8,revision_no=revision_no+1,updated_at=now() WHERE id=$1::uuid`, id, whID, supplierID, date, eta, strings.TrimSpace(input.SupplierReference), terms, strings.TrimSpace(input.Notes)); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM erp.purchase_order_lines WHERE purchase_order_id=$1::uuid`, id); err != nil {
		return nil, err
	}
	sub, disc, dpp, tax, err := purchaseOrderLinesD4A(ctx, tx, id, date, input.Lines)
	if err != nil {
		return nil, err
	}
	total := poMoney(dpp + tax)
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_orders SET subtotal=$2,discount_amount=$3,dpp_amount=$4,tax_amount=$5,total_amount=$6 WHERE id=$1::uuid`, id, sub, disc, dpp, tax, total); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": row.No, "status": "DRAFT", "revisionNo": row.Revision + 1, "subtotal": sub, "discount": disc, "dpp": dpp, "tax": tax, "total": total}
	audit(ctx, tx, rs, requestID, "procurement", "edit", "purchase_order", id, body)
	outbox(ctx, tx, rs, "purchase_order", id, "purchase_order.updated", body)
	return body, nil
}

func (s Service) transitionPurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, from, to, requestID string) (map[string]any, error) {
	row, err := lockPurchaseOrderD4A(ctx, tx, rs, id)
	if err != nil {
		return nil, err
	}
	if (from != "DRAFT" || to != "PENDING_APPROVAL") && (from != "PENDING_APPROVAL" || to != "APPROVED") {
		return nil, errors.New("invalid purchase order transition")
	}
	if row.Status != from {
		return nil, fmt.Errorf("purchase order is %s, expected %s", row.Status, from)
	}
	rs.SiteID = row.SiteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	// Cast status parameter explicitly to avoid PostgreSQL 42P08 (varchar vs text).
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_orders SET status=$2::varchar(30),approved_at=CASE WHEN $2::varchar(30)='APPROVED' THEN now() ELSE approved_at END,updated_at=now() WHERE id=$1::uuid`, id, to); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": row.No, "previousStatus": from, "status": to}
	audit(ctx, tx, rs, requestID, "procurement", "status_change", "purchase_order", id, body)
	outbox(ctx, tx, rs, "purchase_order", id, "purchase_order."+strings.ToLower(to), body)
	return body, nil
}

func (s Service) DeletePurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, requestID string) (map[string]any, error) {
	row, err := lockPurchaseOrderD4A(ctx, tx, rs, id)
	if err != nil {
		return nil, err
	}
	if row.Status != "DRAFT" {
		return nil, errors.New("only DRAFT purchase orders can be deleted")
	}
	rs.SiteID = row.SiteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": row.No, "status": "DELETED"}
	audit(ctx, tx, rs, requestID, "procurement", "delete", "purchase_order", id, body)
	outbox(ctx, tx, rs, "purchase_order", id, "purchase_order.deleted", body)
	if _, err = tx.Exec(ctx, `DELETE FROM erp.purchase_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT'`, id, rs.EntityID); err != nil {
		return nil, err
	}
	return body, nil
}

func (s Service) CancelPurchaseOrderD4A(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string, input CancelPurchaseOrderInput, requestID string) (map[string]any, error) {
	row, err := lockPurchaseOrderD4A(ctx, tx, rs, id)
	if err != nil {
		return nil, err
	}
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("cancellation reason required")
	}
	if row.Status == "DRAFT" {
		return nil, errors.New("delete a DRAFT purchase order instead of cancelling it")
	}
	if row.Status != "PENDING_APPROVAL" && row.Status != "APPROVED" {
		return nil, errors.New("purchase order cannot be cancelled after receiving begins")
	}
	var receipts int
	if err = tx.QueryRow(ctx, `SELECT count(*) FROM erp.goods_receipts WHERE purchase_order_id=$1::uuid`, id).Scan(&receipts); err != nil {
		return nil, err
	}
	if receipts > 0 {
		return nil, errors.New("purchase order has Goods Receipts; cancel or reverse receiving through procurement workflow")
	}
	rs.SiteID = row.SiteID
	if err = ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_orders SET status='CANCELLED',cancel_reason=$2,cancelled_at=now(),cancelled_by=$3::uuid,updated_at=now() WHERE id=$1::uuid`, id, reason, rs.UserID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": row.No, "previousStatus": row.Status, "status": "CANCELLED", "reason": reason}
	audit(ctx, tx, rs, requestID, "procurement", "cancel", "purchase_order", id, body)
	outbox(ctx, tx, rs, "purchase_order", id, "purchase_order.cancelled", body)
	return body, nil
}
