-- NEXA ERP Distributor V3 - Core Transaction Engine
-- MySQL 8.x starter schema. Intentionally normalized and backend-ready.

CREATE TABLE entities (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(30) NOT NULL UNIQUE,
  name VARCHAR(150) NOT NULL,
  base_currency CHAR(3) NOT NULL DEFAULT 'IDR',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE sites (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_site_entity_code (entity_id, code),
  CONSTRAINT fk_sites_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE warehouses (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  site_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(30) NOT NULL,
  name VARCHAR(150) NOT NULL,
  default_location_code VARCHAR(50) NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_wh_site_code (site_id, code),
  CONSTRAINT fk_warehouses_site FOREIGN KEY (site_id) REFERENCES sites(id)
);

CREATE TABLE customers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(40) NOT NULL,
  name VARCHAR(180) NOT NULL,
  payment_term_code VARCHAR(30) NULL,
  credit_limit DECIMAL(20,2) NOT NULL DEFAULT 0,
  default_ship_to TEXT NULL,
  status ENUM('ACTIVE','INACTIVE','BLOCKED') NOT NULL DEFAULT 'ACTIVE',
  UNIQUE KEY uk_customer_entity_code (entity_id, code),
  CONSTRAINT fk_customers_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  sku VARCHAR(60) NOT NULL,
  name VARCHAR(180) NOT NULL,
  base_uom VARCHAR(20) NOT NULL,
  sales_price DECIMAL(20,2) NOT NULL DEFAULT 0,
  tax_rate DECIMAL(8,4) NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  UNIQUE KEY uk_item_entity_sku (entity_id, sku),
  CONSTRAINT fk_items_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);

CREATE TABLE inventory_balance (
  warehouse_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  on_hand_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  reserved_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  version_no BIGINT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (warehouse_id, item_id),
  CONSTRAINT fk_inventory_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_inventory_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE sales_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  requested_delivery_date DATE NULL,
  status VARCHAR(40) NOT NULL,
  approval_status VARCHAR(40) NOT NULL,
  currency_code CHAR(3) NOT NULL DEFAULT 'IDR',
  discount_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  created_by BIGINT UNSIGNED NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_so_entity_no (entity_id, document_no),
  KEY idx_so_customer_status (customer_id, status),
  CONSTRAINT fk_so_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_so_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_so_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_so_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE sales_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  uom_code VARCHAR(20) NOT NULL,
  order_qty DECIMAL(20,6) NOT NULL,
  allocated_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  picked_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  shipped_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  unit_price DECIMAL(20,2) NOT NULL,
  discount_amount DECIMAL(20,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_so_line (sales_order_id, line_no),
  CONSTRAINT fk_sol_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_sol_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE stock_reservations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NOT NULL,
  source_line_id BIGINT UNSIGNED NOT NULL,
  reserved_qty DECIMAL(20,6) NOT NULL,
  released_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  status ENUM('OPEN','PARTIAL','RELEASED','CANCELLED') NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_reservation_source (source_type, source_id),
  CONSTRAINT fk_res_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_res_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE picking_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL,
  assigned_to BIGINT UNSIGNED NULL,
  released_at DATETIME NULL,
  completed_at DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_pko_entity_no (entity_id, document_no),
  CONSTRAINT fk_pko_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_pko_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_pko_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id)
);

CREATE TABLE picking_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  picking_order_id BIGINT UNSIGNED NOT NULL,
  sales_order_line_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  location_code VARCHAR(60) NULL,
  lot_no VARCHAR(80) NULL,
  allocated_qty DECIMAL(20,6) NOT NULL,
  picked_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  CONSTRAINT fk_pkol_pko FOREIGN KEY (picking_order_id) REFERENCES picking_orders(id),
  CONSTRAINT fk_pkol_sol FOREIGN KEY (sales_order_line_id) REFERENCES sales_order_lines(id),
  CONSTRAINT fk_pkol_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE delivery_orders (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  picking_order_id BIGINT UNSIGNED NOT NULL,
  customer_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL,
  delivery_date DATE NULL,
  loading_dock VARCHAR(50) NULL,
  vehicle_no VARCHAR(80) NULL,
  driver_name VARCHAR(120) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_do_entity_no (entity_id, document_no),
  CONSTRAINT fk_do_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_do_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_do_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_do_pko FOREIGN KEY (picking_order_id) REFERENCES picking_orders(id),
  CONSTRAINT fk_do_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE delivery_order_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  delivery_order_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  lot_no VARCHAR(80) NULL,
  location_code VARCHAR(60) NULL,
  delivery_qty DECIMAL(20,6) NOT NULL,
  CONSTRAINT fk_dol_do FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id),
  CONSTRAINT fk_dol_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE shipments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  sales_order_id BIGINT UNSIGNED NOT NULL,
  delivery_order_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  status VARCHAR(40) NOT NULL,
  vehicle_no VARCHAR(80) NULL,
  driver_name VARCHAR(120) NULL,
  route_code VARCHAR(80) NULL,
  dispatched_at DATETIME NULL,
  delivered_at DATETIME NULL,
  pod_no VARCHAR(80) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_shp_entity_no (entity_id, document_no),
  CONSTRAINT fk_shp_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_shp_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_shp_so FOREIGN KEY (sales_order_id) REFERENCES sales_orders(id),
  CONSTRAINT fk_shp_do FOREIGN KEY (delivery_order_id) REFERENCES delivery_orders(id)
);

CREATE TABLE shipment_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  shipment_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  lot_no VARCHAR(80) NULL,
  shipped_qty DECIMAL(20,6) NOT NULL,
  CONSTRAINT fk_shpl_shp FOREIGN KEY (shipment_id) REFERENCES shipments(id),
  CONSTRAINT fk_shpl_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE stock_movements (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  movement_type VARCHAR(40) NOT NULL,
  qty DECIMAL(20,6) NOT NULL,
  source_type VARCHAR(40) NOT NULL,
  source_id BIGINT UNSIGNED NULL,
  source_document_no VARCHAR(60) NULL,
  posted_at DATETIME NOT NULL,
  posted_by BIGINT UNSIGNED NULL,
  idempotency_key VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_movement_idempotency (idempotency_key),
  KEY idx_stock_ledger_item_wh_date (item_id, warehouse_id, posted_at),
  CONSTRAINT fk_sm_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_sm_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_sm_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE transaction_audit_log (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  document_type VARCHAR(40) NOT NULL,
  document_id BIGINT UNSIGNED NOT NULL,
  action_code VARCHAR(50) NOT NULL,
  action_text VARCHAR(255) NOT NULL,
  actor_user_id BIGINT UNSIGNED NULL,
  payload_json JSON NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_document (document_type, document_id, created_at),
  CONSTRAINT fk_audit_entity FOREIGN KEY (entity_id) REFERENCES entities(id)
);
