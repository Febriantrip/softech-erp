BEGIN;

-- D3-C Sales-to-Cash: Shipment & Proof of Delivery.
-- Shipment planning allocates LOADED Delivery Order quantity. Physical stock is issued only on Dispatch.

ALTER TABLE erp.shipments
  ADD COLUMN IF NOT EXISTS delivery_order_id uuid REFERENCES erp.delivery_orders(id),
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS carrier varchar(160),
  ADD COLUMN IF NOT EXISTS vehicle varchar(120),
  ADD COLUMN IF NOT EXISTS driver varchar(160),
  ADD COLUMN IF NOT EXISTS route varchar(240),
  ADD COLUMN IF NOT EXISTS tracking_no varchar(160),
  ADD COLUMN IF NOT EXISTS reference_no varchar(160),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS pod_recipient varchar(200),
  ADD COLUMN IF NOT EXISTS pod_received_at timestamptz,
  ADD COLUMN IF NOT EXISTS pod_reference varchar(240),
  ADD COLUMN IF NOT EXISTS pod_notes text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES erp.users(id),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE erp.shipment_lines
  ADD COLUMN IF NOT EXISTS delivery_order_line_id uuid REFERENCES erp.delivery_order_lines(id),
  ADD COLUMN IF NOT EXISTS sales_order_line_id uuid REFERENCES erp.sales_order_lines(id),
  ADD COLUMN IF NOT EXISTS location_code varchar(80),
  ADD COLUMN IF NOT EXISTS lot_no varchar(100),
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_shipment_scope_status
  ON erp.shipments(entity_id,site_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_delivery_order
  ON erp.shipments(delivery_order_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_sales_order
  ON erp.shipments(sales_order_id,status,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_delivery_line
  ON erp.shipment_lines(delivery_order_line_id,shipment_id);
CREATE INDEX IF NOT EXISTS idx_shipment_lines_sales_line
  ON erp.shipment_lines(sales_order_line_id,shipment_id);

INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('shipment.view','warehouse','view','View Shipments'),
 ('shipment.create','warehouse','create','Create Shipments from loaded Delivery Orders'),
 ('shipment.update','warehouse','update','Update Shipment dispatch plan'),
 ('shipment.dispatch','warehouse','dispatch','Dispatch Shipment and post physical stock issue'),
 ('shipment.deliver','warehouse','deliver','Confirm delivery and Proof of Delivery'),
 ('shipment.cancel','warehouse','cancel','Cancel planned Shipments')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id
FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'shipment.%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
    EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.shipments,erp.shipment_lines TO softech_erp';
  END IF;
END $$;

COMMIT;
