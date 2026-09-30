# V3 Core Transaction Engine

V3 turns the previous static workbench into a functioning browser-side ERP flow. It is intentionally still frontend-only, but document state, stock reservation, stock issue, master creation, and audit history are now persisted to `localStorage` under a V3-specific key.

## Executable flow

1. Create Sales Order as Draft.
2. Submit Order.
3. Automatic credit check routes the document to Pending Approval or Credit Hold.
4. Approve / override.
5. Reserve Stock against the selected warehouse.
6. Generate Picking Order.
7. Complete Picking.
8. Generate Delivery Order.
9. Release → Loading → Loaded.
10. Generate Shipment.
11. Dispatch Shipment. This posts physical `SHIPMENT_OUT` movement and reduces on-hand/reserved.
12. Mark Delivered. A POD reference is generated and upstream documents are updated.

## Core master data

Customer, Item, and Warehouse now have operational screens and creation forms. New items automatically get zero-balance inventory rows across warehouses. New warehouses automatically get zero-balance rows for existing items.

## Inventory rule implemented

`available = on_hand - reserved`

Reservation is a commitment, not a physical stock movement. Physical inventory is reduced at Shipment Dispatch in this prototype. This keeps reservation and physical ledger semantics separate.

## Production migration

The React context should later be replaced by API calls and database transactions. Use `database-core-mysql.sql` as the starter schema. Important backend rules:

- Use DB transactions for allocation, picking completion, shipment dispatch, and cancellation.
- Lock inventory balance rows or use optimistic versioning during reservation.
- Make stock movement posting idempotent.
- Keep audit and stock ledgers append-only.
- Enforce entity/site scope server-side, not only in React.
- Add user/RBAC, approval matrices, document numbering, and period control before production deployment.
