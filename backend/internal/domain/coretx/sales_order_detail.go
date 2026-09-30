package coretx

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
)

type UpdateSalesOrderInput struct {
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
	RevisionNo            *int            `json:"revisionNo,omitempty"`
	Lines                 []ItemLineInput `json:"lines"`
}

type CancelSalesOrderInput struct {
	Reason string `json:"reason"`
}

type lockedSalesOrder struct {
	DocumentNo  string
	Status      string
	SiteID      string
	WarehouseID string
	RevisionNo  int
}

func lockSalesOrderMutation(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID string) (lockedSalesOrder, error) {
	var row lockedSalesOrder
	q := `SELECT document_no,status,site_id::text,warehouse_id::text,revision_no
          FROM erp.sales_orders
          WHERE id=$1::uuid AND entity_id=$2::uuid`
	args := []any{orderID, rs.EntityID}
	if strings.TrimSpace(rs.SiteID) != "" {
		q += ` AND site_id=$3::uuid`
		args = append(args, rs.SiteID)
	}
	q += ` FOR UPDATE`
	err := tx.QueryRow(ctx, q, args...).Scan(&row.DocumentNo, &row.Status, &row.SiteID, &row.WarehouseID, &row.RevisionNo)
	if err != nil {
		return row, errors.New("sales order not found in current entity/site scope")
	}
	return row, nil
}

func salesOrderCanCancel(status string) bool {
	switch status {
	case "PENDING_APPROVAL", "APPROVED", "RESERVED":
		return true
	default:
		return false
	}
}

func (s Service) UpdateSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID string, input UpdateSalesOrderInput, requestID string) (map[string]any, error) {
	if len(input.Lines) == 0 {
		return nil, errors.New("sales order requires at least one line")
	}
	locked, err := lockSalesOrderMutation(ctx, tx, rs, orderID)
	if err != nil {
		return nil, err
	}
	if locked.Status != "DRAFT" {
		return nil, errors.New("only draft sales orders can be edited")
	}
	if input.RevisionNo != nil && *input.RevisionNo != locked.RevisionNo {
		return nil, fmt.Errorf("sales order revision conflict: expected %d, current %d; reload before saving", *input.RevisionNo, locked.RevisionNo)
	}

	rs.SiteID = locked.SiteID
	var warehouseID, customerID, defaultTerms string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.warehouses WHERE entity_id=$1::uuid AND site_id=$2::uuid AND code=$3 AND status='ACTIVE'`, rs.EntityID, locked.SiteID, input.WarehouseCode).Scan(&warehouseID); err != nil {
		return nil, errors.New("warehouse is invalid for sales order site")
	}
	if err := tx.QueryRow(ctx, `SELECT id::text,payment_terms FROM erp.customers WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, input.CustomerCode).Scan(&customerID, &defaultTerms); err != nil {
		return nil, errors.New("customer is invalid for entity")
	}
	terms := strings.TrimSpace(input.PaymentTerms)
	if terms == "" {
		terms = defaultTerms
	}
	date := parseDate(input.OrderDate)
	nextRevision := locked.RevisionNo + 1
	_, err = tx.Exec(ctx, `UPDATE erp.sales_orders SET warehouse_id=$2::uuid,customer_id=$3::uuid,order_date=$4,requested_delivery_date=$5,customer_po=$6,payment_terms=$7,billing_address=$8,shipping_address=$9,salesperson=$10,notes=$11,internal_notes=$12,revision_no=$13,updated_at=now() WHERE id=$1::uuid`, orderID, warehouseID, customerID, date, parseOptionalDate(input.RequestedDeliveryDate), strings.TrimSpace(input.CustomerPO), terms, strings.TrimSpace(input.BillingAddress), strings.TrimSpace(input.ShippingAddress), strings.TrimSpace(input.Salesperson), strings.TrimSpace(input.Notes), strings.TrimSpace(input.InternalNotes), nextRevision)
	if err != nil {
		return nil, err
	}
	if _, err := s.replaceSalesOrderLines(ctx, tx, orderID, input.Lines); err != nil {
		return nil, err
	}
	if err := s.recalculateSalesOrder(ctx, tx, orderID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": orderID, "documentNo": locked.DocumentNo, "status": "DRAFT", "revisionNo": nextRevision, "updated": true}
	audit(ctx, tx, rs, requestID, "sales", "edit", "sales_order", orderID, body)
	outbox(ctx, tx, rs, "sales_order", orderID, "sales_order.updated", body)
	return body, nil
}

