-- EXAMPLE ONLY. Edit the username/display_name/email before executing.
-- Do not store a plaintext password in this SQL file.
-- After creating the user, set the password with the local backend utility:
--   cd backend
--   <securely pipe a 12-72 character password> | go run ./cmd/set-password operator01
--
-- The utility hashes the password with BCrypt before saving it.

BEGIN;

INSERT INTO erp.users(username, display_name, email, mfa_required, status)
VALUES ('operator01', 'Operator Example', 'operator01@example.local', false, 'ACTIVE')
ON CONFLICT(username) DO NOTHING;

INSERT INTO erp.user_roles(user_id, role_id)
SELECT u.id, r.id
FROM erp.users u
JOIN erp.roles r ON r.code = 'WAREHOUSE_OPERATOR'
WHERE u.username = 'operator01'
ON CONFLICT DO NOTHING;

INSERT INTO erp.user_entity_access(user_id, entity_id)
SELECT u.id, e.id
FROM erp.users u
JOIN erp.entities e ON e.code = 'NDU'
WHERE u.username = 'operator01'
ON CONFLICT DO NOTHING;

INSERT INTO erp.user_site_access(user_id, site_id)
SELECT u.id, s.id
FROM erp.users u
JOIN erp.sites s ON s.code = 'JKT-HO'
WHERE u.username = 'operator01'
ON CONFLICT DO NOTHING;

COMMIT;
