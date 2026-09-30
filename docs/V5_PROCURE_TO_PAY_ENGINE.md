# V5 Procure-to-Pay Engine

V5 extends the distributor ERP prototype with an executable procurement, inbound, AP, and supplier-payment flow.

## Executable demo flow

1. Purchase Request is created as Draft.
2. Purchase Request is submitted and approved.
3. Approved PR can create an RFQ for a supplier.
4. Supplier quoted price is captured in RFQ.
5. RFQ can be converted to a Purchase Order.
6. Purchase Order is submitted and approved.
7. Approved PO can create a Goods Receiving Note (GRN) for remaining quantity.
8. Receiving posting moves accepted quantity to **inbound staging**.
9. Put Away moves inbound quantity to **available on-hand stock**.
10. Purchase Invoice is generated from a Put Away GRN.
11. Invoice performs demo **3-way match** against PO + GRN + invoice values.
12. Posting the Purchase Invoice creates:
    - AP open item
    - Dr Merchandise Inventory
    - Dr VAT Input / PPN Masukan
    - Cr Accounts Payable
13. Supplier Payment allocates against the AP item and creates:
    - Dr Accounts Payable
    - Cr Bank/Cash
14. Full payment closes the Purchase Invoice and can close the Purchase Order.

## V5 pages

- `Transactions > Sales & Distribution > Purchase Request`
- `Transactions > Sales & Distribution > Request For Quotation`
- `Transactions > Sales & Distribution > Purchase Order`
- `Transactions > Sales & Distribution > Receiving / Put Away`
- `Transactions > Financials > Purchase Invoice`
- `Transactions > Financials > Payment Run / Bank Disbursement`
- `AR / AP Control Center`
- `Warehouse`
- `Pending Approval`
- `Master Data > Supplier`

## Inventory state model

V5 separates three important warehouse states:

- `Inbound`: goods physically received but not yet put away and not yet available for sales allocation.
- `On Hand`: goods stored in the warehouse after put away.
- `Reserved`: on-hand goods committed to Sales Orders.

`Available = On Hand - Reserved`

The browser demo records `GOODS_RECEIPT_INBOUND` and `PUTAWAY_TRANSFER` events in the stock movement ledger. A production implementation should model receiving/staging/storage at location-level with an immutable inventory ledger.

## 3-way match model

The prototype uses:

- Purchase Order quantity and supplier price
- accepted quantity from Goods Receiving
- Purchase Invoice quantity and price

The generated demo invoice is marked `Matched` when it is created from the accepted GRN lines and PO prices. In production this should become configurable tolerance rules for quantity, unit price, freight, tax, rounding, and landed cost exceptions.

## Production boundary

The React implementation still uses browser localStorage as a transaction demo store. Production posting should move to backend services using:

- database transactions
- idempotency keys
- optimistic/pessimistic locking as appropriate
- immutable inventory and GL ledgers
- row-level entity/site authorization
- approval policy evaluation
- audit events
- configurable 3-way match tolerance
- period posting gates
