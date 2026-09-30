package coretx

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	financecore "github.com/nexa-distributor/erp-backend/internal/domain/finance"
)

type Service struct{ DB *pgxpool.Pool }

type Scope struct {
	EntityCode string
	SiteCode   string
	Username   string
	RequestID  string
}

type ItemLineInput struct {
	SKU             string  `json:"sku"`
	Description     string  `json:"description"`
	Qty             float64 `json:"qty"`
	UnitPrice       float64 `json:"unitPrice"`
	DiscountPercent float64 `json:"discountPercent"`
	TaxCode         string  `json:"taxCode"`
}

type CreateSalesOrderInput struct {
	SiteCode              string          `json:"siteCode"`
	WarehouseCode         string          `json:"warehouseCode"`
	CustomerCode          string          `json:"customerCode"`
	OrderDate             string          `json:"orderDate"`
	RequestedDeliveryDate string          `json:"requestedDeliveryDate"`
	CustomerPO            string          `json:"customerPo"`
	PaymentTerms          string          `json:"paymentTerms"`
	BillingAddress        string          `json:"billingAddress"`
	ShippingAddress       string          `json:"shippingAddress"`
	Salesperson           string          `json:"salesperson"`
	Notes                 string          `json:"notes"`
	InternalNotes         string          `json:"internalNotes"`
	Lines                 []ItemLineInput `json:"lines"`
}

type PurchaseOrderLineInput struct {
	SKU             string  `json:"sku"`
	Description     string  `json:"description"`
	Qty             float64 `json:"qty"`
	UnitPrice       float64 `json:"unitPrice"`
	DiscountPercent float64 `json:"discountPercent"`
	TaxCode         string  `json:"taxCode"`
}

type CreatePurchaseOrderInput struct {
	SiteCode          string                   `json:"siteCode"`
	WarehouseCode     string                   `json:"warehouseCode"`
	SupplierCode      string                   `json:"supplierCode"`
	OrderDate         string                   `json:"orderDate"`
	ETADate           string                   `json:"etaDate"`
	SupplierReference string                   `json:"supplierReference"`
	PaymentTerms      string                   `json:"paymentTerms"`
	Notes             string                   `json:"notes"`
	Lines             []PurchaseOrderLineInput `json:"lines"`
}

type ReceivePOInput struct {
	Lines []ReceiveLineInput `json:"lines"`
}
type ReceiveLineInput struct {
	SKU             string  `json:"sku"`
	AcceptedQty     float64 `json:"acceptedQty"`
	RejectedQty     float64 `json:"rejectedQty"`
	LotNo           string  `json:"lotNo"`
	PutAwayLocation string  `json:"putAwayLocation"`
}

type CreateTransferInput struct {
	SiteCode                 string              `json:"siteCode"`
	SourceWarehouseCode      string              `json:"sourceWarehouseCode"`
	DestinationWarehouseCode string              `json:"destinationWarehouseCode"`
	TransferDate             string              `json:"transferDate"`
	Lines                    []TransferLineInput `json:"lines"`
}
type TransferLineInput struct {
	SKU string  `json:"sku"`
	Qty float64 `json:"qty"`
}

type CommandResult struct {
	Status int
	Body   map[string]any
	Replay bool
}

type CommandFunc func(context.Context, pgx.Tx, ResolvedScope) (map[string]any, error)

type ResolvedScope struct {
	EntityID   string
	SiteID     string
	UserID     string
	EntityCode string
	SiteCode   string
}

func (s Service) Command(ctx context.Context, operation, key string, scope Scope, fn CommandFunc) (CommandResult, error) {
	if strings.TrimSpace(key) == "" {
		return CommandResult{}, errors.New("idempotency key is required")
	}
	tx, err := s.DB.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return CommandResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	lockKey := operation + ":" + key
	if _, err := tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, lockKey); err != nil {
		return CommandResult{}, err
	}

	var storedStatus int
	var storedBody string
	err = tx.QueryRow(ctx, `SELECT response_status, response_body::text FROM erp.idempotency_keys WHERE idempotency_key=$1 AND operation=$2 AND expires_at>now()`, key, operation).Scan(&storedStatus, &storedBody)
	if err == nil {
		var body map[string]any
		if json.Unmarshal([]byte(storedBody), &body) != nil {
			body = map[string]any{"replayed": true}
		}
		if err := tx.Commit(ctx); err != nil {
			return CommandResult{}, err
		}
		return CommandResult{Status: storedStatus, Body: body, Replay: true}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return CommandResult{}, err
	}

	rs, err := resolveScope(ctx, tx, scope)
	if err != nil {
		return CommandResult{}, err
	}
	body, err := fn(ctx, tx, rs)
	if err != nil {
		return CommandResult{}, err
	}
	raw, _ := json.Marshal(body)
	requestHash := sha256.Sum256([]byte(operation + "|" + scope.EntityCode + "|" + scope.SiteCode))
	_, err = tx.Exec(ctx, `INSERT INTO erp.idempotency_keys(idempotency_key,user_id,entity_id,operation,request_hash,response_status,response_body,expires_at) VALUES($1,$2,$3,$4,$5,200,$6::jsonb,now()+interval '24 hours')`, key, rs.UserID, rs.EntityID, operation, hex.EncodeToString(requestHash[:]), string(raw))
	if err != nil {
		return CommandResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return CommandResult{}, err
	}
	return CommandResult{Status: 200, Body: body}, nil
}

