package finance

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
)

// ReceiptAllocationInput names an individual POSTED invoice and amount to settle.
// A receipt has one customer/site and can settle several invoices in that scope.
type ReceiptAllocationInput struct {
	SalesInvoiceID string  `json:"salesInvoiceId"`
	Amount         float64 `json:"amount"`
}

type receiptAR struct {
	ID, InvoiceID, DocumentNo, CustomerID, SiteID, Status, InvoiceStatus string
	Outstanding, InvoicePaid, InvoiceTotal                               float64
	RowVersion                                                           int64
	InvoiceDate                                                          time.Time
}

func moneyCents(v float64) (int64, error) {
	if math.IsNaN(v) || math.IsInf(v, 0) || v <= 0 || v > 1e12 || math.Abs(v*100-math.Round(v*100)) > 0.00001 {
		return 0, errors.New("amount must be positive and have at most 2 decimal places")
	}
	return int64(math.Round(v * 100)), nil
}

func receiptAllocationCents(amount float64, lines []ReceiptAllocationInput) (int64, map[string]int64, []string, error) {
	total, err := moneyCents(amount)
	if err != nil {
		return 0, nil, nil, err
	}
	if len(lines) == 0 || len(lines) > 100 {
		return 0, nil, nil, errors.New("select 1 to 100 invoices for receipt allocation")
	}
	amounts := make(map[string]int64, len(lines))
	ids := make([]string, 0, len(lines))
	var sum int64
	for _, line := range lines {
		id := strings.TrimSpace(line.SalesInvoiceID)
		if id == "" {
			return 0, nil, nil, errors.New("invoice id is required on every allocation")
		}
		if _, duplicate := amounts[id]; duplicate {
			return 0, nil, nil, errors.New("invoice may only appear once per receipt")
		}
		cents, e := moneyCents(line.Amount)
		if e != nil {
			return 0, nil, nil, fmt.Errorf("allocation for %s: %w", id, e)
		}
		amounts[id] = cents
		ids = append(ids, id)
		sum += cents
	}
	if sum != total {
		return 0, nil, nil, fmt.Errorf("receipt amount (%0.2f) must equal total allocations (%0.2f); unallocated overpayment is not supported", float64(total)/100, float64(sum)/100)
	}
	// Deterministic row locks avoid deadlocks when two receipts overlap invoices.
	sort.Strings(ids)
	return total, amounts, ids, nil
}

