BEGIN;

-- D3-B Sales-to-Cash: Delivery Order foundation.
-- Delivery Orders allocate completed Picking quantity. No On Hand / Reserved mutation occurs here.

CREATE TABLE IF NOT EXISTS erp.delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_no varchar(80) NOT NULL,
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id),
  sales_order_id uuid NOT NULL REFERENCES erp.sales_orders(id),
  picking_order_id uuid NOT NULL REFERENCES erp.picking_orders(id),
  status varchar(30) NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','READY_TO_LOAD','LOADING','LOADED','CANCELLED')),
  delivery_date date NOT NULL,
  shipping_address text NOT NULL DEFAULT '',
  carrier varchar(160),
  vehicle varchar(120),
  driver varchar(160),
  dock varchar(80),
  notes text,
  released_at timestamptz,
  loading_started_at timestamptz,
  loaded_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  created_by uuid REFERENCES erp.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, document_no)
);

CREATE INDEX IF NOT EXISTS idx_delivery_order_scope_status
  ON erp.delivery_orders(entity_id,site_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_order_sales_order
  ON erp.delivery_orders(sales_order_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_order_picking
  ON erp.delivery_orders(picking_order_id,status,created_at DESC);

CREATE TABLE IF NOT EXISTS erp.delivery_order_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_order_id uuid NOT NULL REFERENCES erp.delivery_orders(id) ON DELETE CASCADE,
  picking_order_line_id uuid NOT NULL REFERENCES erp.picking_order_lines(id),
  sales_order_line_id uuid NOT NULL REFERENCES erp.sales_order_lines(id),
  line_no integer NOT NULL,
  item_id uuid NOT NULL REFERENCES erp.items(id),
  qty numeric(20,6) NOT NULL CHECK (qty > 0),
  location_code varchar(80),
  lot_no varchar(100),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(delivery_order_id,line_no),
  UNIQUE(delivery_order_id,picking_order_line_id)
);

CREATE INDEX IF NOT EXISTS idx_delivery_lines_picking_line
  ON erp.delivery_order_lines(picking_order_line_id,delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_delivery_lines_so_line
  ON erp.delivery_order_lines(sales_order_line_id,delivery_order_id);

INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('delivery_order.view','warehouse','view','View Delivery Orders'),
 ('delivery_order.create','warehouse','create','Create Delivery Orders from completed Picking Orders'),
 ('delivery_order.update','warehouse','update','Update Delivery Order loading plan'),
 ('delivery_order.release','warehouse','release','Release Delivery Orders to loading'),
 ('delivery_order.load','warehouse','load','Start Delivery Order loading'),
 ('delivery_order.complete','warehouse','complete','Complete Delivery Order loading'),
 ('delivery_order.cancel','warehouse','cancel','Cancel Delivery Orders')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'delivery_order.%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
    EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.delivery_orders,erp.delivery_order_lines TO softech_erp';
  END IF;
END $$;

COMMIT;