func resolveScope(ctx context.Context, tx pgx.Tx, scope Scope) (ResolvedScope, error) {
	var rs ResolvedScope
	rs.EntityCode = scope.EntityCode
	rs.SiteCode = scope.SiteCode
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.entities WHERE code=$1 AND status='ACTIVE'`, scope.EntityCode).Scan(&rs.EntityID); err != nil {
		return rs, fmt.Errorf("entity scope not found: %w", err)
	}
	if strings.TrimSpace(scope.SiteCode) != "" {
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, scope.SiteCode).Scan(&rs.SiteID); err != nil {
			return rs, fmt.Errorf("site scope not found: %w", err)
		}
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.users WHERE username=$1 AND status='ACTIVE'`, scope.Username).Scan(&rs.UserID); err != nil {
		return rs, fmt.Errorf("user not found: %w", err)
	}
	return rs, nil
}

func ensureSiteCode(ctx context.Context, tx pgx.Tx, rs *ResolvedScope) error {
	if rs.SiteCode != "" || rs.SiteID == "" {
		return nil
	}
	return tx.QueryRow(ctx, `SELECT code FROM erp.sites WHERE id=$1::uuid`, rs.SiteID).Scan(&rs.SiteCode)
}

func parseDate(value string) time.Time {
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed
	}
	return time.Now().UTC()
}

func prefix(entity, site, doc string, date time.Time) string {
	site = strings.ReplaceAll(site, "-", "")
	return fmt.Sprintf("%s-%s-%s-%02d%02d-", entity, site, doc, date.Year()%100, int(date.Month()))
}

func audit(ctx context.Context, tx pgx.Tx, rs ResolvedScope, requestID, module, action, resourceType, resourceID string, after any) {
	raw, _ := json.Marshal(after)
	var site any
	if rs.SiteID != "" {
		site = rs.SiteID
	} else {
		site = nil
	}
	_, _ = tx.Exec(ctx, `INSERT INTO erp.audit_events(request_id,user_id,entity_id,site_id,module,action,resource_type,resource_id,after_data) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::jsonb)`, requestID, rs.UserID, rs.EntityID, site, module, action, resourceType, resourceID, string(raw))
}

func outbox(ctx context.Context, tx pgx.Tx, rs ResolvedScope, aggregateType, aggregateID, eventType string, payload any) {
	raw, _ := json.Marshal(payload)
	var site any
	if rs.SiteID != "" {
		site = rs.SiteID
	} else {
		site = nil
	}
	_, _ = tx.Exec(ctx, `INSERT INTO erp.outbox_events(aggregate_type,aggregate_id,event_type,payload,entity_id,site_id) VALUES($1,$2,$3,$4::jsonb,$5::uuid,$6::uuid)`, aggregateType, aggregateID, eventType, string(raw), rs.EntityID, site)
}

func (s Service) Bootstrap(ctx context.Context, entityCode, siteCode string) (map[string]any, error) {
	var entityID string
	if err := s.DB.QueryRow(ctx, `SELECT id::text FROM erp.entities WHERE code=$1`, entityCode).Scan(&entityID); err != nil {
		return nil, err
	}
	args := []any{entityID}
	siteClause := ""
	if siteCode != "" {
		var siteID string
		if err := s.DB.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2`, entityID, siteCode).Scan(&siteID); err != nil {
			return nil, err
		}
		args = append(args, siteID)
		siteClause = " AND w.site_id=$2::uuid"
	}
	customers, err := queryRows(s.DB, ctx, `SELECT c.id::text,c.code,c.name,c.credit_limit::float8,c.payment_terms FROM erp.customers c WHERE c.entity_id=$1::uuid AND c.status='ACTIVE' ORDER BY c.name`, []string{"id", "code", "name", "creditLimit", "paymentTerms"}, entityID)
	if err != nil {
		return nil, err
	}
	suppliers, err := queryRows(s.DB, ctx, `SELECT s.id::text,s.code,s.name,s.payment_terms,s.lead_time_days FROM erp.suppliers s WHERE s.entity_id=$1::uuid AND s.status='ACTIVE' ORDER BY s.name`, []string{"id", "code", "name", "paymentTerms", "leadTimeDays"}, entityID)
	if err != nil {
		return nil, err
	}
	items, err := queryRows(s.DB, ctx, `SELECT id::text,sku,name,base_uom,standard_cost::float8,sales_price::float8,tax_rate::float8,reorder_point::float8,max_stock::float8 FROM erp.items WHERE status='ACTIVE' ORDER BY sku`, []string{"id", "sku", "name", "uom", "standardCost", "salesPrice", "taxRate", "reorderPoint", "maxStock"})
	if err != nil {
		return nil, err
	}
	q := `SELECT w.id::text,w.code,w.name,st.code AS site_code FROM erp.warehouses w JOIN erp.sites st ON st.id=w.site_id WHERE w.entity_id=$1::uuid` + siteClause + ` AND w.status='ACTIVE' ORDER BY w.code`
	warehouses, err := queryRows(s.DB, ctx, q, []string{"id", "code", "name", "siteCode"}, args...)
	if err != nil {
		return nil, err
	}
	taxCodes, err := queryRows(s.DB, ctx, `SELECT id::text,code,name,rate::float8,treatment,valid_from,valid_to FROM erp.tax_codes WHERE status='ACTIVE' AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_to IS NULL OR valid_to>=current_date) ORDER BY rate DESC,code`, []string{"id", "code", "name", "rate", "treatment", "validFrom", "validTo"})
	if err != nil {
		return nil, err
	}
	uomUnits, err := queryRows(s.DB, ctx, `SELECT code,name,dimension FROM erp.uom_units WHERE is_active ORDER BY code`, []string{"code", "name", "dimension"})
	if err != nil {
		return nil, err
	}
	uomConversions, err := queryRows(s.DB, ctx, `SELECT i.sku,c.uom_code,c.base_qty_per_uom::float8,i.base_uom FROM erp.item_uom_conversions c JOIN erp.items i ON i.id=c.item_id WHERE c.is_active AND i.status='ACTIVE' ORDER BY i.sku,c.uom_code`, []string{"sku", "uom", "factor", "inventoryUom"})
	if err != nil {
		return nil, err
	}
	return map[string]any{"customers": customers, "suppliers": suppliers, "items": items, "warehouses": warehouses, "taxCodes": taxCodes, "uomUnits": uomUnits, "uomConversions": uomConversions}, nil
}

type rowQuerier interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func queryRows(q rowQuerier, ctx context.Context, sql string, keys []string, args ...any) ([]map[string]any, error) {
	rows, err := q.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		vals, err := rows.Values()
		if err != nil {
			return nil, err
		}
		row := map[string]any{}
		for i, k := range keys {
			row[k] = vals[i]
		}
		out = append(out, row)
	}
	return out, rows.Err()
}

func (s Service) ListInventory(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	query := `SELECT w.code,w.name,st.code,i.sku,i.name,i.base_uom,b.on_hand_qty::float8,b.reserved_qty::float8,b.inbound_qty::float8,(b.on_hand_qty-b.reserved_qty)::float8,b.average_cost::float8,(b.on_hand_qty*b.average_cost)::float8,b.row_version FROM erp.inventory_balance b JOIN erp.warehouses w ON w.id=b.warehouse_id JOIN erp.sites st ON st.id=w.site_id JOIN erp.entities e ON e.id=w.entity_id JOIN erp.items i ON i.id=b.item_id WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		query += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	query += ` ORDER BY w.code,i.sku`
	return queryRows(s.DB, ctx, query, []string{"warehouseCode", "warehouseName", "siteCode", "sku", "itemName", "uom", "onHand", "reserved", "inbound", "available", "averageCost", "inventoryValue", "rowVersion"}, args...)
}

