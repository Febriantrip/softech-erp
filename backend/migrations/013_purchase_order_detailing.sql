BEGIN;
-- D4-A, additive Purchase Order detailing; legacy PO prices and receipt matching remain valid.
ALTER TABLE erp.purchase_orders
  ADD COLUMN IF NOT EXISTS supplier_reference varchar(120),
  ADD COLUMN IF NOT EXISTS payment_terms varchar(60),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES erp.users(id);
ALTER TABLE erp.purchase_order_lines
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS list_unit_price numeric(20,6),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES erp.tax_codes(id),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric(20,2) NOT NULL DEFAULT 0;
-- Backfill only legacy rows. Effective unit_price remains unchanged for existing receipts/invoices.
UPDATE erp.purchase_order_lines
SET list_unit_price=unit_price,
    dpp_amount=round(qty*unit_price,2),
    tax_amount=round(round(qty*unit_price,2)*tax_rate/100,2),
    line_total=round(qty*unit_price,2)+round(round(qty*unit_price,2)*tax_rate/100,2)
WHERE list_unit_price IS NULL;
UPDATE erp.purchase_orders po
SET dpp_amount=COALESCE((SELECT sum(l.dpp_amount) FROM erp.purchase_order_lines l WHERE l.purchase_order_id=po.id),0),
    payment_terms=COALESCE(po.payment_terms,(SELECT s.payment_terms FROM erp.suppliers s WHERE s.id=po.supplier_id))
WHERE po.payment_terms IS NULL OR (po.dpp_amount=0 AND po.subtotal<>0);
CREATE INDEX IF NOT EXISTS idx_po_supplier_date ON erp.purchase_orders(supplier_id,order_date DESC);
INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('purchase_order.view','procurement','view','View Purchase Orders'),
 ('purchase_order.create','procurement','create','Create Purchase Orders'),
 ('purchase_order.edit','procurement','edit','Edit draft Purchase Orders'),
 ('purchase_order.delete','procurement','delete','Delete draft Purchase Orders'),
 ('purchase_order.submit','procurement','submit','Submit Purchase Orders'),
 ('purchase_order.approve','procurement','approve','Approve Purchase Orders'),
 ('purchase_order.cancel','procurement','cancel','Cancel unreceived Purchase Orders'),
 ('purchase_order.receive','procurement','receive','Receive Purchase Orders')
ON CONFLICT (code) DO NOTHING;
INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'purchase_order.%'
ON CONFLICT DO NOTHING;
DO $d4_grants$
BEGIN
 IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
  EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.purchase_orders,erp.purchase_order_lines TO softech_erp';
 END IF;
END $d4_grants$;
COMMIT;
