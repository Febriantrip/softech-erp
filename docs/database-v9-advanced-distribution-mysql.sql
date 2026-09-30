-- Distributor ERP V9 · Advanced Distribution & Reverse Logistics
-- MySQL 8.x starter extension. Apply after the V3-V8 schemas.
-- Adapt naming/FKs to the production schema used by your backend.

ALTER TABLE inventory_balance
  ADD COLUMN quarantine_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN quality_hold_qty DECIMAL(20,6) NOT NULL DEFAULT 0;

ALTER TABLE inventory_lot_balances
  ADD COLUMN hold_qty DECIMAL(20,6) NOT NULL DEFAULT 0;

CREATE TABLE sales_returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  sales_invoice_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','QUARANTINE_RECEIVED','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_request_id BIGINT UNSIGNED NULL,
  received_at DATETIME NULL,
  posted_at DATETIME NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sales_return_entity_no (entity_id, document_no),
  KEY idx_sales_return_source (sales_order_id, sales_invoice_id, status),
  CONSTRAINT fk_sret_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_sret_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_sret_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_sret_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_sret_invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
  CONSTRAINT fk_sret_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_sret_approval FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id)
);

CREATE TABLE sales_return_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_return_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  return_qty DECIMAL(20,6) NOT NULL,
  received_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  uom_code VARCHAR(20) NOT NULL,
  lot_no VARCHAR(100) NULL,
  disposition ENUM('RESTOCK','DAMAGED','PENDING') NOT NULL DEFAULT 'PENDING',
  unit_price DECIMAL(20,6) NOT NULL,
  carrying_unit_cost DECIMAL(20,6) NOT NULL,
  tax_rate DECIMAL(9,6) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_sales_return_line (sales_return_id, line_no),
  CONSTRAINT fk_sret_line_header FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  CONSTRAINT fk_sret_line_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE sales_credit_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  sales_return_id BIGINT UNSIGNED NOT NULL,
  sales_invoice_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  credit_note_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  subtotal_amount DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) NOT NULL,
  total_amount DECIMAL(20,2) NOT NULL,
  application_status ENUM('APPLIED','PARTIALLY_APPLIED','UNAPPLIED_CREDIT') NOT NULL DEFAULT 'UNAPPLIED_CREDIT',
  journal_entry_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sales_credit_entity_no (entity_id, credit_note_no),
  CONSTRAINT fk_scn_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_scn_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_scn_return FOREIGN KEY (sales_return_id) REFERENCES sales_returns(id),
  CONSTRAINT fk_scn_invoice FOREIGN KEY (sales_invoice_id) REFERENCES sales_invoices(id),
  CONSTRAINT fk_scn_customer FOREIGN KEY (customer_id) REFERENCES customers(id),
  CONSTRAINT fk_scn_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE purchase_returns (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  purchase_invoice_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  reason VARCHAR(500) NULL,
  status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_request_id BIGINT UNSIGNED NULL,
  posted_at DATETIME NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchase_return_entity_no (entity_id, document_no),
  KEY idx_purchase_return_source (purchase_order_id, purchase_invoice_id, status),
  CONSTRAINT fk_pret_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_pret_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_pret_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_pret_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_pret_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  CONSTRAINT fk_pret_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pret_approval FOREIGN KEY (approval_request_id) REFERENCES approval_requests(id)
);

CREATE TABLE purchase_return_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_return_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  return_qty DECIMAL(20,6) NOT NULL,
  uom_code VARCHAR(20) NOT NULL,
  lot_no VARCHAR(100) NULL,
  invoice_unit_price DECIMAL(20,6) NOT NULL,
  carrying_unit_cost DECIMAL(20,6) NOT NULL,
  tax_rate DECIMAL(9,6) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_purchase_return_line (purchase_return_id, line_no),
  CONSTRAINT fk_pret_line_header FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
  CONSTRAINT fk_pret_line_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE purchase_debit_notes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  purchase_return_id BIGINT UNSIGNED NOT NULL,
  purchase_invoice_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  debit_note_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  subtotal_amount DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) NOT NULL,
  total_amount DECIMAL(20,2) NOT NULL,
  carrying_value DECIMAL(20,2) NOT NULL,
  cost_variance_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  application_status ENUM('APPLIED','PARTIALLY_APPLIED','UNAPPLIED') NOT NULL DEFAULT 'APPLIED',
  journal_entry_id BIGINT UNSIGNED NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_purchase_debit_entity_no (entity_id, debit_note_no),
  CONSTRAINT fk_pdn_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_pdn_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_pdn_return FOREIGN KEY (purchase_return_id) REFERENCES purchase_returns(id),
  CONSTRAINT fk_pdn_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  CONSTRAINT fk_pdn_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pdn_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE replenishment_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  destination_site_id BIGINT UNSIGNED NOT NULL,
  source_warehouse_id BIGINT UNSIGNED NOT NULL,
  destination_warehouse_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  status ENUM('PLANNED','TRANSFER_CREATED','CLOSED','CANCELLED') NOT NULL DEFAULT 'PLANNED',
  planner_user_id BIGINT UNSIGNED NULL,
  stock_transfer_id BIGINT UNSIGNED NULL,
  notes VARCHAR(500) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_replenishment_entity_no (entity_id, document_no),
  CONSTRAINT fk_repl_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_repl_dest_site FOREIGN KEY (destination_site_id) REFERENCES sites(id),
  CONSTRAINT fk_repl_source_wh FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_repl_dest_wh FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_repl_transfer FOREIGN KEY (stock_transfer_id) REFERENCES stock_transfers(id)
);

