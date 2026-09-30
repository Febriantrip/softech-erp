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

// D4-B uses the existing receiving tables and inventory staging model.
// Quantities MUST be explicitly entered; an empty request must never auto-receive a PO.
func validateReceiptQtyD4B(accepted, rejected, remaining float64) error {
	for _, n := range []float64{accepted, rejected, remaining} {
		if math.IsNaN(n) || math.IsInf(n, 0) {
			return errors.New("receipt qty must be a finite number")
		}
	}
	if accepted < 0 || rejected < 0 {
		return errors.New("accepted/rejected qty cannot be negative")
	}
	if accepted+rejected > remaining+0.0000001 {
		return fmt.Errorf("accepted + rejected cannot exceed PO remaining qty %.6f", remaining)
	}
	return nil
}

func (s Service) receivePurchaseOrderD4B(ctx context.Context, tx pgx.Tx, rs ResolvedScope, poID string, input ReceivePOInput, requestID string) (map[string]any, error) {
	if len(input.Lines) == 0 {
		return nil, errors.New("enter accepted/rejected qty per PO item; empty receipt is not allowed")
	}
	var entityID, siteID, whID, poNo string
	q := `SELECT entity_id::text,site_id::text,warehouse_id::text,document_no FROM erp.purchase_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('APPROVED','PARTIALLY_RECEIVED')`
	args := []any{poID, rs.EntityID}
	if rs.SiteID != "" {
		q += ` AND site_id=$3::uuid`
		args = append(args, rs.SiteID)
	}
	q += ` FOR UPDATE`
	if err := tx.QueryRow(ctx, q, args...).Scan(&entityID, &siteID, &whID, &poNo); err != nil {
		return nil, errors.New("approved PO not found in selected entity/site or no longer receivable")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}

	type poLine struct {
		ID, Item, SKU        string
		Number               int
		Qty, Received, Price float64
	}
	rows, err := tx.Query(ctx, `SELECT pol.id::text,pol.item_id::text,i.sku,pol.line_no,pol.qty::float8,pol.received_qty::float8,pol.unit_price::float8 FROM erp.purchase_order_lines pol JOIN erp.items i ON i.id=pol.item_id WHERE pol.purchase_order_id=$1::uuid ORDER BY pol.line_no FOR UPDATE OF pol`, poID)
	if err != nil {
		return nil, err
	}
	lines := map[string]poLine{}
	for rows.Next() {
		var l poLine
		if err = rows.Scan(&l.ID, &l.Item, &l.SKU, &l.Number, &l.Qty, &l.Received, &l.Price); err != nil {
			break
		}
		lines[l.SKU] = l
	}
	if err == nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	totalAccepted, totalRejected := 0.0, 0.0
	for _, in := range input.Lines {
		sku := strings.TrimSpace(in.SKU)
		l, ok := lines[sku]
		if !ok {
			return nil, fmt.Errorf("SKU %s does not belong to this PO", sku)
		}
		if seen[sku] {
			return nil, fmt.Errorf("duplicate receiving line for %s", sku)
		}
		seen[sku] = true
		remaining := l.Qty - l.Received
		if err := validateReceiptQtyD4B(in.AcceptedQty, in.RejectedQty, remaining); err != nil {
			return nil, fmt.Errorf("%s: %w", sku, err)
		}
		if in.AcceptedQty+in.RejectedQty <= 0 {
			continue
		}
		if len(strings.TrimSpace(in.LotNo)) > 100 || len(strings.TrimSpace(in.PutAwayLocation)) > 80 {
			return nil, fmt.Errorf("lot/location too long for %s", sku)
		}
		totalAccepted += in.AcceptedQty
		totalRejected += in.RejectedQty
	}
	if totalAccepted <= 0 {
		return nil, errors.New("at least one item must have accepted qty greater than zero")
	}
	date := time.Now().UTC()
	var grnNo, grnID string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'GOODS_RECEIPT',$3,$4,$5,6)`, entityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "GRN", date)).Scan(&grnNo); err != nil {
		return nil, err
	}
	if err := tx.QueryRow(ctx, `INSERT INTO erp.goods_receipts(document_no,entity_id,site_id,warehouse_id,purchase_order_id,receipt_date,status,received_at) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,'RECEIVED',now()) RETURNING id::text`, grnNo, entityID, siteID, whID, poID, date).Scan(&grnID); err != nil {
		return nil, err
	}
	count := 0
	for _, in := range input.Lines {
		l := lines[strings.TrimSpace(in.SKU)]
		if in.AcceptedQty+in.RejectedQty <= 0 {
			continue
		}
		loc := strings.TrimSpace(in.PutAwayLocation)
		if loc == "" {
			loc = "GENERAL"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.goods_receipt_lines(goods_receipt_id,line_no,item_id,expected_qty,accepted_qty,rejected_qty,lot_no,putaway_location) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8)`, grnID, l.Number, l.Item, l.Qty-l.Received, in.AcceptedQty, in.RejectedQty, strings.TrimSpace(in.LotNo), loc); err != nil {
			return nil, err
		}
		tag, err := tx.Exec(ctx, `UPDATE erp.purchase_order_lines SET received_qty=received_qty+$2 WHERE id=$1::uuid AND received_qty+$2<=qty`, l.ID, in.AcceptedQty)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, fmt.Errorf("%s receiving quantity changed; reload PO", l.SKU)
		}
		if in.AcceptedQty > 0 {
			if _, err := tx.Exec(ctx, `INSERT INTO erp.inventory_balance(warehouse_id,item_id,on_hand_qty,reserved_qty,inbound_qty,average_cost) VALUES($1::uuid,$2::uuid,0,0,$3,0) ON CONFLICT(warehouse_id,item_id) DO UPDATE SET inbound_qty=erp.inventory_balance.inbound_qty+EXCLUDED.inbound_qty,row_version=erp.inventory_balance.row_version+1,updated_at=now()`, whID, l.Item, in.AcceptedQty); err != nil {
				return nil, err
			}
			if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id) SELECT $1::uuid,$2::uuid,$3::uuid,$4::uuid,'GOODS_RECEIPT_INBOUND',$5,$6,round(($5::numeric*$6::numeric),2),b.on_hand_qty,'GOODS_RECEIPT',$7,$8 FROM erp.inventory_balance b WHERE b.warehouse_id=$3::uuid AND b.item_id=$4::uuid`, entityID, siteID, whID, l.Item, in.AcceptedQty, l.Price, grnNo, requestID); err != nil {
				return nil, err
			}
		}
		count++
	}
	var poStatus string
	if err := tx.QueryRow(ctx, `UPDATE erp.purchase_orders po SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM erp.purchase_order_lines pol WHERE pol.purchase_order_id=po.id AND pol.received_qty<pol.qty) THEN 'RECEIVED' ELSE 'PARTIALLY_RECEIVED' END,updated_at=now() WHERE po.id=$1::uuid RETURNING status`, poID).Scan(&poStatus); err != nil {
		return nil, err
	}
	body := map[string]any{"id": grnID, "documentNo": grnNo, "purchaseOrderId": poID, "purchaseOrderNo": poNo, "status": "RECEIVED", "purchaseOrderStatus": poStatus, "acceptedQty": totalAccepted, "rejectedQty": totalRejected, "lineCount": count}
	audit(ctx, tx, rs, requestID, "warehouse", "receive", "goods_receipt", grnID, body)
	outbox(ctx, tx, rs, "goods_receipt", grnID, "goods_receipt.received", body)
	return body, nil
}

func (s Service) putAwayReceiptD4B(ctx context.Context, tx pgx.Tx, rs ResolvedScope, grnID, requestID string) (map[string]any, error) {
	var entityID, siteID, whID, grnNo, poID string
	q := `SELECT entity_id::text,site_id::text,warehouse_id::text,document_no,purchase_order_id::text FROM erp.goods_receipts WHERE id=$1::uuid AND entity_id=$2::uuid AND status='RECEIVED'`
	args := []any{grnID, rs.EntityID}
	if rs.SiteID != "" {
		q += ` AND site_id=$3::uuid`
		args = append(args, rs.SiteID)
	}
	q += ` FOR UPDATE`
	if err := tx.QueryRow(ctx, q, args...).Scan(&entityID, &siteID, &whID, &grnNo, &poID); err != nil {
		return nil, errors.New("RECEIVED GRN not found in selected entity/site or already put away")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	type line struct {
		SKU, Item string
		Qty, Cost float64
	}
	rows, err := tx.Query(ctx, `SELECT i.sku,grl.item_id::text,grl.accepted_qty::float8,pol.unit_price::float8 FROM erp.goods_receipt_lines grl JOIN erp.purchase_order_lines pol ON pol.purchase_order_id=$1::uuid AND pol.item_id=grl.item_id JOIN erp.items i ON i.id=grl.item_id WHERE grl.goods_receipt_id=$2::uuid ORDER BY grl.line_no`, poID, grnID)
	if err != nil {
		return nil, err
	}
	lines := []line{}
	for rows.Next() {
		var l line
		if err = rows.Scan(&l.SKU, &l.Item, &l.Qty, &l.Cost); err != nil {
			break
		}
		lines = append(lines, l)
	}
	if err == nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		return nil, err
	}
	total := 0.0
	for _, l := range lines {
		if l.Qty <= 0 {
			continue
		}
		var onHand, inbound, avg float64
		var version int64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8,inbound_qty::float8,average_cost::float8,row_version FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, whID, l.Item).Scan(&onHand, &inbound, &avg, &version); err != nil {
			return nil, err
		}
		if inbound+0.0000001 < l.Qty {
			return nil, fmt.Errorf("%s inbound balance no longer covers GRN", l.SKU)
		}
		newAvg := l.Cost
		if onHand+l.Qty > 0 {
			newAvg = ((onHand * avg) + (l.Qty * l.Cost)) / (onHand + l.Qty)
		}
		tag, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET inbound_qty=inbound_qty-$3,on_hand_qty=on_hand_qty+$3,average_cost=$4,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid AND row_version=$5`, whID, l.Item, l.Qty, newAvg, version)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, errors.New("inventory concurrent update, retry Put Away")
		}
		tag, err = tx.Exec(ctx, `UPDATE erp.purchase_order_lines SET putaway_qty=putaway_qty+$3 WHERE purchase_order_id=$1::uuid AND item_id=$2::uuid AND putaway_qty+$3<=received_qty`, poID, l.Item, l.Qty)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, fmt.Errorf("%s putaway exceeds accepted quantity", l.SKU)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'PUTAWAY_IN',$5,$6,round(($5::numeric*$6::numeric),2),$7,'GOODS_RECEIPT',$8,$9)`, entityID, siteID, whID, l.Item, l.Qty, l.Cost, onHand+l.Qty, grnNo, requestID); err != nil {
			return nil, err
		}
		total += l.Qty
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.goods_receipts SET status='PUT_AWAY',putaway_at=now() WHERE id=$1::uuid`, grnID); err != nil {
		return nil, err
	}
	var poStatus string
	if err := tx.QueryRow(ctx, `UPDATE erp.purchase_orders po SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM erp.purchase_order_lines pol WHERE pol.purchase_order_id=po.id AND (pol.received_qty<pol.qty OR pol.putaway_qty<pol.received_qty)) THEN 'PUT_AWAY' ELSE po.status END,updated_at=now() WHERE po.id=$1::uuid RETURNING status`, poID).Scan(&poStatus); err != nil {
		return nil, err
	}
	body := map[string]any{"id": grnID, "documentNo": grnNo, "purchaseOrderId": poID, "status": "PUT_AWAY", "purchaseOrderStatus": poStatus, "putawayQty": total}
	audit(ctx, tx, rs, requestID, "warehouse", "put_away", "goods_receipt", grnID, body)
	outbox(ctx, tx, rs, "goods_receipt", grnID, "goods_receipt.put_away", body)
	return body, nil
}

