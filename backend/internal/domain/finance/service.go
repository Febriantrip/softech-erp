package finance

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct{ DB *pgxpool.Pool }

type Scope struct {
	EntityCode string
	SiteCode   string
	Username   string
	RequestID  string
}

type ResolvedScope struct {
	EntityID   string
	SiteID     string
	UserID     string
	EntityCode string
	SiteCode   string
}

type CommandResult struct {
	Status int
	Body   map[string]any
	Replay bool
}

type CommandFunc func(context.Context, pgx.Tx, ResolvedScope) (map[string]any, error)

type ReceiptInput struct {
	SalesInvoiceID  string                   `json:"salesInvoiceId"`
	Amount          float64                  `json:"amount"`
	BankAccountCode string                   `json:"bankAccountCode"`
	ReceiptDate     string                   `json:"receiptDate"`
	Method          string                   `json:"method"`
	Reference       string                   `json:"reference"`
	Allocations     []ReceiptAllocationInput `json:"allocations,omitempty"`
}

type SupplierPaymentInput struct {
	PurchaseInvoiceID string  `json:"purchaseInvoiceId"`
	Amount            float64 `json:"amount"`
	BankAccountCode   string  `json:"bankAccountCode"`
	PaymentDate       string  `json:"paymentDate"`
	Method            string  `json:"method"`
	Reference         string  `json:"reference"`
}

type CreateInvoiceInput struct {
	SourceID          string             `json:"sourceId"`
	Date              string             `json:"date"`
	ExternalReference string             `json:"externalReference"`
	Lines             []InvoiceLineInput `json:"lines,omitempty"`
}

type ManualJournalLineInput struct {
	AccountCode string  `json:"accountCode"`
	Debit       float64 `json:"debit"`
	Credit      float64 `json:"credit"`
	Memo        string  `json:"memo"`
}

type ManualJournalInput struct {
	PostingDate string                   `json:"postingDate"`
	Description string                   `json:"description"`
	Lines       []ManualJournalLineInput `json:"lines"`
}

type InventoryIssue struct {
	EntityID    string
	SiteID      string
	UserID      string
	EntityCode  string
	SiteCode    string
	PostingDate time.Time
	ShipmentID  string
	ShipmentNo  string
	Amount      float64
}

func round2(v float64) float64 { return math.Round(v*100) / 100 }

func parseDate(value string) time.Time {
	if parsed, err := time.Parse("2006-01-02", strings.TrimSpace(value)); err == nil {
		return parsed
	}
	return time.Now().UTC()
}

func prefix(entity, site, doc string, date time.Time) string {
	site = strings.ReplaceAll(site, "-", "")
	if site == "" {
		site = "ALL"
	}
	return fmt.Sprintf("%s-%s-%s-%02d%02d-", entity, site, doc, date.Year()%100, int(date.Month()))
}

func dueDate(invoiceDate time.Time, terms string) time.Time {
	upper := strings.ToUpper(strings.TrimSpace(terms))
	if strings.HasPrefix(upper, "NET ") {
		if n, err := strconv.Atoi(strings.TrimSpace(strings.TrimPrefix(upper, "NET "))); err == nil && n >= 0 && n <= 365 {
			return invoiceDate.AddDate(0, 0, n)
		}
	}
	return invoiceDate.AddDate(0, 0, 30)
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
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtextextended($1,0))`, operation+":"+key); err != nil {
		return CommandResult{}, err
	}
	var storedStatus int
	var storedBody string
	err = tx.QueryRow(ctx, `SELECT response_status,response_body::text FROM erp.idempotency_keys WHERE idempotency_key=$1 AND operation=$2 AND expires_at>now()`, key, operation).Scan(&storedStatus, &storedBody)
	if err == nil {
		body := map[string]any{}
		if json.Unmarshal([]byte(storedBody), &body) != nil {
			body = map[string]any{"replayed": true}
		}
		if err = tx.Commit(ctx); err != nil {
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
	h := sha256.Sum256([]byte(operation + "|" + scope.EntityCode + "|" + scope.SiteCode))
	_, err = tx.Exec(ctx, `INSERT INTO erp.idempotency_keys(idempotency_key,user_id,entity_id,operation,request_hash,response_status,response_body,expires_at) VALUES($1,$2::uuid,$3::uuid,$4,$5,200,$6::jsonb,now()+interval '24 hours')`, key, rs.UserID, rs.EntityID, operation, hex.EncodeToString(h[:]), string(raw))
	if err != nil {
		return CommandResult{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return CommandResult{}, err
	}
	return CommandResult{Status: 200, Body: body}, nil
}

func resolveScope(ctx context.Context, tx pgx.Tx, scope Scope) (ResolvedScope, error) {
	rs := ResolvedScope{EntityCode: scope.EntityCode, SiteCode: scope.SiteCode}
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.entities WHERE code=$1 AND status='ACTIVE'`, scope.EntityCode).Scan(&rs.EntityID); err != nil {
		return rs, fmt.Errorf("entity scope not found: %w", err)
	}
	if scope.SiteCode != "" {
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

func accountID(ctx context.Context, tx pgx.Tx, entityID, code string) (string, error) {
	var id string
	if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.chart_of_accounts WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, entityID, code).Scan(&id); err != nil {
		return "", fmt.Errorf("GL account %s is missing", code)
	}
	return id, nil
}

