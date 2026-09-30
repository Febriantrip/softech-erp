package coretx

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type UpdatePickingInput struct {
	Lines []UpdatePickingLineInput `json:"lines"`
}

type UpdatePickingLineInput struct {
	ID        string  `json:"id"`
	PickedQty float64 `json:"pickedQty"`
	Location  string  `json:"location"`
	LotNo     string  `json:"lotNo"`
}

func (s Service) ListPickingOrders(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT p.id::text,p.document_no,p.status,p.created_at::text,COALESCE(p.started_at::text,''),COALESCE(p.completed_at::text,''),
        so.id::text,so.document_no,c.code,c.name,w.code,w.name,st.code,
        COALESCE(u.display_name,u.username,''),
        COALESCE(sum(pl.requested_qty),0)::float8,COALESCE(sum(pl.picked_qty),0)::float8,COALESCE(sum(pl.shortage_qty),0)::float8,count(pl.id)::int
        FROM erp.picking_orders p
        JOIN erp.sales_orders so ON so.id=p.sales_order_id
        JOIN erp.entities e ON e.id=p.entity_id
        JOIN erp.sites st ON st.id=p.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=p.warehouse_id
        LEFT JOIN erp.users u ON u.id=p.picker_user_id
        LEFT JOIN erp.picking_order_lines pl ON pl.picking_order_id=p.id
        WHERE e.code=$1`
	args := []any{entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY p.id,so.id,so.document_no,c.code,c.name,w.code,w.name,st.code,u.display_name,u.username ORDER BY p.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{
		"id", "documentNo", "status", "createdAt", "startedAt", "completedAt",
		"salesOrderId", "salesOrderNo", "customerCode", "customerName", "warehouseCode", "warehouseName", "siteCode", "picker",
		"requestedQty", "pickedQty", "shortageQty", "lineCount",
	}, args...)
}

func (s Service) PickingOrderDetail(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT p.id::text,p.document_no,p.status,p.created_at::text,COALESCE(p.started_at::text,''),COALESCE(p.completed_at::text,''),COALESCE(p.cancel_reason,''),
        so.id::text,so.document_no,so.status,c.code,c.name,w.code,w.name,st.code,e.code,COALESCE(u.display_name,u.username,'')
        FROM erp.picking_orders p
        JOIN erp.sales_orders so ON so.id=p.sales_order_id
        JOIN erp.entities e ON e.id=p.entity_id
        JOIN erp.sites st ON st.id=p.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=p.warehouse_id
        LEFT JOIN erp.users u ON u.id=p.picker_user_id
        WHERE p.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var h struct {
		id, documentNo, status, createdAt, startedAt, completedAt, cancelReason string
		salesOrderID, salesOrderNo, salesOrderStatus                            string
		customerCode, customerName, warehouseCode, warehouseName                string
		siteCode, entityCode, picker                                            string
	}
	if err := s.DB.QueryRow(ctx, q, args...).Scan(
		&h.id, &h.documentNo, &h.status, &h.createdAt, &h.startedAt, &h.completedAt, &h.cancelReason,
		&h.salesOrderID, &h.salesOrderNo, &h.salesOrderStatus,
		&h.customerCode, &h.customerName, &h.warehouseCode, &h.warehouseName,
		&h.siteCode, &h.entityCode, &h.picker,
	); err != nil {
		return nil, errors.New("picking order not found in current scope")
	}
	lines, err := queryRows(s.DB, ctx, `SELECT pl.id::text,pl.line_no,sol.id::text,i.sku,i.name,COALESCE(sol.uom,i.base_uom),
        pl.requested_qty::float8,pl.picked_qty::float8,pl.shortage_qty::float8,COALESCE(pl.location_code,''),COALESCE(pl.lot_no,''),
        sol.reserved_qty::float8,sol.shipped_qty::float8,
        COALESCE((SELECT sum(dl.qty) FROM erp.delivery_order_lines dl JOIN erp.delivery_orders d ON d.id=dl.delivery_order_id WHERE dl.picking_order_line_id=pl.id AND d.status<>'CANCELLED'),0)::float8,
        GREATEST(pl.picked_qty-COALESCE((SELECT sum(dl.qty) FROM erp.delivery_order_lines dl JOIN erp.delivery_orders d ON d.id=dl.delivery_order_id WHERE dl.picking_order_line_id=pl.id AND d.status<>'CANCELLED'),0),0)::float8
        FROM erp.picking_order_lines pl
        JOIN erp.sales_order_lines sol ON sol.id=pl.sales_order_line_id
        JOIN erp.items i ON i.id=pl.item_id
        WHERE pl.picking_order_id=$1::uuid ORDER BY pl.line_no`, []string{
		"id", "lineNo", "salesOrderLineId", "sku", "itemName", "uom", "requestedQty", "pickedQty", "shortageQty", "location", "lotNo", "salesOrderReservedQty", "salesOrderShippedQty", "deliveryAllocatedQty", "availableForDeliveryQty",
	}, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": h.id, "documentNo": h.documentNo, "status": h.status, "createdAt": h.createdAt,
		"startedAt": h.startedAt, "completedAt": h.completedAt, "cancelReason": h.cancelReason,
		"salesOrder": map[string]any{"id": h.salesOrderID, "documentNo": h.salesOrderNo, "status": h.salesOrderStatus},
		"customer":   map[string]any{"code": h.customerCode, "name": h.customerName},
		"warehouse":  map[string]any{"code": h.warehouseCode, "name": h.warehouseName},
		"entityCode": h.entityCode, "siteCode": h.siteCode, "picker": h.picker, "lines": lines,
	}, nil
}

func (s Service) CreatePickingOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, salesOrderID, requestID string) (map[string]any, error) {
	var siteID, warehouseID, salesOrderNo, status string
	if err := tx.QueryRow(ctx, `SELECT site_id::text,warehouse_id::text,document_no,status
        FROM erp.sales_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('RESERVED','PARTIALLY_SHIPPED') FOR UPDATE`, salesOrderID, rs.EntityID).
		Scan(&siteID, &warehouseID, &salesOrderNo, &status); err != nil {
		return nil, errors.New("reserved sales order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("sales order is outside current site scope")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}

	rows, err := tx.Query(ctx, `SELECT sol.id::text,sol.item_id::text,sol.line_no,sol.reserved_qty::float8,i.sku,
        COALESCE((SELECT sum(CASE
            WHEN p.status IN ('OPEN','IN_PROGRESS') THEN pl.requested_qty
            WHEN p.status='COMPLETED' THEN pl.picked_qty
            ELSE 0 END)
            FROM erp.picking_order_lines pl
            JOIN erp.picking_orders p ON p.id=pl.picking_order_id
            WHERE pl.sales_order_line_id=sol.id),0)::float8 AS allocated
        FROM erp.sales_order_lines sol JOIN erp.items i ON i.id=sol.item_id
        WHERE sol.sales_order_id=$1::uuid ORDER BY sol.line_no FOR UPDATE OF sol`, salesOrderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type pickLine struct {
		soLineID, itemID, sku string
		lineNo                int
		reserved, allocated   float64
	}
	var lines []pickLine
	for rows.Next() {
		var line pickLine
		if err := rows.Scan(&line.soLineID, &line.itemID, &line.lineNo, &line.reserved, &line.sku, &line.allocated); err != nil {
			return nil, err
		}
		if remaining := line.reserved - line.allocated; remaining > 0.000001 {
			line.reserved = remaining
			lines = append(lines, line)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(lines) == 0 {
		return nil, errors.New("no reserved quantity remains available for a new picking order")
	}

	date := time.Now().UTC()
	var pickingNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'PICKING_ORDER',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "PKO", date)).Scan(&pickingNo); err != nil {
		return nil, err
	}
	var pickingID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.picking_orders(document_no,entity_id,site_id,warehouse_id,sales_order_id,status,created_by)
        VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'OPEN',$6::uuid) RETURNING id::text`, pickingNo, rs.EntityID, siteID, warehouseID, salesOrderID, rs.UserID).Scan(&pickingID); err != nil {
		return nil, err
	}
	for idx, line := range lines {
		if _, err := tx.Exec(ctx, `INSERT INTO erp.picking_order_lines(picking_order_id,sales_order_line_id,line_no,item_id,requested_qty)
            VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5)`, pickingID, line.soLineID, idx+1, line.itemID, line.reserved); err != nil {
			return nil, err
		}
	}
	body := map[string]any{"id": pickingID, "documentNo": pickingNo, "salesOrderId": salesOrderID, "salesOrderNo": salesOrderNo, "status": "OPEN", "lineCount": len(lines)}
	audit(ctx, tx, rs, requestID, "warehouse", "create", "picking_order", pickingID, body)
	outbox(ctx, tx, rs, "picking_order", pickingID, "picking_order.created", body)
	return body, nil
}

