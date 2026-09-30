# ERP Distributor · Suggested Production Architecture

## 1. Domain utama

### Organization
- legal_entity
- site / branch
- warehouse
- bin_location
- department / cost_center
- fiscal_year / fiscal_period

### Security & Governance
- users
- roles
- permissions
- user_entity_access
- user_site_access
- approval_workflow
- approval_rule
- approval_instance
- audit_log

### Master Data
- customer
- customer_address
- vendor
- item
- item_category
- brand
- uom
- uom_conversion
- pricelist
- tax_code
- chart_of_account
- bank_account
- currency
- exchange_rate

### Sales / Order to Cash
- quotation_header/detail
- sales_order_header/detail
- sales_order_allocation
- delivery_header/detail
- sales_invoice_header/detail
- sales_return_header/detail
- promotion / discount rule
- customer_credit_limit

### Purchase / Procure to Pay
- purchase_request_header/detail
- rfq_header/detail
- purchase_order_header/detail
- goods_receipt_header/detail
- vendor_bill_header/detail
- purchase_return_header/detail

### Inventory / Warehouse
- stock_balance
- stock_movement (append-only)
- stock_reservation
- stock_transfer_header/detail
- stock_adjustment_header/detail
- stock_opname_header/detail
- batch_lot
- serial_number (optional)

### AR / AP
- ar_open_item
- ar_settlement
- ap_open_item
- ap_settlement
- collection_activity
- payment_proposal

### Finance & Accounting
- journal_header
- journal_line
- gl_entry (append-only posting ledger)
- recurring_journal
- accrual
- cash_receipt
- cash_payment
- bank_reconciliation
- fixed_asset
- depreciation_run
- budget

### Closing
- period_close_run
- period_close_task
- subledger_lock
- period_lock

## 2. Prinsip transaksi penting

- Semua transaksi punya `entity_id`, dan transaksi operasional juga punya `site_id` jika relevan.
- Dokumen memakai status eksplisit: draft, submitted, approved, posted, void/cancelled.
- Posting GL tidak boleh mengubah histori. Koreksi dilakukan dengan reversal + replacement.
- Stock movement append-only. `stock_balance` adalah projection/cache untuk baca cepat.
- AR/AP open item berasal dari invoice/bill posted dan berubah melalui settlement resmi.
- Closing period memblokir posting berdasarkan entity + fiscal period + module/subledger.
- Gunakan decimal fixed precision untuk quantity, currency dan exchange rate.
- Setiap write API memakai optimistic locking/version atau row lock sesuai kasus.
- Gunakan idempotency key untuk endpoint kritikal seperti posting, payment dan integration webhook.

## 3. Suggested backend

Pilihan aman:

- React frontend
- REST atau GraphQL API
- Node.js/NestJS, Laravel, .NET, atau Java Spring untuk service layer
- PostgreSQL/MySQL untuk transactional database
- Redis untuk cache, queue dan distributed lock
- Object storage untuk attachment

Untuk ERP skala menengah, modular monolith biasanya lebih aman daripada microservices di fase awal. Pisahkan domain secara ketat di level module/service dan baru pecah service ketika volume serta ownership memang menuntut.

## 4. Posting matrix contoh

### Sales Invoice
Debit  Accounts Receivable
Credit Sales Revenue
Credit Output Tax

### Goods Issue / COGS
Debit  Cost of Goods Sold
Credit Inventory

### Vendor Bill
Debit  Inventory/Expense/Input Tax
Credit Accounts Payable

### Customer Receipt
Debit  Bank/Cash
Credit Accounts Receivable

### Vendor Payment
Debit  Accounts Payable
Credit Bank/Cash

## 5. Fitur lanjutan distributor

- salesman route & territory
- customer hierarchy / chain store
- trade promotion
- rebate & retrospective discount
- credit limit + overdue blocking
- ATP / available-to-promise
- batch & expiry / FEFO
- multi-UOM sales and purchase conversion
- landed cost allocation
- inter-site transfer in transit
- intercompany sale/purchase
- demand planning / replenishment
- min-max / safety stock
- mobile warehouse barcode
- delivery routing / proof of delivery
- commission salesman
- customer claim / deduction management
- returnable packaging / pallet tracking
