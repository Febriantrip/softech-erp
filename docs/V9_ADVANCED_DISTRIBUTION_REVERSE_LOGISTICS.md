# V9 Advanced Distribution & Reverse Logistics

V9 is built directly on the V8 Governance baseline. The existing V7/V8 Aurora visual system is preserved. V9 adds governed reverse-logistics, replenishment, quarantine, quality hold, lot recall, and return accounting without rewriting the established layout or global styling.

## Executable flows

### Sales Return / RMA

`Delivered / Shipped Sales Order → Sales Return Draft → Governed Approval → Receive to Quarantine → Quality Disposition → Credit Note → GL`

Controls:
- return quantity cannot exceed shipped quantity not already returned
- returned quantity first enters a separate quarantine bucket and is excluded from available stock
- `Restock` moves inspected quantity from quarantine back to on-hand
- `Damaged` removes the inspected quantity from the quarantine bucket without making it available
- posted sales return creates a customer credit note
- if a posted AR item exists, the credit reduces that AR balance; otherwise the credit is held as customer credit/refund payable
- restocked goods reverse the original COGS at the captured return unit cost
- accounting-period and finance-post permissions are checked before posting

Accounting model for a normal posted return:
- Dr Sales Returns & Allowances
- Dr VAT Output / PPN Keluaran
- Cr Accounts Receivable or Customer Credits / Refund Payable

For inspected goods returned to saleable stock:
- Dr Merchandise Inventory
- Cr Cost of Goods Sold

### Purchase Return / Return to Vendor

`Posted Purchase Invoice → Purchase Return Draft → Governed Approval → Return Shipment / Stock Out → Supplier Debit Note → AP reduction → GL`

Controls:
- return quantity cannot exceed the invoiced quantity not previously returned
- source warehouse must have sufficient available stock after sales reservations and quality hold
- return uses current warehouse carrying cost for physical stock value
- difference between supplier invoice value and carrying value is posted to Purchase Return Cost Variance
- posted debit note reduces the linked supplier AP balance when present
- accounting period must be open

Accounting model:
- Dr Accounts Payable
- Cr VAT Input / PPN Masukan
- Cr Merchandise Inventory at carrying value
- Dr/Cr Purchase Return Cost Variance for the invoice-value versus carrying-value difference

### Replenishment Planning

`Reorder Point / Max Stock → Auto Replenishment Plan → Planner Qty Review → Stock Transfer Draft → Release → In Transit → Receive → Replenishment Closed`

Planning calculation:

`Projected = Available + Purchase Inbound + Inter-Site In-Transit In`

`Suggested = max(0, Max Stock - Projected)`

A source warehouse is selected only inside the same legal entity. Transferable source stock protects the source warehouse reorder point:

`Transferable = max(0, Source Available - Source Reorder Point)`

The approved quantity is capped by both suggested demand and source transferable stock.

### Quality Hold & Disposition

`Quality Case → Monitoring → Quality Hold → Release or Scrap`

- hold quantity is deducted from *available* inventory without reducing physical on-hand
- lot-specific cases validate lot availability before the hold can be applied
- lot balances keep a separate hold quantity
- `Release` removes the hold and makes the stock allocatable again
- `Scrap` removes the held quantity from on-hand, writes a stock movement, and posts:
  - Dr Quality & Disposal Loss
  - Cr Merchandise Inventory

### Lot Recall Trace

A Quality Case can initiate a Lot Recall. The prototype traces shipment lines that contain the affected SKU and lot and records the downstream:
- shipment
- sales order
- delivery order
- customer
- quantity exposed

The recall remains independently traceable until review is closed.

## Inventory bucket model

V9 inventory position distinguishes:
- On Hand
- Inbound
- Reserved
- Quarantine
- Quality Hold
- Available

Operational available stock is:

`Available = max(0, On Hand - Reserved - Quality Hold)`

Quarantine is kept outside available stock until inspection/posting determines its final disposition.

## Closing Period integration

V9 adds a Return Gate. An entity period cannot be closed while sales returns or purchase returns dated in the period are still unresolved/unposted.

Existing gates remain active:
- unposted sales/purchase invoice
- stock take
- in-transit standard transfer
- intercompany cutoff
- balanced journal requirement
- governance permission / entity scope

## New workspaces

- `Transactions > Distribution > Sales Return & RMA`
- `Transactions > Distribution > Purchase Return`
- `Warehouse > Replenishment`
- `Warehouse > Quality Control & Lot Recall`

Legacy module catalog entries such as Sales Return Order, Purchase Return Order, Sales Rejection, AR Credit Note, and AP Debit Note route to these workspaces.

## Governance integration

V9 extends V8 approval and numbering rules for:
- SALES_RETURN
- PURCHASE_RETURN
- REPLENISHMENT
- QUALITY_CASE

High-value sales and purchase returns can use multi-level approvals. Existing maker/checker, delegation, entity/site access, audit, and document lock controls remain in force.

## Style preservation contract

The established style baseline is intentionally not changed:
- `src/styles.css`
- `src/enterprise.css`
- `src/governance.css`
- `src/layout/Sidebar.jsx`
- `src/layout/Topbar.jsx`
- `src/layout/AppShell.jsx`

V9-only visual rules are isolated in `src/v9-distribution.css`.

## Production boundary

This remains a React/localStorage transactional prototype. Production returns, quality, inventory reservation, costing, credit/debit notes, approval, period locks, and lot recall must be enforced in backend services using transactional writes, idempotency keys, row/version locking, immutable inventory/accounting ledgers, document ownership checks, and server-side RBAC.
