BEGIN;

-- V11 Core Transaction Migration: Sales, Purchase, Warehouse & Inventory.
-- Safe to re-run. Existing V10 volumes receive this migration through the compose migrator service.

UPDATE erp.sites s
SET code = 'GRK-WH', updated_at = now()
FROM erp.entities e
WHERE s.entity_id = e.id AND e.code = 'NDT' AND s.code = 'GRS-WH'
  AND NOT EXISTS (
    SELECT 1 FROM erp.sites x WHERE x.entity_id = e.id AND x.code = 'GRK-WH'
  );

CREATE TABLE IF NOT EXISTS erp.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  code varchar(40) NOT NULL,
  name varchar(180) NOT NULL,
  credit_limit numeric(20,2) NOT NULL DEFAULT 0,
  payment_terms varchar(40) NOT NULL DEFAULT 'NET 30',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);
CREATE INDEX IF NOT EXISTS idx_customers_entity_status ON erp.customers(entity_id, status);

CREATE TABLE IF NOT EXISTS erp.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  code varchar(40) NOT NULL,
  name varchar(180) NOT NULL,
  payment_terms varchar(40) NOT NULL DEFAULT 'NET 30',
  lead_time_days integer NOT NULL DEFAULT 5 CHECK (lead_time_days >= 0),
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);
CREATE INDEX IF NOT EXISTS idx_suppliers_entity_status ON erp.suppliers(entity_id, status);

CREATE TABLE IF NOT EXISTS erp.items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sku varchar(60) NOT NULL UNIQUE,
  name varchar(180) NOT NULL,
  base_uom varchar(20) NOT NULL DEFAULT 'CTN',
  standard_cost numeric(20,6) NOT NULL DEFAULT 0,
  sales_price numeric(20,6) NOT NULL DEFAULT 0,
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  reorder_point numeric(20,6) NOT NULL DEFAULT 0,
  max_stock numeric(20,6) NOT NULL DEFAULT 0,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.inventory_balance (
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  item_id uuid NOT NULL REFERENCES erp.items(id),
  on_hand_qty numeric(20,6) NOT NULL DEFAULT 0,
  reserved_qty numeric(20,6) NOT NULL DEFAULT 0,
  inbound_qty numeric(20,6) NOT NULL DEFAULT 0,
  average_cost numeric(20,6) NOT NULL DEFAULT 0,
  row_version bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(warehouse_id, item_id),
  CHECK (on_hand_qty >= 0),
  CHECK (reserved_qty >= 0),
  CHECK (inbound_qty >= 0),
  CHECK (reserved_qty <= on_hand_qty)
);

CREATE TABLE IF NOT EXISTS erp.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  item_id uuid NOT NULL REFERENCES erp.items(id),
  movement_type varchar(50) NOT NULL,
  qty numeric(20,6) NOT NULL,
  unit_cost numeric(20,6) NOT NULL DEFAULT 0,
  movement_value numeric(20,2) NOT NULL DEFAULT 0,
  balance_after_qty numeric(20,6),
  reference_type varchar(60),
  reference_id varchar(120),
  request_id varchar(80),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_movement_scope_time ON erp.stock_movements(entity_id, site_id, warehouse_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_movement_reference ON erp.stock_movements(reference_type, reference_id);

CREATE TABLE IF NOT EXISTS erp.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  customer_id uuid NOT NULL REFERENCES erp.customers(id),
  order_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','RESERVED','PARTIALLY_SHIPPED','SHIPPED','CANCELLED')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  subtotal numeric(20,2) NOT NULL DEFAULT 0,
  tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  total_amount numeric(20,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES erp.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);
CREATE INDEX IF NOT EXISTS idx_so_scope_status ON erp.sales_orders(entity_id, site_id, status, order_date DESC);

CREATE TABLE IF NOT EXISTS erp.sales_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  unit_price numeric(20,6) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  reserved_qty numeric(20,6) NOT NULL DEFAULT 0,
  shipped_qty numeric(20,6) NOT NULL DEFAULT 0,
  UNIQUE(sales_order_id, line_no),
  CHECK (reserved_qty >= 0 AND shipped_qty >= 0),
  CHECK (reserved_qty <= qty AND shipped_qty <= qty)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_order_item ON erp.sales_order_lines(sales_order_id,item_id);

CREATE TABLE IF NOT EXISTS erp.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_orders(id),
  status varchar(30) NOT NULL DEFAULT 'PLANNED' CHECK (status IN ('PLANNED','DISPATCHED','DELIVERED','CANCELLED')),
  dispatched_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);

CREATE TABLE IF NOT EXISTS erp.shipment_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id uuid NOT NULL REFERENCES erp.shipments(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  unit_cost numeric(20,6) NOT NULL DEFAULT 0,
  UNIQUE(shipment_id, line_no)
);

CREATE TABLE IF NOT EXISTS erp.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  supplier_id uuid NOT NULL REFERENCES erp.suppliers(id),
  order_date date NOT NULL,
  eta_date date,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','PUT_AWAY','CLOSED','CANCELLED')),
  currency char(3) NOT NULL DEFAULT 'IDR',
  subtotal numeric(20,2) NOT NULL DEFAULT 0,
  tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  total_amount numeric(20,2) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES erp.users(id),
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);
CREATE INDEX IF NOT EXISTS idx_po_scope_status ON erp.purchase_orders(entity_id, site_id, status, order_date DESC);