func periodID(ctx context.Context, tx pgx.Tx, entityID string, date time.Time) (string, error) {
	var id string
	if err := tx.QueryRow(ctx, `SELECT erp.assert_open_period($1::uuid,$2)::text`, entityID, date).Scan(&id); err != nil {
		return "", errors.New("accounting period is closed or unavailable")
	}
	return id, nil
}

func audit(ctx context.Context, tx pgx.Tx, rs ResolvedScope, requestID, module, action, resourceType, resourceID string, after any) {
	raw, _ := json.Marshal(after)
	var site any = nil
	if rs.SiteID != "" {
		site = rs.SiteID
	}
	_, _ = tx.Exec(ctx, `INSERT INTO erp.audit_events(request_id,user_id,entity_id,site_id,module,action,resource_type,resource_id,after_data) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::jsonb)`, requestID, rs.UserID, rs.EntityID, site, module, action, resourceType, resourceID, string(raw))
}
func outbox(ctx context.Context, tx pgx.Tx, rs ResolvedScope, aggregateType, aggregateID, eventType string, payload any) {
	raw, _ := json.Marshal(payload)
	var site any = nil
	if rs.SiteID != "" {
		site = rs.SiteID
	}
	_, _ = tx.Exec(ctx, `INSERT INTO erp.outbox_events(aggregate_type,aggregate_id,event_type,payload,entity_id,site_id) VALUES($1,$2,$3,$4::jsonb,$5::uuid,$6::uuid)`, aggregateType, aggregateID, eventType, string(raw), rs.EntityID, site)
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
		m := map[string]any{}
		for i, k := range keys {
			m[k] = vals[i]
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s Service) Bootstrap(ctx context.Context, entityCode, siteCode string) (map[string]any, error) {
	periods, err := s.ListPeriods(ctx, entityCode)
	if err != nil {
		return nil, err
	}
	accounts, err := s.ListAccounts(ctx, entityCode)
	if err != nil {
		return nil, err
	}
	banks, err := s.ListBankAccounts(ctx, entityCode, siteCode)
	if err != nil {
		return nil, err
	}
	salesSources, err := s.ListSalesInvoiceSources(ctx, entityCode, siteCode)
	if err != nil {
		return nil, err
	}
	purchaseSources, err := s.ListPurchaseInvoiceSources(ctx, entityCode, siteCode)
	if err != nil {
		return nil, err
	}
	return map[string]any{"periods": periods, "accounts": accounts, "bankAccounts": banks, "salesInvoiceSources": salesSources, "purchaseInvoiceSources": purchaseSources}, nil
}

func entityIDByCode(ctx context.Context, db *pgxpool.Pool, entityCode string) (string, error) {
	var id string
	err := db.QueryRow(ctx, `SELECT id::text FROM erp.entities WHERE code=$1`, entityCode).Scan(&id)
	return id, err
}
func siteFilter(entityCode, siteCode string) (string, []any) {
	args := []any{entityCode}
	clause := ""
	if siteCode != "" {
		clause = " AND st.code=$2"
		args = append(args, siteCode)
	}
	return clause, args
}

func (s Service) ListPeriods(ctx context.Context, entityCode string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT p.id::text,p.period_code,p.label,p.start_date,p.end_date,p.status,p.closed_at FROM erp.accounting_periods p JOIN erp.entities e ON e.id=p.entity_id WHERE e.code=$1 ORDER BY p.start_date`, []string{"id", "periodCode", "label", "startDate", "endDate", "status", "closedAt"}, entityCode)
}
func (s Service) ListAccounts(ctx context.Context, entityCode string) ([]map[string]any, error) {
	return queryRows(s.DB, ctx, `SELECT a.id::text,a.code,a.name,a.account_type,a.normal_balance,a.allow_manual_posting FROM erp.chart_of_accounts a JOIN erp.entities e ON e.id=a.entity_id WHERE e.code=$1 AND a.status='ACTIVE' ORDER BY a.code`, []string{"id", "code", "name", "type", "normalBalance", "allowManualPosting"}, entityCode)
}
func (s Service) ListBankAccounts(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT b.id::text,b.code,b.name,b.account_type,b.currency,b.balance::float8,COALESCE(st.code,'') FROM erp.bank_accounts b JOIN erp.entities e ON e.id=b.entity_id LEFT JOIN erp.sites st ON st.id=b.site_id WHERE e.code=$1 AND b.status='ACTIVE'`
	args := []any{entityCode}
	if siteCode != "" {
		q += ` AND (st.code=$2 OR b.site_id IS NULL)`
		args = append(args, siteCode)
	}
	q += ` ORDER BY b.code`
	return queryRows(s.DB, ctx, q, []string{"id", "code", "name", "type", "currency", "balance", "siteCode"}, args...)
}
func (s Service) ListPurchaseInvoiceSources(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT gr.id::text,gr.document_no,gr.receipt_date,s.code,s.name,st.code,po.document_no,COALESCE(sum(grl.accepted_qty*pol.unit_price*(1+pol.tax_rate/100)),0)::float8 FROM erp.goods_receipts gr JOIN erp.entities e ON e.id=gr.entity_id JOIN erp.sites st ON st.id=gr.site_id JOIN erp.purchase_orders po ON po.id=gr.purchase_order_id JOIN erp.suppliers s ON s.id=po.supplier_id JOIN erp.goods_receipt_lines grl ON grl.goods_receipt_id=gr.id JOIN erp.purchase_order_lines pol ON pol.purchase_order_id=po.id AND pol.item_id=grl.item_id WHERE e.code=$1 AND gr.status='PUT_AWAY' AND NOT EXISTS(SELECT 1 FROM erp.purchase_invoices pi WHERE pi.entity_id=gr.entity_id AND pi.goods_receipt_id=gr.id AND pi.status<>'VOID')` + cl + ` GROUP BY gr.id,s.code,s.name,st.code,po.document_no ORDER BY gr.receipt_date DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "date", "partyCode", "partyName", "siteCode", "purchaseOrderNo", "total"}, args...)
}
func (s Service) ListSalesInvoices(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT si.id::text,si.document_no,si.invoice_date,si.due_date,si.status,si.subtotal::float8,si.tax_amount::float8,si.total_amount::float8,si.paid_amount::float8,c.code,c.name,so.document_no,st.code,COALESCE(j.document_no,''),COALESCE(sh.document_no,''),si.discount_amount::float8,(CASE WHEN si.shipment_id IS NULL THEN si.subtotal-si.discount_amount ELSE si.dpp_amount END)::float8 FROM erp.sales_invoices si JOIN erp.entities e ON e.id=si.entity_id JOIN erp.sites st ON st.id=si.site_id JOIN erp.customers c ON c.id=si.customer_id JOIN erp.sales_orders so ON so.id=si.sales_order_id LEFT JOIN erp.journal_entries j ON j.id=si.journal_entry_id LEFT JOIN erp.shipments sh ON sh.id=si.shipment_id WHERE e.code=$1` + cl + ` ORDER BY si.invoice_date DESC,si.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "invoiceDate", "dueDate", "status", "subtotal", "tax", "total", "paidAmount", "customerCode", "customerName", "salesOrderNo", "siteCode", "journalNo", "shipmentNo", "discount", "dpp"}, args...)
}
func (s Service) ListPurchaseInvoices(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT pi.id::text,pi.document_no,pi.supplier_invoice_no,pi.invoice_date,pi.due_date,pi.status,pi.match_status,pi.subtotal::float8,pi.tax_amount::float8,pi.total_amount::float8,pi.paid_amount::float8,s.code,s.name,po.document_no,gr.document_no,st.code,COALESCE(j.document_no,'') FROM erp.purchase_invoices pi JOIN erp.entities e ON e.id=pi.entity_id JOIN erp.sites st ON st.id=pi.site_id JOIN erp.suppliers s ON s.id=pi.supplier_id JOIN erp.purchase_orders po ON po.id=pi.purchase_order_id JOIN erp.goods_receipts gr ON gr.id=pi.goods_receipt_id LEFT JOIN erp.journal_entries j ON j.id=pi.journal_entry_id WHERE e.code=$1` + cl + ` ORDER BY pi.invoice_date DESC,pi.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "supplierInvoiceNo", "invoiceDate", "dueDate", "status", "matchStatus", "subtotal", "tax", "total", "paidAmount", "supplierCode", "supplierName", "purchaseOrderNo", "goodsReceiptNo", "siteCode", "journalNo"}, args...)
}
func (s Service) ListAR(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT a.id::text,a.document_no,a.invoice_date,a.due_date,a.original_amount::float8,a.outstanding_amount::float8,a.status,c.code,c.name,st.code,si.id::text,
        CASE WHEN a.outstanding_amount<=0 THEN 0 ELSE GREATEST(CURRENT_DATE-a.due_date,0) END::int,
        CASE WHEN a.outstanding_amount<=0 THEN 'CLOSED'
             WHEN a.due_date>=CURRENT_DATE THEN 'CURRENT'
             WHEN CURRENT_DATE-a.due_date<=30 THEN '1-30'
             WHEN CURRENT_DATE-a.due_date<=60 THEN '31-60'
             WHEN CURRENT_DATE-a.due_date<=90 THEN '61-90'
             ELSE '90+' END,
        CURRENT_DATE::text
        FROM erp.ar_open_items a JOIN erp.entities e ON e.id=a.entity_id JOIN erp.sites st ON st.id=a.site_id
        JOIN erp.customers c ON c.id=a.customer_id JOIN erp.sales_invoices si ON si.id=a.sales_invoice_id WHERE e.code=$1` + cl + ` ORDER BY a.due_date,a.document_no`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "invoiceDate", "dueDate", "originalAmount", "outstanding", "status", "partyCode", "partyName", "siteCode", "invoiceId", "daysPastDue", "agingBucket", "asOfDate"}, args...)
}
func (s Service) ListAP(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT a.id::text,a.document_no,a.invoice_date,a.due_date,a.original_amount::float8,a.outstanding_amount::float8,a.status,s.code,s.name,st.code,pi.id::text FROM erp.ap_open_items a JOIN erp.entities e ON e.id=a.entity_id JOIN erp.sites st ON st.id=a.site_id JOIN erp.suppliers s ON s.id=a.supplier_id JOIN erp.purchase_invoices pi ON pi.id=a.purchase_invoice_id WHERE e.code=$1` + cl + ` ORDER BY a.due_date,a.document_no`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "invoiceDate", "dueDate", "originalAmount", "outstanding", "status", "partyCode", "partyName", "siteCode", "invoiceId"}, args...)
}
func (s Service) ListReceipts(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT r.id::text,r.document_no,r.receipt_date,r.method,COALESCE(r.external_reference,''),r.amount::float8,r.status,c.code,c.name,b.code,st.code,j.document_no FROM erp.customer_receipts r JOIN erp.entities e ON e.id=r.entity_id JOIN erp.sites st ON st.id=r.site_id JOIN erp.customers c ON c.id=r.customer_id JOIN erp.bank_accounts b ON b.id=r.bank_account_id JOIN erp.journal_entries j ON j.id=r.journal_entry_id WHERE e.code=$1` + cl + ` ORDER BY r.receipt_date DESC,r.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "date", "method", "reference", "amount", "status", "partyCode", "partyName", "bankAccountCode", "siteCode", "journalNo"}, args...)
}
func (s Service) ListSupplierPayments(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT p.id::text,p.document_no,p.payment_date,p.method,COALESCE(p.external_reference,''),p.amount::float8,p.status,s.code,s.name,b.code,st.code,j.document_no FROM erp.supplier_payments p JOIN erp.entities e ON e.id=p.entity_id JOIN erp.sites st ON st.id=p.site_id JOIN erp.suppliers s ON s.id=p.supplier_id JOIN erp.bank_accounts b ON b.id=p.bank_account_id JOIN erp.journal_entries j ON j.id=p.journal_entry_id WHERE e.code=$1` + cl + ` ORDER BY p.payment_date DESC,p.created_at DESC`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "date", "method", "reference", "amount", "status", "partyCode", "partyName", "bankAccountCode", "siteCode", "journalNo"}, args...)
}
func (s Service) ListJournals(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	cl, args := siteFilter(entityCode, siteCode)
	q := `SELECT j.id::text,j.document_no,j.posting_date,j.source_type,COALESCE(j.reference_type,''),COALESCE(j.reference_id,''),j.status,COALESCE(j.description,''),st.code,COALESCE(sum(l.debit),0)::float8,COALESCE(sum(l.credit),0)::float8 FROM erp.journal_entries j JOIN erp.entities e ON e.id=j.entity_id LEFT JOIN erp.sites st ON st.id=j.site_id LEFT JOIN erp.journal_lines l ON l.journal_entry_id=j.id WHERE e.code=$1` + cl + ` GROUP BY j.id,st.code ORDER BY j.posting_date DESC,j.created_at DESC LIMIT 300`
	return queryRows(s.DB, ctx, q, []string{"id", "documentNo", "postingDate", "sourceType", "referenceType", "referenceId", "status", "description", "siteCode", "debit", "credit"}, args...)
}
func (s Service) TrialBalance(ctx context.Context, entityCode, siteCode string) ([]map[string]any, error) {
	q := `SELECT a.code,a.name,a.account_type,COALESCE(sum(CASE WHEN j.status='POSTED' THEN l.debit ELSE 0 END),0)::float8,COALESCE(sum(CASE WHEN j.status='POSTED' THEN l.credit ELSE 0 END),0)::float8,COALESCE(sum(CASE WHEN j.status='POSTED' THEN l.debit-l.credit ELSE 0 END),0)::float8 FROM erp.chart_of_accounts a JOIN erp.entities e ON e.id=a.entity_id LEFT JOIN erp.journal_lines l ON l.account_id=a.id LEFT JOIN erp.journal_entries j ON j.id=l.journal_entry_id`
	args := []any{entityCode}
	q += ` WHERE e.code=$1`
	if siteCode != "" {
		q += ` AND (j.site_id IS NULL OR j.site_id IN (SELECT id FROM erp.sites WHERE entity_id=e.id AND code=$2))`
		args = append(args, siteCode)
	}
	q += ` GROUP BY a.id ORDER BY a.code`
	return queryRows(s.DB, ctx, q, []string{"code", "name", "type", "debit", "credit", "balance"}, args...)
}

func createPostedJournal(ctx context.Context, tx pgx.Tx, rs ResolvedScope, date time.Time, sourceType, refType, refID, description string, lines []struct {
	Code          string
	Debit, Credit float64
	Memo          string
}, requestID string) (string, string, error) {
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return "", "", err
	}
	pid, err := periodID(ctx, tx, rs.EntityID, date)
	if err != nil {
		return "", "", err
	}
	debit, credit := 0.0, 0.0
	for _, l := range lines {
		debit += round2(l.Debit)
		credit += round2(l.Credit)
	}
	if math.Abs(debit-credit) > 0.005 || debit <= 0 {
		return "", "", errors.New("journal is not balanced")
	}
	var docNo string
	if err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'JOURNAL',$3,$4,$5,6)`, rs.EntityID, nilIfEmpty(rs.SiteID), date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "JV", date)).Scan(&docNo); err != nil {
		return "", "", err
	}
	var id string
	var site any = nil
	if rs.SiteID != "" {
		site = rs.SiteID
	}
	if err = tx.QueryRow(ctx, `INSERT INTO erp.journal_entries(document_no,entity_id,site_id,period_id,posting_date,source_type,reference_type,reference_id,status,description,created_by,posted_by,posted_at) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,'POSTED',$9,$10::uuid,$10::uuid,now()) RETURNING id::text`, docNo, rs.EntityID, site, pid, date, sourceType, refType, refID, description, rs.UserID).Scan(&id); err != nil {
		return "", "", err
	}
	for i, l := range lines {
		aid, err := accountID(ctx, tx, rs.EntityID, l.Code)
		if err != nil {
			return "", "", err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO erp.journal_lines(journal_entry_id,line_no,account_id,debit,credit,memo) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6)`, id, i+1, aid, round2(l.Debit), round2(l.Credit), l.Memo); err != nil {
			return "", "", err
		}
	}
	body := map[string]any{"id": id, "documentNo": docNo, "status": "POSTED", "debit": round2(debit), "credit": round2(credit)}
	audit(ctx, tx, rs, requestID, "finance", "post", "journal", id, body)
	outbox(ctx, tx, rs, "journal", id, "journal.posted", body)
	return id, docNo, nil
}
func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func PostInventoryIssue(ctx context.Context, tx pgx.Tx, issue InventoryIssue, requestID string) (string, string, error) {
	if issue.Amount <= 0 {
		return "", "", nil
	}
	rs := ResolvedScope{EntityID: issue.EntityID, SiteID: issue.SiteID, UserID: issue.UserID, EntityCode: issue.EntityCode, SiteCode: issue.SiteCode}
	return createPostedJournal(ctx, tx, rs, issue.PostingDate, "INVENTORY_ISSUE", "SHIPMENT", issue.ShipmentNo, "COGS posting for "+issue.ShipmentNo, []struct {
		Code          string
		Debit, Credit float64
		Memo          string
	}{{"510100", issue.Amount, 0, "Cost of goods sold"}, {"120100", 0, issue.Amount, "Inventory issue"}}, requestID)
}

func (s Service) PostSalesInvoice(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, requestID string) (map[string]any, error) {
	var docNo, siteID, customerID string
	var date, due time.Time
	var sub, discount, tax, total float64
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text,customer_id::text,invoice_date,due_date,subtotal::float8,discount_amount::float8,tax_amount::float8,total_amount::float8 FROM erp.sales_invoices WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT' FOR UPDATE`, id, rs.EntityID).Scan(&docNo, &siteID, &customerID, &date, &due, &sub, &discount, &tax, &total); err != nil {
		return nil, errors.New("draft sales invoice not found")
	}
	if rs.SiteID != "" && rs.SiteID != siteID {
		return nil, errors.New("invoice outside current site scope")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	if total <= 0 {
		return nil, errors.New("invoice total must be positive")
	}
	jid, jno, err := createPostedJournal(ctx, tx, rs, date, "SALES_INVOICE", "SALES_INVOICE", docNo, "Sales invoice "+docNo, []struct {
		Code          string
		Debit, Credit float64
		Memo          string
	}{{"110100", total, 0, "Accounts receivable"}, {"410100", 0, round2(sub - discount), "Sales revenue net of discount"}, {"218100", 0, tax, "VAT output"}}, requestID)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO erp.ar_open_items(entity_id,site_id,customer_id,sales_invoice_id,document_no,invoice_date,due_date,original_amount,outstanding_amount) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$8)`, rs.EntityID, siteID, customerID, id, docNo, date, due, total); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.sales_invoices SET status='POSTED',journal_entry_id=$2::uuid,posted_at=now(),updated_at=now() WHERE id=$1::uuid`, id, jid); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": docNo, "status": "POSTED", "journalNo": jno, "total": total}
	audit(ctx, tx, rs, requestID, "receivable", "post", "sales_invoice", id, body)
	outbox(ctx, tx, rs, "sales_invoice", id, "sales_invoice.posted", body)
	return body, nil
}

