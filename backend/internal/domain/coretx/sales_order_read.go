package coretx

import (
	"context"
	"errors"
	"strings"
)

type salesOrderReadHeader struct {
	id                    string
	documentNo            string
	orderDate             string
	requestedDeliveryDate string
	status                string
	currency              string
	subtotal              float64
	discount              float64
	dpp                   float64
	tax                   float64
	total                 float64
	customerPo            string
	paymentTerms          string
	billingAddress        string
	shippingAddress       string
	salesperson           string
	notes                 string
	internalNotes         string
	cancelReason          string
	cancelledAt           string
	revisionNo            int
	createdAt             string
	updatedAt             string
	customerCode          string
	customerName          string
	warehouseCode         string
	warehouseName         string
	siteCode              string
	entityCode            string
	createdBy             string
	entityLegalName       string
	entityTaxID           string
	entityBaseCurrency    string
	entityTimezone        string
	siteName              string
}

// SalesOrderDetail returns the canonical read model for one Sales Order.
// It is read-only and always enforces the active entity/site scope in SQL.
func (s Service) SalesOrderDetail(ctx context.Context, entityCode, siteCode, id string) (map[string]any, error) {
	id = strings.TrimSpace(id)
	entityCode = strings.TrimSpace(entityCode)
	siteCode = strings.TrimSpace(siteCode)
	if id == "" || entityCode == "" {
		return nil, errors.New("sales order not found in current scope")
	}

	header, err := s.salesOrderReadHeader(ctx, entityCode, siteCode, id)
	if err != nil {
		return nil, err
	}

	lines, err := s.salesOrderReadLines(ctx, id)
	if err != nil {
		return nil, err
	}
	taxSummary, err := s.salesOrderTaxSummary(ctx, id)
	if err != nil {
		return nil, err
	}
	approvalHistory, err := s.salesOrderApprovalHistory(ctx, id)
	if err != nil {
		return nil, err
	}
	auditTrail, err := s.salesOrderAuditTrail(ctx, id)
	if err != nil {
		return nil, err
	}
	relatedDocuments, err := s.salesOrderRelatedDocuments(ctx, id)
	if err != nil {
		return nil, err
	}
	fulfillment, err := s.salesOrderFulfillmentSummary(ctx, id)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"id":                    header.id,
		"documentNo":            header.documentNo,
		"orderDate":             header.orderDate,
		"requestedDeliveryDate": header.requestedDeliveryDate,
		"status":                header.status,
		"currency":              header.currency,
		"subtotal":              header.subtotal,
		"discount":              header.discount,
		"dpp":                   header.dpp,
		"tax":                   header.tax,
		"total":                 header.total,
		"customerPo":            header.customerPo,
		"paymentTerms":          header.paymentTerms,
		"billingAddress":        header.billingAddress,
		"shippingAddress":       header.shippingAddress,
		"salesperson":           header.salesperson,
		"notes":                 header.notes,
		"internalNotes":         header.internalNotes,
		"cancelReason":          header.cancelReason,
		"cancelledAt":           header.cancelledAt,
		"revisionNo":            header.revisionNo,
		"createdAt":             header.createdAt,
		"updatedAt":             header.updatedAt,
		"createdBy":             header.createdBy,
		"customer": map[string]any{
			"code": header.customerCode,
			"name": header.customerName,
		},
		"warehouse": map[string]any{
			"code": header.warehouseCode,
			"name": header.warehouseName,
		},
		"company": map[string]any{
			"code":      header.entityCode,
			"legalName": header.entityLegalName,
			"taxId":     header.entityTaxID,
			"currency":  header.entityBaseCurrency,
			"timezone":  header.entityTimezone,
		},
		"site": map[string]any{
			"code": header.siteCode,
			"name": header.siteName,
		},
		"siteCode":         header.siteCode,
		"entityCode":       header.entityCode,
		"lines":            lines,
		"taxSummary":       taxSummary,
		"fulfillment":      fulfillment,
		"approvalHistory":  approvalHistory,
		"auditTrail":       auditTrail,
		"relatedDocuments": relatedDocuments,
		// Compatibility keys for the first D1 patch/frontend while callers migrate.
		"audit":            auditTrail,
		"relatedShipments": filterRelatedDocuments(relatedDocuments, "SHIPMENT"),
	}, nil
}

