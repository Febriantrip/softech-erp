BEGIN;
-- D4-B.1/1: backward-compatible Multi-UOM foundation. Does NOT reinterpret historical quantities.
CREATE TABLE IF NOT EXISTS erp.uom_units (
 code varchar(20) PRIMARY KEY,
 name varchar(80) NOT NULL,
 dimension varchar(32) NOT NULL DEFAULT 'COUNT',
 is_active boolean NOT NULL DEFAULT true
);
INSERT INTO erp.uom_units(code,name,dimension) VALUES
 ('PCS','Piece','COUNT'),('PACK','Pack','COUNT'),('CTN','Carton','COUNT'),
 ('KG','Kilogram','MASS'),('G','Gram','MASS'),('L','Liter','VOLUME'),('ML','Milliliter','VOLUME'),
 ('M','Meter','LENGTH'),('ROLL','Roll','COUNT'),('UNIT','Unit','COUNT')
ON CONFLICT (code) DO NOTHING;
-- Existing projects may have custom base_uom codes. Keep them, do not relabel.
INSERT INTO erp.uom_units(code,name,dimension)
 SELECT DISTINCT upper(trim(base_uom)),upper(trim(base_uom)),'CUSTOM' FROM erp.items
 WHERE base_uom IS NOT NULL AND trim(base_uom)<>''
ON CONFLICT (code) DO NOTHING;
CREATE TABLE IF NOT EXISTS erp.item_uom_conversions (
 item_id uuid NOT NULL REFERENCES erp.items(id) ON DELETE RESTRICT,
 uom_code varchar(20) NOT NULL REFERENCES erp.uom_units(code),
 -- 1 transaction UOM = factor inventory/base UOM. Exact numeric, NEVER global by CTN/PACK.
 base_qty_per_uom numeric(24,9) NOT NULL CHECK (base_qty_per_uom > 0),
 is_active boolean NOT NULL DEFAULT true,
 created_at timestamptz NOT NULL DEFAULT now(),
 updated_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(item_id,uom_code)
);
INSERT INTO erp.item_uom_conversions(item_id,uom_code,base_qty_per_uom)
 SELECT id,upper(trim(base_uom)),1 FROM erp.items
 WHERE base_uom IS NOT NULL AND trim(base_uom)<>''
ON CONFLICT (item_id,uom_code) DO NOTHING;

-- Legacy quantity columns are currently recorded in items.base_uom.
-- Protect all populated items against naive CTN->PCS base unit switches.
CREATE OR REPLACE FUNCTION erp.d4b1_guard_base_uom_change() RETURNS trigger
LANGUAGE plpgsql AS $guard$
BEGIN
 IF upper(trim(new.base_uom)) IS DISTINCT FROM upper(trim(old.base_uom)) THEN
   IF EXISTS (SELECT 1 FROM erp.inventory_balance WHERE item_id=old.id)
      OR EXISTS (SELECT 1 FROM erp.stock_movements WHERE item_id=old.id)
      OR EXISTS (SELECT 1 FROM erp.sales_order_lines WHERE item_id=old.id)
      OR EXISTS (SELECT 1 FROM erp.purchase_order_lines WHERE item_id=old.id)
      OR EXISTS (SELECT 1 FROM erp.goods_receipt_lines WHERE item_id=old.id) THEN
      RAISE EXCEPTION 'UOM_CUTOVER_REQUIRED: SKU has stock/history. Do not change base_uom directly; convert balances, open documents, costs and movement lineage as a controlled migration.';
   END IF;
   INSERT INTO erp.item_uom_conversions(item_id,uom_code,base_qty_per_uom)
   VALUES (new.id,upper(trim(new.base_uom)),1)
   ON CONFLICT(item_id,uom_code) DO UPDATE SET base_qty_per_uom=1;
 END IF;
 RETURN new;
END $guard$;
DROP TRIGGER IF EXISTS d4b1_guard_base_uom ON erp.items;
CREATE TRIGGER d4b1_guard_base_uom BEFORE UPDATE OF base_uom ON erp.items
 FOR EACH ROW EXECUTE FUNCTION erp.d4b1_guard_base_uom_change();

CREATE OR REPLACE FUNCTION erp.d4b1_validate_conversion() RETURNS trigger
LANGUAGE plpgsql AS $v$
DECLARE base varchar(20);
BEGIN
 SELECT upper(trim(base_uom)) INTO base FROM erp.items WHERE id=new.item_id;
 IF base IS NULL THEN RAISE EXCEPTION 'Item does not exist'; END IF;
 IF upper(trim(new.uom_code))=base AND new.base_qty_per_uom<>1 THEN
  RAISE EXCEPTION 'Base UOM conversion must equal 1';
 END IF;
 RETURN new;
END $v$;
DROP TRIGGER IF EXISTS d4b1_validate_conversion ON erp.item_uom_conversions;
CREATE TRIGGER d4b1_validate_conversion BEFORE INSERT OR UPDATE ON erp.item_uom_conversions
 FOR EACH ROW EXECUTE FUNCTION erp.d4b1_validate_conversion();