func (s Service) CreatePurchaseInvoice(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input CreateInvoiceInput, requestID string) (map[string]any, error) {
	date := parseDate(input.Date)
	var siteID, supplierID, poID, grnNo, poNo, terms string
	if err := tx.QueryRow(ctx, `SELECT gr.site_id::text,po.supplier_id::text,po.id::text,gr.document_no,po.document_no,s.payment_terms FROM erp.goods_receipts gr JOIN erp.purchase_orders po ON po.id=gr.purchase_order_id JOIN erp.suppliers s ON s.id=po.supplier_id WHERE gr.id=$1::uuid AND gr.entity_id=$2::uuid AND gr.status='PUT_AWAY' FOR UPDATE`, input.SourceID, rs.EntityID).Scan(&siteID, &supplierID, &poID, &grnNo, &poNo, &terms); err != nil {
		return nil, errors.New("put-away goods receipt not found")
	}
	var exists bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM erp.purchase_invoices WHERE entity_id=$1::uuid AND goods_receipt_id=$2::uuid AND status<>'VOID')`, rs.EntityID, input.SourceID).Scan(&exists); err != nil {
		return nil, err
	}
	if exists {
		return nil, errors.New("goods receipt already invoiced")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	var docNo string
	if err := tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'PURCHASE_INVOICE',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "PINV", date)).Scan(&docNo); err != nil {
		return nil, err
	}
	due := dueDate(date, terms)
	var invID string
	if err := tx.QueryRow(ctx, `INSERT INTO erp.purchase_invoices(document_no,supplier_invoice_no,entity_id,site_id,supplier_id,purchase_order_id,goods_receipt_id,invoice_date,due_date,created_by) VALUES($1,$2,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,$8,$9,$10::uuid) RETURNING id::text`, docNo, input.ExternalReference, rs.EntityID, siteID, supplierID, poID, input.SourceID, date, due, rs.UserID).Scan(&invID); err != nil {
		return nil, err
	}
	rows, err := tx.Query(ctx, `SELECT grl.item_id::text,grl.accepted_qty::float8,pol.unit_price::float8,pol.tax_rate::float8 FROM erp.goods_receipt_lines grl JOIN erp.purchase_order_lines pol ON pol.purchase_order_id=$1::uuid AND pol.item_id=grl.item_id WHERE grl.goods_receipt_id=$2::uuid AND grl.accepted_qty>0 ORDER BY grl.line_no`, poID, input.SourceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sub, tax := 0.0, 0.0
	i := 0
	for rows.Next() {
		var item string
		var qty, price, rate float64
		if err = rows.Scan(&item, &qty, &price, &rate); err != nil {
			return nil, err
		}
		i++
		ls := round2(qty * price)
		lt := round2(ls * rate / 100)
		sub += ls
		tax += lt
		if _, err = tx.Exec(ctx, `INSERT INTO erp.purchase_invoice_lines(purchase_invoice_id,line_no,item_id,qty,unit_price,tax_rate,line_subtotal,tax_amount) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8)`, invID, i, item, qty, price, rate, ls, lt); err != nil {
			return nil, err
		}
	}
	if i == 0 {
		return nil, errors.New("goods receipt has no accepted quantity")
	}
	sub = round2(sub)
	tax = round2(tax)
	total := round2(sub + tax)
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_invoices SET subtotal=$2,tax_amount=$3,total_amount=$4,updated_at=now() WHERE id=$1::uuid`, invID, sub, tax, total); err != nil {
		return nil, err
	}
	body := map[string]any{"id": invID, "documentNo": docNo, "goodsReceiptNo": grnNo, "purchaseOrderNo": poNo, "status": "DRAFT", "matchStatus": "MATCHED", "total": total}
	audit(ctx, tx, rs, requestID, "payable", "create", "purchase_invoice", invID, body)
	return body, nil
}

