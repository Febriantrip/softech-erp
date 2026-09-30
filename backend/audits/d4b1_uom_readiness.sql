\pset pager off
\echo === D4-B.1 UOM READINESS (READ ONLY) ===
SELECT sku,name,inventory_base_uom,has_inventory_balance,has_movement_history,active_uom_count
FROM erp.v_d4b1_item_uom_readiness ORDER BY sku;
\echo === Item-specific conversion catalog ===
SELECT i.sku,c.uom_code,c.base_qty_per_uom,i.base_uom AS inventory_base_uom,c.is_active
FROM erp.item_uom_conversions c JOIN erp.items i ON i.id=c.item_id
ORDER BY i.sku,c.uom_code;
\echo === Example: SKU-10018 is NOT assumed to be 120 PCS / CTN unless explicitly mapped ===
SELECT i.sku,i.base_uom,c.uom_code,c.base_qty_per_uom
FROM erp.items i JOIN erp.item_uom_conversions c ON c.item_id=i.id
WHERE i.sku='SKU-10018' ORDER BY c.uom_code;