func (s Service) GoodsReceiptDetailD4B(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT gr.id::text,gr.document_no,gr.receipt_date,gr.status,gr.received_at,gr.putaway_at,po.id::text,po.document_no,po.status,s.code,s.name,w.code,w.name,st.code,e.code,e.legal_name FROM erp.goods_receipts gr JOIN erp.purchase_orders po ON po.id=gr.purchase_order_id JOIN erp.suppliers s ON s.id=po.supplier_id JOIN erp.warehouses w ON w.id=gr.warehouse_id JOIN erp.sites st ON st.id=gr.site_id JOIN erp.entities e ON e.id=gr.entity_id WHERE gr.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if siteCode != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var grnID, no, status, poID, poNo, poStatus, sCode, sName, wCode, wName, stCode, eCode, eName string
	var receiptDate time.Time
	var receivedAt, putawayAt *time.Time
	err := s.DB.QueryRow(ctx, q, args...).Scan(&grnID, &no, &receiptDate, &status, &receivedAt, &putawayAt, &poID, &poNo, &poStatus, &sCode, &sName, &wCode, &wName, &stCode, &eCode, &eName)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, errors.New("goods receipt not found in selected entity/site")
		}
		return nil, err
	}
	rows, err := s.DB.Query(ctx, `SELECT grl.line_no,i.sku,i.name,i.base_uom,grl.expected_qty::float8,grl.accepted_qty::float8,grl.rejected_qty::float8,COALESCE(grl.lot_no,''),COALESCE(grl.putaway_location,''),pol.unit_price::float8 FROM erp.goods_receipt_lines grl JOIN erp.items i ON i.id=grl.item_id JOIN erp.purchase_order_lines pol ON pol.purchase_order_id=$1::uuid AND pol.item_id=grl.item_id WHERE grl.goods_receipt_id=$2::uuid ORDER BY grl.line_no`, poID, grnID)
	if err != nil {
		return nil, err
	}
	lines := make([]map[string]any, 0)
	totalAccepted, totalRejected, totalCost := 0.0, 0.0, 0.0
	for rows.Next() {
		var lineNo int
		var sku, item, uom, lot, loc string
		var exp, accepted, rejected, cost float64
		if err = rows.Scan(&lineNo, &sku, &item, &uom, &exp, &accepted, &rejected, &lot, &loc, &cost); err != nil {
			break
		}
		lines = append(lines, map[string]any{"lineNo": lineNo, "sku": sku, "itemName": item, "uom": uom, "expectedQty": exp, "acceptedQty": accepted, "rejectedQty": rejected, "lotNo": lot, "putAwayLocation": loc, "unitCost": cost, "lineCost": poMoney(accepted * cost)})
		totalAccepted += accepted
		totalRejected += rejected
		totalCost += poMoney(accepted * cost)
	}
	if err == nil {
		err = rows.Err()
	}
	rows.Close()
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": grnID, "documentNo": no, "status": status, "receiptDate": receiptDate.Format("2006-01-02"), "receivedAt": receivedAt, "putawayAt": putawayAt, "purchaseOrder": map[string]any{"id": poID, "documentNo": poNo, "status": poStatus}, "supplier": map[string]any{"code": sCode, "name": sName}, "warehouse": map[string]any{"code": wCode, "name": wName}, "company": map[string]any{"code": eCode, "legalName": eName}, "siteCode": stCode, "lines": lines, "acceptedQty": totalAccepted, "rejectedQty": totalRejected, "inboundValue": poMoney(totalCost)}, nil
}