-- Future transaction writers must snapshot user-entered UOM and inventory UOM.
-- This migration adds nullable, additive columns, backfills historical rows as identity
-- and DOES NOT rewrite the existing qty, stock balances, prices or GL.
DO $snap$
DECLARE rec record; sql text;
BEGIN
 FOR rec IN SELECT * FROM (VALUES
   ('sales_order_lines','qty'), ('purchase_order_lines','qty'),
   ('shipment_lines','qty'), ('stock_transfer_lines','qty'),
   ('stock_movements','qty'), ('picking_order_lines','requested_qty'),
   ('delivery_order_lines','qty'), ('sales_invoice_lines','qty'),
   ('supplier_invoice_lines','qty')) AS v(tab,qcol)
 LOOP
  IF to_regclass('erp.'||rec.tab) IS NULL THEN CONTINUE; END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='erp' AND table_name=rec.tab AND column_name=rec.qcol) THEN CONTINUE; END IF;
  sql := format('ALTER TABLE erp.%I ADD COLUMN IF NOT EXISTS transaction_qty numeric(24,6), ADD COLUMN IF NOT EXISTS transaction_uom varchar(20), ADD COLUMN IF NOT EXISTS inventory_qty numeric(24,6), ADD COLUMN IF NOT EXISTS inventory_uom varchar(20), ADD COLUMN IF NOT EXISTS uom_factor numeric(24,9)',rec.tab);
  EXECUTE sql;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='erp' AND table_name=rec.tab AND column_name='item_id') THEN
   sql:=format('UPDATE erp.%I l SET transaction_qty=COALESCE(l.transaction_qty,l.%I), inventory_qty=COALESCE(l.inventory_qty,l.%I),transaction_uom=COALESCE(l.transaction_uom,upper(trim(i.base_uom))),inventory_uom=COALESCE(l.inventory_uom,upper(trim(i.base_uom))),uom_factor=COALESCE(l.uom_factor,1) FROM erp.items i WHERE l.item_id=i.id AND (l.transaction_qty IS NULL OR l.inventory_qty IS NULL OR l.transaction_uom IS NULL OR l.inventory_uom IS NULL OR l.uom_factor IS NULL)',rec.tab,rec.qcol,rec.qcol);
   EXECUTE sql;
  END IF;
 END LOOP;
END $snap$;

ALTER TABLE erp.goods_receipt_lines
 ADD COLUMN IF NOT EXISTS transaction_uom varchar(20),
 ADD COLUMN IF NOT EXISTS inventory_uom varchar(20),
 ADD COLUMN IF NOT EXISTS uom_factor numeric(24,9),
 ADD COLUMN IF NOT EXISTS accepted_transaction_qty numeric(24,6),
 ADD COLUMN IF NOT EXISTS accepted_inventory_qty numeric(24,6),
 ADD COLUMN IF NOT EXISTS rejected_transaction_qty numeric(24,6),
 ADD COLUMN IF NOT EXISTS rejected_inventory_qty numeric(24,6);
UPDATE erp.goods_receipt_lines l SET
 transaction_uom=COALESCE(l.transaction_uom,upper(trim(i.base_uom))),
 inventory_uom=COALESCE(l.inventory_uom,upper(trim(i.base_uom))),
 uom_factor=COALESCE(l.uom_factor,1),
 accepted_transaction_qty=COALESCE(l.accepted_transaction_qty,l.accepted_qty),
 accepted_inventory_qty=COALESCE(l.accepted_inventory_qty,l.accepted_qty),
 rejected_transaction_qty=COALESCE(l.rejected_transaction_qty,l.rejected_qty),
 rejected_inventory_qty=COALESCE(l.rejected_inventory_qty,l.rejected_qty)
FROM erp.items i WHERE l.item_id=i.id AND
 (l.transaction_uom IS NULL OR l.inventory_uom IS NULL OR l.uom_factor IS NULL
 OR l.accepted_transaction_qty IS NULL OR l.accepted_inventory_qty IS NULL
 OR l.rejected_transaction_qty IS NULL OR l.rejected_inventory_qty IS NULL);

CREATE OR REPLACE FUNCTION erp.d4b1_convert_to_base(p_item uuid,p_uom varchar,p_qty numeric)
RETURNS numeric LANGUAGE plpgsql STABLE AS $convert$
DECLARE factor numeric;
BEGIN
 IF p_qty IS NULL OR p_qty<0 THEN RAISE EXCEPTION 'UOM qty must be nonnegative'; END IF;
 SELECT base_qty_per_uom INTO factor FROM erp.item_uom_conversions
 WHERE item_id=p_item AND uom_code=upper(trim(p_uom)) AND is_active;
 IF factor IS NULL THEN RAISE EXCEPTION 'Missing item UOM conversion for % / %',p_item,p_uom; END IF;
 IF round(p_qty*factor,6) <> p_qty*factor THEN RAISE EXCEPTION 'Inventory UOM precision exceeded (6 decimals)'; END IF;
 RETURN p_qty*factor;
END $convert$;

-- Master availability, including warning that historical base UOM is not PCS yet.
CREATE OR REPLACE VIEW erp.v_d4b1_item_uom_readiness AS
SELECT i.sku,i.name,i.base_uom AS inventory_base_uom,
 EXISTS(SELECT 1 FROM erp.inventory_balance b WHERE b.item_id=i.id) AS has_inventory_balance,
 EXISTS(SELECT 1 FROM erp.stock_movements m WHERE m.item_id=i.id) AS has_movement_history,
 (SELECT count(*) FROM erp.item_uom_conversions c WHERE c.item_id=i.id AND c.is_active) AS active_uom_count
FROM erp.items i;

-- Only grant to the existing ERP application user; ownership remains with migration user.
DO $grant$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_roles WHERE rolname='softech_erp') THEN
  GRANT SELECT ON erp.uom_units,erp.item_uom_conversions,erp.v_d4b1_item_uom_readiness TO softech_erp;
  GRANT SELECT ON erp.items TO softech_erp;
  GRANT EXECUTE ON FUNCTION erp.d4b1_convert_to_base(uuid,varchar,numeric) TO softech_erp;
 END IF;
END $grant$;
COMMIT;
