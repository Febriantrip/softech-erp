package coretx

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	financecore "github.com/nexa-distributor/erp-backend/internal/domain/finance"
)

type CreateShipmentInput struct {
	ScheduledAt string                    `json:"scheduledAt"`
	Carrier     string                    `json:"carrier"`
	Vehicle     string                    `json:"vehicle"`
	Driver      string                    `json:"driver"`
	Route       string                    `json:"route"`
	TrackingNo  string                    `json:"trackingNo"`
	ReferenceNo string                    `json:"referenceNo"`
	Notes       string                    `json:"notes"`
	Lines       []CreateShipmentLineInput `json:"lines"`
}

type CreateShipmentLineInput struct {
	DeliveryLineID string  `json:"deliveryLineId"`
	Qty            float64 `json:"qty"`
}

type UpdateShipmentInput struct {
	ScheduledAt string `json:"scheduledAt"`
	Carrier     string `json:"carrier"`
	Vehicle     string `json:"vehicle"`
	Driver      string `json:"driver"`
	Route       string `json:"route"`
	TrackingNo  string `json:"trackingNo"`
	ReferenceNo string `json:"referenceNo"`
	Notes       string `json:"notes"`
}

type DeliverShipmentInput struct {
	Recipient  string `json:"recipient"`
	ReceivedAt string `json:"receivedAt"`
	Reference  string `json:"reference"`
	Notes      string `json:"notes"`
}

func parseOptionalTimestamp(value string) (*time.Time, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	for _, layout := range []string{time.RFC3339, "2006-01-02T15:04", "2006-01-02 15:04:05", "2006-01-02"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			parsed = parsed.UTC()
			return &parsed, nil
		}
	}
	return nil, errors.New("invalid date/time format")
}

