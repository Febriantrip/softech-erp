# V11 Core Transaction Migration

V11 is the first production transaction slice of NEXA Distributor ERP. It keeps the approved React/Aurora user interface and V9 prototype engine available, while adding a real PostgreSQL-backed path for Sales, Purchase, Warehouse, and Inventory when `VITE_DATA_MODE=api`.

## Data mode

### Prototype mode

```bash
npm run dev
```

Uses the existing V9/V10 browser transaction engine and localStorage. This mode remains available so development is not blocked when Docker/PostgreSQL are unavailable.

### API mode

```bash
npm run dev:api
```

Requires the Go API and PostgreSQL stack. The production core routes switch to API workspaces:

- Sales Order
- Purchase Order + Goods Receipt
- Warehouse / Inventory + Stock Transfer

The Docker frontend uses API mode automatically.

## Backend routes

### Master/bootstrap

- `GET /api/v1/core/bootstrap`
- `GET /api/v1/core/inventory`
- `GET /api/v1/core/stock-movements`

### Sales

- `GET /api/v1/core/sales-orders`
- `POST /api/v1/core/sales-orders`
- `POST /api/v1/core/sales-orders/{id}/submit`
- `POST /api/v1/core/sales-orders/{id}/approve`
- `POST /api/v1/core/sales-orders/{id}/reserve`
- `POST /api/v1/core/sales-orders/{id}/dispatch`

Sales reservation uses `SELECT ... FOR UPDATE` on inventory balance rows. Dispatch validates both physical on-hand and reserved quantity, updates row version, writes stock movement, creates the Shipment record, and writes an outbox event for the later financial engine.

### Procurement

- `GET /api/v1/core/purchase-orders`
- `POST /api/v1/core/purchase-orders`
- `POST /api/v1/core/purchase-orders/{id}/submit`
- `POST /api/v1/core/purchase-orders/{id}/approve`
- `POST /api/v1/core/purchase-orders/{id}/receive`
- `GET /api/v1/core/goods-receipts`
- `POST /api/v1/core/goods-receipts/{id}/put-away`

Goods Receipt posts accepted quantity to `inbound_qty`. Put Away moves inbound quantity to physical on-hand and recalculates the warehouse/item moving weighted-average cost atomically.

### Warehouse

- `GET /api/v1/core/stock-transfers`
- `POST /api/v1/core/stock-transfers`
- `POST /api/v1/core/stock-transfers/{id}/release`
- `POST /api/v1/core/stock-transfers/{id}/receive`

Transfer release validates `Available = On Hand - Reserved`, row-locks source inventory, persists source carrying cost, and posts `TRANSFER_OUT`. Destination receipt posts `TRANSFER_IN` and recalculates destination average cost.

## Transaction guarantees

V11 core commands use:

- PostgreSQL transaction boundaries
- row-level locking for stock-critical commands
- optimistic `row_version` guard for physical inventory changes
- atomic PostgreSQL document sequences
- `Idempotency-Key` command protection
- entity and site validation from authenticated request context
- append-only audit event writes
- transactional outbox writes
- server-owned state transitions

The browser cannot directly edit inventory balance or document state in API mode.

## Accounting boundary

V11 intentionally does **not** post the final GL/AR/AP entries from the new Go core. Shipment dispatch emits the transactional inventory record plus a `shipment.dispatched` outbox event. The full PostgreSQL financial posting engine is V12, preventing accounting logic from being duplicated in temporary places during migration.

## Existing V10 database volumes

V11 adds a Compose `migrate` service. Every stack start executes the idempotent SQL files in `backend/migrations` in sequence. This matters because PostgreSQL's `/docker-entrypoint-initdb.d` scripts only execute when a volume is first created.

Therefore an existing V10 volume can receive `003_core_transactions.sql` without deleting the database volume.

## Production warning

The automatic bootstrap login used by the V11 frontend API migration bridge is for local/development validation. Do not bake bootstrap credentials into a public production frontend. Persistent user authentication and server-side governance enforcement should replace this bridge before public deployment.
