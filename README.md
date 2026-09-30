# Distributor ERP React · V12 Financial Engine

V12 continues the approved ERP/Aurora frontend and the V11 Go/PostgreSQL transaction core. API mode now includes production-backed GL, AR, AP, cash/bank, invoices, payments and entity-scoped accounting periods.

## Modes

Prototype/localStorage remains available:

```bash
npm run dev
```

API mode:

```bash
npm run dev:api
```

When Docker Desktop is available, run:

```text
START_V12_STACK.bat
```

or:

```bash
docker compose up -d --build
```


## PostgreSQL baseline

This build targets **PostgreSQL 18.x**. Docker development uses `postgres:18-alpine` with the PostgreSQL 18 data layout (`PGDATA=/var/lib/postgresql/18/docker`, persistent volume mounted at `/var/lib/postgresql`).

If you have an existing PostgreSQL 16/17 data volume, do **not** attach that binary data directory directly to PostgreSQL 18. Use a proper major-version upgrade (`pg_upgrade`) or logical dump/restore. For a fresh development environment with no data to preserve, use a fresh PostgreSQL 18 volume.

See `docs/POSTGRESQL_18_BASELINE.md`.

## API-mode scope through V12

- Sales Order / reservation / shipment
- Purchase Order / receiving / put-away
- Inventory / movement / stock transfer
- Shipment COGS
- General Ledger / Trial Balance
- Sales Invoice / AR / Customer Receipt
- Purchase Invoice / AP / Supplier Payment
- Cash/Bank balance
- Accounting Period Closing/Reopen

## Approved UI preservation

V12 does not rewrite the established style system. Existing `styles.css`, `enterprise.css`, `governance.css`, `v9-distribution.css`, `v10-production.css`, and `v11-core-transactions.css` remain intact. V12 only adds `v12-financial-engine.css` for isolated API-finance helpers.

See `docs/V12_FINANCIAL_ENGINE.md` for posting rules and API details.