func (s Service) CreateShipment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, deliveryID string, input CreateShipmentInput, requestID string) (map[string]any, error) {
	var doNo, siteID, warehouseID, salesOrderID, salesOrderNo, entityID string
	if err := tx.QueryRow(ctx, `SELECT d.document_no,d.site_id::text,d.warehouse_id::text,d.sales_order_id::text,so.document_no,d.entity_id::text
        FROM erp.delivery_orders d JOIN erp.sales_orders so ON so.id=d.sales_order_id
        WHERE d.id=$1::uuid AND d.entity_id=$2::uuid AND d.status='LOADED' FOR UPDATE`, deliveryID, rs.EntityID).
		Scan(&doNo, &siteID, &warehouseID, &salesOrderID, &salesOrderNo, &entityID); err != nil {
		return nil, errors.New("loaded Delivery Order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Delivery Order is outside current site scope")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}

	type candidate struct {
		id, soLineID, itemID, location, lot string
		lineNo                              int
		deliveryQty, allocated, remaining   float64
	}
	rows, err := tx.Query(ctx, `SELECT dl.id::text,dl.sales_order_line_id::text,dl.item_id::text,dl.line_no,dl.qty::float8,
        COALESCE((SELECT sum(sl.qty) FROM erp.shipment_lines sl JOIN erp.shipments sh ON sh.id=sl.shipment_id WHERE sl.delivery_order_line_id=dl.id AND sh.status<>'CANCELLED'),0)::float8,
        COALESCE(dl.location_code,''),COALESCE(dl.lot_no,'')
        FROM erp.delivery_order_lines dl WHERE dl.delivery_order_id=$1::uuid ORDER BY dl.line_no FOR UPDATE OF dl`, deliveryID)
	if err != nil {
		return nil, err
	}
	var candidates []candidate
	for rows.Next() {
		var c candidate
		if err := rows.Scan(&c.id, &c.soLineID, &c.itemID, &c.lineNo, &c.deliveryQty, &c.allocated, &c.location, &c.lot); err != nil {
			rows.Close()
			return nil, err
		}
		c.remaining = c.deliveryQty - c.allocated
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
		return nil, errors.New("no loaded Delivery Order quantity remains available for Shipment")
	}

	hasRequested := len(input.Lines) > 0
	requested := map[string]float64{}
	if hasRequested {
		for _, line := range input.Lines {
			id := strings.TrimSpace(line.DeliveryLineID)
			if id == "" || line.Qty <= 0 {
				return nil, errors.New("shipment lines require deliveryLineId and qty > 0")
			}
			if _, exists := requested[id]; exists {
				return nil, errors.New("duplicate Delivery Order line in Shipment request")
			}
			requested[id] = line.Qty
		}
	}
	var selected []candidate
	for _, c := range candidates {
		qty := c.remaining
		if hasRequested {
			var ok bool
			qty, ok = requested[c.id]
			if !ok {
				continue
			}
		}
		if qty > c.remaining+0.000001 {
			return nil, fmt.Errorf("shipment qty %.3f exceeds available loaded qty %.3f", qty, c.remaining)
		}
		if qty <= 0.000001 {
			continue
		}
		c.remaining = qty
		selected = append(selected, c)
		delete(requested, c.id)
	}
	if len(requested) > 0 {
		return nil, errors.New("one or more Delivery Order lines are unavailable for Shipment")
	}
	if len(selected) == 0 {
		return nil, errors.New("at least one Shipment line is required")
	}

	scheduledAt, err := parseOptionalTimestamp(input.ScheduledAt)
	if err != nil {
		return nil, err
	}
	date := time.Now().UTC()
	var shipmentNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'SHIPMENT',$3,$4,$5,6)`, entityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "SHP", date)).Scan(&shipmentNo); err != nil {
		return nil, err
	}
	var shipmentID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.shipments(document_no,entity_id,site_id,warehouse_id,sales_order_id,delivery_order_id,status,scheduled_at,carrier,vehicle,driver,route,tracking_no,reference_no,notes,created_by,updated_at)
        VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,'PLANNED',$7,$8,$9,$10,$11,$12,$13,$14,$15::uuid,now()) RETURNING id::text`,
		shipmentNo, entityID, siteID, warehouseID, salesOrderID, deliveryID, scheduledAt,
		nilIfBlank(input.Carrier), nilIfBlank(input.Vehicle), nilIfBlank(input.Driver), nilIfBlank(input.Route), nilIfBlank(input.TrackingNo), nilIfBlank(input.ReferenceNo), nilIfBlank(input.Notes), rs.UserID).Scan(&shipmentID); err != nil {
		return nil, err
	}
	for idx, line := range selected {
		if _, err := tx.Exec(ctx, `INSERT INTO erp.shipment_lines(shipment_id,line_no,item_id,qty,unit_cost,delivery_order_line_id,sales_order_line_id,location_code,lot_no)
            VALUES($1::uuid,$2,$3::uuid,$4,0,$5::uuid,$6::uuid,$7,$8)`, shipmentID, idx+1, line.itemID, line.remaining, line.id, line.soLineID, nilIfBlank(line.location), nilIfBlank(line.lot)); err != nil {
			return nil, err
		}
	}
	body := map[string]any{"id": shipmentID, "documentNo": shipmentNo, "deliveryOrderId": deliveryID, "deliveryOrderNo": doNo, "salesOrderId": salesOrderID, "salesOrderNo": salesOrderNo, "status": "PLANNED"}
	audit(ctx, tx, rs, requestID, "warehouse", "create", "shipment", shipmentID, body)
	outbox(ctx, tx, rs, "shipment", shipmentID, "shipment.created", body)
	return body, nil
}

func nilIfBlank(value string) any {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func (s Service) UpdateShipment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string, input UpdateShipmentInput, requestID string) (map[string]any, error) {
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.shipments WHERE id=$1::uuid AND entity_id=$2::uuid AND status='PLANNED' FOR UPDATE`, id, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("planned Shipment not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Shipment is outside current site scope")
	}
	rs.SiteID = siteID
	scheduledAt, err := parseOptionalTimestamp(input.ScheduledAt)
	if err != nil {
		return nil, err
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.shipments SET scheduled_at=$2,carrier=$3,vehicle=$4,driver=$5,route=$6,tracking_no=$7,reference_no=$8,notes=$9,updated_at=now() WHERE id=$1::uuid`,
		id, scheduledAt, nilIfBlank(input.Carrier), nilIfBlank(input.Vehicle), nilIfBlank(input.Driver), nilIfBlank(input.Route), nilIfBlank(input.TrackingNo), nilIfBlank(input.ReferenceNo), nilIfBlank(input.Notes)); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": "PLANNED"}
	audit(ctx, tx, rs, requestID, "warehouse", "update", "shipment", id, body)
	return body, nil
}