CREATE TABLE replenishment_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  replenishment_order_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  projected_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  reorder_point_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  max_stock_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  suggested_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  source_available_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  source_transferable_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  approved_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_replenishment_line (replenishment_order_id, line_no),
  CONSTRAINT fk_repl_line_header FOREIGN KEY (replenishment_order_id) REFERENCES replenishment_orders(id),
  CONSTRAINT fk_repl_line_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE quality_cases (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  case_no VARCHAR(50) NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  lot_no VARCHAR(100) NULL,
  affected_qty DECIMAL(20,6) NOT NULL,
  reason VARCHAR(500) NOT NULL,
  source_type VARCHAR(100) NULL,
  status ENUM('MONITORING','HOLD','RELEASED','SCRAPPED','CLOSED','CANCELLED') NOT NULL DEFAULT 'MONITORING',
  hold_applied TINYINT(1) NOT NULL DEFAULT 0,
  disposition ENUM('PENDING','RELEASE','SCRAP') NOT NULL DEFAULT 'PENDING',
  opened_at DATETIME NOT NULL,
  resolved_at DATETIME NULL,
  journal_entry_id BIGINT UNSIGNED NULL,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_quality_entity_case (entity_id, case_no),
  KEY idx_quality_lot (warehouse_id, item_id, lot_no, status),
  CONSTRAINT fk_quality_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_quality_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_quality_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_quality_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_quality_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE lot_recalls (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  quality_case_id BIGINT UNSIGNED NOT NULL,
  recall_no VARCHAR(50) NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  lot_no VARCHAR(100) NULL,
  reason VARCHAR(500) NULL,
  status ENUM('ACTIVE','MONITORING','CLOSED','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  opened_at DATETIME NOT NULL,
  closed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_recall_entity_no (entity_id, recall_no),
  CONSTRAINT fk_recall_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_recall_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_recall_quality FOREIGN KEY (quality_case_id) REFERENCES quality_cases(id),
  CONSTRAINT fk_recall_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE lot_recall_shipments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  lot_recall_id BIGINT UNSIGNED NOT NULL,
  shipment_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NULL,
  delivery_order_id BIGINT UNSIGNED NULL,
  customer_id BIGINT UNSIGNED NULL,
  exposed_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  contact_status ENUM('PENDING','CONTACTED','RETURN_REQUESTED','CLEARED') NOT NULL DEFAULT 'PENDING',
  UNIQUE KEY uk_recall_shipment (lot_recall_id, shipment_id),
  CONSTRAINT fk_recall_ship_header FOREIGN KEY (lot_recall_id) REFERENCES lot_recalls(id),
  CONSTRAINT fk_recall_ship_shipment FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  CONSTRAINT fk_recall_ship_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_recall_ship_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

-- Production service controls:
-- 1) Return authorization and quantity remaining must be checked with row locks inside the posting transaction.
-- 2) Sales-return receiving writes quarantine inventory atomically and never increases available stock directly.
-- 3) Return disposition must be idempotent. Posting a credit/debit note twice must be impossible.
-- 4) Lot-specific quality holds must lock the affected lot balance and inventory balance together.
-- 5) Available stock calculations must subtract active quality-hold quantity server-side.
-- 6) Replenishment planning may be asynchronous, but conversion to stock transfer must revalidate current source availability.
-- 7) Purchase-return carrying value must use a persisted cost snapshot approved by inventory accounting.
-- 8) Credit/debit note application must not reduce AR/AP below zero; excess becomes an unapplied customer/supplier balance.
-- 9) Return, quality-disposal, and credit/debit-note posting must reject a closed accounting period.
-- 10) Recall trace should be immutable snapshots plus follow-up contact/action records for regulatory auditability.
