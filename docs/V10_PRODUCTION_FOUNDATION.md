# V10 Production Foundation

V10 is the transition boundary from the browser/localStorage prototype into the agreed production architecture:

- Frontend: React + Vite with incremental TypeScript
- Backend: Go
- Database: PostgreSQL 18.x
- Cache / Queue / distributed coordination: Redis
- API: REST JSON under `/api/v1`
- Initial architecture: modular monolith
- Long-term: extract services only when real scaling or organizational boundaries justify it

## Why V10 does not rewrite V9 transactions yet

V9 contains working business flows and approved UI behavior. Replacing every localStorage mutation in one large change would create unnecessary regression risk. V10 therefore establishes production infrastructure first, while keeping the V9 transaction engine as the default adapter.

The migration sequence is intentionally incremental:

1. V10: platform, API, auth boundary, database foundation, Redis, Docker, typed frontend client
2. V11: Sales / Purchase / Warehouse / Inventory repositories and transactional commands
3. V12: GL / AR / AP / posting / closing
4. V13: Intercompany / consolidation / governance backend
5. V14: reporting and BI
6. V15: add-on ecosystem

## Frontend boundary

V10 adds:

- `src/config/runtime.ts`
- `src/api/http.ts`
- `src/api/platform.ts`
- `src/api/erpApi.ts`
- `src/types/platform.ts`
- `src/hooks/usePlatformHealth.ts`
- `src/pages/ProductionFoundationPage.jsx`

Runtime variables:

```env
VITE_API_BASE_URL=http://localhost:8080/api/v1
VITE_DATA_MODE=prototype
```

`prototype` remains the default until V11. Changing it to `api` is reserved for migrated modules. V10 does not fake a completed migration.

## Go API foundation

Executable endpoints:

- `GET /api/v1/health/live`
- `GET /api/v1/health/ready`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`
- `GET /api/v1/context`
- `GET /api/v1/meta/platform`

Foundation middleware:

- request ID
- JSON structured logging
- CORS allow-list
- security headers
- panic recovery
- graceful shutdown
- bearer-token authentication
- entity/site context validation

The token implementation uses signed HS256 tokens using only the Go standard library so the V10 backend can compile without network dependency downloads in this build environment.

## Authentication boundary

V10 uses environment-based bootstrap credentials only to exercise the new API/auth boundary before the persistent user repository exists.

Do not treat bootstrap auth as the final identity store. V11 will move users, roles, permissions, sessions and password verification into PostgreSQL repositories.

## PostgreSQL foundation schema

`backend/migrations/001_foundation.sql` creates:

- entities
- sites
- warehouses
- users
- roles
- permissions
- role permissions
- user entity/site/warehouse access
- server-side document sequences
- idempotency keys
- append-only audit events
- transactional outbox events
- system settings

`erp.next_document_number(...)` gives the future posting engine an atomic server-side document sequence rather than browser-generated numbering.

RLS is intentionally not enabled yet. Repository code must first establish a reliable `SET LOCAL app.user_id/entity_id/site_id` transaction context. V13 can then enable RLS as defense-in-depth without locking the application out accidentally.

## Redis boundary

Redis is part of the V10 runtime but is not the source of truth. PostgreSQL remains authoritative.

Planned Redis uses:

- cache
- background job coordination
- notification fan-out
- rate limiting
- distributed locks for selected workflows

Financial and inventory correctness must never rely only on Redis. PostgreSQL transactions / row locks remain authoritative.

## Docker development runtime

```text
frontend :8088
api      :8080
postgres :5432  (PostgreSQL 18.x)
redis    :6379
```

Start:

```bash
docker compose up -d --build
```

Open:

```text
http://localhost:8088
```

Vite-only development remains possible with `npm run dev`. In that mode, start the API separately if you want Platform Health to show online.

## Production safety notes

Before public production deployment:

- replace every default secret/password
- terminate TLS at Nginx/load balancer
- migrate bootstrap auth to PostgreSQL
- hash passwords using a production password hashing algorithm
- implement refresh/revocation/session storage
- implement repository-level entity/site authorization
- introduce PostgreSQL transaction boundaries and row locking for all postings
- persist idempotency results
- implement outbox worker
- add metrics/tracing/error reporting
- establish backup/PITR and restore drills