func (s Service) ListMovements(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT m.id::text,m.occurred_at,m.movement_type,w.code,i.sku,m.qty::float8,m.unit_cost::float8,m.movement_value::float8,m.balance_after_qty::float8,m.reference_type,m.reference_id FROM erp.stock_movements m JOIN erp.entities e ON e.id=m.entity_id JOIN erp.warehouses w ON w.id=m.warehouse_id JOIN erp.items i ON i.id=m.item_id LEFT JOIN erp.sites st ON st.id=m.site_id WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` ORDER BY m.occurred_at DESC LIMIT 200`
	return queryRows(s.DB, ctx, q, []string{"id", "occurredAt", "type", "warehouseCode", "sku", "qty", "unitCost", "value", "balanceAfter", "referenceType", "referenceId"}, args...)
}

func (s Service) ListSalesOrders(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT so.id::text,so.document_no,so.order_date,so.requested_delivery_date,so.status,
        so.subtotal::float8,so.discount_amount::float8,so.dpp_amount::float8,so.tax_amount::float8,so.total_amount::float8,
        c.code,c.name,w.code,st.code,
        COALESCE(sum(sol.qty),0)::float8,
        COALESCE(sum(sol.reserved_qty),0)::float8,
        COALESCE(sum(sol.shipped_qty),0)::float8,
        COALESCE(sum(COALESCE(pa.allocated_qty,0)),0)::float8,
        COALESCE(sum(GREATEST(sol.reserved_qty-COALESCE(pa.allocated_qty,0),0)),0)::float8,
        so.customer_po,so.payment_terms,so.revision_no
        FROM erp.sales_orders so
        JOIN erp.entities e ON e.id=so.entity_id
        JOIN erp.sites st ON st.id=so.site_id
        JOIN erp.customers c ON c.id=so.customer_id
        JOIN erp.warehouses w ON w.id=so.warehouse_id
        LEFT JOIN erp.sales_order_lines sol ON sol.sales_order_id=so.id
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
        WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY so.id,c.code,c.name,w.code,st.code ORDER BY so.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{
		"id", "documentNo", "orderDate", "requestedDeliveryDate", "status", "subtotal", "discount", "dpp", "tax", "total",
		"customerCode", "customerName", "warehouseCode", "siteCode", "qty", "reservedQty", "shippedQty",
		"pickingAllocatedQty", "pickingAvailableQty", "customerPo", "paymentTerms", "revisionNo",
	}, args...)
}

func roundMoney(value float64) float64 { return math.Round(value*100) / 100 }

func parseOptionalDate(value string) any {
	if strings.TrimSpace(value) == "" {
		return nil
	}
	if parsed, err := time.Parse("2006-01-02", value); err == nil {
		return parsed
	}
	return nil
}

