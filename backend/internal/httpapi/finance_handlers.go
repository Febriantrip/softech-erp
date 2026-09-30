package httpapi

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
	financecore "github.com/nexa-distributor/erp-backend/internal/domain/finance"
	"github.com/nexa-distributor/erp-backend/internal/security"
)

func (s *Server) financeScope(r *http.Request) (financecore.Scope, error) {
	claims, ok := ClaimsFromContext(r.Context())
	if !ok {
		return financecore.Scope{}, errors.New("authenticated claims missing")
	}
	entityCode := strings.TrimSpace(r.Header.Get("X-Entity-ID"))
	siteCode := strings.TrimSpace(r.Header.Get("X-Site-ID"))
	if entityCode == "" {
		return financecore.Scope{}, errors.New("X-Entity-ID header is required")
	}
	if !security.Has(claims.Entities, entityCode) {
		return financecore.Scope{}, security.ScopeError("entity", entityCode)
	}
	if siteCode != "" && !security.Has(claims.Sites, siteCode) {
		return financecore.Scope{}, security.ScopeError("site", siteCode)
	}
	return financecore.Scope{EntityCode: entityCode, SiteCode: siteCode, Username: claims.Subject, RequestID: r.Header.Get("X-Request-ID")}, nil
}

func (s *Server) financeRunner(r *http.Request, operation string) func(financecore.Scope, financecore.CommandFunc) (financecore.CommandResult, error) {
	return func(scope financecore.Scope, fn financecore.CommandFunc) (financecore.CommandResult, error) {
		return s.finance.Command(r.Context(), operation, commandKey(r), scope, fn)
	}
}

func (s *Server) runFinanceCommand(w http.ResponseWriter, r *http.Request, operation string, fn financecore.CommandFunc) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	if commandKey(r) == "" {
		writeError(w, http.StatusBadRequest, "IDEMPOTENCY_REQUIRED", "Idempotency-Key header is required for commands")
		return
	}
	result, err := s.financeRunner(r, operation)(scope, fn)
	if err != nil {
		s.logger.Warn("finance_command_rejected", "operation", operation, "error", err.Error(), "request_id", scope.RequestID)
		writeError(w, http.StatusConflict, "COMMAND_REJECTED", err.Error())
		return
	}
	if result.Replay {
		w.Header().Set("X-Idempotent-Replay", "true")
	}
	writeJSON(w, result.Status, result.Body)
}

func (s *Server) financeBootstrap(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.Bootstrap(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeJournals(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListJournals(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeTrialBalance(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.TrialBalance(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeSalesInvoices(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListSalesInvoices(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financePurchaseInvoices(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListPurchaseInvoices(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeAR(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListAR(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeAP(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListAP(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeReceipts(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListReceipts(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}
func (s *Server) financeReceiptDetail(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ReceiptDetail(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, 404, "RECEIPT_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}

func (s *Server) financeSupplierPayments(w http.ResponseWriter, r *http.Request) {
	scope, err := s.financeScope(r)
	if err != nil {
		writeError(w, 403, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	data, err := s.finance.ListSupplierPayments(r.Context(), scope.EntityCode, scope.SiteCode)
	if err != nil {
		writeError(w, 500, "FINANCE_READ_ERROR", err.Error())
		return
	}
	writeJSON(w, 200, map[string]any{"data": data})
}

func (s *Server) financeCreateSalesInvoice(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[financecore.CreateInvoiceInput](w, r)
	if !ok {
		return
	}
	op := "finance.sales_invoice.create"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.CreateSalesInvoice(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financePostSalesInvoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "finance.sales_invoice.post"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.PostSalesInvoice(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeCreateReceipt(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[financecore.ReceiptInput](w, r)
	if !ok {
		return
	}
	op := "finance.customer_receipt.post"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.ReceiveCustomerPayment(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeCreatePurchaseInvoice(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[financecore.CreateInvoiceInput](w, r)
	if !ok {
		return
	}
	op := "finance.purchase_invoice.create"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.CreatePurchaseInvoice(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financePostPurchaseInvoice(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "finance.purchase_invoice.post"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.PostPurchaseInvoice(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeCreateSupplierPayment(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[financecore.SupplierPaymentInput](w, r)
	if !ok {
		return
	}
	op := "finance.supplier_payment.post"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.PaySupplier(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeCreateManualJournal(w http.ResponseWriter, r *http.Request) {
	input, ok := decodeBody[financecore.ManualJournalInput](w, r)
	if !ok {
		return
	}
	op := "finance.manual_journal.post"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.CreateManualJournal(ctx, tx, rs, input, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeClosePeriod(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "finance.period.close"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.ClosePeriod(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
func (s *Server) financeReopenPeriod(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	op := "finance.period.reopen"
	s.runFinanceCommand(w, r, op, func(ctx context.Context, tx pgx.Tx, rs financecore.ResolvedScope) (map[string]any, error) {
		return s.finance.ReopenPeriod(ctx, tx, rs, id, r.Header.Get("X-Request-ID"))
	})
}
