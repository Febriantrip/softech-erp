-- EXAMPLE ONLY. Edit the username/display_name/email before executing.
-- Do not store a password in this SQL file. Run SET_ACCOUNT_PASSWORD.cmd username
-- after creating the user to generate a BCrypt password hash securely.
BEGIN;
INSERT INTO erp.users(username,display_name,email,mfa_required,status)
VALUES ('operator01','Operator Example','operator01@example.local',false,'ACTIVE')
ON CONFLICT(username) DO NOTHING;
INSERT INTO erp.user_roles(user_id,role_id)
SELECT u.id,r.id FROM erp.users u JOIN erp.roles r ON r.code='WAREHOUSE_OPERATOR'
WHERE u.username='operator01' ON CONFLICT DO NOTHING;
INSERT INTO erp.user_entity_access(user_id,entity_id)
SELECT u.id,e.id FROM erp.users u JOIN erp.entities e ON e.code='NDU'
WHERE u.username='operator01' ON CONFLICT DO NOTHING;
INSERT INTO erp.user_site_access(user_id,site_id)
SELECT u.id,s.id FROM erp.users u JOIN erp.sites s ON s.code='JKT-HO'
WHERE u.username='operator01' ON CONFLICT DO NOTHING;
COMMIT;
