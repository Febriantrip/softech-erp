BEGIN;

INSERT INTO erp.entities(code, legal_name, base_currency, timezone)
VALUES
  ('NDU', 'PT Nusantara Distribusi Utama', 'IDR', 'Asia/Jakarta'),
  ('NDT', 'PT Nusantara Distribusi Timur', 'IDR', 'Asia/Jakarta')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.sites(entity_id, code, name, site_type)
SELECT e.id, v.code, v.name, v.site_type
FROM erp.entities e
JOIN (VALUES
  ('NDU','JKT-HO','Jakarta Head Office','HEAD_OFFICE'),
  ('NDU','CKR-DC','Cikarang Distribution Center','DISTRIBUTION_CENTER'),
  ('NDU','TGR-WH','Tangerang Warehouse','WAREHOUSE'),
  ('NDT','SBY-BR','Surabaya Branch','BRANCH'),
  ('NDT','GRS-WH','Gresik Warehouse','WAREHOUSE')
) AS v(entity_code,code,name,site_type) ON e.code=v.entity_code
ON CONFLICT (entity_id, code) DO NOTHING;

INSERT INTO erp.warehouses(entity_id, site_id, code, name)
SELECT e.id, s.id, v.warehouse_code, v.warehouse_name
FROM erp.entities e
JOIN erp.sites s ON s.entity_id=e.id
JOIN (VALUES
  ('NDU','JKT-HO','WH-JKT','Jakarta Distribution Center'),
  ('NDU','CKR-DC','WH-CKR','Cikarang Distribution Center'),
  ('NDU','TGR-WH','WH-TGR','Tangerang Warehouse'),
  ('NDT','SBY-BR','WH-SBY','Surabaya Distribution Center'),
  ('NDT','GRS-WH','WH-GRS','Gresik Warehouse')
) AS v(entity_code,site_code,warehouse_code,warehouse_name)
ON e.code=v.entity_code AND s.code=v.site_code
ON CONFLICT (entity_id, code) DO NOTHING;

INSERT INTO erp.roles(code, name, is_privileged)
VALUES ('GROUP_ADMIN','Group Administrator',true), ('FINANCE_MANAGER','Finance Manager',true), ('WAREHOUSE_OPERATOR','Warehouse Operator',false)
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.permissions(code,module,action,description)
VALUES
 ('platform.read','platform','read','Read production platform health and metadata'),
 ('entity.switch','enterprise','switch','Switch authorized entity/site context'),
 ('audit.read','governance','read','Read append-only audit events'),
 ('document.sequence','governance','execute','Request server-side document number')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.users(username, display_name, email, mfa_required)
VALUES ('admin','ERP Administrator','admin@example.local',true)
ON CONFLICT (username) DO NOTHING;

INSERT INTO erp.user_roles(user_id, role_id)
SELECT u.id, r.id FROM erp.users u CROSS JOIN erp.roles r WHERE u.username='admin' AND r.code='GROUP_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO erp.role_permissions(role_id, permission_id)
SELECT r.id, p.id FROM erp.roles r CROSS JOIN erp.permissions p WHERE r.code='GROUP_ADMIN'
ON CONFLICT DO NOTHING;

INSERT INTO erp.user_entity_access(user_id, entity_id)
SELECT u.id, e.id FROM erp.users u CROSS JOIN erp.entities e WHERE u.username='admin'
ON CONFLICT DO NOTHING;

INSERT INTO erp.user_site_access(user_id, site_id)
SELECT u.id, s.id FROM erp.users u CROSS JOIN erp.sites s WHERE u.username='admin'
ON CONFLICT DO NOTHING;

INSERT INTO erp.user_warehouse_access(user_id, warehouse_id)
SELECT u.id, w.id FROM erp.users u CROSS JOIN erp.warehouses w WHERE u.username='admin'
ON CONFLICT DO NOTHING;

COMMIT;
