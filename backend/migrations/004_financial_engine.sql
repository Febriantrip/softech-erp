BEGIN;

-- V12 Financial Engine: entity-scoped accounting periods, GL, AR/AP and cash/bank.

ALTER TABLE erp.sales_order_lines ADD COLUMN IF NOT EXISTS invoiced_qty numeric(20,6) NOT NULL DEFAULT 0;
ALTER TABLE erp.purchase_order_lines ADD COLUMN IF NOT EXISTS invoiced_qty numeric(20,6) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS erp.accounting_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  period_code varchar(20) NOT NULL,
  label varchar(80) NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','CLOSED')),
  closed_at timestamptz,
  closed_by uuid REFERENCES erp.users(id),
  reopened_at timestamptz,
  reopened_by uuid REFERENCES erp.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, period_code),
  CHECK (start_date <= end_date)
);
CREATE INDEX IF NOT EXISTS idx_accounting_period_scope ON erp.accounting_periods(entity_id,start_date,end_date,status);

CREATE OR REPLACE FUNCTION erp.assert_open_period(p_entity_id uuid, p_posting_date date)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_period_id uuid;
BEGIN
  SELECT id INTO v_period_id
  FROM erp.accounting_periods
  WHERE entity_id=p_entity_id
    AND p_posting_date BETWEEN start_date AND end_date
    AND status='OPEN'
  ORDER BY start_date DESC
  LIMIT 1;

  IF v_period_id IS NULL THEN
    RAISE EXCEPTION 'accounting period is not open for %', p_posting_date;
  END IF;
  RETURN v_period_id;
END;
$$;

CREATE TABLE IF NOT EXISTS erp.chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  code varchar(30) NOT NULL,
  name varchar(180) NOT NULL,
  account_type varchar(30) NOT NULL CHECK (account_type IN ('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE')),
  normal_balance varchar(10) NOT NULL CHECK (normal_balance IN ('DEBIT','CREDIT')),
  allow_manual_posting boolean NOT NULL DEFAULT true,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);
CREATE INDEX IF NOT EXISTS idx_coa_entity_type ON erp.chart_of_accounts(entity_id,account_type,code);

CREATE TABLE IF NOT EXISTS erp.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  code varchar(40) NOT NULL,
  name varchar(160) NOT NULL,
  account_type varchar(20) NOT NULL DEFAULT 'BANK' CHECK (account_type IN ('BANK','CASH')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  gl_account_id uuid NOT NULL REFERENCES erp.chart_of_accounts(id),
  balance numeric(20,2) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  row_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);

