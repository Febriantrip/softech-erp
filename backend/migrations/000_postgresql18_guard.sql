-- NEXA ERP V12 PostgreSQL 18 baseline guard.
-- This file sorts before all other migrations and prevents an accidental
-- initialization against PostgreSQL 16/17 or a future unvalidated major.
DO $$
DECLARE
  v_version_num integer := current_setting('server_version_num')::integer;
  v_version text := current_setting('server_version');
BEGIN
  IF v_version_num < 180000 OR v_version_num >= 190000 THEN
    RAISE EXCEPTION
      'NEXA ERP V12 requires PostgreSQL 18.x; detected PostgreSQL % (server_version_num=%)',
      v_version,
      v_version_num;
  END IF;
END;
$$;
