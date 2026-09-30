# SOFTECH ERP

<p align="center">
  <strong>Full-stack distributor ERP for sales, procurement, inventory, warehouse operations, finance, and multi-entity workflows.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=111" alt="React 18">
  <img src="https://img.shields.io/badge/Vite-5-646CFF?logo=vite&logoColor=fff" alt="Vite 5">
  <img src="https://img.shields.io/badge/Go-Backend-00ADD8?logo=go&logoColor=fff" alt="Go">
  <img src="https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=fff" alt="PostgreSQL 18">
  <img src="https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=fff" alt="Redis 7">
  <img src="https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker&logoColor=fff" alt="Docker Compose">
</p>

---

## Overview

**SOFTECH ERP** is a modular distributor ERP built to connect operational and financial workflows in one system. The project combines a React frontend with a Go modular-monolith backend, PostgreSQL as the system of record, Redis for supporting infrastructure, and REST APIs between the application layers.

The current public snapshot includes the V12 financial engine and production-backed transaction flows for sales, procurement, inventory, warehouse operations, receivables, payables, cash/bank, and accounting periods.

## Key capabilities

- Sales Order lifecycle, reservation, picking, delivery, shipment, and invoicing
- Purchase Order, receiving, goods receipt, and put-away
- Inventory movement, stock transfer, replenishment, and stock take
- Accounts Receivable and customer receipts
- Accounts Payable and supplier payments
- General Ledger, Trial Balance, and manual journals
- Accounting period closing and reopening controls
- Cash and bank balance control
- Multi-entity and multi-site operational context
- Role and permission-aware API flows
- Audit-oriented document and transaction handling
- Passkey and face-authentication pilot flows
- PostgreSQL migrations with Docker-based development setup

## Business domains

| Domain | Scope |
| --- | --- |
| **Sales** | Orders, reservation, picking, delivery, shipment, invoice |
| **Procurement** | Purchase requests, RFQ, purchase orders, receiving |
| **Inventory** | Stock movement, transfer, valuation, stock take |
| **Warehouse** | Receiving, put-away, fulfillment, replenishment |
| **Finance** | GL, AR, AP, receipts, payments, cash/bank |
| **Governance** | Accounting periods, approvals, audit-oriented controls |
| **Enterprise** | Multi-entity, site context, intercompany/consolidation foundations |
| **Security** | Database-backed accounts, permissions, passkeys, face pilot |

## Architecture

~~~mermaid
flowchart LR
    U[User / Browser] --> FE[React + Vite]
    FE -->|REST JSON| API[Go API]
    API --> PG[(PostgreSQL 18)]
    API --> R[(Redis 7)]

    API --> SALES[Sales]
    API --> PROC[Procurement]
    API --> INV[Inventory / Warehouse]
    API --> FIN[Finance]
    API --> GOV[Governance]
    API --> SEC[Security]
~~~

The backend follows a **modular monolith** approach: business domains remain separated in code while sharing one deployable backend and one transactional database boundary.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React 18, Vite, React Router, Lucide |
| Backend | Go |
| API | REST / JSON |
| Database | PostgreSQL 18 |
| Supporting infrastructure | Redis 7 |
| Containerization | Docker, Docker Compose |
| Web server | Nginx |
| Styling | Modular CSS / Aurora UI system |

## Repository structure

~~~text
softech-erp/
├── src/                         # React frontend
│   ├── api/
│   ├── auth/
│   ├── components/
│   ├── context/
│   ├── hooks/
│   ├── layout/
│   └── pages/
├── backend/
│   ├── cmd/                     # API + local utilities
│   ├── internal/
│   │   ├── config/
│   │   ├── domain/              # Business-domain boundaries
│   │   ├── httpapi/
│   │   ├── platform/
│   │   └── security/
│   ├── migrations/
│   └── audits/
├── deploy/nginx/
├── docs/
├── docker-compose.yml
└── Dockerfile.frontend
~~~

## Quick start

### Docker Compose

Create your local environment file:

~~~powershell
Copy-Item .env.example .env
~~~

Set at minimum:

~~~env
POSTGRES_PASSWORD=your-local-password
JWT_SECRET=use-a-random-secret-at-least-32-characters
~~~

Then start the stack:

~~~bash
docker compose up -d --build
~~~

Default development endpoints:

- Frontend: http://localhost:8088
- API: http://localhost:8080/api/v1
- Liveness: http://localhost:8080/api/v1/health/live
- Readiness: http://localhost:8080/api/v1/health/ready

> Do not commit a real .env file, database password, JWT secret, biometric key, or other local credentials.

### Frontend-only development

~~~bash
npm install
npm run dev
~~~

API mode:

~~~bash
npm run dev:api
~~~

Production frontend build:

~~~bash
npm run build
~~~

## PostgreSQL 18 baseline

This repository targets **PostgreSQL 18.x**. The Docker configuration uses postgres:18-alpine and the PostgreSQL 18 data layout.

Do not directly attach a PostgreSQL 16/17 binary data directory to PostgreSQL 18. Use a supported major-version upgrade path such as pg_upgrade or logical dump/restore.

See [docs/POSTGRESQL_18_BASELINE.md](docs/POSTGRESQL_18_BASELINE.md).

## Transaction and data integrity

The backend uses PostgreSQL transactions for critical commands. Current transaction flows include idempotency controls and locking/version checks where concurrent mutation matters. Financial posting and operational transaction rules are implemented in the Go domain layer and PostgreSQL migrations.

Browse the organized documentation index at [docs/README.md](docs/README.md), including architecture, module scope, PostgreSQL baseline, Aurora UI notes, and version milestones.

## Development status

This repository is a **public portfolio snapshot** of an actively developed ERP project. Some modules represent later-stage foundations while the core transaction and financial flows are progressively moved to production-backed APIs.

Current baseline: **V12 Financial Engine**.

## Author

**Febrian Tri Prasmanto**  
Full-Stack Programmer · ERP Implementator · System Builder

- GitHub: [@Febriantrip](https://github.com/Febriantrip)
- LinkedIn: [linkedin.com/in/febriantrip](https://www.linkedin.com/in/febriantrip)

---

<p align="center">
  Built around real business workflows, not just screens.
</p>