func (s Service) PostPurchaseInvoice(ctx context.Context, tx pgx.Tx, rs ResolvedScope, id, requestID string) (map[string]any, error) {
	var docNo, siteID, supplierID, poID string
	var date, due time.Time
	var sub, tax, total float64
	var match string
	if err := tx.QueryRow(ctx, `SELECT document_no,site_id::text,supplier_id::text,purchase_order_id::text,invoice_date,due_date,subtotal::float8,tax_amount::float8,total_amount::float8,match_status FROM erp.purchase_invoices WHERE id=$1::uuid AND entity_id=$2::uuid AND status='DRAFT' FOR UPDATE`, id, rs.EntityID).Scan(&docNo, &siteID, &supplierID, &poID, &date, &due, &sub, &tax, &total, &match); err != nil {
		return nil, errors.New("draft purchase invoice not found")
	}
	if match != "MATCHED" {
		return nil, errors.New("purchase invoice is not 3-way matched")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	jid, jno, err := createPostedJournal(ctx, tx, rs, date, "PURCHASE_INVOICE", "PURCHASE_INVOICE", docNo, "Purchase invoice "+docNo, []struct {
		Code          string
		Debit, Credit float64
		Memo          string
	}{{"120100", sub, 0, "Merchandise inventory"}, {"118100", tax, 0, "VAT input"}, {"210100", 0, total, "Accounts payable"}}, requestID)
	if err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO erp.ap_open_items(entity_id,site_id,supplier_id,purchase_invoice_id,document_no,invoice_date,due_date,original_amount,outstanding_amount) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$8)`, rs.EntityID, siteID, supplierID, id, docNo, date, due, total); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_invoices SET status='POSTED',journal_entry_id=$2::uuid,posted_at=now(),updated_at=now() WHERE id=$1::uuid`, id, jid); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_order_lines pol SET invoiced_qty=LEAST(pol.qty,pol.invoiced_qty+src.qty) FROM (SELECT item_id,qty FROM erp.purchase_invoice_lines WHERE purchase_invoice_id=$1::uuid) src WHERE pol.purchase_order_id=$2::uuid AND pol.item_id=src.item_id`, id, poID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": id, "documentNo": docNo, "status": "POSTED", "journalNo": jno, "total": total}
	audit(ctx, tx, rs, requestID, "payable", "post", "purchase_invoice", id, body)
	outbox(ctx, tx, rs, "purchase_invoice", id, "purchase_invoice.posted", body)
	return body, nil
}

func (s Service) PaySupplier(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input SupplierPaymentInput, requestID string) (map[string]any, error) {
	if input.Amount <= 0 {
		return nil, errors.New("payment amount must be positive")
	}
	date := parseDate(input.PaymentDate)
	var apID, siteID, supplierID string
	var outstanding float64
	var version int64
	if err := tx.QueryRow(ctx, `SELECT a.id::text,a.site_id::text,a.supplier_id::text,a.outstanding_amount::float8,a.row_version FROM erp.ap_open_items a WHERE a.purchase_invoice_id=$1::uuid AND a.entity_id=$2::uuid AND a.status IN ('OPEN','PARTIAL') FOR UPDATE`, input.PurchaseInvoiceID, rs.EntityID).Scan(&apID, &siteID, &supplierID, &outstanding, &version); err != nil {
		return nil, errors.New("open AP item not found")
	}
	if input.Amount > outstanding+0.005 {
		return nil, errors.New("payment exceeds AP outstanding")
	}
	rs.SiteID = siteID
	if err := ensureSiteCode(ctx, tx, &rs); err != nil {
		return nil, err
	}
	var bankID, bankGL string
	var bankBalance float64
	var bankVersion int64
	if err := tx.QueryRow(ctx, `SELECT b.id::text,b.gl_account_id::text,b.balance::float8,b.row_version FROM erp.bank_accounts b WHERE b.entity_id=$1::uuid AND b.code=$2 AND b.status='ACTIVE' FOR UPDATE`, rs.EntityID, input.BankAccountCode).Scan(&bankID, &bankGL, &bankBalance, &bankVersion); err != nil {
		return nil, errors.New("bank/cash account not found")
	}
	if bankBalance+0.005 < input.Amount {
		return nil, errors.New("insufficient bank/cash balance")
	}
	pid, err := periodID(ctx, tx, rs.EntityID, date)
	if err != nil {
		return nil, err
	}
	var docNo string
	if err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'SUPPLIER_PAYMENT',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "PAY", date)).Scan(&docNo); err != nil {
		return nil, err
	}
	apGL, err := accountID(ctx, tx, rs.EntityID, "210100")
	if err != nil {
		return nil, err
	}
	var journalNo, journalID string
	if err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'JOURNAL',$3,$4,$5,6)`, rs.EntityID, siteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "JV", date)).Scan(&journalNo); err != nil {
		return nil, err
	}
	if err = tx.QueryRow(ctx, `INSERT INTO erp.journal_entries(document_no,entity_id,site_id,period_id,posting_date,source_type,reference_type,reference_id,status,description,created_by,posted_by,posted_at) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,'SUPPLIER_PAYMENT','SUPPLIER_PAYMENT',$6,'POSTED',$7,$8::uuid,$8::uuid,now()) RETURNING id::text`, journalNo, rs.EntityID, siteID, pid, date, docNo, "Supplier payment "+docNo, rs.UserID).Scan(&journalID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO erp.journal_lines(journal_entry_id,line_no,account_id,debit,credit,memo) VALUES($1::uuid,1,$2::uuid,$3,0,'AP settlement'),($1::uuid,2,$4::uuid,0,$3,'Cash/bank payment')`, journalID, apGL, round2(input.Amount), bankGL); err != nil {
		return nil, err
	}
	var paymentID string
	if err = tx.QueryRow(ctx, `INSERT INTO erp.supplier_payments(document_no,entity_id,site_id,supplier_id,payment_date,bank_account_id,method,external_reference,amount,journal_entry_id,created_by) VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid,$7,$8,$9,$10::uuid,$11::uuid) RETURNING id::text`, docNo, rs.EntityID, siteID, supplierID, date, bankID, input.Method, input.Reference, round2(input.Amount), journalID, rs.UserID).Scan(&paymentID); err != nil {
		return nil, err
	}
	if _, err = tx.Exec(ctx, `INSERT INTO erp.supplier_payment_allocations(supplier_payment_id,ap_open_item_id,amount) VALUES($1::uuid,$2::uuid,$3)`, paymentID, apID, round2(input.Amount)); err != nil {
		return nil, err
	}
	remaining := round2(outstanding - input.Amount)
	tag, err := tx.Exec(ctx, `UPDATE erp.ap_open_items SET outstanding_amount=$2,status=CASE WHEN $2<=0.005 THEN 'CLOSED' ELSE 'PARTIAL' END,row_version=row_version+1,updated_at=now() WHERE id=$1::uuid AND row_version=$3`, apID, remaining, version)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, errors.New("AP concurrent update detected")
	}
	if _, err = tx.Exec(ctx, `UPDATE erp.purchase_invoices SET paid_amount=paid_amount+$2,status=CASE WHEN paid_amount+$2>=total_amount-0.005 THEN 'PAID' ELSE 'PARTIALLY_PAID' END,updated_at=now() WHERE id=$1::uuid`, input.PurchaseInvoiceID, round2(input.Amount)); err != nil {
		return nil, err
	}
	tag, err = tx.Exec(ctx, `UPDATE erp.bank_accounts SET balance=balance-$2,row_version=row_version+1,updated_at=now() WHERE id=$1::uuid AND row_version=$3`, bankID, round2(input.Amount), bankVersion)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, errors.New("bank concurrent update detected")
	}
	body := map[string]any{"id": paymentID, "documentNo": docNo, "status": "POSTED", "journalNo": journalNo, "amount": round2(input.Amount), "outstandingAfter": remaining}
	audit(ctx, tx, rs, requestID, "payable", "payment", "supplier_payment", paymentID, body)
	outbox(ctx, tx, rs, "supplier_payment", paymentID, "supplier_payment.posted", body)
	return body, nil
}

func (s Service) CreateManualJournal(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input ManualJournalInput, requestID string) (map[string]any, error) {
	if len(input.Lines) < 2 {
		return nil, errors.New("manual journal requires at least two lines")
	}
	date := parseDate(input.PostingDate)
	if rs.SiteID == "" && rs.SiteCode != "" {
		if err := tx.QueryRow(ctx, `SELECT id::text FROM erp.sites WHERE entity_id=$1::uuid AND code=$2`, rs.EntityID, rs.SiteCode).Scan(&rs.SiteID); err != nil {
			return nil, errors.New("site scope is invalid")
		}
	}
	lines := make([]struct {
		Code          string
		Debit, Credit float64
		Memo          string
	}, 0, len(input.Lines))
	for _, l := range input.Lines {
		if l.Debit < 0 || l.Credit < 0 || (l.Debit > 0 && l.Credit > 0) || (l.Debit == 0 && l.Credit == 0) {
			return nil, errors.New("each journal line must contain either debit or credit")
		}
		var allow bool
		if err := tx.QueryRow(ctx, `SELECT allow_manual_posting FROM erp.chart_of_accounts WHERE entity_id=$1::uuid AND code=$2 AND status='ACTIVE'`, rs.EntityID, l.AccountCode).Scan(&allow); err != nil {
			return nil, fmt.Errorf("account %s not found", l.AccountCode)
		}
		if !allow {
			return nil, fmt.Errorf("manual posting is blocked for control account %s", l.AccountCode)
		}
		lines = append(lines, struct {
			Code          string
			Debit, Credit float64
			Memo          string
		}{l.AccountCode, l.Debit, l.Credit, l.Memo})
	}
	jid, jno, err := createPostedJournal(ctx, tx, rs, date, "MANUAL_JOURNAL", "MANUAL", requestID, input.Description, lines, requestID)
	if err != nil {
		return nil, err
	}
	return map[string]any{"id": jid, "documentNo": jno, "status": "POSTED"}, nil
}

func (s Service) ClosePeriod(ctx context.Context, tx pgx.Tx, rs ResolvedScope, periodIDValue, requestID string) (map[string]any, error) {
	var code string
	var start, end time.Time
	if err := tx.QueryRow(ctx, `SELECT period_code,start_date,end_date FROM erp.accounting_periods WHERE id=$1::uuid AND entity_id=$2::uuid AND status='OPEN' FOR UPDATE`, periodIDValue, rs.EntityID).Scan(&code, &start, &end); err != nil {
		return nil, errors.New("open accounting period not found")
	}
	var draftInvoices, inTransit, unputaway int
	if err := tx.QueryRow(ctx, `SELECT (SELECT count(*) FROM erp.sales_invoices WHERE entity_id=$1::uuid AND invoice_date BETWEEN $2 AND $3 AND status='DRAFT')+(SELECT count(*) FROM erp.purchase_invoices WHERE entity_id=$1::uuid AND invoice_date BETWEEN $2 AND $3 AND status='DRAFT'),(SELECT count(*) FROM erp.stock_transfers WHERE entity_id=$1::uuid AND transfer_date BETWEEN $2 AND $3 AND status='IN_TRANSIT'),(SELECT count(*) FROM erp.goods_receipts WHERE entity_id=$1::uuid AND receipt_date BETWEEN $2 AND $3 AND status='RECEIVED')`, rs.EntityID, start, end).Scan(&draftInvoices, &inTransit, &unputaway); err != nil {
		return nil, err
	}
	if draftInvoices+inTransit+unputaway > 0 {
		return nil, fmt.Errorf("period has blockers: %d draft invoice, %d in-transit transfer, %d receipt waiting put-away", draftInvoices, inTransit, unputaway)
	}
	var imbalance float64
	if err := tx.QueryRow(ctx, `SELECT COALESCE(sum(x.delta),0)::float8 FROM (SELECT j.id,sum(l.debit-l.credit) delta FROM erp.journal_entries j JOIN erp.journal_lines l ON l.journal_entry_id=j.id WHERE j.entity_id=$1::uuid AND j.posting_date BETWEEN $2 AND $3 AND j.status='POSTED' GROUP BY j.id) x`, rs.EntityID, start, end).Scan(&imbalance); err != nil {
		return nil, err
	}
	if math.Abs(imbalance) > 0.005 {
		return nil, errors.New("journal imbalance detected")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.accounting_periods SET status='CLOSED',closed_at=now(),closed_by=$3::uuid,updated_at=now() WHERE id=$1::uuid AND entity_id=$2::uuid`, periodIDValue, rs.EntityID, rs.UserID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": periodIDValue, "periodCode": code, "status": "CLOSED"}
	audit(ctx, tx, rs, requestID, "finance", "close_period", "accounting_period", periodIDValue, body)
	outbox(ctx, tx, rs, "accounting_period", periodIDValue, "accounting_period.closed", body)
	return body, nil
}
func (s Service) ReopenPeriod(ctx context.Context, tx pgx.Tx, rs ResolvedScope, periodIDValue, requestID string) (map[string]any, error) {
	var code string
	if err := tx.QueryRow(ctx, `SELECT period_code FROM erp.accounting_periods WHERE id=$1::uuid AND entity_id=$2::uuid AND status='CLOSED' FOR UPDATE`, periodIDValue, rs.EntityID).Scan(&code); err != nil {
		return nil, errors.New("closed accounting period not found")
	}
	if _, err := tx.Exec(ctx, `UPDATE erp.accounting_periods SET status='OPEN',reopened_at=now(),reopened_by=$3::uuid,updated_at=now() WHERE id=$1::uuid AND entity_id=$2::uuid`, periodIDValue, rs.EntityID, rs.UserID); err != nil {
		return nil, err
	}
	body := map[string]any{"id": periodIDValue, "periodCode": code, "status": "OPEN"}
	audit(ctx, tx, rs, requestID, "finance", "reopen_period", "accounting_period", periodIDValue, body)
	return body, nil
}
