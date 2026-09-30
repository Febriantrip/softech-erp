package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
	"github.com/nexa-distributor/erp-backend/internal/security"
)

func (s *Server) coreScope(r *http.Request) (coretx.Scope, error) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return coretx.Scope{}, errors.New("authenticated claims missing")
	}
	entityCode := strings.TrimSpace(r.Header.Get("X-Entity-ID"))
	siteCode := strings.TrimSpace(r.Header.Get("X-Site-ID"))
	if entityCode == "" {
		return coretx.Scope{}, errors.New("X-Entity-ID header is required")
	}
	if !security.Has(claims.Entities, entityCode) {
		return coretx.Scope{}, security.ScopeError("entity", entityCode)
	}
	if siteCode != "" && !security.Has(claims.Sites, siteCode) {
		return coretx.Scope{}, security.ScopeError("site", siteCode)
	}
	return coretx.Scope{EntityCode: entityCode, SiteCode: siteCode, Username: claims.Subject, RequestID: r.Header.Get("X-Request-ID")}, nil
}

func decodeBody[T any](w http.ResponseWriter, r *http.Request) (T, bool) {
	var input T
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2*1024*1024))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&input); err != nil {
		writeError(w, http.StatusBadRequest, "INVALID_REQUEST", err.Error())
		return input, false
	}
	return input, true
}

func commandKey(r *http.Request) string { return strings.TrimSpace(r.Header.Get("Idempotency-Key")) }

func (s *Server) runCoreCommand(w http.ResponseWriter, r *http.Request, operation string, command func(scope coretx.Scope, fn coretx.CommandFunc) (coretx.CommandResult, error), fn coretx.CommandFunc) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	if commandKey(r) == "" {
		writeError(w, http.StatusBadRequest, "IDEMPOTENCY_REQUIRED", "Idempotency-Key header is required for commands")
		return
	}
	result, err := command(scope, fn)
	if err != nil {
		s.logger.Warn("core_command_rejected", "operation", operation, "error", err.Error(), "request_id", scope.RequestID)
		writeError(w, http.StatusConflict, "COMMAND_REJECTED", err.Error())
		return
	}
	if result.Replay {
		w.Header().Set("X-Idempotent-Replay", "true")
	}
	writeJSON(w, result.Status, result.Body)
}

func (s *Server) commandRunner(r *http.Request, operation string) func(coretx.Scope, coretx.CommandFunc) (coretx.CommandResult, error) {
	return func(scope coretx.Scope, fn coretx.CommandFunc) (coretx.CommandResult, error) {
		return s.core.Command(r.Context(), operation, commandKey(r), scope, fn)
	}
}

func (s *Server) coreBootstrap(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.core.Bootstrap(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}
func (s *Server) coreInventory(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListInventory(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}
func (s *Server) coreMovements(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListMovements(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}
func (s *Server) coreSalesOrders(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListSalesOrders(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}
func (s *Server) corePurchaseOrders(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListPurchaseOrders(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}
func (s *Server) coreReceipts(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListReceipts(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}
func (s *Server) coreTransfers(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListTransfers(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": rows})
}

func (s *Server) coreCreateSalesOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CreateSalesOrderInput](w, r)
	if !ok {
		return
	}
	op := "sales_order.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreateSalesOrder(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreSubmitSalesOrder(w http.ResponseWriter, r *http.Request) {
	s.salesOrderTransition(w, r, "sales_order.submit", "DRAFT", "PENDING_APPROVAL")
}
func (s *Server) coreApproveSalesOrder(w http.ResponseWriter, r *http.Request) {
	s.salesOrderTransition(w, r, "sales_order.approve", "PENDING_APPROVAL", "APPROVED")
}
func (s *Server) salesOrderTransition(w http.ResponseWriter, r *http.Request, op, from, to string) {
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.TransitionSalesOrder(ctx, tx, rs, id, from, to, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreReserveSalesOrder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "sales_order.reserve"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.ReserveSalesOrder(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreDispatchSalesOrder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "sales_order.dispatch"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.DispatchSalesOrder(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCreatePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CreatePurchaseOrderInput](w, r)
	if !ok {
		return
	}
	op := "purchase_order.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreatePurchaseOrder(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreSubmitPurchaseOrder(w http.ResponseWriter, r *http.Request) {
	s.purchaseOrderTransition(w, r, "purchase_order.submit", "DRAFT", "PENDING_APPROVAL")
}
func (s *Server) coreApprovePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	s.purchaseOrderTransition(w, r, "purchase_order.approve", "PENDING_APPROVAL", "APPROVED")
}
func (s *Server) purchaseOrderTransition(w http.ResponseWriter, r *http.Request, op, from, to string) {
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.TransitionPurchaseOrder(ctx, tx, rs, id, from, to, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreReceivePurchaseOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.ReceivePOInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "purchase_order.receive"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.ReceivePurchaseOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) corePutAwayReceipt(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "goods_receipt.put_away"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.PutAwayReceipt(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCreateTransfer(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CreateTransferInput](w, r)
	if !ok {
		return
	}
	op := "stock_transfer.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreateTransfer(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreReleaseTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "stock_transfer.release"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.ReleaseTransfer(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreReceiveTransfer(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "stock_transfer.receive"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.ReceiveTransfer(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreSalesOrderDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.core.SalesOrderDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "SALES_ORDER_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": data})
}

func (s *Server) coreUpdateSalesOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdateSalesOrderInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "sales_order.edit"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.UpdateSalesOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreDeleteSalesOrder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "sales_order.delete"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.DeleteSalesOrder(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCancelSalesOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CancelSalesOrderInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "sales_order.cancel"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CancelSalesOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