func (s Service) CreateSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreateSalesOrderInput, requestID string) (map[string]any, error) {
	if len(input.Lines) == 0 {
		return nil, errors.New("sales order requires at least one line")
	}
	date := parseDate(input.OrderDate)
	siteCode := input.SiteCode
	if siteCode == "" {
		siteCode = rs.SiteCode
	}
	var siteID, warehouseID, customerID, defaultTerms string
	if siteCode == "" {
		if err := tx.QueryRow(ctx, `SELECT w.id::text,s.id::text,s.code FROM erp.warehouses w JOIN erp.sites s ON s.id=w.site_id WHERE w.entity_id=$1::uuid AND w.code=$2 AND w.status='ACTIVE'`, rs.EntityID, input.WarehouseCode).Scan(&warehouseID, &siteID, &siteCode); err != nil {
			return nil, errors.New("warehouse is invalid for entity")
		}
	} else {
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2`, rs.EntityID, siteCode).Scan(&siteID); err != nil {
			return nil, errors.New("site is invalid for entity")
		}
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.warehouses WHERE entity_id=$1::uuid AND site_id=$2::uuid AND code=$3 AND status='ACTIVE'`, rs.EntityID, siteID, input.WarehouseCode).Scan(&warehouseID); err != nil {
			return nil, errors.New("warehouse is invalid for site")
		}
	}
	if err := tx.QueryRow(ctx, `SELECT id::text,payment_terms FROM erp.customers WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, input.CustomerCode).Scan(&customerID, &defaultTerms); err != nil {
		return nil, errors.New("customer is invalid for entity")
	}
	rs.SiteID, rs.SiteCode = siteID, siteCode
	docPrefix := prefix(rs.EntityCode, siteCode, "SO", date)
	var docNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'SALES_ORDER',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), docPrefix).Scan(&docNo); err != nil {
		return nil, err
	}
	terms := strings.TrimSpace(input.PaymentTerms)
	if terms == "" {
		terms = defaultTerms
	}
	var soID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.sales_orders(document_no,entity_id,site_id,warehouse_id,customer_id,order_date,requested_delivery_date,customer_po,payment_terms,billing_address,shipping_address,salesperson,notes,internal_notes,created_by) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::uuid) RETURNING id::text`, docNo, rs.EntityID, siteID, warehouseID, customerID, date, parseOptionalDate(input.RequestedDeliveryDate), strings.TrimSpace(input.CustomerPO), terms, strings.TrimSpace(input.BillingAddress), strings.TrimSpace(input.ShippingAddress), strings.TrimSpace(input.Salesperson), strings.TrimSpace(input.Notes), strings.TrimSpace(input.InternalNotes), rs.UserID).Scan(&soID); err != nil {
		return nil, err
	}
	if _, err := s.replaceSalesOrderLines(ctx, tx, soID, input.Lines); err != nil {
		return nil, err
	}
	if err := s.recalculateSalesOrder(ctx, tx, soID); err != nil {
		return nil, err
	}
	var subtotal, discount, dpp, tax, total float64
	if err := tx.QueryRow(ctx, `SELECT subtotal::float8,discount_amount::float8,dpp_amount::float8,tax_amount::float8,total_amount::float8 FROM erp.sales_orders WHERE id=$1::uuid`, soID).Scan(&subtotal, &discount, &dpp, &tax, &total); err != nil {
		return nil, err
	}
	body := map[string]any{"id": soID, "documentNo": docNo, "status": "DRAFT", "subtotal": subtotal, "discount": discount, "dpp": dpp, "tax": tax, "total": total}
	audit(ctx, tx, rs, requestID, "sales", "create", "sales_order", soID, body)
	outbox(ctx, tx, rs, "sales_order", soID, "sales_order.created", body)
	return body, nil
}

func (s Service) replaceSalesOrderLines(ctx context.Context, tx pgx.Tx, soID string, lines []ItemLineInput) (map[string]any, error) {
	if _, err := tx.Exec(ctx, `DELETE FROM erp.sales_order_lines WHERE sales_order_id=$1::uuid`, soID); err != nil {
		return nil, err
	}
	for idx, line := range lines {
		if line.Qty <= 0 {
			return nil, fmt.Errorf("line %d qty must be positive", idx+1)
		}
		if line.DiscountPercent < 0 || line.DiscountPercent > 100 {
			return nil, fmt.Errorf("line %d discount must be between 0 and 100", idx+1)
		}
		var itemID, uom string
		var defaultPrice, itemTaxRate float64
		if err := tx.QueryRow(ctx, `SELECT id::text,base_uom,sales_price::float8,tax_rate::float8 FROM erp.items WHERE sku=$1 AND status='ACTIVE'`, line.SKU).Scan(&itemID, &uom, &defaultPrice, &itemTaxRate); err != nil {
			return nil, fmt.Errorf("item %s not found", line.SKU)
		}
		price := line.UnitPrice
		if price <= 0 {
			price = defaultPrice
		}
		var taxCodeID any = nil
		taxRate := itemTaxRate
		if strings.TrimSpace(line.TaxCode) != "" {
			var id string
			if err := tx.QueryRow(ctx, `SELECT id::text,rate::float8 FROM erp.tax_codes WHERE code=$1 AND status='ACTIVE' AND (valid_from IS NULL OR valid_from<=current_date) AND (valid_to IS NULL OR valid_to>=current_date)`, strings.TrimSpace(line.TaxCode)).Scan(&id, &taxRate); err != nil {
				return nil, fmt.Errorf("tax code %s is invalid", line.TaxCode)
			}
			taxCodeID = id
		}
		gross := roundMoney(line.Qty * price)
		discount := roundMoney(gross * line.DiscountPercent / 100)
		dpp := roundMoney(gross - discount)
		tax := roundMoney(dpp * taxRate / 100)
		lineTotal := roundMoney(dpp + tax)
		_, err := tx.Exec(ctx, `INSERT INTO erp.sales_order_lines(sales_order_id,line_no,item_id,description,uom,qty,unit_price,discount_percent,discount_amount,dpp_amount,tax_code_id,tax_rate,tax_amount,line_total) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11::uuid,$12,$13,$14)`, soID, idx+1, itemID, strings.TrimSpace(line.Description), uom, line.Qty, price, line.DiscountPercent, discount, dpp, taxCodeID, taxRate, tax, lineTotal)
		if err != nil {
			return nil, err
		}
	}
	return map[string]any{"lines": len(lines)}, nil
}

