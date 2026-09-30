-- NEXA ERP Distributor V5 - Procure-to-Pay extension
-- Apply after database-core-mysql.sql and database-v4-finance-mysql.sql
-- MySQL 8.x starter migration. Adapt names/FKs to your production naming standard.

CREATE TABLE suppliers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  supplier_code VARCHAR(40) NOT NULL,
  supplier_name VARCHAR(180) NOT NULL,
  payment_term_code VARCHAR(40) NULL,
  tax_id VARCHAR(80) NULL,
  lead_time_days INT UNSIGNED NOT NULL DEFAULT 0,
  supplier_rating VARCHAR(10) NULL,
  default_warehouse_id BIGINT UNSIGNED NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_supplier_entity_code (entity_id, supplier_code),
  CONSTRAINT fk_supplier_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_supplier_wh FOREIGN KEY (default_warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE purchase_requests (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  needed_date DATE NULL,
  requester_name VARCHAR(120) NULL,
  status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','RFQ_CREATED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_status VARCHAR(40) NOT NULL DEFAULT 'NOT_SUBMITTED',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pr_entity_no (entity_id, document_no),
  KEY idx_pr_status_needed (status, needed_date),
  CONSTRAINT fk_pr_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_pr_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_pr_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE purchase_request_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_request_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  requested_qty DECIMAL(20,6) NOT NULL,
  uom_code VARCHAR(20) NOT NULL,
  estimated_unit_cost DECIMAL(20,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_pr_line (purchase_request_id, line_no),
  CONSTRAINT fk_prl_pr FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id),
  CONSTRAINT fk_prl_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE request_for_quotations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  purchase_request_id BIGINT UNSIGNED NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  valid_until DATE NULL,
  buyer_name VARCHAR(120) NULL,
  status ENUM('OPEN','QUOTED','CONVERTED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_rfq_entity_no (entity_id, document_no),
  CONSTRAINT fk_rfq_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_rfq_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_rfq_pr FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id),
  CONSTRAINT fk_rfq_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id)
);