func (s Service) UpdatePickingOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, pickingID string, input UpdatePickingInput, requestID string) (map[string]any, error) {
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.picking_orders
        WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('OPEN','IN_PROGRESS') FOR UPDATE`, pickingID, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("open picking order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("picking order is outside current site scope")
	}
	rs.SiteID = siteID
	if len(input.Lines) == 0 {
		return nil, errors.New("picking update requires at least one line")
	}

	if err := applyPickingLineUpdates(ctx, tx, pickingID, input.Lines); err != nil {
		return nil, err
	}
	var anyPicked bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.picking_order_lines WHERE picking_order_id=$1::uuid AND picked_qty>0)`, pickingID).Scan(&anyPicked); err != nil {
		return nil, err
	}
	next := "OPEN"
	if anyPicked {
		next = "IN_PROGRESS"
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.picking_orders SET status=$2::varchar(30),picker_user_id=$3::uuid,
        started_at=CASE WHEN $2::varchar(30)='IN_PROGRESS' THEN COALESCE(started_at,now()) ELSE started_at END,updated_at=now() WHERE id=$1::uuid`, pickingID, next, rs.UserID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": pickingID, "documentNo": documentNo, "status": next}
	audit(ctx, tx, rs, requestID, "warehouse", "update", "picking_order", pickingID, body)
	outbox(ctx, tx, rs, "picking_order", pickingID, "picking_order.updated", body)
	return body, nil
}

func applyPickingLineUpdates(ctx context.Context, tx pgx.Tx, pickingID string, lines []UpdatePickingLineInput) error {
	for _, line := range lines {
		if strings.TrimSpace(line.ID) == "" || line.PickedQty < 0 {
			return errors.New("invalid picking line update")
		}
		var requested float64
		if err := tx.QueryRow(ctx, `SELECT requested_qty::float8 FROM erp.picking_order_lines
            WHERE id=$1::uuid AND picking_order_id=$2::uuid FOR UPDATE`, line.ID, pickingID).Scan(&requested); err != nil {
			return errors.New("picking line not found")
		}
		if line.PickedQty > requested+0.000001 {
			return fmt.Errorf("picked quantity exceeds requested quantity for line %s", line.ID)
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.picking_order_lines SET picked_qty=$2,shortage_qty=GREATEST(requested_qty-$2,0),location_code=$3,lot_no=$4,updated_at=now()
            WHERE id=$1::uuid`, line.ID, line.PickedQty, strings.TrimSpace(line.Location), strings.TrimSpace(line.LotNo)); err != nil {
			return err
		}
	}
	return nil
}