func (s Service) recalculateSalesOrder(ctx context.Context, tx pgx.Tx, soID string) error {
	_, err := tx.Exec(ctx, `UPDATE erp.sales_orders so SET subtotal=x.subtotal,discount_amount=x.discount,dpp_amount=x.dpp,tax_amount=x.tax,total_amount=x.total,updated_at=now() FROM (SELECT sales_order_id,COALESCE(round(sum(qty*unit_price)::numeric,2),0) subtotal,COALESCE(round(sum(discount_amount)::numeric,2),0) discount,COALESCE(round(sum(dpp_amount)::numeric,2),0) dpp,COALESCE(round(sum(tax_amount)::numeric,2),0) tax,COALESCE(round(sum(line_total)::numeric,2),0) total FROM erp.sales_order_lines WHERE sales_order_id=$1::uuid GROUP BY sales_order_id) x WHERE so.id=x.sales_order_id`, soID)
	return err
}

func (s Service) TransitionSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID, fromStatus, toStatus, requestID string) (map[string]any, error) {
	var docNo string
	var entityID, siteID string
	err := tx.QueryRow(ctx, `SELECT document_no,entity_id::text,site_id::text FROM erp.sales_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status=$3 FOR UPDATE`, orderID, rs.EntityID, fromStatus).Scan(&docNo, &entityID, &siteID)
	if err != nil {
		return nil, errors.New("sales order status changed or document not found")
	}
	rs.SiteID = siteID
	_, err = tx.Exec(ctx, `UPDATE erp.sales_orders SET status=$2::varchar(30),approved_at=CASE WHEN $2::varchar(30)='APPROVED' THEN now() ELSE approved_at END,updated_at=now() WHERE id=$1::uuid`, orderID, toStatus)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"id": orderID, "documentNo": docNo, "status": toStatus}
	audit(ctx, tx, rs, requestID, "sales", "status_change", "sales_order", orderID, body)
	outbox(ctx, tx, rs, "sales_order", orderID, "sales_order."+strings.ToLower(toStatus), body)
	return body, nil
}

