-- SOFTECH ERP V12.2: real DB accounts + WebAuthn credentials.
-- Run once in pgAdmin connected to softech_erp as softech_erp owner.
BEGIN;
CREATE TABLE IF NOT EXISTS erp.user_passkeys (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
    credential_id bytea NOT NULL UNIQUE,
    credential jsonb NOT NULL,
    label varchar(100) NOT NULL DEFAULT 'Perangkat pribadi',
    created_at timestamptz NOT NULL DEFAULT now(),
    last_used_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_user_passkeys_user ON erp.user_passkeys(user_id);
CREATE TABLE IF NOT EXISTS erp.webauthn_ceremonies (
    id varchar(80) PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
    purpose varchar(20) NOT NULL CHECK (purpose IN ('register', 'login')),
    session_data jsonb NOT NULL,
    expires_at timestamptz NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_webauthn_ceremonies_expiry ON erp.webauthn_ceremonies(expires_at);
CREATE TABLE IF NOT EXISTS erp.auth_login_attempts (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    principal varchar(160) NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT now(),
    succeeded boolean NOT NULL DEFAULT false
);
CREATE INDEX IF NOT EXISTS idx_auth_login_attempts_lookup ON erp.auth_login_attempts(principal, occurred_at DESC);
-- Correct the known V12 Go integer / original SQL smallint document numbering mismatch.
CREATE OR REPLACE FUNCTION erp.next_document_number(
    p_entity_id uuid, p_site_id uuid, p_document_type text,
    p_fiscal_year integer, p_fiscal_month integer, p_prefix text, p_padding integer
) RETURNS text LANGUAGE sql AS $fn$
    SELECT erp.next_document_number(
      p_entity_id, p_site_id, p_document_type::varchar,
      p_fiscal_year::smallint, p_fiscal_month::smallint,
      p_prefix::varchar, p_padding::smallint);
$fn$;
COMMIT;