CREATE TABLE IF NOT EXISTS erp.journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  period_id uuid NOT NULL REFERENCES erp.accounting_periods(id),
  posting_date date NOT NULL,
  source_type varchar(60) NOT NULL,
  reference_type varchar(60),
  reference_id varchar(120),
  status varchar(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','REVERSED','VOID')),
  description text,
  created_by uuid REFERENCES erp.users(id),
  posted_by uuid REFERENCES erp.users(id),
  posted_at timestamptz,
  reversal_of_id uuid REFERENCES erp.journal_entries(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_journal_source_reference
  ON erp.journal_entries(entity_id,source_type,reference_type,reference_id)
  WHERE reference_id IS NOT NULL AND status <> 'VOID';
CREATE INDEX IF NOT EXISTS idx_journal_scope_date ON erp.journal_entries(entity_id,site_id,posting_date DESC,status);

CREATE TABLE IF NOT EXISTS erp.journal_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES erp.journal_entries(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  account_id uuid NOT NULL REFERENCES erp.chart_of_accounts(id),
  debit numeric(20,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit numeric(20,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  memo varchar(240),
  customer_id uuid REFERENCES erp.customers(id),
  supplier_id uuid REFERENCES erp.suppliers(id),
  UNIQUE(journal_entry_id,line_no),
  CHECK ((debit > 0 AND credit = 0) OR (credit > 0 AND debit = 0))
);
CREATE INDEX IF NOT EXISTS idx_journal_line_account ON erp.journal_lines(account_id,journal_entry_id);

CREATE OR REPLACE FUNCTION erp.prevent_posted_journal_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('POSTED','REVERSED') THEN
    RAISE EXCEPTION 'posted journal entry is immutable; create a reversal instead';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_journal_header_immutable ON erp.journal_entries;
CREATE TRIGGER trg_journal_header_immutable
BEFORE UPDATE OR DELETE ON erp.journal_entries
FOR EACH ROW EXECUTE FUNCTION erp.prevent_posted_journal_mutation();

CREATE OR REPLACE FUNCTION erp.prevent_posted_journal_line_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_status varchar(20);
  v_journal uuid;
BEGIN
  v_journal := COALESCE(OLD.journal_entry_id, NEW.journal_entry_id);
  SELECT status INTO v_status FROM erp.journal_entries WHERE id=v_journal;
  IF v_status IN ('POSTED','REVERSED') THEN
    RAISE EXCEPTION 'posted journal lines are immutable';
  END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_journal_line_immutable ON erp.journal_lines;
CREATE TRIGGER trg_journal_line_immutable
BEFORE UPDATE OR DELETE ON erp.journal_lines
FOR EACH ROW EXECUTE FUNCTION erp.prevent_posted_journal_line_mutation();

CREATE TABLE IF NOT EXISTS erp.sales_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  customer_id uuid NOT NULL REFERENCES erp.customers(id),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_orders(id),
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','PARTIALLY_PAID','PAID','VOID')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  subtotal numeric(20,2) NOT NULL DEFAULT 0,
  tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  total_amount numeric(20,2) NOT NULL DEFAULT 0,
  paid_amount numeric(20,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES erp.journal_entries(id),
  created_by uuid REFERENCES erp.users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no),
  UNIQUE(entity_id, sales_order_id)
);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_scope ON erp.sales_invoices(entity_id,site_id,status,invoice_date DESC);

CREATE TABLE IF NOT EXISTS erp.sales_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_invoice_id uuid NOT NULL REFERENCES erp.sales_invoices(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  unit_price numeric(20,6) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  line_subtotal numeric(20,2) NOT NULL,
  tax_amount numeric(20,2) NOT NULL,
  UNIQUE(sales_invoice_id,line_no)
);

CREATE TABLE IF NOT EXISTS erp.ar_open_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  customer_id uuid NOT NULL REFERENCES erp.customers(id),
  sales_invoice_id uuid NOT NULL REFERENCES erp.sales_invoices(id),
  document_no varchar(80) NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  original_amount numeric(20,2) NOT NULL,
  outstanding_amount numeric(20,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','CLOSED','VOID')),
  row_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,sales_invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_ar_open_scope_due ON erp.ar_open_items(entity_id,site_id,status,due_date);

CREATE TABLE IF NOT EXISTS erp.customer_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  customer_id uuid NOT NULL REFERENCES erp.customers(id),
  receipt_date date NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES erp.bank_accounts(id),
  method varchar(40) NOT NULL,
  external_reference varchar(120),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  status varchar(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','REVERSED')),
  journal_entry_id uuid NOT NULL REFERENCES erp.journal_entries(id),
  created_by uuid REFERENCES erp.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,document_no)
);

CREATE TABLE IF NOT EXISTS erp.customer_receipt_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_receipt_id uuid NOT NULL REFERENCES erp.customer_receipts(id) ON DELETE CASCADE,
  ar_open_item_id uuid NOT NULL REFERENCES erp.ar_open_items(id),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  UNIQUE(customer_receipt_id,ar_open_item_id)
);

CREATE TABLE IF NOT EXISTS erp.purchase_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  supplier_invoice_no varchar(100),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  supplier_id uuid NOT NULL REFERENCES erp.suppliers(id),
  purchase_order_id uuid NOT NULL REFERENCES erp.purchase_orders(id),
  goods_receipt_id uuid NOT NULL REFERENCES erp.goods_receipts(id),
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','POSTED','PARTIALLY_PAID','PAID','VOID')),
  match_status varchar(20) NOT NULL DEFAULT 'MATCHED' CHECK (match_status IN ('MATCHED','VARIANCE','BLOCKED')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  subtotal numeric(20,2) NOT NULL DEFAULT 0,
  tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  total_amount numeric(20,2) NOT NULL DEFAULT 0,
  paid_amount numeric(20,2) NOT NULL DEFAULT 0,
  journal_entry_id uuid REFERENCES erp.journal_entries(id),
  created_by uuid REFERENCES erp.users(id),
  posted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,document_no),
  UNIQUE(entity_id,goods_receipt_id)
);
CREATE INDEX IF NOT EXISTS idx_purchase_invoice_scope ON erp.purchase_invoices(entity_id,site_id,status,invoice_date DESC);

CREATE TABLE IF NOT EXISTS erp.purchase_invoice_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_invoice_id uuid NOT NULL REFERENCES erp.purchase_invoices(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  unit_price numeric(20,6) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  line_subtotal numeric(20,2) NOT NULL,
  tax_amount numeric(20,2) NOT NULL,
  UNIQUE(purchase_invoice_id,line_no)
);

CREATE TABLE IF NOT EXISTS erp.ap_open_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  supplier_id uuid NOT NULL REFERENCES erp.suppliers(id),
  purchase_invoice_id uuid NOT NULL REFERENCES erp.purchase_invoices(id),
  document_no varchar(80) NOT NULL,
  invoice_date date NOT NULL,
  due_date date NOT NULL,
  original_amount numeric(20,2) NOT NULL,
  outstanding_amount numeric(20,2) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','PARTIAL','CLOSED','VOID')),
  row_version bigint NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,purchase_invoice_id)
);
CREATE INDEX IF NOT EXISTS idx_ap_open_scope_due ON erp.ap_open_items(entity_id,site_id,status,due_date);