func (s Service) salesOrderReadHeader(ctx context.Context, entityCode, siteCode, id string) (salesOrderReadHeader, error) {
	q := `SELECT so.id::text,so.document_no,so.order_date::text,COALESCE(so.requested_delivery_date::text,''),so.status,so.currency,
        so.subtotal::float8,so.discount_amount::float8,so.dpp_amount::float8,so.tax_amount::float8,so.total_amount::float8,
        COALESCE(so.customer_po,''),COALESCE(so.payment_terms,''),COALESCE(so.billing_address,''),COALESCE(so.shipping_address,''),COALESCE(so.salesperson,''),COALESCE(so.notes,''),COALESCE(so.internal_notes,''),
        COALESCE(so.cancel_reason,''),COALESCE(so.cancelled_at::text,''),so.revision_no,so.created_at::text,so.updated_at::text,
        c.code,c.name,w.code,w.name,st.code,e.code,COALESCE(cu.display_name,cu.username,''),e.legal_name,COALESCE(e.tax_id,''),e.base_currency,e.timezone,st.name
        FROM erp.sales_orders so
        JOIN erp.entities e ON e.id=so.entity_id
        JOIN erp.sites st ON st.id=so.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=so.warehouse_id
        LEFT JOIN erp.users cu ON cu.id=so.created_by
        WHERE so.id=$1::uuid AND e.code=$2`
	args := []any{id, entityCode}
	if siteCode != "" {
		q += ` AND st.code=$3`
		args = append(args, siteCode)
	}

	var h salesOrderReadHeader
	err := s.DB.QueryRow(ctx, q, args...).Scan(
		&h.id, &h.documentNo, &h.orderDate, &h.requestedDeliveryDate, &h.status, &h.currency,
		&h.subtotal, &h.discount, &h.dpp, &h.tax, &h.total,
		&h.customerPo, &h.paymentTerms, &h.billingAddress, &h.shippingAddress, &h.salesperson, &h.notes, &h.internalNotes,
		&h.cancelReason, &h.cancelledAt, &h.revisionNo, &h.createdAt, &h.updatedAt,
		&h.customerCode, &h.customerName, &h.warehouseCode, &h.warehouseName, &h.siteCode, &h.entityCode, &h.createdBy,
		&h.entityLegalName, &h.entityTaxID, &h.entityBaseCurrency, &h.entityTimezone, &h.siteName,
	)
	if err != nil {
		return h, errors.New("sales order not found in current scope")
	}
	return h, nil
}

func (s Service) salesOrderReadLines(ctx context.Context, id string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT
        sol.id::text,sol.line_no,i.sku,i.name,COALESCE(sol.description,''),COALESCE(sol.uom,i.base_uom),
        sol.qty::float8,sol.unit_price::float8,sol.discount_percent::float8,sol.discount_amount::float8,sol.dpp_amount::float8,
        COALESCE(tc.code,''),COALESCE(tc.name,''),COALESCE(tc.treatment,''),sol.tax_rate::float8,sol.tax_amount::float8,sol.line_total::float8,
        sol.reserved_qty::float8,sol.shipped_qty::float8,
        COALESCE((SELECT sum(pl.picked_qty) FROM erp.picking_order_lines pl JOIN erp.picking_orders p ON p.id=pl.picking_order_id WHERE pl.sales_order_line_id=sol.id AND p.status<>'CANCELLED'),0)::float8,
        COALESCE(b.on_hand_qty,0)::float8,COALESCE(b.reserved_qty,0)::float8,COALESCE(b.on_hand_qty-b.reserved_qty,0)::float8
        FROM erp.sales_order_lines sol
        JOIN erp.items i ON i.id=sol.item_id
        LEFT JOIN erp.tax_codes tc ON tc.id=sol.tax_code_id
        JOIN erp.sales_orders so ON so.id=sol.sales_order_id
        LEFT JOIN erp.inventory_balance b ON b.warehouse_id=so.warehouse_id AND b.item_id=sol.item_id
        WHERE sol.sales_order_id=$1::uuid
        ORDER BY sol.line_no`, []string{
		"id", "lineNo", "sku", "itemName", "description", "uom", "qty", "unitPrice", "discountPercent", "discountAmount", "dpp",
		"taxCode", "taxName", "taxTreatment", "taxRate", "taxAmount", "lineTotal", "reservedQty", "shippedQty", "pickedQty", "onHandStock", "warehouseReservedStock", "availableStock",
	}, id)
}

func (s Service) salesOrderTaxSummary(ctx context.Context, id string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT
        COALESCE(tc.code,CASE WHEN sol.tax_rate=0 THEN 'NO-TAX-CODE' ELSE 'LEGACY-RATE' END),
        COALESCE(tc.name,CASE WHEN sol.tax_rate=0 THEN 'No tax' ELSE 'Legacy item tax rate' END),
        COALESCE(tc.treatment,CASE WHEN sol.tax_rate=0 THEN 'NON_TAXABLE' ELSE 'STANDARD' END),
        sol.tax_rate::float8,
        round(sum(sol.dpp_amount)::numeric,2)::float8,
        round(sum(sol.tax_amount)::numeric,2)::float8,
        round(sum(sol.line_total)::numeric,2)::float8,
        count(*)::int
        FROM erp.sales_order_lines sol
        LEFT JOIN erp.tax_codes tc ON tc.id=sol.tax_code_id
        WHERE sol.sales_order_id=$1::uuid
        GROUP BY tc.code,tc.name,tc.treatment,sol.tax_rate
        ORDER BY sol.tax_rate DESC,COALESCE(tc.code,'')`, []string{
		"taxCode", "taxName", "treatment", "rate", "dpp", "taxAmount", "total", "lineCount",
	}, id)
}

