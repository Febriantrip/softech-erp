# D3-F • Sales-to-Cash Final Integrity Audit

**Read-only diagnostic, not a migration or automatic financial correction.**

Run `RUN_D3F_ONE_CLICK.cmd` from the extracted patch to validate the current SOFTECH
`C:\xampp\htdocs\softech` project and its PostgreSQL data. The runner verifies D3-D/D3-E
source prerequisites, runs `go test ./...` and `npm run build`, then runs
`d3f_sales_to_cash.sql` with one `REPEATABLE READ READ ONLY` database snapshot.

## What is checked

- New DO-backed Shipment quantity versus stock movements, unit cost and COGS journal.
- Shipment quantity versus SO shipped quantity, and Shipment allocations versus DO/Picking.
- Per-line partial invoice allocation, invoice source/scope and tax/discount totals.
- Posted invoice journals, AR open items, paid amounts and remaining balances.
- Multiple invoice allocations per customer receipt, bank/AR journal and site/customer scope.
- Duplicate active bank transaction references and duplicate invoice GL references.

Legacy shipments (without Delivery Order) and legacy SO-level invoices are **deliberately
excluded** from source-line checks; they require a separate legacy reconciliation and must
not be declared verified by a zero-findings D3-F report.

## How to read output

- `D3F_RESULT:PASS`: no listed integrity findings in the selected entity/site *for the
  modern D3-A/B/C/D/E lineage*. Not a statement about legacy records, all bank opening
  balances, tax law compliance, multi-user race tests, or full production readiness.
- `D3F_RESULT:FAIL`: report lists anomaly code, document and observed figures. No balances
  are changed. Preserve the report and fix the identified source before declaring D3 closed.
- An SQL/permission error is a failed *audit execution*, not evidence of financial mismatch.

Partial/unshipped/unpaid balances are normal and **not flagged** as errors.

Report and test logs are saved under `C:\xampp\htdocs\softech\patch-logs\`.
No `pg_dump` or PostgreSQL owner privileges are needed because the audit does not write
or migrate the database. No backend API restart is needed.
