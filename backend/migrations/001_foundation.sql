BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS erp;

CREATE TABLE IF NOT EXISTS erp.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(20) NOT NULL UNIQUE,
  legal_name varchar(180) NOT NULL,
  base_currency char(3) NOT NULL DEFAULT 'IDR',
  tax_id varchar(80),
  timezone varchar(64) NOT NULL DEFAULT 'Asia/Jakarta',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.sites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  code varchar(30) NOT NULL,
  name varchar(160) NOT NULL,
  site_type varchar(30) NOT NULL DEFAULT 'BRANCH',
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);
CREATE INDEX IF NOT EXISTS idx_sites_entity ON erp.sites(entity_id);

CREATE TABLE IF NOT EXISTS erp.warehouses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid NOT NULL REFERENCES erp.sites(id),
  code varchar(30) NOT NULL,
  name varchar(160) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, code)
);
CREATE INDEX IF NOT EXISTS idx_warehouses_scope ON erp.warehouses(entity_id, site_id);

CREATE TABLE IF NOT EXISTS erp.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username varchar(80) NOT NULL UNIQUE,
  display_name varchar(160) NOT NULL,
  email varchar(180),
  password_hash text,
  status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','LOCKED','INACTIVE')),
  mfa_required boolean NOT NULL DEFAULT false,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(60) NOT NULL UNIQUE,
  name varchar(120) NOT NULL,
  is_privileged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(120) NOT NULL UNIQUE,
  module varchar(80) NOT NULL,
  action varchar(40) NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS erp.user_roles (
  user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES erp.roles(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, role_id)
);

CREATE TABLE IF NOT EXISTS erp.role_permissions (
  role_id uuid NOT NULL REFERENCES erp.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES erp.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS erp.user_entity_access (
  user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES erp.entities(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, entity_id)
);

CREATE TABLE IF NOT EXISTS erp.user_site_access (
  user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
  site_id uuid NOT NULL REFERENCES erp.sites(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, site_id)
);

CREATE TABLE IF NOT EXISTS erp.user_warehouse_access (
  user_id uuid NOT NULL REFERENCES erp.users(id) ON DELETE CASCADE,
  warehouse_id uuid NOT NULL REFERENCES erp.warehouses(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id, warehouse_id)
);

CREATE TABLE IF NOT EXISTS erp.document_sequences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  document_type varchar(40) NOT NULL,
  fiscal_year smallint NOT NULL,
  fiscal_month smallint NOT NULL CHECK (fiscal_month BETWEEN 1 AND 12),
  prefix varchar(80) NOT NULL,
  last_number bigint NOT NULL DEFAULT 0,
  padding smallint NOT NULL DEFAULT 6 CHECK (padding BETWEEN 1 AND 12),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_document_sequences UNIQUE NULLS NOT DISTINCT (entity_id, site_id, document_type, fiscal_year, fiscal_month)
);

CREATE OR REPLACE FUNCTION erp.next_document_number(
  p_entity_id uuid,
  p_site_id uuid,
  p_document_type varchar,
  p_fiscal_year smallint,
  p_fiscal_month smallint,
  p_prefix varchar,
  p_padding smallint DEFAULT 6
) RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_number bigint;
BEGIN
  INSERT INTO erp.document_sequences(entity_id, site_id, document_type, fiscal_year, fiscal_month, prefix, last_number, padding)
  VALUES (p_entity_id, p_site_id, p_document_type, p_fiscal_year, p_fiscal_month, p_prefix, 1, p_padding)
  ON CONFLICT (entity_id, site_id, document_type, fiscal_year, fiscal_month)
  DO UPDATE SET last_number = erp.document_sequences.last_number + 1, updated_at = now()
  RETURNING last_number INTO v_number;

  RETURN p_prefix || lpad(v_number::text, p_padding, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS erp.idempotency_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key varchar(160) NOT NULL,
  user_id uuid REFERENCES erp.users(id),
  entity_id uuid REFERENCES erp.entities(id),
  operation varchar(120) NOT NULL,
  request_hash char(64),
  response_status integer,
  response_body jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  UNIQUE(idempotency_key, operation)
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON erp.idempotency_keys(expires_at);

CREATE TABLE IF NOT EXISTS erp.audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  request_id varchar(80),
  user_id uuid REFERENCES erp.users(id),
  entity_id uuid REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  module varchar(80) NOT NULL,
  action varchar(80) NOT NULL,
  resource_type varchar(80),
  resource_id varchar(120),
  ip_address inet,
  user_agent text,
  before_data jsonb,
  after_data jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_audit_scope_time ON erp.audit_events(entity_id, site_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON erp.audit_events(resource_type, resource_id, occurred_at DESC);

CREATE OR REPLACE FUNCTION erp.prevent_audit_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_immutable ON erp.audit_events;
CREATE TRIGGER trg_audit_immutable
BEFORE UPDATE OR DELETE ON erp.audit_events
FOR EACH ROW EXECUTE FUNCTION erp.prevent_audit_mutation();

CREATE TABLE IF NOT EXISTS erp.outbox_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type varchar(80) NOT NULL,
  aggregate_id varchar(120) NOT NULL,
  event_type varchar(120) NOT NULL,
  payload jsonb NOT NULL,
  entity_id uuid REFERENCES erp.entities(id),
  site_id uuid REFERENCES erp.sites(id),
  occurred_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  retry_count integer NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX IF NOT EXISTS idx_outbox_unpublished ON erp.outbox_events(occurred_at) WHERE published_at IS NULL;

CREATE TABLE IF NOT EXISTS erp.system_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid REFERENCES erp.entities(id),
  setting_key varchar(160) NOT NULL,
  value jsonb NOT NULL,
  is_secret boolean NOT NULL DEFAULT false,
  updated_by uuid REFERENCES erp.users(id),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(entity_id, setting_key)
);

-- Future repository code will SET LOCAL app.user_id/app.entity_id/app.site_id per DB transaction.
-- RLS is intentionally not enabled in V10 until transactional repositories arrive in V11,
-- preventing accidental lock-out while preserving a clear path to database-level defense-in-depth.

COMMIT;
