package httpapi

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
)

type deliveryCancelInput struct {
	Reason string `json:"reason"`
}

func (s *Server) coreDeliveryOrders(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListDeliveryOrders(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows})
}
func (s *Server) coreDeliveryOrderDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	row, err := s.core.DeliveryOrderDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "DELIVERY_ORDER_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": row})
}
func (s *Server) coreCreateDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CreateDeliveryOrderInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "delivery_order.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreateDeliveryOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreUpdateDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdateDeliveryOrderInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "delivery_order.update"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.UpdateDeliveryOrder(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreReleaseDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	s.deliveryTransition(w, r, "READY_TO_LOAD", "delivery_order.release")
}
func (s *Server) coreStartLoadingDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	s.deliveryTransition(w, r, "LOADING", "delivery_order.load")
}
func (s *Server) coreCompleteLoadingDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	s.deliveryTransition(w, r, "LOADED", "delivery_order.complete")
}
func (s *Server) deliveryTransition(w http.ResponseWriter, r *http.Request, status, op string) {
	id := r.PathValue("id")
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.TransitionDeliveryOrder(ctx, tx, rs, id, status, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) coreCancelDeliveryOrder(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[deliveryCancelInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "delivery_order.cancel"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CancelDeliveryOrder(ctx, tx, rs, id, input.Reason, r.Header.Get("X-Request-ID"))
	})
}