CREATE TABLE request_for_quotation_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  rfq_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  requested_qty DECIMAL(20,6) NOT NULL,
  quoted_unit_price DECIMAL(20,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_rfq_line (rfq_id, line_no),
  CONSTRAINT fk_rfql_rfq FOREIGN KEY (rfq_id) REFERENCES request_for_quotations(id),
  CONSTRAINT fk_rfql_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE purchase_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  purchase_request_id BIGINT UNSIGNED NULL,
  rfq_id BIGINT UNSIGNED NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  eta_date DATE NULL,
  buyer_name VARCHAR(120) NULL,
  status ENUM('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','INVOICED','CLOSED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  approval_status VARCHAR(40) NOT NULL DEFAULT 'NOT_SUBMITTED',
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_po_entity_no (entity_id, document_no),
  KEY idx_po_supplier_eta (supplier_id, eta_date, status),
  CONSTRAINT fk_po_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_po_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_po_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_po_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_po_pr FOREIGN KEY (purchase_request_id) REFERENCES purchase_requests(id),
  CONSTRAINT fk_po_rfq FOREIGN KEY (rfq_id) REFERENCES request_for_quotations(id)
);

CREATE TABLE purchase_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  ordered_qty DECIMAL(20,6) NOT NULL,
  received_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  put_away_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  invoiced_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  uom_code VARCHAR(20) NOT NULL,
  unit_price DECIMAL(20,2) NOT NULL,
  UNIQUE KEY uk_po_line (purchase_order_id, line_no),
  CONSTRAINT fk_pol_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_pol_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE goods_receipts (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  receipt_date DATE NOT NULL,
  status ENUM('DRAFT','RECEIVED','PUT_AWAY','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  received_by BIGINT UNSIGNED NULL,
  posted_at DATETIME NULL,
  put_away_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_gr_entity_no (entity_id, document_no),
  CONSTRAINT fk_gr_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_gr_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_gr_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_gr_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_gr_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE goods_receipt_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  goods_receipt_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  purchase_order_line_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  receive_qty DECIMAL(20,6) NOT NULL,
  accepted_qty DECIMAL(20,6) NOT NULL,
  rejected_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  inbound_location_code VARCHAR(60) NULL,
  put_away_location_code VARCHAR(60) NULL,
  lot_no VARCHAR(100) NULL,
  UNIQUE KEY uk_gr_line (goods_receipt_id, line_no),
  CONSTRAINT fk_grl_gr FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id),
  CONSTRAINT fk_grl_pol FOREIGN KEY (purchase_order_line_id) REFERENCES purchase_order_lines(id),
  CONSTRAINT fk_grl_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE purchase_invoices (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_order_id BIGINT UNSIGNED NOT NULL,
  goods_receipt_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IDR',
  status ENUM('DRAFT','OPEN','PARTIALLY_PAID','PAID','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  posting_status ENUM('UNPOSTED','POSTED') NOT NULL DEFAULT 'UNPOSTED',
  match_status ENUM('MATCHED','EXCEPTION','OVERRIDE_APPROVED') NOT NULL DEFAULT 'MATCHED',
  subtotal_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  paid_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  posted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pinv_entity_no (entity_id, document_no),
  CONSTRAINT fk_pinv_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_pinv_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_pinv_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_pinv_po FOREIGN KEY (purchase_order_id) REFERENCES purchase_orders(id),
  CONSTRAINT fk_pinv_gr FOREIGN KEY (goods_receipt_id) REFERENCES goods_receipts(id)
);

CREATE TABLE purchase_invoice_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  purchase_invoice_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  invoice_qty DECIMAL(20,6) NOT NULL,
  unit_price DECIMAL(20,2) NOT NULL,
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  line_subtotal DECIMAL(20,2) NOT NULL,
  tax_amount DECIMAL(20,2) NOT NULL,
  line_total DECIMAL(20,2) NOT NULL,
  UNIQUE KEY uk_pinv_line (purchase_invoice_id, line_no),
  CONSTRAINT fk_pinvl_pinv FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id),
  CONSTRAINT fk_pinvl_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE ap_open_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  purchase_invoice_id BIGINT UNSIGNED NOT NULL,
  document_date DATE NOT NULL,
  due_date DATE NOT NULL,
  original_amount DECIMAL(20,2) NOT NULL,
  outstanding_amount DECIMAL(20,2) NOT NULL,
  status ENUM('OPEN','CLOSED','WRITTEN_OFF') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_ap_invoice (purchase_invoice_id),
  KEY idx_ap_supplier_due (supplier_id, due_date, status),
  CONSTRAINT fk_ap_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_ap_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_ap_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES purchase_invoices(id)
);

CREATE TABLE supplier_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  supplier_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  payment_date DATE NOT NULL,
  bank_cash_account_id BIGINT UNSIGNED NOT NULL,
  payment_method VARCHAR(40) NOT NULL,
  external_reference VARCHAR(120) NULL,
  amount DECIMAL(20,2) NOT NULL,
  status ENUM('DRAFT','POSTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  posted_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_supplier_payment_entity_no (entity_id, document_no),
  CONSTRAINT fk_sp_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_sp_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_sp_supplier FOREIGN KEY (supplier_id) REFERENCES suppliers(id),
  CONSTRAINT fk_sp_account FOREIGN KEY (bank_cash_account_id) REFERENCES bank_cash_accounts(id)
);

CREATE TABLE supplier_payment_allocations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  supplier_payment_id BIGINT UNSIGNED NOT NULL,
  ap_open_item_id BIGINT UNSIGNED NOT NULL,
  allocated_amount DECIMAL(20,2) NOT NULL,
  UNIQUE KEY uk_supplier_payment_ap (supplier_payment_id, ap_open_item_id),
  CONSTRAINT fk_spa_payment FOREIGN KEY (supplier_payment_id) REFERENCES supplier_payments(id),
  CONSTRAINT fk_spa_ap FOREIGN KEY (ap_open_item_id) REFERENCES ap_open_items(id)
);

-- Recommended production controls:
-- 1) Unique idempotency keys for posting GRN, Purchase Invoice, and Supplier Payment.
-- 2) Location-level immutable inventory movements for RECEIVING and PUT_AWAY.
-- 3) 3-way match tolerance tables by supplier/item/category/entity.
-- 4) Purchase Invoice and Supplier Payment must reject dates in CLOSED accounting periods.
-- 5) Journal posting should reference source document and remain immutable after POSTED.
