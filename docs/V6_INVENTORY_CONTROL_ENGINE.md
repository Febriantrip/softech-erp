# V6 Inventory Control & Costing Engine

V6 extends the distributor ERP prototype with warehouse control that behaves more like a real distribution ERP rather than a flat stock screen.

## Executable inventory flow

### Inter-site transfer

`Draft → Release → In Transit → Receive`

- Release validates source `Available = On Hand - Reserved`.
- Release reduces physical stock at the source warehouse.
- Stock remains visible as an in-transit transfer until destination receipt.
- Receive increases destination on-hand and preserves the carrying unit cost.
- Destination weighted-average cost is recalculated when the transfer is received.
- `TRANSFER_OUT` and `TRANSFER_IN` are written to the stock movement ledger.

### Stock take / cycle count

`Counting → Pending Approval → Approved → Posted`

- Opening a stock take snapshots system quantity and carrying cost.
- Count quantity is entered per SKU.
- Variance is calculated automatically.
- Pending variance can be approved from the central Approval inbox.
- Posting writes physical adjustment movements and creates a balanced GL journal.
- Posting is rejected if the accounting period is closed.
- Posting is also rejected when the current inventory balance no longer matches the original snapshot, preventing silent overwrite of intervening warehouse transactions.

### Moving weighted-average costing

- Purchase put-away recalculates `average_cost` using prior on-hand value plus received purchase value.
- Inter-site receipt carries source cost and recalculates destination average cost.
- Shipment dispatch snapshots the current average cost per line.
- Shipment dispatch creates the physical stock issue and a COGS journal:
  - Dr Cost of Goods Sold
  - Cr Merchandise Inventory
- Manual inventory adjustment and posted stock-take variance also create GL entries.

## New V6 workspaces

- `Warehouse > Inter-Site Transfer`
- `Warehouse > Stock Take`
- `Warehouse > Inventory Valuation`
- Warehouse Inventory Control Center shortcuts
- Replenishment signals using reorder point and max-stock planning
- Lot / expiry status
- Stock movement ledger with unit cost and movement value
- Pending Approval now includes stock-take variance
- Closing Period now checks unresolved stock takes and in-transit transfers

## Planning model

Each item can now carry:

- Reorder Point
- Max Stock
- Standard Cost

Warehouse replenishment projection uses:

`Projected = Available + Inbound + Inter-Site In Transit`

Suggested replenishment quantity is:

`max(0, Max Stock - Projected)`

## Production boundary

The React implementation still uses localStorage as a demonstrator. A production implementation should move all posting to backend services with:

- database transactions
- row locks/version checks for inventory balances
- immutable stock movements
- persisted cost snapshots
- location/lot-level reservation
- FEFO allocation for expiring goods
- idempotent posting keys
- period lock validation on the server
- entity/site authorization
- intercompany accounting for cross-legal-entity transfers