CREATE TABLE IF NOT EXISTS erp.purchase_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES erp.purchase_orders(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  unit_price numeric(20,6) NOT NULL CHECK (unit_price >= 0),
  tax_rate numeric(8,4) NOT NULL DEFAULT 0,
  received_qty numeric(20,6) NOT NULL DEFAULT 0,
  putaway_qty numeric(20,6) NOT NULL DEFAULT 0,
  UNIQUE(purchase_order_id, line_no),
  CHECK (received_qty >= 0 AND putaway_qty >= 0),
  CHECK (received_qty <= qty AND putaway_qty <= received_qty)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_order_item ON erp.purchase_order_lines(purchase_order_id,item_id);

CREATE TABLE IF NOT EXISTS erp.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  purchase_order_id uuid NOT NULL REFERENCES erp.purchase_orders(id),
  receipt_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','RECEIVED','PUT_AWAY','CANCELLED')),
  received_at timestamptz,
  putaway_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);

CREATE TABLE IF NOT EXISTS erp.goods_receipt_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_receipt_id uuid NOT NULL REFERENCES erp.goods_receipts(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  expected_qty numeric(20,6) NOT NULL,
  accepted_qty numeric(20,6) NOT NULL DEFAULT 0,
  rejected_qty numeric(20,6) NOT NULL DEFAULT 0,
  lot_no varchar(100),
  putaway_location varchar(80),
  UNIQUE(goods_receipt_id, line_no),
  CHECK (accepted_qty >= 0 AND rejected_qty >= 0),
  CHECK (accepted_qty + rejected_qty <= expected_qty)
);

CREATE TABLE IF NOT EXISTS erp.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  source_warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  destination_warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  transfer_date date NOT NULL,
  status varchar(30) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','IN_TRANSIT','RECEIVED','CANCELLED')),
  released_at timestamptz,
  received_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no),
  CHECK (source_warehouse_id <> destination_warehouse_id)
);

CREATE TABLE IF NOT EXISTS erp.stock_transfer_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_transfer_id uuid NOT NULL REFERENCES erp.stock_transfers(id) ON DELETE CASCADE,
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  shipped_qty numeric(20,6) NOT NULL DEFAULT 0,
  received_qty numeric(20,6) NOT NULL DEFAULT 0,
  carrying_unit_cost numeric(20,6) NOT NULL DEFAULT 0,
  UNIQUE(stock_transfer_id, line_no)
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_transfer_item ON erp.stock_transfer_lines(stock_transfer_id,item_id);

-- Demo master data, deliberately small. Business transactions can now be created by the API.
INSERT INTO erp.customers(entity_id, code, name, credit_limit, payment_terms)
SELECT e.id, v.code, v.name, v.credit_limit, v.terms
FROM erp.entities e
JOIN (VALUES
  ('NDU','CUST-001','PT Sinar Retail Indonesia',150000000::numeric,'NET 30'),
  ('NDU','CUST-002','CV Maju Bersama Mart',85000000::numeric,'NET 21'),
  ('NDT','CUST-101','PT Timur Niaga Sentosa',120000000::numeric,'NET 30')
) AS v(entity_code,code,name,credit_limit,terms) ON e.code=v.entity_code
ON CONFLICT (entity_id, code) DO NOTHING;

INSERT INTO erp.suppliers(entity_id, code, name, payment_terms, lead_time_days)
SELECT e.id, v.code, v.name, v.terms, v.lead
FROM erp.entities e
JOIN (VALUES
  ('NDU','SUP-001','PT Indo Principal Supply','NET 30',5),
  ('NDU','SUP-002','PT Sumber Niaga Makmur','NET 30',4),
  ('NDT','SUP-101','PT Timur Principal Supply','NET 30',6)
) AS v(entity_code,code,name,terms,lead) ON e.code=v.entity_code
ON CONFLICT (entity_id, code) DO NOTHING;

INSERT INTO erp.items(sku,name,base_uom,standard_cost,sales_price,tax_rate,reorder_point,max_stock)
VALUES
  ('SKU-10018','Premium Cooking Oil 2L','CTN',278000,335000,11,180,650),
  ('SKU-10077','Mineral Water 600ml x24','CTN',302000,365000,11,140,500),
  ('SKU-10221','Instant Noodle Assorted','CTN',306000,372000,11,120,460),
  ('SKU-10301','Laundry Detergent 800g','CTN',174000,219000,11,170,620),
  ('SKU-10521','Household Cleaner 800ml','CTN',289000,349000,11,100,380)
ON CONFLICT (sku) DO NOTHING;

INSERT INTO erp.inventory_balance(warehouse_id,item_id,on_hand_qty,reserved_qty,inbound_qty,average_cost)
SELECT w.id, i.id, v.on_hand, v.reserved, v.inbound, v.avg_cost
FROM erp.warehouses w
JOIN erp.entities e ON e.id=w.entity_id
JOIN (VALUES
  ('NDU','WH-JKT','SKU-10018',380::numeric,40::numeric,0::numeric,278000::numeric),
  ('NDU','WH-JKT','SKU-10077',260,30,0,302000),
  ('NDU','WH-JKT','SKU-10221',210,0,0,306000),
  ('NDU','WH-JKT','SKU-10301',350,40,0,174000),
  ('NDU','WH-JKT','SKU-10521',70,0,0,289000),
  ('NDU','WH-CKR','SKU-10018',140,0,0,278000),
  ('NDU','WH-CKR','SKU-10077',95,0,0,302000),
  ('NDT','WH-SBY','SKU-10018',120,0,0,278000),
  ('NDT','WH-SBY','SKU-10301',160,0,0,174000)
) AS v(entity_code,warehouse_code,sku,on_hand,reserved,inbound,avg_cost)
ON e.code=v.entity_code AND w.code=v.warehouse_code
JOIN erp.items i ON i.sku=v.sku
ON CONFLICT (warehouse_id,item_id) DO NOTHING;

COMMIT;
