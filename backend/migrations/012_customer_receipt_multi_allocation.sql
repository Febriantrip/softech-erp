BEGIN;
-- D3-E extends existing AR, receipts, allocation and bank tables; no duplicate ledger.
INSERT INTO erp.permissions(code,module,action,description) VALUES
 ('receivable.view','finance','view','View AR open item aging and balances'),
 ('customer_receipt.view','finance','view','View customer receipts and allocations'),
 ('customer_receipt.post','finance','post','Post allocated customer receipt to AR, bank and GL')
ON CONFLICT (code) DO NOTHING;

INSERT INTO erp.role_permissions(role_id,permission_id)
SELECT r.id,p.id FROM erp.roles r CROSS JOIN erp.permissions p
WHERE r.code='GROUP_ADMIN' AND p.code IN ('receivable.view','customer_receipt.view','customer_receipt.post')
ON CONFLICT DO NOTHING;

-- Existing receipt_allocations has UNIQUE(receipt_id, ar_item_id); add lookup-only index.
CREATE INDEX IF NOT EXISTS idx_customer_receipt_allocations_ar
  ON erp.customer_receipt_allocations(ar_open_item_id,customer_receipt_id);
COMMIT;
