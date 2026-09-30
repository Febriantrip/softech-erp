BEGIN;
-- D4-B: existing GRN tables are reused. Only action permissions are additive.
INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('goods_receipt.view','procurement','view','View Goods Receipts'),
 ('goods_receipt.put_away','warehouse','put_away','Post Goods Receipt Put Away')
ON CONFLICT(code) DO NOTHING;
INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code IN ('goods_receipt.view','goods_receipt.put_away')
ON CONFLICT DO NOTHING;
-- Existing GRN/inventory table grants are preserved; no ownership-dependent GRANT is attempted.
COMMIT;