func (s Service) salesOrderApprovalHistory(ctx context.Context, id string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT
        ae.occurred_at,
        COALESCE(ae.after_data->>'status',''),
        ae.action,
        COALESCE(u.display_name,u.username,'System'),
        COALESCE(ae.request_id,'')
        FROM erp.audit_events ae
        LEFT JOIN erp.users u ON u.id=ae.user_id
        WHERE ae.resource_type='sales_order'
          AND ae.resource_id=$1
          AND ae.entity_id=(SELECT entity_id FROM erp.sales_orders WHERE id=$1::uuid)
          AND (ae.site_id IS NULL OR ae.site_id=(SELECT site_id FROM erp.sales_orders WHERE id=$1::uuid))
          AND COALESCE(ae.after_data->>'status','') IN ('PENDING_APPROVAL','APPROVED')
        ORDER BY ae.occurred_at ASC`, []string{
		"occurredAt", "status", "action", "actor", "requestId",
	}, id)
}

func (s Service) salesOrderAuditTrail(ctx context.Context, id string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT
        ae.id::text,ae.occurred_at,ae.action,ae.module,COALESCE(u.display_name,u.username,'System'),COALESCE(ae.request_id,''),
        COALESCE(ae.before_data,'{}'::jsonb)::text,COALESCE(ae.after_data,'{}'::jsonb)::text,COALESCE(ae.metadata,'{}'::jsonb)::text,
        COALESCE(ae.after_data->>'status','')
        FROM erp.audit_events ae
        LEFT JOIN erp.users u ON u.id=ae.user_id
        WHERE ae.resource_type='sales_order' AND ae.resource_id=$1
          AND ae.entity_id=(SELECT entity_id FROM erp.sales_orders WHERE id=$1::uuid)
          AND (ae.site_id IS NULL OR ae.site_id=(SELECT site_id FROM erp.sales_orders WHERE id=$1::uuid))
        ORDER BY ae.occurred_at DESC
        LIMIT 100`, []string{
		"id", "occurredAt", "action", "module", "actor", "requestId", "before", "after", "metadata", "status",
	}, id)
}

