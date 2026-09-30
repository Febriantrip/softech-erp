# V4 Finance Integration Engine

V4 extends the V3 fulfillment engine with the financial half of order-to-cash.

## Executable demo flow

1. Sales Order is fulfilled and shipped/delivered.
2. Sales Invoice is generated from **actual shipped quantity**.
3. Posting the invoice checks the Accounting Period.
4. If the period is Open, posting creates:
   - AR open item
   - General journal: Dr Accounts Receivable, Cr Sales Revenue, Cr VAT Output
   - customer credit exposure update
5. Cash/Bank Receipt allocates to a specific open invoice.
6. Receipt posting creates:
   - reduction of AR outstanding
   - invoice status Partially Paid / Paid
   - General journal: Dr Bank/Cash, Cr Accounts Receivable
   - bank/cash balance update
   - customer credit exposure release
7. Closing Period can lock an accounting period. Financial posting is rejected when a transaction date belongs to a Closed period.

## V4 demo pages

- `Transactions > Financials > Sales Invoice`
- `Transactions > Financials > Cash Receipt / Bank Receipt`
- `AR / AP Control Center`
- `Finance & Accounting`
- `Closing Period`

## Important production rules represented in the prototype

- fulfillment status and financial status are separate concepts
- invoice is based on shipped quantity, not ordered quantity
- posted journals must balance debit and credit
- AR is an open-item ledger, not merely a customer balance field
- receipts are allocated against explicit AR items
- accounting period status is a posting gate
- links between SO, shipment, invoice, AR item, receipt, and journal are retained for traceability

## Backend boundary

The React implementation still uses localStorage as a transactional demo store. In production, every posting action should move to a backend transaction with row locking/idempotency, immutable ledger tables, authorization, audit events, and database constraints.
