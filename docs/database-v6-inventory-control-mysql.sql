-- NEXA ERP Distributor V6 - Inventory Control & Costing extension
-- Apply after database-core-mysql.sql, database-v4-finance-mysql.sql, and database-v5-procure-to-pay-mysql.sql
-- MySQL 8.x starter migration. Adapt IDs/FKs to your production naming standard.

ALTER TABLE items
  ADD COLUMN standard_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN reorder_point DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN max_stock DECIMAL(20,6) NOT NULL DEFAULT 0;

ALTER TABLE inventory_balance
  ADD COLUMN inbound_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN average_cost DECIMAL(20,6) NOT NULL DEFAULT 0;

CREATE TABLE warehouse_locations (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  location_code VARCHAR(60) NOT NULL,
  location_type ENUM('INBOUND','STORAGE','PICK_FACE','STAGING','QUARANTINE','RETURN','VIRTUAL') NOT NULL DEFAULT 'STORAGE',
  zone_code VARCHAR(60) NULL,
  pick_priority INT NOT NULL DEFAULT 999,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_wh_location (warehouse_id, location_code),
  CONSTRAINT fk_whloc_warehouse FOREIGN KEY (warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE inventory_lot_balances (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  warehouse_location_id BIGINT UNSIGNED NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  lot_no VARCHAR(100) NOT NULL,
  expiry_date DATE NULL,
  on_hand_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  reserved_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  average_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  row_version BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_inventory_lot (warehouse_id, warehouse_location_id, item_id, lot_no),
  KEY idx_inventory_lot_expiry (item_id, expiry_date),
  CONSTRAINT fk_invlot_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_invlot_loc FOREIGN KEY (warehouse_location_id) REFERENCES warehouse_locations(id),
  CONSTRAINT fk_invlot_item FOREIGN KEY (item_id) REFERENCES items(id)
);

CREATE TABLE stock_transfers (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  source_site_id BIGINT UNSIGNED NOT NULL,
  destination_site_id BIGINT UNSIGNED NOT NULL,
  source_warehouse_id BIGINT UNSIGNED NOT NULL,
  destination_warehouse_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  status ENUM('DRAFT','RELEASED','IN_TRANSIT','PARTIALLY_RECEIVED','RECEIVED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  requested_by BIGINT UNSIGNED NULL,
  released_at DATETIME NULL,
  received_at DATETIME NULL,
  notes TEXT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_transfer_entity_no (entity_id, document_no),
  KEY idx_transfer_in_transit (status, destination_warehouse_id),
  CONSTRAINT fk_transfer_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_transfer_source_site FOREIGN KEY (source_site_id) REFERENCES sites(id),
  CONSTRAINT fk_transfer_dest_site FOREIGN KEY (destination_site_id) REFERENCES sites(id),
  CONSTRAINT fk_transfer_source_wh FOREIGN KEY (source_warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_transfer_dest_wh FOREIGN KEY (destination_warehouse_id) REFERENCES warehouses(id)
);

CREATE TABLE stock_transfer_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_transfer_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  requested_qty DECIMAL(20,6) NOT NULL,
  shipped_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  received_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  uom_code VARCHAR(20) NOT NULL,
  carrying_unit_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  source_location_id BIGINT UNSIGNED NULL,
  destination_location_id BIGINT UNSIGNED NULL,
  lot_no VARCHAR(100) NULL,
  UNIQUE KEY uk_transfer_line (stock_transfer_id, line_no),
  CONSTRAINT fk_transfer_line_header FOREIGN KEY (stock_transfer_id) REFERENCES stock_transfers(id),
  CONSTRAINT fk_transfer_line_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_transfer_line_source_loc FOREIGN KEY (source_location_id) REFERENCES warehouse_locations(id),
  CONSTRAINT fk_transfer_line_dest_loc FOREIGN KEY (destination_location_id) REFERENCES warehouse_locations(id)
);

CREATE TABLE stock_takes (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  entity_id BIGINT UNSIGNED NOT NULL,
  site_id BIGINT UNSIGNED NOT NULL,
  warehouse_id BIGINT UNSIGNED NOT NULL,
  document_no VARCHAR(50) NOT NULL,
  document_date DATE NOT NULL,
  scope_label VARCHAR(120) NULL,
  status ENUM('COUNTING','PENDING_APPROVAL','APPROVED','POSTED','CANCELLED') NOT NULL DEFAULT 'COUNTING',
  requested_by BIGINT UNSIGNED NULL,
  approved_by BIGINT UNSIGNED NULL,
  approved_at DATETIME NULL,
  posted_at DATETIME NULL,
  journal_entry_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_stock_take_entity_no (entity_id, document_no),
  KEY idx_stock_take_status (warehouse_id, status, document_date),
  CONSTRAINT fk_stock_take_entity FOREIGN KEY (entity_id) REFERENCES entities(id),
  CONSTRAINT fk_stock_take_site FOREIGN KEY (site_id) REFERENCES sites(id),
  CONSTRAINT fk_stock_take_wh FOREIGN KEY (warehouse_id) REFERENCES warehouses(id),
  CONSTRAINT fk_stock_take_journal FOREIGN KEY (journal_entry_id) REFERENCES journal_entries(id)
);

CREATE TABLE stock_take_lines (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  stock_take_id BIGINT UNSIGNED NOT NULL,
  line_no INT UNSIGNED NOT NULL,
  item_id BIGINT UNSIGNED NOT NULL,
  warehouse_location_id BIGINT UNSIGNED NULL,
  lot_no VARCHAR(100) NULL,
  system_qty DECIMAL(20,6) NOT NULL,
  counted_qty DECIMAL(20,6) NULL,
  variance_qty DECIMAL(20,6) NOT NULL DEFAULT 0,
  carrying_unit_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  variance_value DECIMAL(20,2) NOT NULL DEFAULT 0,
  UNIQUE KEY uk_stock_take_line (stock_take_id, line_no),
  CONSTRAINT fk_stock_take_line_header FOREIGN KEY (stock_take_id) REFERENCES stock_takes(id),
  CONSTRAINT fk_stock_take_line_item FOREIGN KEY (item_id) REFERENCES items(id),
  CONSTRAINT fk_stock_take_line_loc FOREIGN KEY (warehouse_location_id) REFERENCES warehouse_locations(id)
);

-- For production, stock_movements should carry valuation metadata.
ALTER TABLE stock_movements
  ADD COLUMN warehouse_location_id BIGINT UNSIGNED NULL,
  ADD COLUMN lot_no VARCHAR(100) NULL,
  ADD COLUMN unit_cost DECIMAL(20,6) NOT NULL DEFAULT 0,
  ADD COLUMN movement_value DECIMAL(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN balance_after_qty DECIMAL(20,6) NULL,
  ADD CONSTRAINT fk_stock_movement_location FOREIGN KEY (warehouse_location_id) REFERENCES warehouse_locations(id);

-- Recommended production controls:
-- 1) Release transfer must lock source inventory rows and validate available = on_hand - reserved.
-- 2) Transfer-out and transfer-in must share one immutable transfer correlation ID.
-- 3) Same-entity transfer has no P&L impact; cross-entity transfer should invoke intercompany accounting.
-- 4) Moving-average cost updates must be atomic with put-away/receipt inventory posting.
-- 5) Shipment issue should post COGS using the persisted carrying cost snapshot, not a later recalculated cost.
-- 6) Stock take should freeze/snapshot the counted scope or reject posting when inventory changed after snapshot.
-- 7) Stock-take variance and manual adjustment posting must reject CLOSED accounting periods.
-- 8) Lot/expiry allocation should support FEFO policy where required.
