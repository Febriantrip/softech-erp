package coretx

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
)

func (s Service) PurchaseOrderDetailD4A(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT po.id::text,po.document_no,po.order_date,po.eta_date,po.status,po.currency,
 po.subtotal::float8,po.discount_amount::float8,po.dpp_amount::float8,po.tax_amount::float8,po.total_amount::float8,
 COALESCE(po.supplier_reference,''),COALESCE(po.payment_terms,''),COALESCE(po.notes,''),po.revision_no,
 COALESCE(po.cancel_reason,''),po.cancelled_at,po.created_at,po.updated_at,
 s.code,s.name,s.payment_terms,w.code,w.name,st.code,st.name,e.code,e.legal_name,COALESCE(e.tax_id,''),COALESCE(u.display_name,'')
 FROM erp.purchase_orders po
 JOIN erp.entities e ON e.id=po.entity_id JOIN erp.sites st ON st.id=po.site_id
 JOIN erp.suppliers s ON s.id=po.supplier_id JOIN erp.warehouses w ON w.id=po.warehouse_id
 LEFT JOIN erp.users u ON u.id=po.created_by
 WHERE po.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if siteCode != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var orderDate time.Time
	var eta, cancelled *time.Time
	var created, updated time.Time
	var poID, no, status, currency, ref, terms, notes, cancelReason, sCode, sName, sTerms, wCode, wName, stCode, stName, eCode, eName, taxID, createdBy string
	var sub, disc, dpp, tax, total float64
	var revision int
	err := s.DB.QueryRow(ctx, q, args...).Scan(&poID, &no, &orderDate, &eta, &status, &currency, &sub, &disc, &dpp, &tax, &total, &ref, &terms, &notes, &revision, &cancelReason, &cancelled, &created, &updated, &sCode, &sName, &sTerms, &wCode, &wName, &stCode, &stName, &eCode, &eName, &taxID, &createdBy)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, errors.New("purchase order not found in selected entity/site")
		}
		return nil, err
	}
	result := map[string]any{"id": poID, "documentNo": no, "orderDate": orderDate.Format("2006-01-02"), "status": status, "currency": currency,
		"subtotal": sub, "discount": disc, "dpp": dpp, "tax": tax, "total": total, "supplierReference": ref, "paymentTerms": terms,
		"notes": notes, "revisionNo": revision, "cancelReason": cancelReason, "cancelledAt": cancelled,
		"createdAt": created, "updatedAt": updated, "createdBy": createdBy, "entityCode": eCode, "siteCode": stCode,
		"company": map[string]any{"code": eCode, "legalName": eName, "taxId": taxID},
		"site":    map[string]any{"code": stCode, "name": stName}, "supplier": map[string]any{"code": sCode, "name": sName, "paymentTerms": sTerms},
		"warehouse": map[string]any{"code": wCode, "name": wName}}
	if eta != nil {
		result["etaDate"] = eta.Format("2006-01-02")
	}
	lq := `SELECT pol.id::text,pol.line_no,i.sku,i.name,i.base_uom,COALESCE(pol.description,''),
 pol.qty::float8,COALESCE(pol.list_unit_price,pol.unit_price)::float8,pol.unit_price::float8,
 pol.discount_percent::float8,pol.discount_amount::float8,pol.dpp_amount::float8,
 COALESCE(tc.code,''),COALESCE(tc.name,''),pol.tax_rate::float8,pol.tax_amount::float8,pol.line_total::float8,
 pol.received_qty::float8,pol.putaway_qty::float8
 FROM erp.purchase_order_lines pol JOIN erp.items i ON i.id=pol.item_id
 LEFT JOIN erp.tax_codes tc ON tc.id=pol.tax_code_id
 WHERE pol.purchase_order_id=$1::uuid ORDER BY pol.line_no`
	rows, err := s.DB.Query(ctx, lq, poID)
	if err != nil {
		return nil, err
	}
	lines := make([]map[string]any, 0)
	for rows.Next() {
		var lineID, sku, item, uom, desc, taxCode, taxName string
		var lineNo int
		var qty, grossUnit, netUnit, discountPercent, discountAmount, lineDPP, rate, lineTax, lineTotal, received, putaway float64
		if err = rows.Scan(&lineID, &lineNo, &sku, &item, &uom, &desc, &qty, &grossUnit, &netUnit, &discountPercent, &discountAmount, &lineDPP, &taxCode, &taxName, &rate, &lineTax, &lineTotal, &received, &putaway); err != nil {
			break
		}
		lines = append(lines, map[string]any{"id": lineID, "lineNo": lineNo, "sku": sku, "itemName": item, "uom": uom, "description": desc,
			"qty": qty, "unitPrice": grossUnit, "effectiveUnitPrice": netUnit, "discountPercent": discountPercent, "discountAmount": discountAmount,
			"dpp": lineDPP, "taxCode": taxCode, "taxName": taxName, "taxRate": rate, "taxAmount": lineTax, "lineTotal": lineTotal,
			"receivedQty": received, "putawayQty": putaway, "remainingQty": poMoney(qty - received)})
	}
	if rowsErr := rows.Err(); err == nil {
		err = rowsErr
	}
	rows.Close()
	if err != nil {
		return nil, err
	}
	result["lines"] = lines
	// Group only persisted tax values; avoid recalculating canonical amounts in React.
	type totals struct {
		DPP, Tax float64
		Count    int
	}
	groups := map[string]*totals{}
	order := []string{}
	for _, l := range lines {
		code := l["taxCode"].(string)
		if code == "" {
			code = "Item default"
		}
		key := code
		if _, ok := groups[key]; !ok {
			groups[key] = &totals{}
			order = append(order, key)
		}
		g := groups[key]
		g.DPP += l["dpp"].(float64)
		g.Tax += l["taxAmount"].(float64)
		g.Count++
	}
	summary := make([]map[string]any, 0, len(order))
	for _, key := range order {
		g := groups[key]
		summary = append(summary, map[string]any{"taxCode": key, "dpp": poMoney(g.DPP), "taxAmount": poMoney(g.Tax), "total": poMoney(g.DPP + g.Tax), "lineCount": g.Count})
	}
	result["taxSummary"] = summary
	aq := `SELECT a.occurred_at,a.action,COALESCE(u.display_name,''),COALESCE(a.after_data::text,'{}') FROM erp.audit_events a LEFT JOIN erp.users u ON u.id=a.user_id WHERE a.entity_id=(SELECT entity_id FROM erp.purchase_orders WHERE id=$1::uuid) AND a.resource_type='purchase_order' AND a.resource_id=$1::text ORDER BY a.occurred_at DESC LIMIT 60`
	ar, err := s.DB.Query(ctx, aq, poID)
	if err != nil {
		return nil, err
	}
	trail := make([]map[string]any, 0)
	for ar.Next() {
		var when time.Time
		var action, actor, after string
		if err = ar.Scan(&when, &action, &actor, &after); err != nil {
			break
		}
		trail = append(trail, map[string]any{"occurredAt": when, "action": action, "actor": actor, "after": after})
	}
	if rowsErr := ar.Err(); err == nil {
		err = rowsErr
	}
	ar.Close()
	if err != nil {
		return nil, err
	}
	result["auditTrail"] = trail
	gr, err := s.DB.Query(ctx, `SELECT id::text,document_no,status,receipt_date FROM erp.goods_receipts WHERE purchase_order_id=$1::uuid ORDER BY receipt_date DESC`, poID)
	if err != nil {
		return nil, err
	}
	related := make([]map[string]any, 0)
	for gr.Next() {
		var rid, doc, state string
		var dt time.Time
		if err = gr.Scan(&rid, &doc, &state, &dt); err != nil {
			break
		}
		related = append(related, map[string]any{"documentType": "GOODS_RECEIPT", "id": rid, "documentNo": doc, "status": state, "documentDate": dt.Format("2006-01-02")})
	}
	if rowsErr := gr.Err(); err == nil {
		err = rowsErr
	}
	gr.Close()
	if err != nil {
		return nil, err
	}
	result["relatedDocuments"] = related
	return result, nil
}
