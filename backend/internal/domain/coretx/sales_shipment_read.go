package coretx

import (
	"context"
	"errors"
	"strings"
)

func (s Service) ListShipments(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT sh.id::text,sh.document_no,sh.status,sh.created_at::text,COALESCE(sh.scheduled_at::text,''),COALESCE(sh.dispatched_at::text,''),COALESCE(sh.delivered_at::text,''),
        so.id::text,so.document_no,COALESCE(d.id::text,''),COALESCE(d.document_no,''),c.code,c.name,w.code,w.name,st.code,
        COALESCE(sh.carrier,''),COALESCE(sh.vehicle,''),COALESCE(sh.driver,''),COALESCE(sh.route,''),COALESCE(sh.tracking_no,''),
        COALESCE(sum(sl.qty),0)::float8,count(sl.id)::int
        FROM erp.shipments sh
        JOIN erp.sales_orders so ON so.id=sh.sales_order_id
        LEFT JOIN erp.delivery_orders d ON d.id=sh.delivery_order_id
        JOIN erp.entities e ON e.id=sh.entity_id
        JOIN erp.sites st ON st.id=sh.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=sh.warehouse_id
        LEFT JOIN erp.shipment_lines sl ON sl.shipment_id=sh.id
        WHERE e.code=$1`
	args := []any{entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY sh.id,so.id,so.document_no,d.id,d.document_no,c.code,c.name,w.code,w.name,st.code ORDER BY sh.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{
		"id", "documentNo", "status", "createdAt", "scheduledAt", "dispatchedAt", "deliveredAt",
		"salesOrderId", "salesOrderNo", "deliveryOrderId", "deliveryOrderNo", "customerCode", "customerName",
		"warehouseCode", "warehouseName", "siteCode", "carrier", "vehicle", "driver", "route", "trackingNo", "qty", "lineCount",
	}, args...)
}

func (s Service) ShipmentDetail(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	q := `SELECT sh.id::text,sh.document_no,sh.status,sh.created_at::text,COALESCE(sh.scheduled_at::text,''),COALESCE(sh.dispatched_at::text,''),COALESCE(sh.delivered_at::text,''),
        COALESCE(sh.carrier,''),COALESCE(sh.vehicle,''),COALESCE(sh.driver,''),COALESCE(sh.route,''),COALESCE(sh.tracking_no,''),COALESCE(sh.reference_no,''),COALESCE(sh.notes,''),
        COALESCE(sh.pod_recipient,''),COALESCE(sh.pod_received_at::text,''),COALESCE(sh.pod_reference,''),COALESCE(sh.pod_notes,''),COALESCE(sh.cancel_reason,''),
        so.id::text,so.document_no,so.status,COALESCE(d.id::text,''),COALESCE(d.document_no,''),COALESCE(d.status,''),
        c.code,c.name,w.code,w.name,st.code,st.name,e.code,e.legal_name,COALESCE(e.tax_id,'')
        FROM erp.shipments sh
        JOIN erp.sales_orders so ON so.id=sh.sales_order_id
        LEFT JOIN erp.delivery_orders d ON d.id=sh.delivery_order_id
        JOIN erp.entities e ON e.id=sh.entity_id
        JOIN erp.sites st ON st.id=sh.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=sh.warehouse_id
        WHERE sh.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if strings.TrimSpace(siteCode) != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	var h struct {
		id, documentNo, status, createdAt, scheduledAt, dispatchedAt, deliveredAt string
		carrier, vehicle, driver, route, trackingNo, referenceNo, notes           string
		podRecipient, podReceivedAt, podReference, podNotes, cancelReason         string
		soID, soNo, soStatus, doID, doNo, doStatus                                string
		customerCode, customerName, warehouseCode, warehouseName                  string
		siteCode, siteName, entityCode, entityName, entityTaxID                   string
	}
	if err := s.DB.QueryRow(ctx, q, args...).Scan(
		&h.id, &h.documentNo, &h.status, &h.createdAt, &h.scheduledAt, &h.dispatchedAt, &h.deliveredAt,
		&h.carrier, &h.vehicle, &h.driver, &h.route, &h.trackingNo, &h.referenceNo, &h.notes,
		&h.podRecipient, &h.podReceivedAt, &h.podReference, &h.podNotes, &h.cancelReason,
		&h.soID, &h.soNo, &h.soStatus, &h.doID, &h.doNo, &h.doStatus,
		&h.customerCode, &h.customerName, &h.warehouseCode, &h.warehouseName,
		&h.siteCode, &h.siteName, &h.entityCode, &h.entityName, &h.entityTaxID,
	); err != nil {
		return nil, errors.New("shipment not found in current scope")
	}
	lines, err := queryRows(s.DB, ctx, `SELECT sl.id::text,sl.line_no,COALESCE(sl.delivery_order_line_id::text,''),COALESCE(sl.sales_order_line_id::text,''),
        i.sku,i.name,COALESCE(sol.uom,i.base_uom),sl.qty::float8,sl.unit_cost::float8,(sl.qty*sl.unit_cost)::float8,
        COALESCE(sl.location_code,''),COALESCE(sl.lot_no,'')
        FROM erp.shipment_lines sl
        JOIN erp.items i ON i.id=sl.item_id
        LEFT JOIN erp.sales_order_lines sol ON sol.id=sl.sales_order_line_id
        WHERE sl.shipment_id=$1::uuid ORDER BY sl.line_no`, []string{
		"id", "lineNo", "deliveryLineId", "salesOrderLineId", "sku", "itemName", "uom", "qty", "unitCost", "cogs", "location", "lotNo",
	}, id)
	if err != nil {
		return nil, err
	}
	journal, _ := queryRows(s.DB, ctx, `SELECT id::text,document_no,status,posting_date::text
        FROM erp.journal_entries
        WHERE entity_id=(SELECT entity_id FROM erp.shipments WHERE id=$1::uuid)
          AND source_type='INVENTORY_ISSUE' AND reference_type='SHIPMENT'
          AND reference_id=(SELECT document_no FROM erp.shipments WHERE id=$1::uuid)
          AND status<>'VOID'
        ORDER BY created_at DESC LIMIT 1`, []string{"id", "documentNo", "status", "postingDate"}, id)
	var journalRow any
	if len(journal) > 0 {
		journalRow = journal[0]
	}
	return map[string]any{
		"id": h.id, "documentNo": h.documentNo, "status": h.status, "createdAt": h.createdAt,
		"scheduledAt": h.scheduledAt, "dispatchedAt": h.dispatchedAt, "deliveredAt": h.deliveredAt,
		"carrier": h.carrier, "vehicle": h.vehicle, "driver": h.driver, "route": h.route, "trackingNo": h.trackingNo,
		"referenceNo": h.referenceNo, "notes": h.notes, "cancelReason": h.cancelReason,
		"pod":           map[string]any{"recipient": h.podRecipient, "receivedAt": h.podReceivedAt, "reference": h.podReference, "notes": h.podNotes},
		"salesOrder":    map[string]any{"id": h.soID, "documentNo": h.soNo, "status": h.soStatus},
		"deliveryOrder": map[string]any{"id": h.doID, "documentNo": h.doNo, "status": h.doStatus},
		"customer":      map[string]any{"code": h.customerCode, "name": h.customerName},
		"warehouse":     map[string]any{"code": h.warehouseCode, "name": h.warehouseName},
		"company":       map[string]any{"code": h.entityCode, "legalName": h.entityName, "taxId": h.entityTaxID},
		"site":          map[string]any{"code": h.siteCode, "name": h.siteName},
		"entityCode":    h.entityCode, "siteCode": h.siteCode, "lines": lines, "cogsJournal": journalRow,
	}, nil
}