func (s Service) salesOrderRelatedDocuments(ctx context.Context, id string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT DISTINCT document_type,id,document_no,status,document_date,relation FROM (
        SELECT 'PICKING_ORDER'::text AS document_type,p.id::text AS id,p.document_no,p.status,p.created_at::text AS document_date,'FULFILLMENT'::text AS relation
        FROM erp.picking_orders p
        WHERE p.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'DELIVERY_ORDER'::text,d.id::text,d.document_no,d.status,d.delivery_date::text,'FULFILLMENT'::text
        FROM erp.delivery_orders d
        WHERE d.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'SHIPMENT'::text AS document_type,sh.id::text AS id,sh.document_no,sh.status,COALESCE(sh.dispatched_at,sh.created_at)::text AS document_date,'FULFILLMENT'::text AS relation
        FROM erp.shipments sh
        WHERE sh.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'SALES_INVOICE'::text,si.id::text,si.document_no,si.status,si.invoice_date::text,'BILLING'::text
        FROM erp.sales_invoices si
        WHERE si.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'CUSTOMER_RECEIPT'::text,cr.id::text,cr.document_no,cr.status,cr.receipt_date::text,'SETTLEMENT'::text
        FROM erp.customer_receipts cr
        JOIN erp.customer_receipt_allocations cra ON cra.customer_receipt_id=cr.id
        JOIN erp.ar_open_items ar ON ar.id=cra.ar_open_item_id
        JOIN erp.sales_invoices si ON si.id=ar.sales_invoice_id
        WHERE si.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'JOURNAL_ENTRY'::text,je.id::text,je.document_no,je.status,je.posting_date::text,'ACCOUNTING'::text
        FROM erp.sales_invoices si
        JOIN erp.journal_entries je ON je.id=si.journal_entry_id
        WHERE si.sales_order_id=$1::uuid
        UNION ALL
        SELECT 'JOURNAL_ENTRY'::text,je.id::text,je.document_no,je.status,je.posting_date::text,'ACCOUNTING'::text
        FROM erp.customer_receipts cr
        JOIN erp.customer_receipt_allocations cra ON cra.customer_receipt_id=cr.id
        JOIN erp.ar_open_items ar ON ar.id=cra.ar_open_item_id
        JOIN erp.sales_invoices si ON si.id=ar.sales_invoice_id
        JOIN erp.journal_entries je ON je.id=cr.journal_entry_id
        WHERE si.sales_order_id=$1::uuid
    ) docs
    ORDER BY document_date DESC,document_no DESC`, []string{
		"documentType", "id", "documentNo", "status", "documentDate", "relation",
	}, id)
}

func (s Service) salesOrderFulfillmentSummary(ctx context.Context, id string) (map[string]any, error) {
	var ordered, reserved, picked, deliveryAllocated, shipped float64
	var lineCount int
	err := s.DB.QueryRow(ctx, `SELECT
        COALESCE(sum(qty),0)::float8,
        COALESCE(sum(reserved_qty),0)::float8,
        COALESCE((SELECT sum(pl.picked_qty) FROM erp.picking_order_lines pl JOIN erp.picking_orders p ON p.id=pl.picking_order_id WHERE p.sales_order_id=$1::uuid AND p.status<>'CANCELLED'),0)::float8,
        COALESCE((SELECT sum(dl.qty) FROM erp.delivery_order_lines dl JOIN erp.delivery_orders d ON d.id=dl.delivery_order_id WHERE d.sales_order_id=$1::uuid AND d.status<>'CANCELLED'),0)::float8,
        COALESCE(sum(shipped_qty),0)::float8,
        count(*)::int
        FROM erp.sales_order_lines
        WHERE sales_order_id=$1::uuid`, id).Scan(&ordered, &reserved, &picked, &deliveryAllocated, &shipped, &lineCount)
	if err != nil {
		return nil, err
	}

	var pickingAllocated, pickingAvailable float64
	err = s.DB.QueryRow(ctx, `SELECT
        COALESCE(sum(COALESCE(pa.allocated_qty,0)),0)::float8,
        COALESCE(sum(GREATEST(sol.reserved_qty-COALESCE(pa.allocated_qty,0),0)),0)::float8
        FROM erp.sales_order_lines sol
        LEFT JOIN (
            SELECT pl.sales_order_line_id,
                sum(CASE
                    WHEN p.status IN ('OPEN','IN_PROGRESS') THEN pl.requested_qty
                    WHEN p.status='COMPLETED' THEN pl.picked_qty
                    ELSE 0 END) AS allocated_qty
            FROM erp.picking_order_lines pl
            JOIN erp.picking_orders p ON p.id=pl.picking_order_id
            WHERE p.status<>'CANCELLED'
            GROUP BY pl.sales_order_line_id
        ) pa ON pa.sales_order_line_id=sol.id
        WHERE sol.sales_order_id=$1::uuid`, id).Scan(&pickingAllocated, &pickingAvailable)
	if err != nil {
		return nil, err
	}

	return map[string]any{
		"lineCount":           lineCount,
		"orderedQty":          ordered,
		"reservedQty":         reserved,
		"pickedQty":           picked,
		"pickingAllocatedQty": pickingAllocated,
		"pickingAvailableQty": pickingAvailable,
		"deliveryQty":         deliveryAllocated,
		"shippedQty":          shipped,
		"remainingToShipQty":  maxZero(ordered - shipped),
	}, nil
}

func filterRelatedDocuments(rows []map[string]any, documentType string) []map[string]any {
	out := make([]map[string]any, 0)
	for _, row := range rows {
		if strings.EqualFold(asString(row["documentType"]), documentType) {
			out = append(out, row)
		}
	}
	return out
}

func asString(value any) string {
	if value == nil {
		return ""
	}
	if s, ok := value.(string); ok {
		return s
	}
	return ""
}

func maxZero(value float64) float64 {
	if value < 0 {
		return 0
	}
	return value
}
