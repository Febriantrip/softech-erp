BEGIN;

-- D3-D: multiple invoices per SO, invoice allocation traceable to shipment line.
-- Existing invoices remain intact; legacy invoices (shipment_id IS NULL)
-- are deliberately excluded from new source availability until reconciled.
ALTER TABLE erp.sales_invoices
  DROP CONSTRAINT IF EXISTS sales_invoices_entity_id_sales_order_id_key;

ALTER TABLE erp.sales_invoices
  ADD COLUMN IF NOT EXISTS shipment_id uuid REFERENCES erp.shipments(id),
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_terms varchar(60),
  ADD COLUMN IF NOT EXISTS customer_po varchar(120),
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS shipping_address text;

ALTER TABLE erp.sales_invoice_lines
  ADD COLUMN IF NOT EXISTS shipment_line_id uuid REFERENCES erp.shipment_lines(id),
  ADD COLUMN IF NOT EXISTS sales_order_line_id uuid REFERENCES erp.sales_order_lines(id),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES erp.tax_codes(id),
  ADD COLUMN IF NOT EXISTS uom varchar(20),
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS line_total numeric(20,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_sales_invoice_shipment_status
  ON erp.sales_invoices(entity_id,shipment_id,status);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_line_shipment
  ON erp.sales_invoice_lines(shipment_line_id,sales_invoice_id);
CREATE INDEX IF NOT EXISTS idx_sales_invoice_line_so
  ON erp.sales_invoice_lines(sales_order_line_id,sales_invoice_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_one_shipment_line_per_invoice
  ON erp.sales_invoice_lines(sales_invoice_id,shipment_line_id)
  WHERE shipment_line_id IS NOT NULL;

INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('sales_invoice.view','finance','view','View Sales Invoices and eligible Shipment sources'),
 ('sales_invoice.create','finance','create','Create partial Sales Invoice drafts'),
 ('sales_invoice.post','finance','post','Post Sales Invoice to AR and GL'),
 ('sales_invoice.delete','finance','delete','Delete unposted Sales Invoice drafts')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'sales_invoice.%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
   EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.sales_invoices,erp.sales_invoice_lines TO softech_erp';
 END IF;
END $$;

COMMIT;