func (s Service) CompletePickingOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, pickingID string, input UpdatePickingInput, requestID string) (map[string]any, error) {
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.picking_orders
        WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('OPEN','IN_PROGRESS') FOR UPDATE`, pickingID, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("open picking order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("picking order is outside current site scope")
	}
	rs.SiteID = siteID
	if len(input.Lines) > 0 {
		if err := applyPickingLineUpdates(ctx, tx, pickingID, input.Lines); err != nil {
			return nil, err
		}
	}
	var picked float64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(sum(picked_qty),0)::float8 FROM erp.picking_order_lines WHERE picking_order_id=$1::uuid`, pickingID).Scan(&picked); err != nil {
		return nil, err
	}
	if picked <= 0.000001 {
		return nil, errors.New("cannot complete picking without picked quantity")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.picking_order_lines SET shortage_qty=GREATEST(requested_qty-picked_qty,0),updated_at=now() WHERE picking_order_id=$1::uuid`, pickingID); err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.picking_orders SET status='COMPLETED',picker_user_id=COALESCE(picker_user_id,$2::uuid),started_at=COALESCE(started_at,now()),completed_at=now(),updated_at=now() WHERE id=$1::uuid`, pickingID, rs.UserID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": pickingID, "documentNo": documentNo, "status": "COMPLETED", "pickedQty": picked}
	audit(ctx, tx, rs, requestID, "warehouse", "complete", "picking_order", pickingID, body)
	outbox(ctx, tx, rs, "picking_order", pickingID, "picking_order.completed", body)
	return body, nil
}

func (s Service) CancelPickingOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, pickingID, reason, requestID string) (map[string]any, error) {
	if strings.TrimSpace(reason) == "" {
		return nil, errors.New("cancel reason is required")
	}
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.picking_orders
        WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('OPEN','IN_PROGRESS','COMPLETED') FOR UPDATE`, pickingID, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("active picking order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("picking order is outside current site scope")
	}
	rs.SiteID = siteID
	var activeDelivery bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.delivery_orders WHERE picking_order_id=$1::uuid AND status<>'CANCELLED')`, pickingID).Scan(&activeDelivery); err != nil {
		return nil, err
	}
	if activeDelivery {
		return nil, errors.New("cancel active Delivery Orders before cancelling the Picking Order")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.picking_orders SET status='CANCELLED',cancel_reason=$2,cancelled_at=now(),updated_at=now() WHERE id=$1::uuid`, pickingID, strings.TrimSpace(reason)); err != nil {
		return nil, err
	}
	body := map[string]any{"id": pickingID, "documentNo": documentNo, "status": "CANCELLED", "reason": strings.TrimSpace(reason)}
	audit(ctx, tx, rs, requestID, "warehouse", "cancel", "picking_order", pickingID, body)
	outbox(ctx, tx, rs, "picking_order", pickingID, "picking_order.cancelled", body)
	return body, nil
}
