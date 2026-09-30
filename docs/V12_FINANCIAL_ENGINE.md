# V12 Financial Engine

V12 moves the accounting core from the browser prototype into the Go/PostgreSQL production path while keeping the approved ERP visual system unchanged.

## API-mode financial flows

### Order to cash

`Sales Order → Reserve → Dispatch → COGS GL → Sales Invoice → AR → Customer Receipt → Bank/Cash + GL`

Shipment dispatch now posts COGS in the same PostgreSQL transaction as the physical stock issue:

- Dr `510100 Cost of Goods Sold`
- Cr `120100 Merchandise Inventory`

Sales Invoice posting is atomic:

- Dr `110100 Accounts Receivable`
- Cr `410100 Sales Revenue`
- Cr `218100 VAT Output`

Customer receipt is atomic with the AR allocation and bank balance row lock:

- Dr Bank/Cash account
- Cr `110100 Accounts Receivable`

### Procure to pay

`Purchase Order → Goods Receipt → Put Away → Purchase Invoice → AP → Supplier Payment → Bank/Cash + GL`

Purchase Invoice is created only from a Put-Away Goods Receipt and is marked `MATCHED` by the current strict quantity/price source relationship. Posting creates:

- Dr `120100 Merchandise Inventory`
- Dr `118100 VAT Input`
- Cr `210100 Accounts Payable`

Supplier payment locks both AP and bank rows before posting:

- Dr `210100 Accounts Payable`
- Cr Bank/Cash account

## General ledger controls

V12 introduces PostgreSQL tables for:

- accounting periods per legal entity
- chart of accounts per legal entity
- bank/cash accounts
- journal entries and journal lines
- sales invoices and lines
- AR open items
- customer receipts and allocations
- purchase invoices and lines
- AP open items
- supplier payments and allocations

Posted journal headers and lines are immutable by database trigger. A later correction workflow must use reversal documents rather than editing posted ledger data.

Manual journal posting is available, but control accounts such as AR, AP, Inventory, VAT, Revenue and COGS are configured as non-manual accounts so operational modules remain the owner of those balances.

## Accounting-period gate

Every financial posting calls `erp.assert_open_period(entity_id, posting_date)`. A closed period rejects:

- shipment COGS
- sales invoice posting
- customer receipt
- purchase invoice posting
- supplier payment
- manual journal

Period close verifies that the entity-period has no:

- draft sales/purchase invoices
- inter-site transfers still in transit
- goods receipts waiting for put-away
- imbalanced posted journals

The period is entity-scoped, so closing NDU does not close NDT.

## API endpoints

Reads:

- `GET /api/v1/finance/bootstrap`
- `GET /api/v1/finance/journals`
- `GET /api/v1/finance/trial-balance`
- `GET /api/v1/finance/sales-invoices`
- `GET /api/v1/finance/ar`
- `GET /api/v1/finance/customer-receipts`
- `GET /api/v1/finance/purchase-invoices`
- `GET /api/v1/finance/ap`
- `GET /api/v1/finance/supplier-payments`

Commands:

- `POST /api/v1/finance/sales-invoices`
- `POST /api/v1/finance/sales-invoices/{id}/post`
- `POST /api/v1/finance/customer-receipts`
- `POST /api/v1/finance/purchase-invoices`
- `POST /api/v1/finance/purchase-invoices/{id}/post`
- `POST /api/v1/finance/supplier-payments`
- `POST /api/v1/finance/journals`
- `POST /api/v1/finance/periods/{id}/close`
- `POST /api/v1/finance/periods/{id}/reopen`

Every command requires authentication, entity/site context and `Idempotency-Key`.

## Frontend data mode

Prototype remains available:

```bash
npm run dev
```

API mode uses the PostgreSQL-backed financial workspaces:

```bash
npm run dev:api
```

The Docker frontend uses API mode automatically.

## Cutover note

V12 is a production-architecture migration stage. If a development PostgreSQL volume already contains V11 API transactions, perform a controlled opening-balance/cutover reconciliation before treating the V12 ledger as an accounting system of record. For clean evaluation, a fresh development database gives the clearest end-to-end validation.