// ReceiveCustomerPayment replaces the legacy single-invoice receipt transaction.
// Allocation rows, open AR, invoice paid amount, bank balance and GL commit together.
func (s Service) ReceiveCustomerPayment(ctx context.Context, tx pgx.Tx, rs ResolvedScope, input ReceiptInput, requestID string) (map[string]any, error) {
	if rs.SiteID == "" {
		return nil, errors.New("choose a site before posting a customer receipt")
	}
	allocations := input.Allocations
	if len(allocations) == 0 && strings.TrimSpace(input.SalesInvoiceID) != "" {
		allocations = []ReceiptAllocationInput{{SalesInvoiceID: input.SalesInvoiceID, Amount: input.Amount}}
	}
	totalCents, amounts, invoiceIDs, err := receiptAllocationCents(input.Amount, allocations)
	if err != nil {
		return nil, err
	}
	method := strings.TrimSpace(input.Method)
	if method == "" || len(method) > 40 {
		return nil, errors.New("payment method is required (max 40 characters)")
	}
	reference := strings.TrimSpace(input.Reference)
	if len(reference) > 120 {
		return nil, errors.New("bank reference exceeds 120 characters")
	}
	date, err := time.Parse("2006-01-02", strings.TrimSpace(input.ReceiptDate))
	if err != nil {
		return nil, errors.New("receipt date must be YYYY-MM-DD")
	}
	receiptAmount := float64(totalCents) / 100
	var siteID, customerID string
	ars := make([]receiptAR, 0, len(invoiceIDs))
	for _, invoiceID := range invoiceIDs {
		var a receiptAR
		err = tx.QueryRow(ctx, `SELECT a.id::text,a.sales_invoice_id::text,a.document_no,a.customer_id::text,a.site_id::text,a.status,
              a.outstanding_amount::float8,a.row_version,si.status,si.paid_amount::float8,si.total_amount::float8,si.invoice_date
              FROM erp.ar_open_items a JOIN erp.sales_invoices si ON si.id=a.sales_invoice_id AND si.entity_id=a.entity_id
              WHERE a.sales_invoice_id=$1::uuid AND a.entity_id=$2::uuid AND a.site_id=$3::uuid FOR UPDATE`,
			invoiceID, rs.EntityID, rs.SiteID).Scan(&a.ID, &a.InvoiceID, &a.DocumentNo, &a.CustomerID, &a.SiteID, &a.Status,
			&a.Outstanding, &a.RowVersion, &a.InvoiceStatus, &a.InvoicePaid, &a.InvoiceTotal, &a.InvoiceDate)
		if err != nil {
			return nil, fmt.Errorf("invoice %s does not have an AR item in selected site", invoiceID)
		}
		if a.Status != "OPEN" && a.Status != "PARTIAL" {
			return nil, fmt.Errorf("invoice %s is not open", a.DocumentNo)
		}
		if a.InvoiceStatus != "POSTED" && a.InvoiceStatus != "PARTIALLY_PAID" {
			return nil, fmt.Errorf("invoice %s is not eligible for receipt", a.DocumentNo)
		}
		if a.InvoiceDate.After(date) {
			return nil, fmt.Errorf("receipt date cannot precede invoice %s", a.DocumentNo)
		}
		outstandingCents := int64(math.Round(a.Outstanding * 100))
		invoiceRemainingCents := int64(math.Round((a.InvoiceTotal - a.InvoicePaid) * 100))
		amount := amounts[invoiceID]
		if amount > outstandingCents || amount > invoiceRemainingCents {
			return nil, fmt.Errorf("allocation for %s exceeds outstanding", a.DocumentNo)
		}
		if customerID == "" {
			customerID, siteID = a.CustomerID, a.SiteID
		}
		if customerID != a.CustomerID || siteID != a.SiteID {
			return nil, errors.New("all invoices in a receipt must belong to the same customer and site")
		}
		ars = append(ars, a)
	}
	bankCode := strings.TrimSpace(input.BankAccountCode)
	var bankID, bankGL string
	var bankVersion int64
	err = tx.QueryRow(ctx, `SELECT b.id::text,b.gl_account_id::text,b.row_version
             FROM erp.bank_accounts b JOIN erp.chart_of_accounts coa ON coa.id=b.gl_account_id AND coa.entity_id=b.entity_id
             WHERE b.entity_id=$1::uuid AND b.code=$2 AND b.status='ACTIVE'
               AND (b.site_id IS NULL OR b.site_id=$3::uuid) AND b.currency='IDR' AND coa.status='ACTIVE' FOR UPDATE OF b`,
		rs.EntityID, bankCode, rs.SiteID).Scan(&bankID, &bankGL, &bankVersion)
	if err != nil {
		return nil, errors.New("active IDR bank/cash account not found for selected site")
	}
	if reference != "" {
		// Bank row is locked: competing transactions with same account/reference serialize.
		var existing string
		err = tx.QueryRow(ctx, `SELECT document_no FROM erp.customer_receipts WHERE entity_id=$1::uuid AND bank_account_id=$2::uuid AND external_reference=$3 AND status='POSTED' LIMIT 1`,
			rs.EntityID, bankID, reference).Scan(&existing)
		if err == nil {
			return nil, fmt.Errorf("bank reference is already used by receipt %s", existing)
		}
		if !errors.Is(err, pgx.ErrNoRows) {
			return nil, err
		}
	}
	pid, err := periodID(ctx, tx, rs.EntityID, date)
	if err != nil {
		return nil, err
	}
	docNo, journalNo := "", ""
	err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'CUSTOMER_RECEIPT',$3,$4,$5,6)`, rs.EntityID,
		rs.SiteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "RCPT", date)).Scan(&docNo)
	if err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx, `SELECT erp.next_document_number($1::uuid,$2::uuid,'JOURNAL',$3,$4,$5,6)`, rs.EntityID,
		rs.SiteID, date.Year(), int(date.Month()), prefix(rs.EntityCode, rs.SiteCode, "JV", date)).Scan(&journalNo)
	if err != nil {
		return nil, err
	}
	arGL, err := accountID(ctx, tx, rs.EntityID, "110100")
	if err != nil {
		return nil, err
	}
	var journalID, receiptID string
	err = tx.QueryRow(ctx, `INSERT INTO erp.journal_entries(document_no,entity_id,site_id,period_id,posting_date,
         source_type,reference_type,reference_id,status,description,created_by,posted_by,posted_at)
         VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,'CUSTOMER_RECEIPT','CUSTOMER_RECEIPT',$6,'POSTED',$7,$8::uuid,$8::uuid,now()) RETURNING id::text`,
		journalNo, rs.EntityID, siteID, pid, date, docNo, "Customer receipt "+docNo, rs.UserID).Scan(&journalID)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(ctx, `INSERT INTO erp.journal_lines(journal_entry_id,line_no,account_id,debit,credit,memo)
        VALUES($1::uuid,1,$2::uuid,$3,0,'Cash/bank receipt'),($1::uuid,2,$4::uuid,0,$3,'AR settlement')`,
		journalID, bankGL, receiptAmount, arGL)
	if err != nil {
		return nil, err
	}
	err = tx.QueryRow(ctx, `INSERT INTO erp.customer_receipts(document_no,entity_id,site_id,customer_id,receipt_date,
        bank_account_id,method,external_reference,amount,journal_entry_id,created_by)
        VALUES($1,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid,$7,$8,$9,$10::uuid,$11::uuid) RETURNING id::text`,
		docNo, rs.EntityID, siteID, customerID, date, bankID, method, reference, receiptAmount, journalID, rs.UserID).Scan(&receiptID)
	if err != nil {
		return nil, err
	}
	details := make([]map[string]any, 0, len(ars))
	for _, a := range ars {
		allocatedCents := amounts[a.InvoiceID]
		amount := float64(allocatedCents) / 100
		remaining := float64(int64(math.Round(a.Outstanding*100))-allocatedCents) / 100
		_, err = tx.Exec(ctx, `INSERT INTO erp.customer_receipt_allocations(customer_receipt_id,ar_open_item_id,amount)
            VALUES($1::uuid,$2::uuid,$3)`, receiptID, a.ID, amount)
		if err != nil {
			return nil, err
		}
		tag, e := tx.Exec(ctx, `UPDATE erp.ar_open_items SET outstanding_amount=$2,
            status=CASE WHEN $2<=0.005 THEN 'CLOSED' ELSE 'PARTIAL' END,row_version=row_version+1,updated_at=now()
            WHERE id=$1::uuid AND row_version=$3`, a.ID, remaining, a.RowVersion)
		if e != nil {
			return nil, e
		}
		if tag.RowsAffected() != 1 {
			return nil, errors.New("AR concurrent update detected")
		}
		tag, e = tx.Exec(ctx, `UPDATE erp.sales_invoices SET paid_amount=paid_amount+$2,
            status=CASE WHEN paid_amount+$2>=total_amount-0.005 THEN 'PAID' ELSE 'PARTIALLY_PAID' END,updated_at=now()
            WHERE id=$1::uuid AND entity_id=$3::uuid AND site_id=$4::uuid AND status IN ('POSTED','PARTIALLY_PAID')`,
			a.InvoiceID, amount, rs.EntityID, siteID)
		if e != nil {
			return nil, e
		}
		if tag.RowsAffected() != 1 {
			return nil, errors.New("sales invoice settlement conflict")
		}
		details = append(details, map[string]any{"invoiceId": a.InvoiceID, "invoiceNo": a.DocumentNo, "amount": amount, "outstandingAfter": remaining})
	}
	tag, err := tx.Exec(ctx, `UPDATE erp.bank_accounts SET balance=balance+$2,row_version=row_version+1,updated_at=now()
        WHERE id=$1::uuid AND entity_id=$3::uuid AND row_version=$4`, bankID, receiptAmount, rs.EntityID, bankVersion)
	if err != nil {
		return nil, err
	}
	if tag.RowsAffected() != 1 {
		return nil, errors.New("bank concurrent update detected")
	}
	body := map[string]any{"id": receiptID, "documentNo": docNo, "status": "POSTED", "journalNo": journalNo,
		"amount": receiptAmount, "bankAccountCode": bankCode, "customerId": customerID, "allocations": details}
	audit(ctx, tx, rs, requestID, "receivable", "receipt", "customer_receipt", receiptID, body)
	outbox(ctx, tx, rs, "customer_receipt", receiptID, "customer_receipt.posted", body)
	return body, nil
}

// ReceiptDetail shows persisted invoice allocations rather than an inferred UI breakdown.
func (s Service) ReceiptDetail(ctx context.Context, entityCode, siteCode, receiptID string) (map[string]any, error) {
	query := `SELECT r.id::text,r.document_no,r.receipt_date,r.method,COALESCE(r.external_reference,''),r.amount::float8,
         r.status,c.code,c.name,b.code,st.code,j.document_no
         FROM erp.customer_receipts r JOIN erp.entities e ON e.id=r.entity_id
         JOIN erp.sites st ON st.id=r.site_id JOIN erp.customers c ON c.id=r.customer_id
         JOIN erp.bank_accounts b ON b.id=r.bank_account_id JOIN erp.journal_entries j ON j.id=r.journal_entry_id
         WHERE r.id=$1::uuid AND e.code=$2`
	args := []any{receiptID, entityCode}
	if siteCode != "" {
		query += ` AND st.code=$3`
		args = append(args, siteCode)
	}
	keys := []string{"id", "documentNo", "date", "method", "reference", "amount", "status", "partyCode", "partyName", "bankAccountCode", "siteCode", "journalNo"}
	rows, err := queryRows(s.DB, ctx, query, keys, args...)
	if err != nil {
		return nil, err
	}
	if len(rows) == 0 {
		return nil, errors.New("receipt not found in current scope")
	}
	result := rows[0]
	allocations, err := queryRows(s.DB, ctx, `SELECT si.id::text,si.document_no,ra.amount::float8,si.total_amount::float8,
         a.outstanding_amount::float8 FROM erp.customer_receipt_allocations ra
         JOIN erp.customer_receipts cr ON cr.id=ra.customer_receipt_id
         JOIN erp.ar_open_items a ON a.id=ra.ar_open_item_id
         JOIN erp.sales_invoices si ON si.id=a.sales_invoice_id AND si.entity_id=cr.entity_id
         WHERE ra.customer_receipt_id=$1::uuid AND cr.document_no=$2 ORDER BY si.document_no`,
		[]string{"invoiceId", "invoiceNo", "amount", "invoiceTotal", "currentOutstanding"}, receiptID, result["documentNo"])
	if err != nil {
		return nil, err
	}
	result["allocations"] = allocations
	return result, nil
}