func (s Service) DeleteSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID, requestID string) (map[string]any, error) {
	locked, err := lockSalesOrderMutation(ctx, tx, rs, orderID)
	if err != nil {
		return nil, err
	}
	if locked.Status != "DRAFT" {
		return nil, errors.New("only draft sales orders can be deleted")
	}
	rs.SiteID = locked.SiteID
	body := map[string]any{"id": orderID, "documentNo": locked.DocumentNo, "status": locked.Status, "deleted": true}
	audit(ctx, tx, rs, requestID, "sales", "delete", "sales_order", orderID, body)
	outbox(ctx, tx, rs, "sales_order", orderID, "sales_order.deleted", body)
	if _, err := tx.Exec(ctx, `DELETE FROM erp.sales_orders WHERE id=$1::uuid`, orderID); err != nil {
		return nil, err
	}
	return body, nil
}

func (s Service) CancelSalesOrder(ctx context.Context, tx pgx.Tx, rs ResolvedScope, orderID string, input CancelSalesOrderInput, requestID string) (map[string]any, error) {
	reason := strings.TrimSpace(input.Reason)
	if reason == "" {
		return nil, errors.New("cancel reason is required")
	}
	locked, err := lockSalesOrderMutation(ctx, tx, rs, orderID)
	if err != nil {
		return nil, err
	}
	if locked.Status == "DRAFT" {
		return nil, errors.New("draft sales orders must be deleted, not cancelled")
	}
	if !salesOrderCanCancel(locked.Status) {
		return nil, errors.New("sales order cannot be cancelled in current status; shipped documents require return/reversal workflow")
	}
	rs.SiteID = locked.SiteID

	var activeDelivery bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.delivery_orders WHERE sales_order_id=$1::uuid AND status<>'CANCELLED')`, orderID).Scan(&activeDelivery); err != nil {
		return nil, err
	}
	if activeDelivery {
		return nil, errors.New("cancel active Delivery Orders before cancelling the Sales Order")
	}

	var activePicking bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.picking_orders WHERE sales_order_id=$1::uuid AND status IN ('OPEN','IN_PROGRESS','COMPLETED'))`, orderID).Scan(&activePicking); err != nil {
		return nil, err
	}
	if activePicking {
		return nil, errors.New("cancel active Picking Orders before cancelling the Sales Order")
	}

	if locked.Status == "RESERVED" {
		rows, err := tx.Query(ctx, `SELECT sol.item_id::text,sol.reserved_qty::float8,i.sku FROM erp.sales_order_lines sol JOIN erp.items i ON i.id=sol.item_id WHERE sol.sales_order_id=$1::uuid ORDER BY sol.line_no`, orderID)
		if err != nil {
			return nil, err
		}
		type release struct {
			item, sku string
			qty       float64
		}
		releases := []release{}
		for rows.Next() {
			var x release
			if err := rows.Scan(&x.item, &x.qty, &x.sku); err != nil {
				rows.Close()
				return nil, err
			}
			releases = append(releases, x)
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, err
		}
		rows.Close()
		for _, x := range releases {
			if x.qty <= 0 {
				continue
			}
			var currentReserved float64
			if err := tx.QueryRow(ctx, `SELECT reserved_qty::float8 FROM erp.inventory_balance WHERE warehouse_id=$1::uuid AND item_id=$2::uuid FOR UPDATE`, locked.WarehouseID, x.item).Scan(&currentReserved); err != nil {
				return nil, fmt.Errorf("inventory reservation missing for %s", x.sku)
			}
			if currentReserved+0.0000001 < x.qty {
				return nil, fmt.Errorf("reservation balance changed for %s; reload and reconcile before cancel", x.sku)
			}
			if _, err := tx.Exec(ctx, `UPDATE erp.inventory_balance SET reserved_qty=reserved_qty-$3,row_version=row_version+1,updated_at=now() WHERE warehouse_id=$1::uuid AND item_id=$2::uuid`, locked.WarehouseID, x.item, x.qty); err != nil {
				return nil, err
			}
		}
		if _, err := tx.Exec(ctx, `UPDATE erp.sales_order_lines SET reserved_qty=0 WHERE sales_order_id=$1::uuid`, orderID); err != nil {
			return nil, err
		}
	}

	_, err = tx.Exec(ctx, `UPDATE erp.sales_orders SET status='CANCELLED',cancel_reason=$2,cancelled_at=now(),cancelled_by=$3::uuid,updated_at=now() WHERE id=$1::uuid`, orderID, reason, rs.UserID)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"id": orderID, "documentNo": locked.DocumentNo, "previousStatus": locked.Status, "status": "CANCELLED", "reason": reason}
	audit(ctx, tx, rs, requestID, "sales", "cancel", "sales_order", orderID, body)
	outbox(ctx, tx, rs, "sales_order", orderID, "sales_order.cancelled", body)
	return body, nil
}