func (s Service) ReserveSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID, requestID string) (map[string]any, error) {
	var whID, siteID, docNo string
	if err := tx.QueryRow(ctx, `SELECT warehouse_id::text,site_id::text,document_no FROM erp.sales_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status='APPROVED' FOR UPDATE`, orderID, rs.EntityID).Scan(&whID, &siteID, &docNo); err != nil {
		return nil, errors.New("approved sales order not found")
	}
	rs.SiteID = siteID
	rows, err := tx.Query(ctx, `SELECT sol.id::text,sol.item_id::text,sol.qty::float8,sol.reserved_qty::float8,i.sku FROM erp.sales_order_lines sol JOIN erp.items i ON i.id=sol.item_id WHERE sol.sales_order_id=$1::uuid ORDER BY sol.line_no`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type l struct {
		id, item, sku string
		qty, res      float64
	}
	lines := []l{}
	for rows.Next() {
		var x l
		if err := rows.Scan(&x.id, &x.item, &x.qty, &x.res, &x.sku); err != nil {
			return nil, err
		}
		lines = append(lines, x)
	}
	for _, line := range lines {
		need := line.qty - line.res
		if need <= 0 {
			continue
		}
		var onHand, reserved float64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8,reserved_qty::float8 FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, whID, line.item).Scan(&onHand, &reserved); err != nil {
			return nil, fmt.Errorf("inventory missing for %s", line.sku)
		}
		if onHand-reserved < need {
			return nil, fmt.Errorf("insufficient available stock for %s", line.sku)
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET reserved_qty=reserved_qty+$3,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid`, whID, line.item, need); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.sales_order_lines SET reserved_qty=qty WHERE id=$1::uuid`, line.id); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.sales_orders SET status='RESERVED',updated_at=now() WHERE id=$1::uuid`, orderID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": orderID, "documentNo": docNo, "status": "RESERVED"}
	audit(ctx, tx, rs, requestID, "inventory", "reserve", "sales_order", orderID, body)
	outbox(ctx, tx, rs, "sales_order", orderID, "inventory.reserved", body)
	return body, nil
}

func (s Service) DispatchSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID, requestID string) (map[string]any, error) {
	var hasPicking bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.picking_orders WHERE sales_order_id=$1::uuid AND status<>'CANCELLED')`, orderID).Scan(&hasPicking); err != nil {
		return nil, err
	}
	if hasPicking {
		return nil, errors.New("Sales Order already uses Picking workflow; continue through Delivery Order in D3-B")
	}

	var whID, siteID, docNo, entityID string
	if err := tx.QueryRow(ctx, `SELECT warehouse_id::text,site_id::text,document_no,entity_id::text FROM erp.sales_orders WHERE id=$1::uuid AND entity_id=$2::uuid AND status IN ('RESERVED','PARTIALLY_SHIPPED') FOR UPDATE`, orderID, rs.EntityID).Scan(&whID, &siteID, &docNo, &entityID); err != nil {
		return nil, errors.New("reserved sales order not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("purchase order is not in selected site")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	date := time.Now().UTC()
	var shipmentNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'SHIPMENT',$3,$4,$5,6)`, entityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "SHP", date)).Scan(&shipmentNo); err != nil {
		return nil, err
	}
	var shipmentID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.shipments(document_no,entity_id,site_id,warehouse_id,sales_order_id,status,dispatched_at) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,'DISPATCHED',now()) RETURNING id::text`, shipmentNo, entityID, siteID, whID, orderID).Scan(&shipmentID); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT sol.id::text,sol.item_id::text,sol.qty::float8,sol.shipped_qty::float8,i.sku FROM erp.sales_order_lines sol JOIN erp.items i ON i.id=sol.item_id WHERE sol.sales_order_id=$1::uuid ORDER BY sol.line_no`, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type l struct {
		id, item, sku string
		qty, shipped  float64
	}
	lines := []l{}
	for rows.Next() {
		var x l
		if err := rows.Scan(&x.id, &x.item, &x.qty, &x.shipped, &x.sku); err != nil {
			return nil, err
		}
		lines = append(lines, x)
	}
	totalCOGS := 0.0
	for idx, line := range lines {
		qty := line.qty - line.shipped
		if qty <= 0 {
			continue
		}
		var onHand, reserved, cost float64
		var version int64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8,reserved_qty::float8,average_cost::float8,row_version FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, whID, line.item).Scan(&onHand, &reserved, &cost, &version); err != nil {
			return nil, fmt.Errorf("inventory missing for %s", line.sku)
		}
		if onHand < qty || reserved < qty {
			return nil, fmt.Errorf("stock/reservation changed for %s", line.sku)
		}
		balanceAfter := onHand - qty
		value := qty * cost
		totalCOGS += value
		if _, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET on_hand_qty=on_hand_qty-$3,reserved_qty=reserved_qty-$3,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid AND row_version=$4`, whID, line.item, qty, version); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.sales_order_lines SET shipped_qty=shipped_qty+$2,reserved_qty=GREATEST(reserved_qty-$2,0) WHERE id=$1::uuid`, line.id, qty); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.shipment_lines(shipment_id,line_no,item_id,qty,unit_cost) VALUES($1::uuid,$2,$3::uuid,$4,$5)`, shipmentID, idx+1, line.item, qty, cost); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'SHIPMENT_OUT',$5,$6,$7,$8,'SHIPMENT',$9,$10)`, entityID, siteID, whID, line.item, -qty, cost, -value, balanceAfter, shipmentNo, requestID); err != nil {
			return nil, err
		}
	}
	_, err = tx.Exec(ctx, `UPDATE erp.sales_orders SET status='SHIPPED',updated_at=now() WHERE id=$1::uuid`, orderID)
	if err != nil {
		return nil, err
	}
	cogsJournalID, cogsJournalNo, err := financecore.PostInventoryIssue(ctx, tx, financecore.InventoryIssue{
		EntityID: entityID, SiteID: siteID, UserID: rs.UserID, EntityCode: rs.EntityCode, SiteCode: rs.SiteCode,
		PostingDate: date, ShipmentID: shipmentID, ShipmentNo: shipmentNo, Amount: math.Round(totalCOGS*100) / 100,
	}, requestID)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"id": shipmentID, "documentNo": shipmentNo, "salesOrderId": orderID, "salesOrderNo": docNo, "status": "DISPATCHED", "cogsAmount": math.Round(totalCOGS*100) / 100, "cogsJournalId": cogsJournalID, "cogsJournalNo": cogsJournalNo}
	audit(ctx, tx, rs, requestID, "warehouse", "dispatch", "shipment", shipmentID, body)
	outbox(ctx, tx, rs, "shipment", shipmentID, "shipment.dispatched", body)
	return body, nil
}

func (s Service) ListPurchaseOrders(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT po.id::text,po.document_no,po.order_date,po.eta_date,po.status,po.total_amount::float8,po.subtotal::float8,po.discount_amount::float8,po.dpp_amount::float8,po.tax_amount::float8,po.revision_no,s.code,s.name,w.code,st.code,COALESCE(sum(pol.qty),0)::float8,COALESCE(sum(pol.received_qty),0)::float8,COALESCE(sum(pol.putaway_qty),0)::float8 FROM erp.purchase_orders po JOIN erp.entities e ON e.id=po.entity_id JOIN erp.sites st ON st.id=po.site_id JOIN erp.suppliers s ON s.id=po.supplier_id JOIN erp.warehouses w ON w.id=po.warehouse_id LEFT JOIN erp.purchase_order_lines pol ON pol.purchase_order_id=po.id WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY po.id,s.code,s.name,w.code,st.code ORDER BY po.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "orderDate", "etaDate", "status", "total", "subtotal", "discount", "dpp", "tax", "revisionNo", "supplierCode", "supplierName", "warehouseCode", "siteCode", "qty", "receivedQty", "putawayQty"}, args...)
}

func (s Service) CreatePurchaseOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreatePurchaseOrderInput, requestID string) (map[string]any, error) {
	return s.createPurchaseOrderD4A(ctx, tx, rs, input, requestID)
}

func (s Service) TransitionPurchaseOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, poID, fromStatus, toStatus, requestID string) (map[string]any, error) {
	return s.transitionPurchaseOrderD4A(ctx, tx, rs, poID, fromStatus, toStatus, requestID)
}

func (s Service) ReceivePurchaseOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, poID string, input ReceivePOInput, requestID string) (map[string]any, error) {
	return s.receivePurchaseOrderD4B(ctx, tx, rs, poID, input, requestID)
}

func (s Service) PutAwayReceipt(ctx context.Context, tx pgx.Tx, rs ResolvedScope, grnID, requestID string) (map[string]any, error) {
	return s.putAwayReceiptD4B(ctx, tx, rs, grnID, requestID)
}

func (s Service) ListReceipts(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT gr.id::text,gr.document_no,gr.receipt_date,gr.status,po.document_no,w.code,st.code,COALESCE(sum(grl.accepted_qty),0)::float8,COALESCE(sum(grl.rejected_qty),0)::float8 FROM erp.goods_receipts gr JOIN erp.entities e ON e.id=gr.entity_id JOIN erp.sites st ON st.id=gr.site_id JOIN erp.warehouses w ON w.id=gr.warehouse_id JOIN erp.purchase_orders po ON po.id=gr.purchase_order_id LEFT JOIN erp.goods_receipt_lines grl ON grl.goods_receipt_id=gr.id WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY gr.id,po.document_no,w.code,st.code ORDER BY gr.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "receiptDate", "status", "purchaseOrderNo", "warehouseCode", "siteCode", "acceptedQty", "rejectedQty"}, args...)
}

func (s Service) ListTransfers(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT t.id::text,t.document_no,t.transfer_date,t.status,sw.code,dw.code,st.code,COALESCE(sum(tl.qty),0)::float8,COALESCE(sum(tl.shipped_qty),0)::float8,COALESCE(sum(tl.received_qty),0)::float8 FROM erp.stock_transfers t JOIN erp.entities e ON e.id=t.entity_id JOIN erp.sites st ON st.id=t.site_id JOIN erp.warehouses sw ON sw.id=t.source_warehouse_id JOIN erp.warehouses dw ON dw.id=t.destination_warehouse_id LEFT JOIN erp.stock_transfer_lines tl ON tl.stock_transfer_id=t.id WHERE e.code=$1`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND st.code=$2`
		args = append(args, siteCode)
	}
	q += ` GROUP BY t.id,sw.code,dw.code,st.code ORDER BY t.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "transferDate", "status", "sourceWarehouseCode", "destinationWarehouseCode", "siteCode", "qty", "shippedQty", "receivedQty"}, args...)
}

