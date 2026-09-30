# V7 Enterprise · Multi-Entity, Intercompany & Consolidation

V7 turns the existing Entity/Site selector into a real transaction and accounting boundary. The application now supports legal-entity ledgers, site-level operational scope, related-party posting, settlement, close readiness, and group consolidation.

## Enterprise hierarchy

```text
Consolidation Group
└─ Legal Entity
   └─ Site / Branch / Distribution Center
      └─ Warehouse / Location
```

Seed hierarchy:

- **Nusantara Distribution Group** (`GRP-NUSANTARA`)
  - **NDU** · PT Nusantara Distribusi Utama
    - Jakarta Head Office
    - Cikarang Distribution Center
    - Tangerang Warehouse
  - **NDT** · PT Nusantara Distribusi Timur
    - Surabaya Branch
    - Gresik Warehouse

## Scope behavior

### Entity mode

When a legal entity is selected, operational and finance collections are scoped to that entity. Site selection narrows site-owned transactions further.

Scoped domains include:

- customer and supplier ownership
- warehouse and inventory
- Sales Order, Picking, Delivery, Shipment
- Purchase Request, RFQ, Purchase Order, Receiving
- Sales/Purchase Invoice
- AR/AP open items
- receipts and supplier payments
- bank/cash accounts
- journal entries
- stock take and stock transfer
- accounting periods

Items and Chart of Accounts remain shared master structures in the browser demo.

### Group Consolidated mode

Group mode exposes all entities for consolidation and enterprise reporting. It does **not** directly post operational transactions or close an entity period.

## Intercompany rules

A normal Stock Transfer is restricted to warehouses belonging to the **same legal entity**. Cross-entity movement must use Intercompany.

### Intercompany service

Source entity:

```text
Dr Due From Related Parties
Cr Intercompany Revenue
```

Destination entity:

```text
Dr Intercompany Expense
Cr Due To Related Parties
```

### Intercompany inventory transfer

Release at source entity:

```text
Dr Due From Related Parties
Cr Intercompany Revenue
Dr Cost of Goods Sold
Cr Merchandise Inventory
```

Receipt at destination entity:

```text
Dr Merchandise Inventory      (transfer price)
Cr Due To Related Parties
```

The destination warehouse preserves transfer-price carrying value and recalculates its moving weighted-average cost.

### Settlement

Paying entity:

```text
Dr Due To Related Parties
Cr Bank / Cash
```

Receiving entity:

```text
Dr Bank / Cash
Cr Due From Related Parties
```

One Intercompany document retains the journal IDs from both entities and settlement references.

## Consolidation engine

The V7 group preview reads posted journals for each entity and calculates:

- entity Revenue
- entity Expense
- entity Net Income
- Assets and Liabilities
- period status
- close blockers
- intercompany Revenue/Expense elimination
- Due From / Due To elimination
- unrealized inventory profit
- consolidated Revenue, Expense, and Net Income

### Inventory markup elimination

For an intercompany inventory transfer, the browser engine tracks an `endingInventoryRatio`.

`Unrealized Profit = IC Margin × Ending Inventory Ratio`

The consolidation bridge removes intercompany revenue and the corresponding expense/COGS components so only the unrealized markup remaining in ending inventory reduces group earnings.

## Entity close controls

Each legal entity owns its Accounting Period. Closing one entity does not close another entity.

Entity close is blocked by:

- unposted Sales Invoice
- unposted Purchase Invoice
- unresolved Stock Take
- in-transit same-entity Stock Transfer
- Draft / In-Transit Intercompany documents involving that entity
- unbalanced posted journals
- incomplete close checklist

Group consolidation can be **Prepared** before all entities are closed for review, but it can only be **Posted** after every entity period in the selected group/month is Closed.

## V7 pages

- `Enterprise > Entity & Site`
- `Enterprise > Intercompany`
- `Enterprise > Consolidation`
- entity-aware `Closing Period`
- entity/group selector in the Aurora topbar

## Browser demo migration

V7 keeps the existing V3/V4/V5/V6 localStorage key and enriches legacy rows with legal-entity/site ownership. This avoids intentionally wiping the user's existing demo state when the V7 overlay is installed.

A dedicated V7 scope key stores the selected entity/site/group view separately.

## Production boundary

The localStorage engine demonstrates rules and UI behavior only. Production implementation should move all enterprise posting to backend database transactions with:

- server-side entity/site authorization
- immutable entity ledgers
- idempotency keys
- period locks enforced server-side
- explicit counterparty entity on related-party lines
- intercompany matching/reconciliation
- FX translation when entity functional currencies differ
- ownership percentages and non-controlling interest when required
- consolidation adjustment journals stored separately from statutory entity ledgers
- audit trail for prepare/post/reopen consolidation
