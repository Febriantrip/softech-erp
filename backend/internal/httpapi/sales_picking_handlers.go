package httpapi

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
)

type pickingCancelInput struct {
	Reason string `json:"reason"`
}

func (s *Server) corePickingOrders(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListPickingOrders(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows})
}

func (s *Server) corePickingOrderDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	row, err := s.core.PickingOrderDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "PICKING_ORDER_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": row})
}

func (s *Server) coreCreatePickingOrder(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "picking_order.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreatePickingOrder(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreUpdatePickingOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdatePickingInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "picking_order.update"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.UpdatePickingOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCompletePickingOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdatePickingInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "picking_order.complete"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CompletePickingOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCancelPickingOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[pickingCancelInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "picking_order.cancel"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CancelPickingOrder(ctx, tx, rs, id, input.Reason, r.Header.Get("X-Request-ID"))
	})
}
