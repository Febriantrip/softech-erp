BEGIN;

-- D3-A Sales-to-Cash: Picking & Fulfillment foundation.
-- Additive migration. Picking records actual warehouse work without changing On Hand.

CREATE TABLE IF NOT EXISTS erp.picking_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_orders(id),
  status varchar(30) NOT NULL DEFAULT 'OPEN'
    CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
  picker_user_id uuid REFERENCES erp.users(id),
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid REFERENCES erp.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);

CREATE INDEX IF NOT EXISTS idx_picking_scope_status
  ON erp.picking_orders(entity_id,site_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_picking_sales_order
  ON erp.picking_orders(sales_order_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS erp.picking_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  picking_order_id uuid NOT NULL REFERENCES erp.picking_orders(id) ON DELETE CASCADE,
  sales_order_line_id uuid NOT NULL REFERENCES erp.sales_order_lines(id),
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  requested_qty numeric(20,6) NOT NULL CHECK (requested_qty > 0),
  picked_qty numeric(20,6) NOT NULL DEFAULT 0 CHECK (picked_qty >= 0),
  shortage_qty numeric(20,6) NOT NULL DEFAULT 0 CHECK (shortage_qty >= 0),
  location_code varchar(80),
  lot_no varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(picking_order_id,line_no),
  UNIQUE(picking_order_id,sales_order_line_id),
  CHECK (picked_qty <= requested_qty),
  CHECK (shortage_qty <= requested_qty)
);

CREATE INDEX IF NOT EXISTS idx_picking_lines_so_line
  ON erp.picking_order_lines(sales_order_line_id,picking_order_id);

INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('picking_order.view','warehouse','view','View Picking Orders'),
 ('picking_order.create','warehouse','create','Create Picking Orders from reserved Sales Orders'),
 ('picking_order.update','warehouse','update','Update Picking Order progress'),
 ('picking_order.complete','warehouse','complete','Complete Picking Orders'),
 ('picking_order.cancel','warehouse','cancel','Cancel Picking Orders')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'picking_order.%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
    EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.picking_orders,erp.picking_order_lines TO softech_erp';
  END IF;
END $$;

COMMIT;
