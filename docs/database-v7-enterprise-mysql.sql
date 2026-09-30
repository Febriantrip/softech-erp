-- Distributor ERP V7 · Multi-Entity / Intercompany / Consolidation
-- MySQL 8.x architectural extension.
-- Assumes earlier ERP migrations already provide entities, sites, warehouses,
-- accounting_periods, journal_entries, journal_entry_lines and bank_cash_accounts.

CREATE TABLE consolidation_groups (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  group_code VARCHAR(40) NOT NULL,
  group_name VARCHAR(180) NOT NULL,
  presentation_currency CHAR(3) NOT NULL DEFAULT 'IDR',
  status ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_consolidation_group_code (group_code)
);

CREATE TABLE consolidation_group_entities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consolidation_group_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  ownership_percentage DECIMAL(9,6) NOT NULL DEFAULT 100.000000,
  consolidation_method ENUM('FULL','PROPORTIONATE','EQUITY') NOT NULL DEFAULT 'FULL',
  effective_from DATE NOT NULL,
  effective_to DATE NULL,
  UNIQUE KEY uk_group_entity_period (consolidation_group_id, entity_id, effective_from),
  CONSTRAINT fk_cge_group FOREIGN KEY (consolidation_group_id) REFERENCES consolidation_groups(id),
  CONSTRAINT fk_cge_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE user_entity_access (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  access_level ENUM('VIEW','TRANSACT','APPROVE','ADMIN') NOT NULL DEFAULT 'VIEW',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_user_entity (user_id, entity_id),
  CONSTRAINT fk_uea_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE user_site_access (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  access_level ENUM('VIEW','TRANSACT','APPROVE','ADMIN') NOT NULL DEFAULT 'VIEW',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_user_site (user_id, site_id),
  CONSTRAINT fk_usa_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE intercompany_account_rules (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  transaction_type ENUM('SERVICE','INVENTORY','LOAN','CASH','OTHER') NOT NULL,
  due_from_coa_id BIGINT UNSIGNED NOT NULL,
  due_to_coa_id BIGINT UNSIGNED NOT NULL,
  ic_revenue_coa_id BIGINT UNSIGNED NULL,
  ic_expense_coa_id BIGINT UNSIGNED NULL,
  inventory_coa_id BIGINT UNSIGNED NULL,
  cogs_coa_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_ic_rule_entity_type (entity_id, transaction_type),
  CONSTRAINT fk_ic_rule_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ic_rule_due_from FOREIGN KEY (due_from_coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_ic_rule_due_to FOREIGN KEY (due_to_coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_ic_rule_revenue FOREIGN KEY (ic_revenue_coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_ic_rule_expense FOREIGN KEY (ic_expense_coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_ic_rule_inventory FOREIGN KEY (inventory_coa_id) REFERENCES chart_of_accounts(id),
  CONSTRAINT fk_ic_rule_cogs FOREIGN KEY (cogs_coa_id) REFERENCES chart_of_accounts(id)
);

CREATE TABLE intercompany_transactions (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consolidation_group_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  transaction_type ENUM('SERVICE','INVENTORY','LOAN','CASH','OTHER') NOT NULL,
  source_entity_id BIGINT UNSIGNED NOT NULL,
  destination_entity_id BIGINT UNSIGNED NOT NULL,
  source_site_id BIGINT UNSIGNED NULL,
  destination_site_id BIGINT UNSIGNED NULL,
  source_warehouse_id BIGINT UNSIGNED NULL,
  destination_warehouse_id BIGINT UNSIGNED NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IDR',
  transaction_amount DECIMAL(20,2) NOT NULL,
  cost_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  outstanding_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  ending_inventory_ratio DECIMAL(9,6) NOT NULL DEFAULT 0,
  unrealized_profit DECIMAL(20,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  status ENUM('DRAFT','IN_TRANSIT','POSTED','SETTLED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  elimination_status ENUM('PENDING','PREPARED','ELIMINATED') NOT NULL DEFAULT 'PENDING',
  idempotency_key VARCHAR(120) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ic_group_document (consolidation_group_id, document_no),
  UNIQUE KEY uk_ic_idempotency (idempotency_key),
  KEY idx_ic_pair_period (source_entity_id, destination_entity_id, document_date, status),
  CONSTRAINT fk_ic_group FOREIGN KEY (consolidation_group_id) REFERENCES consolidation_groups(id),
  CONSTRAINT fk_ic_source_entity FOREIGN KEY (source_entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ic_destination_entity FOREIGN KEY (destination_entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ic_source_site FOREIGN KEY (source_site_id) REFERENCES sites(id),
  CONSTRAINT fk_ic_destination_site FOREIGN KEY (destination_site_id) REFERENCES sites(id),
  CONSTRAINT fk_ic_source_wh FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_ic_destination_wh FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT chk_ic_different_entity CHECK (source_entity_id <> destination_entity_id)
);

CREATE TABLE intercompany_inventory_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  intercompany_transaction_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  quantity DECIMAL(20,6) NOT NULL,
  uom_code VARCHAR(20) NOT NULL,
  source_unit_cost DECIMAL(20,6) NOT NULL,
  transfer_unit_price DECIMAL(20,6) NOT NULL,
  line_cost_amount DECIMAL(20,2) NOT NULL,
  line_transfer_amount DECIMAL(20,2) NOT NULL,
  ending_inventory_ratio DECIMAL(9,6) NOT NULL DEFAULT 0,
  unrealized_profit DECIMAL(20,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_ic_inventory_line (intercompany_transaction_id, line_no),
  CONSTRAINT fk_icil_header FOREIGN KEY (intercompany_transaction_id) REFERENCES intercompany_transactions(id),
  CONSTRAINT fk_icil_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE intercompany_journal_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  intercompany_transaction_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  journal_entry_id BIGINT UNSIGNED NOT NULL,
  journal_role ENUM('SOURCE','DESTINATION','SETTLEMENT_PAYER','SETTLEMENT_RECEIVER','REVERSAL') NOT NULL,
  UNIQUE KEY uk_ic_journal_role (intercompany_transaction_id, entity_id, journal_role, journal_entry_id),
  CONSTRAINT fk_icjl_header FOREIGN KEY (intercompany_transaction_id) REFERENCES intercompany_transactions(id),
  CONSTRAINT fk_icjl_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_icjl_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE intercompany_settlements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  intercompany_transaction_id BIGINT UNSIGNED NOT NULL,
  settlement_no VARCHAR(50) NOT NULL,
  settlement_date DATE NOT NULL,
  payer_entity_id BIGINT UNSIGNED NOT NULL,
  receiver_entity_id BIGINT UNSIGNED NOT NULL,
  payer_bank_cash_account_id BIGINT UNSIGNED NOT NULL,
  receiver_bank_cash_account_id BIGINT UNSIGNED NOT NULL,
  settlement_amount DECIMAL(20,2) NOT NULL,
  status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ic_settlement_no (settlement_no),
  CONSTRAINT fk_ics_header FOREIGN KEY (intercompany_transaction_id) REFERENCES intercompany_transactions(id),
  CONSTRAINT fk_ics_payer_entity FOREIGN KEY (payer_entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ics_receiver_entity FOREIGN KEY (receiver_entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ics_payer_bank FOREIGN KEY (payer_bank_cash_account_id) REFERENCES bank_cash_accounts(id),
  CONSTRAINT fk_ics_receiver_bank FOREIGN KEY (receiver_bank_cash_account_id) REFERENCES bank_cash_accounts(id)
);

CREATE TABLE consolidation_runs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consolidation_group_id BIGINT UNSIGNED NOT NULL,
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  period_no TINYINT UNSIGNED NOT NULL,
  run_no VARCHAR(50) NOT NULL,
  status ENUM('DRAFT','PREPARED','POSTED','REOPENED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  presentation_currency CHAR(3) NOT NULL DEFAULT 'IDR',
  prepared_at DATETIME NULL,
  prepared_by BIGINT UNSIGNED NULL,
  posted_at DATETIME NULL,
  posted_by BIGINT UNSIGNED NULL,
  snapshot_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_consolidation_group_period_run (consolidation_group_id, fiscal_year, period_no, run_no),
  CONSTRAINT fk_cons_run_group FOREIGN KEY (consolidation_group_id) REFERENCES consolidation_groups(id)
);

CREATE TABLE consolidation_entity_status (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consolidation_run_id BIGINT UNSIGNED NOT NULL,
  entity_id BIGINT UNSIGNED NOT NULL,
  accounting_period_id BIGINT UNSIGNED NULL,
  period_status VARCHAR(30) NOT NULL,
  revenue_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  expense_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  net_income_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  close_blocker_count INT UNSIGNED NOT NULL DEFAULT 0,
  snapshot_json JSON NULL,
  UNIQUE KEY uk_cons_run_entity (consolidation_run_id, entity_id),
  CONSTRAINT fk_ces_run FOREIGN KEY (consolidation_run_id) REFERENCES consolidation_runs(id),
  CONSTRAINT fk_ces_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ces_period FOREIGN KEY (accounting_period_id) REFERENCES accounting_periods(id)
);

CREATE TABLE consolidation_elimination_entries (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  consolidation_run_id BIGINT UNSIGNED NOT NULL,
  elimination_no VARCHAR(50) NOT NULL,
  elimination_type ENUM('IC_REVENUE_EXPENSE','DUE_FROM_DUE_TO','UNREALIZED_INVENTORY_PROFIT','FX','OTHER') NOT NULL,
  source_reference VARCHAR(80) NULL,
  account_code VARCHAR(40) NOT NULL,
  debit_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  credit_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  description VARCHAR(255) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_cons_elimination_line (consolidation_run_id, elimination_no, account_code, debit_amount, credit_amount),
  CONSTRAINT fk_cee_run FOREIGN KEY (consolidation_run_id) REFERENCES consolidation_runs(id),
  CONSTRAINT chk_cee_one_side CHECK (
    (debit_amount > 0 AND credit_amount = 0) OR
    (credit_amount > 0 AND debit_amount = 0)
  )
);

-- Recommended production constraints / service rules:
-- 1. Every operational transaction stores entity_id and site_id explicitly.
-- 2. Entity ID is immutable after the document receives a posting/reservation reference.
-- 3. Customer/Supplier/Bank/Warehouse ownership must match the transaction entity.
-- 4. Normal warehouse transfer is prohibited across different entity_id values.
-- 5. Intercompany posting locks both entity accounting periods in one backend transaction.
-- 6. Related-party journal lines persist counterparty_entity_id for reconciliation.
-- 7. Intercompany matching compares reciprocal balances before consolidation.
-- 8. Statutory entity ledgers remain untouched by consolidation eliminations.
-- 9. Consolidation adjustments are stored only in the group consolidation ledger/tables.
-- 10. Posting a consolidation run requires every participating entity period to be CLOSED.
