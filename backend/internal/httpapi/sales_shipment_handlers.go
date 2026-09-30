package httpapi

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
)

type shipmentCancelInput struct {
	Reason string `json:"reason"`
}

func (s *Server) coreShipments(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	rows, err := s.core.ListShipments(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "CORE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": rows})
}

func (s *Server) coreShipmentDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	row, err := s.core.ShipmentDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "SHIPMENT_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": row})
}

func (s *Server) coreCreateShipment(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.CreateShipmentInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "shipment.create"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CreateShipment(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreUpdateShipment(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.UpdateShipmentInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "shipment.update"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.UpdateShipment(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreDispatchShipment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "shipment.dispatch"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.DispatchShipment(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreDeliverShipment(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[coretx.DeliverShipmentInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "shipment.deliver"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.DeliverShipment(ctx, tx, rs, id, input, r.Header.Get("X-Request-ID"))
	})
}

func (s *Server) coreCancelShipment(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[shipmentCancelInput](w, r)
	if !ok {
		return
	}
	id := r.PathValue("id")
	op := "shipment.cancel"
	s.runCoreCommand(w, r, op, s.commandRunner(r, op), func(ctx context.Context, tx pgx.Tx, rs coretx.ResolvedScope) (map[string]any, error) {
		return s.core.CancelShipment(ctx, tx, rs, id, input.Reason, r.Header.Get("X-Request-ID"))
	})
}