func (s Service) CreateTransfer(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreateTransferInput, requestID string) (map[string]any, error) {
	if len(input.Lines) == 0 {
		return nil, errors.New("transfer requires lines")
	}
	siteCode := input.SiteCode
	if siteCode == "" {
		siteCode = rs.SiteCode
	}
	var siteID, sourceID, destID string
	if siteCode == "" {
		if err := tx.QueryRow(ctx, `SELECT w.id::text,s.id::text,s.code FROM erp.warehouses w JOIN erp.sites s ON s.id=w.site_id WHERE w.entity_id=$1::uuid AND w.code=$2 AND w.status='ACTIVE'`, rs.EntityID, input.SourceWarehouseCode).Scan(&sourceID, &siteID, &siteCode); err != nil {
			return nil, errors.New("source warehouse invalid")
		}
	} else {
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2`, rs.EntityID, siteCode).Scan(&siteID); err != nil {
			return nil, errors.New("site invalid")
		}
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.warehouses WHERE entity_id=$1::uuid AND site_id=$2::uuid AND code=$3`, rs.EntityID, siteID, input.SourceWarehouseCode).Scan(&sourceID); err != nil {
			return nil, errors.New("source warehouse invalid")
		}
	}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.warehouses WHERE entity_id=$1::uuid AND code=$2`, rs.EntityID, input.DestinationWarehouseCode).Scan(&destID); err != nil {
		return nil, errors.New("destination warehouse invalid")
	}
	if sourceID == destID {
		return nil, errors.New("source and destination must differ")
	}
	rs.SiteID = siteID
	rs.SiteCode = siteCode
	date := parseDate(input.TransferDate)
	var docNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'STOCK_TRANSFER',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, siteCode, "TRF", date)).Scan(&docNo); err != nil {
		return nil, err
	}
	var transferID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.stock_transfers(document_no,entity_id,site_id,source_warehouse_id,destination_warehouse_id,transfer_date) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6) RETURNING id::text`, docNo, rs.EntityID, siteID, sourceID, destID, date).Scan(&transferID); err != nil {
		return nil, err
	}
	for idx, line := range input.Lines {
		if line.Qty <= 0 {
			return nil, errors.New("transfer qty must be positive")
		}
		var itemID string
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.items WHERE sku=$1`, line.SKU).Scan(&itemID); err != nil {
			return nil, fmt.Errorf("item %s not found", line.SKU)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_transfer_lines(stock_transfer_id,line_no,item_id,qty) VALUES($1::uuid,$2,$3::uuid,$4)`, transferID, idx+1, itemID, line.Qty); err != nil {
			return nil, err
		}
	}
	body := map[string]any{"id": transferID, "documentNo": docNo, "status": "DRAFT"}
	audit(ctx, tx, rs, requestID, "warehouse", "create", "stock_transfer", transferID, body)
	return body, nil
}

