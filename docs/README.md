# SOFTECH ERP Documentation

This directory contains architecture notes, module scope, version milestones, database references, and implementation documentation for SOFTECH ERP.

## Core documentation

- [Architecture](architecture.md)
- [Module Scope](module-scope.md)
- [PostgreSQL 18 Baseline](POSTGRESQL_18_BASELINE.md)
- [Aurora UI System](AURORA_UI.md)

## Evolution milestones

- [V3 — Core Engine](V3_CORE_ENGINE.md)
- [V4 — Finance Engine](V4_FINANCE_ENGINE.md)
- [V5 — Procure-to-Pay Engine](V5_PROCURE_TO_PAY_ENGINE.md)
- [V6 — Inventory Control Engine](V6_INVENTORY_CONTROL_ENGINE.md)
- [V7 — Enterprise / Intercompany / Consolidation](V7_ENTERPRISE_INTERCOMPANY_CONSOLIDATION.md)
- [V8 — Enterprise Governance Control](V8_ENTERPRISE_GOVERNANCE_CONTROL.md)
- [V9 — Advanced Distribution & Reverse Logistics](V9_ADVANCED_DISTRIBUTION_REVERSE_LOGISTICS.md)
- [V10 — Production Foundation](V10_PRODUCTION_FOUNDATION.md)
- [V11 — Core Transaction Migration](V11_CORE_TRANSACTION_MIGRATION.md)
- [V12 — Financial Engine](V12_FINANCIAL_ENGINE.md)

## Legacy database references

The `database-*-mysql.sql` files are historical design references from earlier iterations. The current runtime baseline is **PostgreSQL 18**, and active database changes are maintained under:

~~~text
backend/migrations/
~~~

For current setup and migration behavior, use the PostgreSQL migration files and the Docker Compose stack rather than the legacy MySQL reference scripts.
