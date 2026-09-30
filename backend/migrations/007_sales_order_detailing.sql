BEGIN;

-- D1/D2 Sales Order detailing foundation.
-- Safe to re-run on an existing V12 database.

CREATE TABLE IF NOT EXISTS erp.tax_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(40) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  rate numeric(8,4) NOT NULL DEFAULT 0 CHECK (rate >= 0),
  treatment varchar(20) NOT NULL DEFAULT 'STANDARD' CHECK (treatment IN ('STANDARD','ZERO','EXEMPT','NON_TAXABLE')),
  valid_from date,
  valid_to date,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (valid_to IS NULL OR valid_from IS NULL OR valid_to >= valid_from)
);

INSERT INTO erp.tax_codes(code,name,rate,treatment,status)
VALUES
  ('PPN-11','PPN 11% (compatibility baseline)',11,'STANDARD','ACTIVE'),
  ('PPN-0','PPN 0%',0,'ZERO','ACTIVE'),
  ('NON-PPN','Non PPN',0,'NON_TAXABLE','ACTIVE')
ON CONFLICT (code) DO NOTHING;

ALTER TABLE erp.sales_orders
  ADD COLUMN IF NOT EXISTS customer_po varchar(120),
  ADD COLUMN IF NOT EXISTS requested_delivery_date date,
  ADD COLUMN IF NOT EXISTS payment_terms varchar(60),
  ADD COLUMN IF NOT EXISTS billing_address text,
  ADD COLUMN IF NOT EXISTS shipping_address text,
  ADD COLUMN IF NOT EXISTS salesperson varchar(120),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS internal_notes text,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES erp.users(id),
  ADD COLUMN IF NOT EXISTS cancel_reason text,
  ADD COLUMN IF NOT EXISTS revision_no integer NOT NULL DEFAULT 0;

ALTER TABLE erp.sales_order_lines
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS uom varchar(20),
  ADD COLUMN IF NOT EXISTS discount_percent numeric(8,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dpp_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_code_id uuid REFERENCES erp.tax_codes(id),
  ADD COLUMN IF NOT EXISTS tax_amount numeric(20,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS line_total numeric(20,2) NOT NULL DEFAULT 0;

DROP INDEX IF EXISTS erp.uq_sales_order_item;

UPDATE erp.sales_order_lines l
SET uom = COALESCE(l.uom, i.base_uom),
    dpp_amount = round((l.qty*l.unit_price - COALESCE(l.discount_amount,0))::numeric,2),
    tax_amount = round(((l.qty*l.unit_price - COALESCE(l.discount_amount,0)) * l.tax_rate / 100)::numeric,2),
    line_total = round(((l.qty*l.unit_price - COALESCE(l.discount_amount,0)) * (1 + l.tax_rate/100))::numeric,2)
FROM erp.items i
WHERE i.id=l.item_id;

UPDATE erp.sales_orders so
SET discount_amount = x.discount_amount,
    dpp_amount = x.dpp_amount,
    subtotal = x.subtotal,
    tax_amount = x.tax_amount,
    total_amount = x.total_amount
FROM (
  SELECT sales_order_id,
         round(sum(qty*unit_price)::numeric,2) subtotal,
         round(sum(discount_amount)::numeric,2) discount_amount,
         round(sum(dpp_amount)::numeric,2) dpp_amount,
         round(sum(tax_amount)::numeric,2) tax_amount,
         round(sum(line_total)::numeric,2) total_amount
  FROM erp.sales_order_lines GROUP BY sales_order_id
) x
WHERE so.id=x.sales_order_id;

CREATE INDEX IF NOT EXISTS idx_so_customer_date ON erp.sales_orders(customer_id,order_date DESC);
CREATE INDEX IF NOT EXISTS idx_so_requested_delivery ON erp.sales_orders(entity_id,site_id,requested_delivery_date) WHERE requested_delivery_date IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_so_line_item ON erp.sales_order_lines(item_id,sales_order_id);
CREATE INDEX IF NOT EXISTS idx_tax_codes_active_dates ON erp.tax_codes(status,valid_from,valid_to);

-- PostgreSQL 18 / pgx integer compatibility overload.
-- The overload may already exist from an earlier manual compatibility fix and can be
-- owned by postgres. Never CREATE OR REPLACE an existing function owned by another role.
DO $d1_next_number$
BEGIN
  IF to_regprocedure('erp.next_document_number(uuid,uuid,text,integer,integer,text,integer)') IS NULL THEN
    EXECUTE $create_fn$
      CREATE FUNCTION erp.next_document_number(
        p_entity_id uuid,
        p_site_id uuid,
        p_document_type text,
        p_fiscal_year integer,
        p_fiscal_month integer,
        p_prefix text,
        p_padding integer
      ) RETURNS text
      LANGUAGE sql
      AS $body$
        SELECT erp.next_document_number(
          p_entity_id,
          p_site_id,
          p_document_type::varchar,
          p_fiscal_year::smallint,
          p_fiscal_month::smallint,
          p_prefix::varchar,
          p_padding::smallint
        );
      $body$
    $create_fn$;
  END IF;
END
$d1_next_number$;

INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('sales_order.view','sales','view','View Sales Orders'),
 ('sales_order.create','sales','create','Create Sales Orders'),
 ('sales_order.edit','sales','edit','Edit draft Sales Orders'),
 ('sales_order.delete','sales','delete','Delete draft Sales Orders'),
 ('sales_order.submit','sales','submit','Submit Sales Orders'),
 ('sales_order.approve','sales','approve','Approve Sales Orders'),
 ('sales_order.cancel','sales','cancel','Cancel unshipped Sales Orders'),
 ('sales_order.reserve','sales','reserve','Reserve stock for Sales Orders'),
 ('sales_order.dispatch','sales','dispatch','Dispatch reserved Sales Orders')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code LIKE 'sales_order.%'
ON CONFLICT DO NOTHING;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
    EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.tax_codes TO softech_erp';
    EXECUTE 'GRANT SELECT,INSERT,UPDATE,DELETE ON erp.sales_orders,erp.sales_order_lines TO softech_erp';
  END IF;
END $$;

COMMIT;
