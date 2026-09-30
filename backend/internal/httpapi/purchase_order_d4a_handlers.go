package httpapi

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
)

func (s *Server) corePurchaseOrderDetailD4A(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	result, err := s.core.PurchaseOrderDetailD4A(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "PURCHASE_ORDER_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}
func (s *Server) coreUpdatePurchaseOrderD4A(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdatePurchaseOrderInput](w, r)
	if !ok {
		return
	}
	op := "purchase_order.edit"
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.UpdatePurchaseOrderD4A(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreDeletePurchaseOrderD4A(w http.ResponseWriter, r *http.Request) {
	op := "purchase_order.delete"
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.DeletePurchaseOrderD4A(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreCancelPurchaseOrderD4A(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CancelPurchaseOrderInput](w, r)
	if !ok {
		return
	}
	op := "purchase_order.cancel"
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CancelPurchaseOrderD4A(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
