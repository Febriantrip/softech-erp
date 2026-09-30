# PostgreSQL 18 Baseline

This ERP build targets PostgreSQL **18.x** as its database baseline.

## Docker development runtime

The Compose stack uses:

```yaml
image: postgres:18-alpine
environment:
  PGDATA: /var/lib/postgresql/18/docker
volumes:
  - nexa_postgres18_data:/var/lib/postgresql
```

PostgreSQL 18 changed the official Docker image data layout. The image-level volume is now `/var/lib/postgresql`, while the default PGDATA for major 18 is `/var/lib/postgresql/18/docker`.

The migration helper container also uses the PostgreSQL 18 client image so `psql` tooling matches the database major.

## Fresh installation

For a project that has never persisted ERP data in PostgreSQL 16/17, simply start the normal stack after applying this patch:

```bash
docker compose up -d --build
```

Verify the database major:

```bash
docker compose exec postgres psql -U nexa -d nexa_erp -c "SHOW server_version;"
```

The first migration is `backend/migrations/000_postgresql18_guard.sql`. It intentionally aborts initialization if the server is not PostgreSQL 18.x.

## Existing PostgreSQL 16/17 volume

A PostgreSQL major upgrade is not a Docker image swap. Do not mount the raw PostgreSQL 16/17 data directory into a PostgreSQL 18 server.

Use one of these supported approaches:

1. `pg_dump` / `pg_restore` into a fresh PostgreSQL 18 cluster; or
2. `pg_upgrade` with the old and new server binaries available.

If the old database contains no data that needs to be retained, remove the old development volume and let the PostgreSQL 18 stack create a fresh one.

## ERP SQL compatibility review

The existing V10-V12 schema remains valid on PostgreSQL 18. It intentionally keeps proven constructs rather than rewriting the database just to use new syntax:

- `numeric(20,2)` / `numeric(20,6)` for finance and inventory quantities
- JSONB for audit/outbox/settings payloads
- `UNIQUE NULLS NOT DISTINCT` for document sequences
- `SELECT ... FOR UPDATE` for transactional row locking
- transaction-scoped advisory locks for idempotent commands
- PL/pgSQL posting/guard functions
- `pgcrypto` / `gen_random_uuid()` for existing UUID defaults

PostgreSQL 18 also provides built-in `uuidv7()`. This patch does **not** mass-convert existing primary-key defaults because changing identifier generation is not required for PostgreSQL 18 compatibility and would create unnecessary migration risk. New high-volume tables can adopt UUIDv7 later through a dedicated, reviewed migration.

## Development vs production image pinning

Development uses the major tag:

```text
postgres:18-alpine
```

This keeps development on current PostgreSQL 18 minor fixes when images are refreshed.

For production, pin the exact tested minor image (or immutable image digest) and upgrade minor releases through the deployment pipeline after backup/restore verification.