CREATE TABLE IF NOT EXISTS erp.supplier_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  supplier_id uuid NOT NULL REFERENCES erp.suppliers(id),
  payment_date date NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES erp.bank_accounts(id),
  method varchar(40) NOT NULL,
  external_reference varchar(120),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  status varchar(20) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','REVERSED')),
  journal_entry_id uuid NOT NULL REFERENCES erp.journal_entries(id),
  created_by uuid REFERENCES erp.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id,document_no)
);

CREATE TABLE IF NOT EXISTS erp.supplier_payment_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_payment_id uuid NOT NULL REFERENCES erp.supplier_payments(id) ON DELETE CASCADE,
  ap_open_item_id uuid NOT NULL REFERENCES erp.ap_open_items(id),
  amount numeric(20,2) NOT NULL CHECK (amount > 0),
  UNIQUE(supplier_payment_id,ap_open_item_id)
);

-- Seed 2026 periods for every active legal entity.
INSERT INTO erp.accounting_periods(entity_id,period_code,label,start_date,end_date,status)
SELECT e.id, to_char(d,'YYYY-MM'), to_char(d,'Mon YYYY'), d::date, (d + interval '1 month - 1 day')::date,
       CASE WHEN d::date <= date '2026-09-01' THEN 'OPEN' ELSE 'OPEN' END
FROM erp.entities e
CROSS JOIN generate_series(date '2026-01-01', date '2026-12-01', interval '1 month') d
ON CONFLICT(entity_id,period_code) DO NOTHING;

-- Core COA per legal entity. Codes are stable contracts used by posting services.
INSERT INTO erp.chart_of_accounts(entity_id,code,name,account_type,normal_balance,allow_manual_posting)
SELECT e.id,v.code,v.name,v.account_type,v.normal_balance,v.allow_manual
FROM erp.entities e
CROSS JOIN (VALUES
 ('100100','Cash on Hand','ASSET','DEBIT',true),
 ('101100','Bank - Operating','ASSET','DEBIT',true),
 ('110100','Accounts Receivable','ASSET','DEBIT',false),
 ('118100','VAT Input / PPN Masukan','ASSET','DEBIT',false),
 ('120100','Merchandise Inventory','ASSET','DEBIT',false),
 ('210100','Accounts Payable','LIABILITY','CREDIT',false),
 ('218100','VAT Output / PPN Keluaran','LIABILITY','CREDIT',false),
 ('300100','Retained Earnings','EQUITY','CREDIT',false),
 ('410100','Sales Revenue','REVENUE','CREDIT',false),
 ('419900','Inventory Adjustment Gain','REVENUE','CREDIT',false),
 ('510100','Cost of Goods Sold','EXPENSE','DEBIT',false),
 ('519900','Inventory Adjustment Loss','EXPENSE','DEBIT',false),
 ('590100','Other Operating Expense','EXPENSE','DEBIT',true)
) AS v(code,name,account_type,normal_balance,allow_manual)
ON CONFLICT(entity_id,code) DO NOTHING;

INSERT INTO erp.bank_accounts(entity_id,site_id,code,name,account_type,currency,gl_account_id,balance)
SELECT e.id,s.id,v.code,v.name,v.kind,'IDR',coa.id,v.balance
FROM erp.entities e
JOIN erp.sites s ON s.entity_id=e.id
JOIN (VALUES
 ('NDU','JKT-HO','BCA-NDU','BCA Operasional NDU','BANK',500000000::numeric),
 ('NDU','JKT-HO','CASH-NDU','Petty Cash NDU','CASH',25000000::numeric),
 ('NDT','SBY-BR','BCA-NDT','BCA Operasional NDT','BANK',250000000::numeric),
 ('NDT','SBY-BR','CASH-NDT','Petty Cash NDT','CASH',15000000::numeric)
) AS v(entity_code,site_code,code,name,kind,balance) ON e.code=v.entity_code AND s.code=v.site_code
JOIN erp.chart_of_accounts coa ON coa.entity_id=e.id AND coa.code=CASE WHEN v.kind='BANK' THEN '101100' ELSE '100100' END
ON CONFLICT(entity_id,code) DO NOTHING;

COMMIT;
