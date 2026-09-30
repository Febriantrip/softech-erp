-- NEXA ERP Distributor V4 - Finance / AR extension
-- Apply after docs/database-core-mysql.sql
-- MySQL 8.x starter migration.

ALTER TABLE items
  ADD COLUMN standard_cost DECIMAL(20,2) NOT NULL DEFAULT 0 AFTER sales_price;

CREATE TABLE accounting_periods (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  period_no TINYINT UNSIGNED NOT NULL,
  period_name VARCHAR(50) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status ENUM('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
  closed_at DATETIME NULL,
  closed_by BIGINT UNSIGNED NULL,
  UNIQUE KEY uk_period_entity_year_no (entity_id, fiscal_year, period_no),
  CONSTRAINT fk_period_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE chart_of_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  account_code VARCHAR(40) NOT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_type ENUM('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
  control_type ENUM('NONE','AR','AP','BANK','CASH','INVENTORY','TAX') NOT NULL DEFAULT 'NONE',
  is_postable TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_coa_entity_code (entity_id, account_code),
  CONSTRAINT fk_coa_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE bank_cash_accounts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NULL,
  account_code VARCHAR(40) NOT NULL,
  account_name VARCHAR(160) NOT NULL,
  account_type ENUM('BANK','CASH') NOT NULL,
  coa_id BIGINT UNSIGNED NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IDR',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_bank_entity_code (entity_id, account_code),
  CONSTRAINT fk_bank_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_bank_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_bank_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(id)
);

CREATE TABLE sales_invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NULL,
  shipment_id BIGINT UNSIGNED NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IDR',
  status ENUM('DRAFT','OPEN','PARTIALLY_PAID','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  posting_status ENUM('UNPOSTED','POSTED') NOT NULL DEFAULT 'UNPOSTED',
  subtotal_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  posted_at DATETIME NULL,
  posted_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_invoice_entity_no (entity_id, document_no),
  KEY idx_invoice_customer_due (customer_id, due_date, status),
  CONSTRAINT fk_inv_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_inv_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_inv_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_inv_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_inv_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id)
);

CREATE TABLE sales_invoice_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_invoice_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  shipped_qty DECIMAL(20,6) NOT NULL,
  uom_code VARCHAR(20) NOT NULL,
  unit_price DECIMAL(20,2) NOT NULL,
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) NOT NULL,
  line_total DECIMAL(20,2) NOT NULL,
  UNIQUE KEY uk_invoice_line (sales_invoice_id, line_no),
  CONSTRAINT fk_invl_invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
  CONSTRAINT fk_invl_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE ar_open_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  sales_invoice_id BIGINT UNSIGNED NOT NULL,
  document_date DATE NOT NULL,
  due_date DATE NOT NULL,
  original_amount DECIMAL(20,2) NOT NULL,
  outstanding_amount DECIMAL(20,2) NOT NULL,
  status ENUM('OPEN','CLOSED','WRITTEN_OFF') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ar_invoice (sales_invoice_id),
  KEY idx_ar_customer_due (customer_id, due_date, status),
  CONSTRAINT fk_ar_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ar_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_ar_invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id)
);

CREATE TABLE receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  receipt_date DATE NOT NULL,
  bank_cash_account_id BIGINT UNSIGNED NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  external_reference VARCHAR(120) NULL,
  amount DECIMAL(20,2) NOT NULL,
  status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  posted_at DATETIME NULL,
  posted_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_receipt_entity_no (entity_id, document_no),
  CONSTRAINT fk_receipt_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_receipt_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_receipt_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_receipt_account FOREIGN KEY (bank_cash_account_id) REFERENCES bank_cash_accounts(id)
);

CREATE TABLE receipt_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  receipt_id BIGINT UNSIGNED NOT NULL,
  ar_open_item_id BIGINT UNSIGNED NOT NULL,
  allocated_amount DECIMAL(20,2) NOT NULL,
  UNIQUE KEY uk_receipt_ar (receipt_id, ar_open_item_id),
  CONSTRAINT fk_ra_receipt FOREIGN KEY (receipt_id) REFERENCES receipts(id),
  CONSTRAINT fk_ra_ar FOREIGN KEY (ar_open_item_id) REFERENCES ar_open_items(id)
);

CREATE TABLE journal_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NULL,
  document_no VARCHAR(50) NOT NULL,
  journal_date DATE NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  source_document_no VARCHAR(60) NULL,
  description VARCHAR(255) NULL,
  status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  idempotency_key VARCHAR(120) NOT NULL,
  posted_at DATETIME NULL,
  posted_by BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_journal_entity_no (entity_id, document_no),
  UNIQUE KEY uk_journal_idempotency (idempotency_key),
  KEY idx_journal_date_source (journal_date, source_type),
  CONSTRAINT fk_journal_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_journal_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE journal_entry_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  journal_entry_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  coa_id BIGINT UNSIGNED NOT NULL,
  debit_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  customer_id BIGINT UNSIGNED NULL,
  cost_center_code VARCHAR(40) NULL,
  description VARCHAR(255) NULL,
  UNIQUE KEY uk_journal_line (journal_entry_id, line_no),
  CONSTRAINT fk_jl_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id),
  CONSTRAINT fk_jl_coa FOREIGN KEY (coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_jl_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT chk_jl_one_side CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  )
);

-- Production posting services should execute invoice posting and receipt posting
-- inside database transactions and reject dates in accounting_periods.status='CLOSED'.
