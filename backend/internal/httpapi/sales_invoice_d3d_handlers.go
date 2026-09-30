package httpapi

import (
	"context"
	"net/http"

	"github.com/jackc/pgx/v5"
	financecore "github.com/nexa-distributor/erp-backend/internal/domain/finance"
)

func (s *Server) financeSalesInvoiceSource(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.SalesInvoiceSource(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, 404, "INVOICE_SOURCE_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeSalesInvoiceDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.SalesInvoiceDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, 404, "SALES_INVOICE_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeDeleteSalesInvoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	s.runFinanceCommand(w, r, "finance.sales_invoice.delete", func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.DeleteSalesInvoiceDraft(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