func (s Service) DispatchShipment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, requestID string) (map[string]any, error) {
	var documentNo, siteID, warehouseID, salesOrderID, salesOrderNo, entityID, deliveryID, vehicle, driver string
	if err := tx.QueryRow(ctx, `SELECT sh.document_no,sh.site_id::text,sh.warehouse_id::text,sh.sales_order_id::text,so.document_no,sh.entity_id::text,COALESCE(sh.delivery_order_id::text,''),COALESCE(sh.vehicle,''),COALESCE(sh.driver,'')
        FROM erp.shipments sh JOIN erp.sales_orders so ON so.id=sh.sales_order_id
        WHERE sh.id=$1::uuid AND sh.entity_id=$2::uuid AND sh.status='PLANNED' FOR UPDATE`, id, rs.EntityID).
		Scan(&documentNo, &siteID, &warehouseID, &salesOrderID, &salesOrderNo, &entityID, &deliveryID, &vehicle, &driver); err != nil {
		return nil, errors.New("planned Shipment not found or already dispatched")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Shipment is outside current site scope")
	}
	if deliveryID != "" {
		var doStatus string
		if err := tx.QueryRow(ctx, `SELECT status FROM erp.delivery_orders WHERE id=$1::uuid FOR UPDATE`, deliveryID).Scan(&doStatus); err != nil || doStatus != "LOADED" {
			return nil, errors.New("source Delivery Order must remain LOADED before dispatch")
		}
	}
	if strings.TrimSpace(vehicle) == "" || strings.TrimSpace(driver) == "" {
		return nil, errors.New("vehicle and driver are required before dispatch")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}

	type lineRow struct {
		shipmentLineID, soLineID, itemID, sku string
		qty                                   float64
	}
	rows, err := tx.Query(ctx, `SELECT sl.id::text,COALESCE(sl.sales_order_line_id::text,''),sl.item_id::text,i.sku,sl.qty::float8
        FROM erp.shipment_lines sl JOIN erp.items i ON i.id=sl.item_id WHERE sl.shipment_id=$1::uuid ORDER BY sl.line_no`, id)
	if err != nil {
		return nil, err
	}
	var lines []lineRow
	for rows.Next() {
		var line lineRow
		if err := rows.Scan(&line.shipmentLineID, &line.soLineID, &line.itemID, &line.sku, &line.qty); err != nil {
			rows.Close()
			return nil, err
		}
		if line.soLineID == "" {
			rows.Close()
			return nil, errors.New("legacy Shipment cannot use D3-C dispatch workflow")
		}
		lines = append(lines, line)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()
	if len(lines) == 0 {
		return nil, errors.New("Shipment has no lines")
	}

	totalCOGS := 0.0
	for _, line := range lines {
		var ordered, shipped, lineReserved float64
		if err := tx.QueryRow(ctx, `SELECT qty::float8,shipped_qty::float8,reserved_qty::float8 FROM erp.sales_order_lines WHERE id=$1::uuid AND sales_order_id=$2::uuid FOR UPDATE`, line.soLineID, salesOrderID).Scan(&ordered, &shipped, &lineReserved); err != nil {
			return nil, fmt.Errorf("sales order line missing for %s", line.sku)
		}
		if shipped+line.qty > ordered+0.000001 {
			return nil, fmt.Errorf("shipment would over-ship %s", line.sku)
		}
		if lineReserved+0.000001 < line.qty {
			return nil, fmt.Errorf("sales order reservation changed for %s", line.sku)
		}
		var onHand, reserved, cost float64
		var version int64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8,reserved_qty::float8,average_cost::float8,row_version FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, warehouseID, line.itemID).Scan(&onHand, &reserved, &cost, &version); err != nil {
			return nil, fmt.Errorf("inventory missing for %s", line.sku)
		}
		if onHand+0.000001 < line.qty || reserved+0.000001 < line.qty {
			return nil, fmt.Errorf("stock/reservation changed for %s", line.sku)
		}
		balanceAfter := onHand - line.qty
		value := line.qty * cost
		totalCOGS += value
		cmd, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET on_hand_qty=on_hand_qty-$3,reserved_qty=reserved_qty-$3,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid AND row_version=$4`, warehouseID, line.itemID, line.qty, version)
		if err != nil {
			return nil, err
		}
		if cmd.RowsAffected() != 1 {
			return nil, fmt.Errorf("inventory changed concurrently for %s", line.sku)
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.sales_order_lines SET shipped_qty=shipped_qty+$2,reserved_qty=GREATEST(reserved_qty-$2,0) WHERE id=$1::uuid`, line.soLineID, line.qty); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.shipment_lines SET unit_cost=$2 WHERE id=$1::uuid`, line.shipmentLineID, cost); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id)
            VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'SHIPMENT_OUT',$5,$6,$7,$8,'SHIPMENT',$9,$10)`, entityID, siteID, warehouseID, line.itemID, -line.qty, cost, -value, balanceAfter, documentNo, requestID); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.shipments SET status='DISPATCHED',dispatched_at=now(),updated_at=now() WHERE id=$1::uuid`, id); err != nil {
		return nil, err
	}
	var orderedTotal, shippedTotal float64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(sum(qty),0)::float8,COALESCE(sum(shipped_qty),0)::float8 FROM erp.sales_order_lines WHERE sales_order_id=$1::uuid`, salesOrderID).Scan(&orderedTotal, &shippedTotal); err != nil {
		return nil, err
	}
	soStatus := "PARTIALLY_SHIPPED"
	if shippedTotal+0.000001 >= orderedTotal {
		soStatus = "SHIPPED"
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.sales_orders SET status=$2::varchar(30),updated_at=now() WHERE id=$1::uuid`, salesOrderID, soStatus); err != nil {
		return nil, err
	}
	date := time.Now().UTC()
	journalID, journalNo, err := financecore.PostInventoryIssue(ctx, tx, financecore.InventoryIssue{
		EntityID: entityID, SiteID: siteID, UserID: rs.UserID, EntityCode: rs.EntityCode, SiteCode: rs.SiteCode,
		PostingDate: date, ShipmentID: id, ShipmentNo: documentNo, Amount: math.Round(totalCOGS*100) / 100,
	}, requestID)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "salesOrderId": salesOrderID, "salesOrderNo": salesOrderNo, "status": "DISPATCHED", "salesOrderStatus": soStatus, "cogsAmount": math.Round(totalCOGS*100) / 100, "cogsJournalId": journalID, "cogsJournalNo": journalNo}
	audit(ctx, tx, rs, requestID, "warehouse", "dispatch", "shipment", id, body)
	outbox(ctx, tx, rs, "shipment", id, "shipment.dispatched", body)
	return body, nil
}

func (s Service) DeliverShipment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id string, input DeliverShipmentInput, requestID string) (map[string]any, error) {
	recipient := strings.TrimSpace(input.Recipient)
	reference := strings.TrimSpace(input.Reference)
	if recipient == "" {
		return nil, errors.New("POD recipient is required")
	}
	if reference == "" {
		return nil, errors.New("POD reference is required")
	}
	receivedAt, err := parseOptionalTimestamp(input.ReceivedAt)
	if err != nil {
		return nil, err
	}
	if receivedAt == nil {
		now := time.Now().UTC()
		receivedAt = &now
	}
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.shipments WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DISPATCHED' FOR UPDATE`, id, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("dispatched Shipment not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Shipment is outside current site scope")
	}
	rs.SiteID = siteID
	if _, err := tx.Exec(ctx, `UPDATE erp.shipments SET status='DELIVERED',delivered_at=now(),pod_recipient=$2,pod_received_at=$3,pod_reference=$4,pod_notes=$5,updated_at=now() WHERE id=$1::uuid`, id, recipient, receivedAt, reference, nilIfBlank(input.Notes)); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": "DELIVERED", "podRecipient": recipient, "podReference": reference, "podReceivedAt": receivedAt.Format(time.RFC3339)}
	audit(ctx, tx, rs, requestID, "warehouse", "deliver", "shipment", id, body)
	outbox(ctx, tx, rs, "shipment", id, "shipment.delivered", body)
	return body, nil
}

func (s Service) CancelShipment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, reason, requestID string) (map[string]any, error) {
	reason = strings.TrimSpace(reason)
	if reason == "" {
		return nil, errors.New("cancel reason is required")
	}
	var documentNo, siteID string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text FROM erp.shipments WHERE id=$1::uuid AND entity_id=$2::uuid AND status='PLANNED' FOR UPDATE`, id, rs.EntityID).Scan(&documentNo, &siteID); err != nil {
		return nil, errors.New("only PLANNED Shipment can be cancelled")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("Shipment is outside current site scope")
	}
	rs.SiteID = siteID
	if _, err := tx.Exec(ctx, `UPDATE erp.shipments SET status='CANCELLED',cancel_reason=$2,cancelled_at=now(),updated_at=now() WHERE id=$1::uuid`, id, reason); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": documentNo, "status": "CANCELLED", "reason": reason}
	audit(ctx, tx, rs, requestID, "warehouse", "cancel", "shipment", id, body)
	outbox(ctx, tx, rs, "shipment", id, "shipment.cancelled", body)
	return body, nil
}
