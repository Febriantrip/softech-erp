# NEXA ERP Go Backend · V12 Financial Engine

The backend is a Go modular monolith with PostgreSQL as source of truth and Redis as supporting coordination infrastructure.

## Production-backed domains

V11:
- Sales Order
- Purchase Order
- Goods Receipt / Put Away
- Warehouse Inventory
- Stock Movement
- Stock Transfer

V12 adds:
- Accounting Period
- Chart of Accounts
- General Ledger
- Shipment COGS posting
- Sales Invoice
- Accounts Receivable
- Customer Receipt
- Purchase Invoice
- Accounts Payable
- Supplier Payment
- Bank/Cash balance control
- Trial Balance
- Manual Journal with control-account restrictions

## Guarantees

Critical commands run inside PostgreSQL transactions and use idempotency keys. Inventory, AR, AP and bank/cash mutation paths use row locking/version checks where concurrent mutation matters. Posted journal data is protected by database immutability triggers.

## Migrations

`001_foundation.sql` → `002_seed_demo.sql` → `003_core_transactions.sql` → `004_financial_engine.sql`

The Docker Compose migrate service applies all SQL migrations in order on stack startup.
