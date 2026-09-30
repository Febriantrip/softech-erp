package coretx

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

type CreateDeliveryOrderInput struct {
	DeliveryDate    string                    `json:"deliveryDate"`
	ShippingAddress string                    `json:"shippingAddress"`
	Carrier         string                    `json:"carrier"`
	Vehicle         string                    `json:"vehicle"`
	Driver          string                    `json:"driver"`
	Dock            string                    `json:"dock"`
	Notes           string                    `json:"notes"`
	Lines           []CreateDeliveryLineInput `json:"lines"`
}

type CreateDeliveryLineInput struct {
	PickingLineID string  `json:"pickingLineId"`
	Qty           float64 `json:"qty"`
}

type UpdateDeliveryOrderInput struct {
	DeliveryDate    string `json:"deliveryDate"`
	ShippingAddress string `json:"shippingAddress"`
	Carrier         string `json:"carrier"`
	Vehicle         string `json:"vehicle"`
	Driver          string `json:"driver"`
	Dock            string `json:"dock"`
	Notes           string `json:"notes"`
}

func (s Service) ListDeliveryOrders(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT d.id::text,d.document_no,d.status,d.delivery_date::text,d.created_at::text,
        so.id::text,so.document_no,p.id::text,p.document_no,c.code,c.name,w.code,w.name,st.code,
        COALESCE(d.carrier,''),COALESCE(d.vehicle,''),COALESCE(d.driver,''),COALESCE(sum(dl.qty),0)::float8,count(dl.id)::int,
        COALESCE((SELECT sum(sl.qty) FROM erp.shipment_lines sl JOIN erp.shipments sh ON sh.id=sl.shipment_id WHERE sh.delivery_order_id=d.id AND sh.status<>'CANCELLED'),0)::float8
        FROM erp.delivery_orders d
        JOIN erp.sales_orders so ON so.id=d.sales_order_id
        JOIN erp.picking_orders p ON p.id=d.picking_order_id
        JOIN erp.entities e ON e.id=d.entity_id
        JOIN erp.sites st ON st.id=d.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=d.warehouse_id
        LEFT JOIN erp.delivery_order_lines dl ON dl.delivery_order_id=d.id
        WHERE e.code=$1`
	args := []any{entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY d.id,so.id,so.document_no,p.id,p.document_no,c.code,c.name,w.code,w.name,st.code ORDER BY d.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{
		"id", "documentNo", "status", "deliveryDate", "createdAt", "salesOrderId", "salesOrderNo", "pickingOrderId", "pickingOrderNo",
		"customerCode", "customerName", "warehouseCode", "warehouseName", "siteCode", "carrier", "vehicle", "driver", "qty", "lineCount", "shipmentAllocatedQty",
	}, args...)
}

func (s Service) DeliveryOrderDetail(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT d.id::text,d.document_no,d.status,d.delivery_date::text,d.created_at::text,
        COALESCE(d.shipping_address,''),COALESCE(d.carrier,''),COALESCE(d.vehicle,''),COALESCE(d.driver,''),COALESCE(d.dock,''),COALESCE(d.notes,''),
        COALESCE(d.released_at::text,''),COALESCE(d.loading_started_at::text,''),COALESCE(d.loaded_at::text,''),COALESCE(d.cancel_reason,''),
        so.id::text,so.document_no,so.status,p.id::text,p.document_no,p.status,c.code,c.name,w.code,w.name,st.code,st.name,e.code,e.legal_name,COALESCE(e.tax_id,'')
        FROM erp.delivery_orders d
        JOIN erp.sales_orders so ON so.id=d.sales_order_id
        JOIN erp.picking_orders p ON p.id=d.picking_order_id
        JOIN erp.entities e ON e.id=d.entity_id
        JOIN erp.sites st ON st.id=d.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=d.warehouse_id
        WHERE d.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var h struct {
		id, documentNo, status, deliveryDate, createdAt          string
		shippingAddress, carrier, vehicle, driver, dock, notes   string
		releasedAt, loadingStartedAt, loadedAt, cancelReason     string
		salesOrderID, salesOrderNo, salesOrderStatus             string
		pickingID, pickingNo, pickingStatus                      string
		customerCode, customerName, warehouseCode, warehouseName string
		siteCode, siteName, entityCode, entityName, entityTaxID  string
	}
	if err := s.DB.QueryRow(ctx, q, args...).Scan(
		&h.id, &h.documentNo, &h.status, &h.deliveryDate, &h.createdAt,
		&h.shippingAddress, &h.carrier, &h.vehicle, &h.driver, &h.dock, &h.notes,
		&h.releasedAt, &h.loadingStartedAt, &h.loadedAt, &h.cancelReason,
		&h.salesOrderID, &h.salesOrderNo, &h.salesOrderStatus, &h.pickingID, &h.pickingNo, &h.pickingStatus,
		&h.customerCode, &h.customerName, &h.warehouseCode, &h.warehouseName,
		&h.siteCode, &h.siteName, &h.entityCode, &h.entityName, &h.entityTaxID,
	); err != nil {
		return nil, errors.New("delivery order not found in current scope")
	}
	lines, err := queryRows(s.DB, ctx, `SELECT dl.id::text,dl.line_no,dl.picking_order_line_id::text,dl.sales_order_line_id::text,
        i.sku,i.name,COALESCE(sol.uom,i.base_uom),dl.qty::float8,COALESCE(dl.location_code,''),COALESCE(dl.lot_no,''),
        COALESCE((SELECT sum(sl.qty) FROM erp.shipment_lines sl JOIN erp.shipments sh ON sh.id=sl.shipment_id WHERE sl.delivery_order_line_id=dl.id AND sh.status<>'CANCELLED'),0)::float8,
        GREATEST(dl.qty-COALESCE((SELECT sum(sl.qty) FROM erp.shipment_lines sl JOIN erp.shipments sh ON sh.id=sl.shipment_id WHERE sl.delivery_order_line_id=dl.id AND sh.status<>'CANCELLED'),0),0)::float8
        FROM erp.delivery_order_lines dl
        JOIN erp.items i ON i.id=dl.item_id
        JOIN erp.sales_order_lines sol ON sol.id=dl.sales_order_line_id
        WHERE dl.delivery_order_id=$1::uuid ORDER BY dl.line_no`, []string{
		"id", "lineNo", "pickingLineId", "salesOrderLineId", "sku", "itemName", "uom", "qty", "location", "lotNo", "shipmentAllocatedQty", "availableForShipmentQty",
	}, id)
	if err != nil {
		return nil, err
	}
	return map[string]any{
		"id": h.id, "documentNo": h.documentNo, "status": h.status, "deliveryDate": h.deliveryDate, "createdAt": h.createdAt,
		"shippingAddress": h.shippingAddress, "carrier": h.carrier, "vehicle": h.vehicle, "driver": h.driver, "dock": h.dock, "notes": h.notes,
		"releasedAt": h.releasedAt, "loadingStartedAt": h.loadingStartedAt, "loadedAt": h.loadedAt, "cancelReason": h.cancelReason,
		"salesOrder":   map[string]any{"id": h.salesOrderID, "documentNo": h.salesOrderNo, "status": h.salesOrderStatus},
		"pickingOrder": map[string]any{"id": h.pickingID, "documentNo": h.pickingNo, "status": h.pickingStatus},
		"customer":     map[string]any{"code": h.customerCode, "name": h.customerName},
		"warehouse":    map[string]any{"code": h.warehouseCode, "name": h.warehouseName},
		"company":      map[string]any{"code": h.entityCode, "legalName": h.entityName, "taxId": h.entityTaxID},
		"site":         map[string]any{"code": h.siteCode, "name": h.siteName},
		"entityCode":   h.entityCode, "siteCode": h.siteCode, "lines": lines,
	}, nil
}

func (s Service) CreateDeliveryOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, pickingID string, input CreateDeliveryOrderInput, requestID string) (map[string]any, error) {
	var documentNo, siteID, warehouseID, salesOrderID, salesOrderNo, requestedDate, shippingAddress string
	if err := tx.QueryRow(ctx, `SELECT p.document_no,p.site_id::text,p.warehouse_id::text,p.sales_order_id::text,so.document_no,
        COALESCE(so.requested_delivery_date::text,''),COALESCE(so.shipping_address,'')
        FROM erp.picking_orders p JOIN erp.sales_orders so ON so.id=p.sales_order_id
        WHERE p.id=$1::uuid AND p.entity_id=$2::uuid AND p.status='COMPLETED' FOR UPDATE`, pickingID, rs.EntityID).
		Scan(&documentNo, &siteID, &warehouseID, &salesOrderID, &salesOrderNo, &requestedDate, &shippingAddress); err != nil {
		return nil, errors.New("completed picking order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("picking order is outside current site scope")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}

	type candidate struct {
		id, soLineID, itemID, location, lot string
		lineNo                              int
		picked, allocated, remaining        float64
	}
	rows, err := tx.Query(ctx, `SELECT pl.id::text,pl.sales_order_line_id::text,pl.item_id::text,pl.line_no,pl.picked_qty::float8,
        COALESCE((SELECT sum(dl.qty) FROM erp.delivery_order_lines dl JOIN erp.delivery_orders d ON d.id=dl.delivery_order_id WHERE dl.picking_order_line_id=pl.id AND d.status<>'CANCELLED'),0)::float8,
        COALESCE(pl.location_code,''),COALESCE(pl.lot_no,'')
        FROM erp.picking_order_lines pl WHERE pl.picking_order_id=$1::uuid ORDER BY pl.line_no FOR UPDATE OF pl`, pickingID)
	if err != nil {
		return nil, err
	}
	var candidates []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.soLineID, &c.itemID, &c.lineNo, &c.picked, &c.allocated, &c.location, &c.lot); err != nil {
			rows.Close()
			return nil, err
		}
		c.remaining = c.picked - c.allocated
		if c.remaining > 0.000001 {
			candidates = append(candidates, c)
		}
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	if len(candidates) == 0 {
		return nil, errors.New("no completed picked quantity remains available for Delivery Order")
	}

	hasRequestedLines := len(input.Lines) > 0
	requested := map[string]float64{}
	if hasRequestedLines {
		for _, line := range input.Lines {
			id := strings.TrimSpace(line.PickingLineID)
			if id == "" || line.Qty <= 0 {
				return nil, errors.New("delivery lines require pickingLineId and qty > 0")
			}
			if _, exists := requested[id]; exists {
				return nil, errors.New("duplicate picking line in Delivery Order request")
			}
			requested[id] = line.Qty
		}
	}
	var selected []candidate
	for _, c := range candidates {
		qty := c.remaining
		if hasRequestedLines {
			var ok bool
			qty, ok = requested[c.id]
			if !ok {
				continue
			}
		}
		if qty > c.remaining+0.000001 {
			return nil, fmt.Errorf("delivery qty %.3f exceeds available picked qty %.3f", qty, c.remaining)
		}
		if qty <= 0.000001 {
			continue
		}
		c.remaining = qty
		selected = append(selected, c)
		delete(requested, c.id)
	}
	if len(requested) > 0 {
		return nil, errors.New("one or more picking lines are unavailable for Delivery Order")
	}
	if len(selected) == 0 {
		return nil, errors.New("at least one Delivery Order line is required")
	}

	deliveryDate := strings.TrimSpace(input.DeliveryDate)
	if deliveryDate == "" {
		deliveryDate = requestedDate
	}
	if deliveryDate == "" {
		deliveryDate = time.Now().UTC().Format("2006-01-02")
	}
	if _, err := time.Parse("2006-01-02", deliveryDate); err != nil {
		return nil, errors.New("deliveryDate must use YYYY-MM-DD")
	}
	snapshotAddress := strings.TrimSpace(input.ShippingAddress)
	if snapshotAddress == "" {
		snapshotAddress = shippingAddress
	}

	now := time.Now().UTC()
	var deliveryNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'DELIVERY_ORDER',$3,$4,$5,6)`, rs.EntityID, siteID, now.Year(), int(now.Month()), prefix(rs.EntityCode, rs.SiteCode, "DO", now)).Scan(&deliveryNo); err != nil {
		return nil, err
	}
	var deliveryID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.delivery_orders(document_no,entity_id,site_id,warehouse_id,sales_order_id,picking_order_id,status,delivery_date,shipping_address,carrier,vehicle,driver,dock,notes,created_by)
        VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'DRAFT',$7::date,$8,$9,$10,$11,$12,$13,$14::uuid) RETURNING id::text`,
		deliveryNo, rs.EntityID, siteID, warehouseID, salesOrderID, pickingID, deliveryDate, snapshotAddress, strings.TrimSpace(input.Carrier), strings.TrimSpace(input.Vehicle), strings.TrimSpace(input.Driver), strings.TrimSpace(input.Dock), strings.TrimSpace(input.Notes), rs.UserID).Scan(&deliveryID); err != nil {
		return nil, err
	}
	total := 0.0
	for idx, c := range selected {
		total += c.remaining
		if _, err := tx.Exec(ctx, `INSERT INTO erp.delivery_order_lines(delivery_order_id,picking_order_line_id,sales_order_line_id,line_no,item_id,qty,location_code,lot_no)
            VALUES($1::uuid,$2::uuid,$3::uuid,$4,$5::uuid,$6,$7,$8)`, deliveryID, c.id, c.soLineID, idx+1, c.itemID, c.remaining, c.location, c.lot); err != nil {
			return nil, err
		}
	}
	body := map[string]any{"id": deliveryID, "documentNo": deliveryNo, "pickingOrderId": pickingID, "pickingOrderNo": documentNo, "salesOrderId": salesOrderID, "salesOrderNo": salesOrderNo, "status": "DRAFT", "qty": total}
	audit(ctx, tx, rs, requestID, "warehouse", "create", "delivery_order", deliveryID, body)
	outbox(ctx, tx, rs, "delivery_order", deliveryID, "delivery_order.created", body)
	return body, nil
}

func (s Service) UpdateDeliveryOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string, input UpdateDeliveryOrderInput, requestID string) (map[string]any, error) {
	var documentNo, siteID, currentDate string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text,delivery_date::text FROM erp.delivery_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('DRAFT','READY_TO_LOAD') FOR UPDATE`, id, rs.EntityID).Scan(&documentNo, &siteID, &currentDate); err != nil {
		return nil, errors.New("editable Delivery Order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Delivery Order is outside current site scope")
	}
	rs.SiteID = siteID
	date := strings.TrimSpace(input.DeliveryDate)
	if date == "" {
		date = currentDate
	}
	if _, err := time.Parse("2006-01-02", date); err != nil {
		return nil, errors.New("deliveryDate must use YYYY-MM-DD")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.delivery_orders SET delivery_date=$2::date,shipping_address=$3,carrier=$4,vehicle=$5,driver=$6,dock=$7,notes=$8,updated_at=now() WHERE id=$1::uuid`, id, date, strings.TrimSpace(input.ShippingAddress), strings.TrimSpace(input.Carrier), strings.TrimSpace(input.Vehicle), strings.TrimSpace(input.Driver), strings.TrimSpace(input.Dock), strings.TrimSpace(input.Notes)); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": "UPDATED"}
	audit(ctx, tx, rs, requestID, "warehouse", "edit", "delivery_order", id, body)
	outbox(ctx, tx, rs, "delivery_order", id, "delivery_order.updated", body)
	return body, nil
}

func (s Service) TransitionDeliveryOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, toStatus, requestID string) (map[string]any, error) {
	allowed := map[string]struct{ from, stamp string }{"READY_TO_LOAD": {"DRAFT", "released_at"}, "LOADING": {"READY_TO_LOAD", "loading_started_at"}, "LOADED": {"LOADING", "loaded_at"}}
	rule, ok := allowed[toStatus]
	if !ok {
		return nil, errors.New("invalid Delivery Order transition")
	}
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.delivery_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status=$3 FOR UPDATE`, id, rs.EntityID, rule.from).Scan(&documentNo, &siteID); err != nil {
		return nil, fmt.Errorf("Delivery Order must be %s before %s", rule.from, toStatus)
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Delivery Order is outside current site scope")
	}
	rs.SiteID = siteID
	if toStatus == "READY_TO_LOAD" {
		var address string
		if err := tx.QueryRow(ctx, `SELECT shipping_address FROM erp.delivery_orders WHERE id=$1::uuid`, id).Scan(&address); err != nil {
			return nil, err
		}
		if strings.TrimSpace(address) == "" {
			return nil, errors.New("shipping address is required before release to loading")
		}
	}
	query := fmt.Sprintf("UPDATE erp.delivery_orders SET status=$2::varchar(30),%s=now(),updated_at=now() WHERE id=$1::uuid", rule.stamp)
	if _, err := tx.Exec(ctx, query, id, toStatus); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": toStatus}
	audit(ctx, tx, rs, requestID, "warehouse", "status_change", "delivery_order", id, body)
	outbox(ctx, tx, rs, "delivery_order", id, "delivery_order."+strings.ToLower(toStatus), body)
	return body, nil
}

func (s Service) CancelDeliveryOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, reason, requestID string) (map[string]any, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("cancel reason is required")
	}
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.delivery_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('DRAFT','READY_TO_LOAD','LOADING','LOADED') FOR UPDATE`, id, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("active Delivery Order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Delivery Order is outside current site scope")
	}
	rs.SiteID = siteID
	var hasShipment bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.shipments WHERE delivery_order_id=$1::uuid AND status<>'CANCELLED')`, id).Scan(&hasShipment); err != nil {
		return nil, err
	}
	if hasShipment {
		return nil, errors.New("Delivery Order already has an active Shipment; cancel the planned Shipment first or continue the dispatch workflow")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.delivery_orders SET status='CANCELLED',cancel_reason=$2,cancelled_at=now(),updated_at=now() WHERE id=$1::uuid`, id, reason); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": "CANCELLED", "reason": reason}
	audit(ctx, tx, rs, requestID, "warehouse", "cancel", "delivery_order", id, body)
	outbox(ctx, tx, rs, "delivery_order", id, "delivery_order.cancelled", body)
	return body, nil
}