func (s Service) ReleaseTransfer(ctx context.Context, tx pgx.Tx, rs ResolvedScope, transferID, requestID string) (map[string]any, error) {
	var sourceID, siteID, docNo string
	if err := tx.QueryRow(ctx, `SELECT source_warehouse_id::text,site_id::text,document_no FROM erp.stock_transfers WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT' FOR UPDATE`, transferID, rs.EntityID).Scan(&sourceID, &siteID, &docNo); err != nil {
		return nil, errors.New("draft transfer not found")
	}
	rs.SiteID = siteID
	rows, err := tx.Query(ctx, `SELECT tl.id::text,tl.item_id::text,tl.qty::float8,i.sku FROM erp.stock_transfer_lines tl JOIN erp.items i ON i.id=tl.item_id WHERE tl.stock_transfer_id=$1::uuid ORDER BY tl.line_no`, transferID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type l struct {
		id, item, sku string
		qty           float64
	}
	lines := []l{}
	for rows.Next() {
		var x l
		if err := rows.Scan(&x.id, &x.item, &x.qty, &x.sku); err != nil {
			return nil, err
		}
		lines = append(lines, x)
	}
	for _, line := range lines {
		var onHand, reserved, cost float64
		var version int64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8,reserved_qty::float8,average_cost::float8,row_version FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, sourceID, line.item).Scan(&onHand, &reserved, &cost, &version); err != nil {
			return nil, fmt.Errorf("source inventory missing for %s", line.sku)
		}
		if onHand-reserved < line.qty {
			return nil, fmt.Errorf("insufficient available stock for %s", line.sku)
		}
		balance := onHand - line.qty
		tag, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET on_hand_qty=on_hand_qty-$3,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid AND row_version=$4`, sourceID, line.item, line.qty, version)
		if err != nil {
			return nil, err
		}
		if tag.RowsAffected() != 1 {
			return nil, errors.New("concurrent inventory update detected")
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.stock_transfer_lines SET shipped_qty=qty,carrying_unit_cost=$2 WHERE id=$1::uuid`, line.id, cost); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'TRANSFER_OUT',$5,$6,$7,$8,'STOCK_TRANSFER',$9,$10)`, rs.EntityID, siteID, sourceID, line.item, -line.qty, cost, -line.qty*cost, balance, docNo, requestID); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.stock_transfers SET status='IN_TRANSIT',released_at=now() WHERE id=$1::uuid`, transferID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": transferID, "documentNo": docNo, "status": "IN_TRANSIT"}
	audit(ctx, tx, rs, requestID, "warehouse", "release", "stock_transfer", transferID, body)
	outbox(ctx, tx, rs, "stock_transfer", transferID, "stock_transfer.released", body)
	return body, nil
}

func (s Service) ReceiveTransfer(ctx context.Context, tx pgx.Tx, rs ResolvedScope, transferID, requestID string) (map[string]any, error) {
	var destID, siteID, docNo string
	if err := tx.QueryRow(ctx, `SELECT destination_warehouse_id::text,site_id::text,document_no FROM erp.stock_transfers WHERE id=$1::uuid AND entity_id=$2::uuid AND status='IN_TRANSIT' FOR UPDATE`, transferID, rs.EntityID).Scan(&destID, &siteID, &docNo); err != nil {
		return nil, errors.New("in-transit transfer not found")
	}
	rs.SiteID = siteID
	rows, err := tx.Query(ctx, `SELECT tl.id::text,tl.item_id::text,tl.shipped_qty::float8,tl.carrying_unit_cost::float8 FROM erp.stock_transfer_lines tl WHERE tl.stock_transfer_id=$1::uuid ORDER BY tl.line_no`, transferID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	type l struct {
		id, item  string
		qty, cost float64
	}
	lines := []l{}
	for rows.Next() {
		var x l
		if err := rows.Scan(&x.id, &x.item, &x.qty, &x.cost); err != nil {
			return nil, err
		}
		lines = append(lines, x)
	}
	for _, line := range lines {
		if line.qty <= 0 {
			continue
		}
		_, err = tx.Exec(ctx, `INSERT INTO erp.inventory_balance(warehouse_id,item_id,on_hand_qty,reserved_qty,inbound_qty,average_cost,row_version) VALUES($1::uuid,$2::uuid,$3,0,0,$4,1) ON CONFLICT(warehouse_id,item_id) DO UPDATE SET average_cost=CASE WHEN erp.inventory_balance.on_hand_qty+EXCLUDED.on_hand_qty=0 THEN EXCLUDED.average_cost ELSE ((erp.inventory_balance.on_hand_qty*erp.inventory_balance.average_cost)+(EXCLUDED.on_hand_qty*EXCLUDED.average_cost))/(erp.inventory_balance.on_hand_qty+EXCLUDED.on_hand_qty) END,on_hand_qty=erp.inventory_balance.on_hand_qty+EXCLUDED.on_hand_qty,row_version=erp.inventory_balance.row_version+1,updated_at=now()`, destID, line.item, line.qty, line.cost)
		if err != nil {
			return nil, err
		}
		var balance float64
		if err := tx.QueryRow(ctx, `SELECT on_hand_qty::float8 FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid`, destID, line.item).Scan(&balance); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.stock_transfer_lines SET received_qty=shipped_qty WHERE id=$1::uuid`, line.id); err != nil {
			return nil, err
		}
		if _, err := tx.Exec(ctx, `INSERT INTO erp.stock_movements(entity_id,site_id,warehouse_id,item_id,movement_type,qty,unit_cost,movement_value,balance_after_qty,reference_type,reference_id,request_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,'TRANSFER_IN',$5,$6,$7,$8,'STOCK_TRANSFER',$9,$10)`, rs.EntityID, siteID, destID, line.item, line.qty, line.cost, line.qty*line.cost, balance, docNo, requestID); err != nil {
			return nil, err
		}
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.stock_transfers SET status='RECEIVED',received_at=now() WHERE id=$1::uuid`, transferID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": transferID, "documentNo": docNo, "status": "RECEIVED"}
	audit(ctx, tx, rs, requestID, "warehouse", "receive", "stock_transfer", transferID, body)
	outbox(ctx, tx, rs, "stock_transfer", transferID, "stock_transfer.received", body)
	return body, nil
}
