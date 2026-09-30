-- SOFTECH D3-F: read-only Sales-to-Cash integrity audit, for psql 16+
-- Required psql variables: entity_code, site_code, sample_shipment.
-- No migration, insert, update, delete, procedural calls or temporary tables.
\set ON_ERROR_STOP on
\pset pager off
\pset null '(null)'
\echo ============================================================================
\echo SOFTECH D3-F - SALES-TO-CASH DATABASE AUDIT (READ ONLY)
\echo ============================================================================
\echo Entity: :entity_code   Site: :site_code   Sample shipment: :sample_shipment
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT CURRENT_TIMESTAMP AS audited_at, e.code AS entity_code, st.code AS site_code,
       e.legal_name AS entity_name, st.name AS site_name
FROM erp.entities e JOIN erp.sites st ON st.entity_id=e.id
WHERE e.code=:'entity_code' AND st.code=:'site_code';
-- Fail closed if wrong entity/site was supplied; never report zero findings for an empty scope.
SELECT 1/COUNT(*) AS scope_verified FROM erp.entities e JOIN erp.sites st ON st.entity_id=e.id
WHERE e.code=:'entity_code' AND st.code=:'site_code';
\echo -----------------------------------------------------------------------------
\echo DOCUMENT TOTALS (not all orders must be fully shipped or fully paid)
SELECT
 (SELECT count(*) FROM erp.sales_orders so WHERE so.entity_id=e.id AND so.site_id=st.id) AS sales_orders,
 (SELECT count(*) FROM erp.picking_orders p WHERE p.entity_id=e.id AND p.site_id=st.id) AS picking_orders,
 (SELECT count(*) FROM erp.delivery_orders d WHERE d.entity_id=e.id AND d.site_id=st.id) AS delivery_orders,
 (SELECT count(*) FROM erp.shipments sh WHERE sh.entity_id=e.id AND sh.site_id=st.id AND sh.delivery_order_id IS NOT NULL) AS d3c_shipments,
 (SELECT count(*) FROM erp.sales_invoices iv WHERE iv.entity_id=e.id AND iv.site_id=st.id AND iv.shipment_id IS NOT NULL AND iv.status<>'VOID') AS d3d_invoices,
 (SELECT count(*) FROM erp.customer_receipts r WHERE r.entity_id=e.id AND r.site_id=st.id AND r.status='POSTED') AS receipts,
 (SELECT COALESCE(SUM(a.outstanding_amount),0) FROM erp.ar_open_items a WHERE a.entity_id=e.id AND a.site_id=st.id AND a.status<>'VOID') AS ar_outstanding
FROM erp.entities e JOIN erp.sites st ON st.entity_id=e.id
WHERE e.code=:'entity_code' AND st.code=:'site_code';
\echo -----------------------------------------------------------------------------
\echo SAMPLE SHIPMENT LINEAGE / QUANTITY / JOURNAL REFERENCES
SELECT sh.document_no AS shipment, sh.status AS shipment_status, so.document_no AS sales_order,
       COALESCE(d.document_no,'LEGACY') AS delivery_order,
       COALESCE((SELECT SUM(sl.qty) FROM erp.shipment_lines sl WHERE sl.shipment_id=sh.id),0) AS shipped_qty,
       COALESCE((SELECT SUM(il.qty) FROM erp.sales_invoice_lines il
                 JOIN erp.sales_invoices iv ON iv.id=il.sales_invoice_id
                 WHERE iv.shipment_id=sh.id AND iv.status<>'VOID'),0) AS allocated_invoice_qty,
       COALESCE((SELECT SUM(-sm.qty) FROM erp.stock_movements sm
                 WHERE sm.entity_id=sh.entity_id AND sm.site_id=sh.site_id AND
                   sm.reference_type='SHIPMENT' AND sm.reference_id=sh.document_no AND sm.movement_type='SHIPMENT_OUT'),0) AS stock_out_qty,
       COALESCE((SELECT SUM(-sm.movement_value) FROM erp.stock_movements sm
                 WHERE sm.entity_id=sh.entity_id AND sm.site_id=sh.site_id AND
                   sm.reference_type='SHIPMENT' AND sm.reference_id=sh.document_no AND sm.movement_type='SHIPMENT_OUT'),0) AS stock_out_value,
       (SELECT string_agg(DISTINCT iv.document_no || ':' || iv.status,', ' ORDER BY iv.document_no || ':' || iv.status)
          FROM erp.sales_invoices iv WHERE iv.shipment_id=sh.id) AS invoices,
       (SELECT string_agg(DISTINCT j.document_no || ':' || j.status,', ' ORDER BY j.document_no || ':' || j.status)
          FROM erp.journal_entries j WHERE j.entity_id=sh.entity_id AND j.site_id=sh.site_id
            AND j.source_type='INVENTORY_ISSUE' AND j.reference_type='SHIPMENT' AND j.reference_id=sh.document_no) AS cogs_journals
FROM erp.shipments sh JOIN erp.sales_orders so ON so.id=sh.sales_order_id
LEFT JOIN erp.delivery_orders d ON d.id=sh.delivery_order_id
JOIN erp.entities e ON e.id=sh.entity_id JOIN erp.sites st ON st.id=sh.site_id
WHERE e.code=:'entity_code' AND st.code=:'site_code' AND sh.document_no=:'sample_shipment';
\echo -----------------------------------------------------------------------------
\echo INTEGRITY FINDINGS (zero findings = PASS within defined D3-C/D3-D/D3-E scope)
WITH
scope AS (
 SELECT e.id AS entity_id,st.id AS site_id
 FROM erp.entities e JOIN erp.sites st ON st.entity_id=e.id
 WHERE e.code=:'entity_code' AND st.code=:'site_code'
),
ships AS (
 SELECT sh.* FROM erp.shipments sh JOIN scope s ON s.entity_id=sh.entity_id AND s.site_id=sh.site_id
 WHERE sh.delivery_order_id IS NOT NULL
),
ship_expected AS (
 SELECT sh.id AS shipment_id,sh.document_no,sh.entity_id,sh.site_id,sh.warehouse_id,sl.item_id,
   SUM(sl.qty) AS qty,SUM(ROUND(sl.qty*sl.unit_cost,2)) AS cost,COUNT(*) AS lines
 FROM ships sh JOIN erp.shipment_lines sl ON sl.shipment_id=sh.id
 WHERE sh.status IN ('DISPATCHED','DELIVERED')
 GROUP BY sh.id,sh.document_no,sh.entity_id,sh.site_id,sh.warehouse_id,sl.item_id
),
ship_actual AS (
 SELECT sh.id AS shipment_id,sm.item_id,SUM(sm.qty) AS qty,
   SUM(sm.movement_value) AS value,COUNT(*) AS moves
 FROM ships sh JOIN erp.stock_movements sm ON sm.entity_id=sh.entity_id AND sm.site_id=sh.site_id
  AND sm.warehouse_id=sh.warehouse_id AND sm.reference_type='SHIPMENT'
  AND sm.reference_id=sh.document_no AND sm.movement_type='SHIPMENT_OUT'
 GROUP BY sh.id,sm.item_id
),
shipment_gl AS (
 SELECT sh.id AS shipment_id,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status='POSTED') AS posted_count,
  COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED'),0) AS debit,
  COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED'),0) AS credit,
  COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED' AND coa.code='510100'),0) AS cogs_debit,
  COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED' AND coa.code='120100'),0) AS inventory_credit
 FROM ships sh LEFT JOIN erp.journal_entries j ON j.entity_id=sh.entity_id AND j.site_id=sh.site_id
  AND j.source_type='INVENTORY_ISSUE' AND j.reference_type='SHIPMENT' AND j.reference_id=sh.document_no
  AND j.status<>'VOID'
 LEFT JOIN erp.journal_lines jl ON jl.journal_entry_id=j.id
 LEFT JOIN erp.chart_of_accounts coa ON coa.id=jl.account_id
 GROUP BY sh.id
),
ship_cost AS (
 SELECT shipment_id,SUM(cost) AS cost FROM ship_expected GROUP BY shipment_id
),
inv AS (
 SELECT iv.* FROM erp.sales_invoices iv JOIN scope s ON s.entity_id=iv.entity_id AND s.site_id=iv.site_id
 WHERE iv.shipment_id IS NOT NULL AND iv.status<>'VOID'
),
invoice_qty AS (
 SELECT sl.id AS shipment_line_id,sl.qty AS available_qty,
  COALESCE(SUM(il.qty) FILTER (WHERE iv.status<>'VOID'),0) AS allocated_qty,
  sh.document_no AS shipment_no
 FROM ships sh JOIN erp.shipment_lines sl ON sl.shipment_id=sh.id
 LEFT JOIN erp.sales_invoice_lines il ON il.shipment_line_id=sl.id
 LEFT JOIN erp.sales_invoices iv ON iv.id=il.sales_invoice_id
 GROUP BY sl.id,sl.qty,sh.document_no
),
invoice_lines AS (
 SELECT iv.id AS invoice_id,COUNT(il.id) AS lines,
   COALESCE(SUM(il.qty),0) AS qty,
   COALESCE(SUM(il.line_subtotal),0) AS gross,
   COALESCE(SUM(il.discount_amount),0) AS discount,
   COALESCE(SUM(il.dpp_amount),0) AS dpp,
   COALESCE(SUM(il.tax_amount),0) AS tax,
   COALESCE(SUM(il.line_total),0) AS total
 FROM inv iv LEFT JOIN erp.sales_invoice_lines il ON il.sales_invoice_id=iv.id GROUP BY iv.id
),
allocation_by_ar AS (
 SELECT a.id AS ar_id,COALESCE(SUM(ra.amount) FILTER (WHERE r.status='POSTED'),0) AS paid
 FROM erp.ar_open_items a
 LEFT JOIN erp.customer_receipt_allocations ra ON ra.ar_open_item_id=a.id
 LEFT JOIN erp.customer_receipts r ON r.id=ra.customer_receipt_id
 GROUP BY a.id
),
invoice_gl AS (
 SELECT iv.id AS invoice_id,
   COUNT(DISTINCT j.id) FILTER (WHERE j.status='POSTED') AS posted_count,
   COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED'),0) AS debit,
   COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED'),0) AS credit,
   COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED' AND coa.code='110100'),0) AS ar_debit,
   COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED' AND coa.code='410100'),0) AS revenue_credit,
   COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED' AND coa.code='218100'),0) AS vat_credit
 FROM inv iv LEFT JOIN erp.journal_entries j ON j.id=iv.journal_entry_id
  AND j.entity_id=iv.entity_id AND j.site_id=iv.site_id AND j.source_type='SALES_INVOICE'
  AND j.reference_type='SALES_INVOICE' AND j.reference_id=iv.document_no
 LEFT JOIN erp.journal_lines jl ON jl.journal_entry_id=j.id
 LEFT JOIN erp.chart_of_accounts coa ON coa.id=jl.account_id
 GROUP BY iv.id
),
receipt AS (
 SELECT r.* FROM erp.customer_receipts r JOIN scope s ON s.entity_id=r.entity_id AND s.site_id=r.site_id
 WHERE r.status='POSTED'
),
receipt_alloc AS (
 SELECT r.id AS receipt_id,COALESCE(SUM(ra.amount),0) AS amount,COUNT(ra.id) AS lines
 FROM receipt r LEFT JOIN erp.customer_receipt_allocations ra ON ra.customer_receipt_id=r.id GROUP BY r.id
),
receipt_gl AS (
 SELECT r.id AS receipt_id,
 COUNT(DISTINCT j.id) FILTER (WHERE j.status='POSTED') AS posted_count,
 COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED'),0) AS debit,
 COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED'),0) AS credit,
 COALESCE(SUM(jl.debit) FILTER (WHERE j.status='POSTED' AND jl.account_id=b.gl_account_id),0) AS bank_debit,
 COALESCE(SUM(jl.credit) FILTER (WHERE j.status='POSTED' AND coa.code='110100'),0) AS ar_credit
 FROM receipt r JOIN erp.bank_accounts b ON b.id=r.bank_account_id
 LEFT JOIN erp.journal_entries j ON j.id=r.journal_entry_id AND j.entity_id=r.entity_id AND j.site_id=r.site_id
   AND j.source_type='CUSTOMER_RECEIPT' AND j.reference_type='CUSTOMER_RECEIPT' AND j.reference_id=r.document_no
 LEFT JOIN erp.journal_lines jl ON jl.journal_entry_id=j.id
 LEFT JOIN erp.chart_of_accounts coa ON coa.id=jl.account_id
 GROUP BY r.id
),
issues AS (
 -- Shipment physical issue must happen exactly once per shipped line, and never before Dispatch.
 SELECT 'SHIPMENT_NO_LINES'::text AS code,sh.document_no::text AS document_no,
        'Modern Shipment has no cargo lines'::text AS detail
 FROM ships sh WHERE NOT EXISTS(SELECT 1 FROM erp.shipment_lines sl WHERE sl.shipment_id=sh.id)
 UNION ALL
 SELECT 'SHIPMENT_STOCK_QTY',s.document_no,
        format('item %s expected movement qty -%s, actual %s; expected rows %s, actual rows %s',s.item_id,s.qty,COALESCE(m.qty,0),s.lines,COALESCE(m.moves,0))
 FROM ship_expected s LEFT JOIN ship_actual m ON m.shipment_id=s.shipment_id AND m.item_id=s.item_id
 WHERE ABS(s.qty+COALESCE(m.qty,0))>0.000001 OR s.lines<>COALESCE(m.moves,0)
 UNION ALL
 SELECT 'SHIPMENT_STOCK_VALUE',s.document_no,
        format('item %s expected stock issue value -%s, actual %s',s.item_id,s.cost,COALESCE(m.value,0))
 FROM ship_expected s LEFT JOIN ship_actual m ON m.shipment_id=s.shipment_id AND m.item_id=s.item_id
 WHERE ABS(s.cost+COALESCE(m.value,0))>0.02
 UNION ALL
 SELECT 'SHIPMENT_EARLY_STOCK_ISSUE',sh.document_no,
        format('status %s already has stock movements, qty %s',sh.status,m.qty)
 FROM ships sh JOIN ship_actual m ON m.shipment_id=sh.id
 WHERE sh.status IN ('PLANNED','CANCELLED')
 UNION ALL
 SELECT 'SHIPMENT_COGS_JOURNAL',sh.document_no,
        format('expected COGS %s; posted journals %s; debit %s credit %s; COGS debit %s inventory credit %s',
          c.cost,g.posted_count,g.debit,g.credit,g.cogs_debit,g.inventory_credit)
 FROM ships sh JOIN ship_cost c ON c.shipment_id=sh.id
 JOIN shipment_gl g ON g.shipment_id=sh.id
 WHERE sh.status IN ('DISPATCHED','DELIVERED') AND c.cost>0
 AND (g.posted_count<>1 OR ABS(g.debit-g.credit)>0.01 OR ABS(g.debit-c.cost)>0.02
    OR ABS(g.cogs_debit-c.cost)>0.02 OR ABS(g.inventory_credit-c.cost)>0.02)
 UNION ALL
 SELECT 'SHIPMENT_SCOPE_MISMATCH',sh.document_no,
        'Shipment scope/customer/order does not match Delivery Order and Sales Order'
 FROM ships sh JOIN erp.sales_orders so ON so.id=sh.sales_order_id
 JOIN erp.delivery_orders d ON d.id=sh.delivery_order_id
 WHERE sh.entity_id<>so.entity_id OR sh.site_id<>so.site_id OR sh.warehouse_id<>so.warehouse_id
    OR sh.entity_id<>d.entity_id OR sh.site_id<>d.site_id OR sh.sales_order_id<>d.sales_order_id
 UNION ALL
 SELECT 'DO_SHIPMENT_OVER_ALLOCATION',d.document_no,
        format('line %s loaded qty %s allocated shipment qty %s',dl.line_no,dl.qty,SUM(sl.qty))
 FROM erp.delivery_orders d JOIN scope sc ON sc.entity_id=d.entity_id AND sc.site_id=d.site_id
 JOIN erp.delivery_order_lines dl ON dl.delivery_order_id=d.id
 JOIN erp.shipment_lines sl ON sl.delivery_order_line_id=dl.id
 JOIN erp.shipments sh ON sh.id=sl.shipment_id AND sh.status<>'CANCELLED'
 GROUP BY d.document_no,dl.line_no,dl.qty HAVING SUM(sl.qty)>dl.qty+0.000001
 UNION ALL
 SELECT 'PICKING_DO_OVER_ALLOCATION',p.document_no,
        format('line %s picked %s allocated DO %s',pl.line_no,pl.picked_qty,SUM(dl.qty))
 FROM erp.picking_orders p JOIN scope sc ON sc.entity_id=p.entity_id AND sc.site_id=p.site_id
 JOIN erp.picking_order_lines pl ON pl.picking_order_id=p.id
 JOIN erp.delivery_order_lines dl ON dl.picking_order_line_id=pl.id
 JOIN erp.delivery_orders d ON d.id=dl.delivery_order_id AND d.status<>'CANCELLED'
 GROUP BY p.document_no,pl.line_no,pl.picked_qty HAVING SUM(dl.qty)>pl.picked_qty+0.000001
 UNION ALL
 SELECT 'SO_SHIPPED_QTY',so.document_no,
        format('Sales Order line %s shipped field %s, actual Shipment qty %s',sol.line_no,sol.shipped_qty,
               COALESCE(SUM(shl.qty),0))
 FROM erp.sales_orders so JOIN scope sc ON sc.entity_id=so.entity_id AND sc.site_id=so.site_id
 JOIN erp.sales_order_lines sol ON sol.sales_order_id=so.id
 LEFT JOIN ships sh ON sh.sales_order_id=so.id AND sh.status IN ('DISPATCHED','DELIVERED')
 LEFT JOIN erp.shipment_lines shl ON shl.shipment_id=sh.id AND shl.sales_order_line_id=sol.id
 WHERE NOT EXISTS(SELECT 1 FROM erp.shipments legacy
                  WHERE legacy.sales_order_id=so.id AND legacy.delivery_order_id IS NULL
                    AND legacy.status IN ('DISPATCHED','DELIVERED'))
 GROUP BY so.id,so.document_no,sol.id,sol.line_no,sol.shipped_qty
 HAVING ABS(sol.shipped_qty-COALESCE(SUM(shl.qty),0))>0.000001
 UNION ALL
 SELECT 'INVOICE_OVER_ALLOCATION',q.shipment_no,
        format('shipment line %s shipped qty %s invoice allocated %s',q.shipment_line_id,q.available_qty,q.allocated_qty)
 FROM invoice_qty q WHERE q.allocated_qty>q.available_qty+0.000001
 UNION ALL
 SELECT 'INVOICE_SOURCE_MISMATCH',iv.document_no,
        'Invoice shipment/order/customer/entity/site do not match source Shipment and Sales Order'
 FROM inv iv JOIN erp.shipments sh ON sh.id=iv.shipment_id
 JOIN erp.sales_orders so ON so.id=iv.sales_order_id
 WHERE iv.entity_id<>sh.entity_id OR iv.site_id<>sh.site_id OR iv.sales_order_id<>sh.sales_order_id
   OR iv.customer_id<>so.customer_id OR sh.status<>'DELIVERED'
 UNION ALL
 SELECT 'INVOICE_LINE_SOURCE_MISMATCH',iv.document_no,
        format('invoice line %s is not linked to a line in its source shipment',il.line_no)
 FROM inv iv JOIN erp.sales_invoice_lines il ON il.sales_invoice_id=iv.id
 LEFT JOIN erp.shipment_lines sl ON sl.id=il.shipment_line_id AND sl.shipment_id=iv.shipment_id
 WHERE sl.id IS NULL OR il.item_id<>sl.item_id OR il.sales_order_line_id IS DISTINCT FROM sl.sales_order_line_id
 UNION ALL
 SELECT 'INVOICE_HEADER_TOTALS',iv.document_no,
        format('header gross/discount/dpp/tax/total=%s/%s/%s/%s/%s lines=%s/%s/%s/%s/%s',
        iv.subtotal,iv.discount_amount,iv.dpp_amount,iv.tax_amount,iv.total_amount,l.gross,l.discount,l.dpp,l.tax,l.total)
 FROM inv iv JOIN invoice_lines l ON l.invoice_id=iv.id
 WHERE l.lines=0 OR ABS(iv.subtotal-l.gross)>0.02 OR ABS(iv.discount_amount-l.discount)>0.02
    OR ABS(iv.dpp_amount-l.dpp)>0.02 OR ABS(iv.tax_amount-l.tax)>0.02 OR ABS(iv.total_amount-l.total)>0.02
    OR ABS(iv.total_amount-iv.dpp_amount-iv.tax_amount)>0.02
 UNION ALL
 SELECT 'INVOICE_POSTING_GL',iv.document_no,
        format('invoice total/dpp/tax %s/%s/%s, journal count %s, debit %s credit %s AR %s sales %s VAT %s',
           iv.total_amount,iv.dpp_amount,iv.tax_amount,g.posted_count,g.debit,g.credit,g.ar_debit,g.revenue_credit,g.vat_credit)
 FROM inv iv JOIN invoice_gl g ON g.invoice_id=iv.id
 WHERE iv.status IN ('POSTED','PARTIALLY_PAID','PAID')
   AND (g.posted_count<>1 OR ABS(g.debit-g.credit)>0.01 OR ABS(g.debit-iv.total_amount)>0.02
      OR ABS(g.ar_debit-iv.total_amount)>0.02 OR ABS(g.revenue_credit-iv.dpp_amount)>0.02
      OR ABS(g.vat_credit-iv.tax_amount)>0.02)
 UNION ALL
 SELECT 'INVOICE_DUPLICATE_GL',iv.document_no,
        format('Sales Invoice has %s active posted journal references',COUNT(j.id))
 FROM inv iv JOIN erp.journal_entries j ON j.entity_id=iv.entity_id
   AND j.source_type='SALES_INVOICE' AND j.reference_type='SALES_INVOICE'
   AND j.reference_id=iv.document_no AND j.status='POSTED'
 GROUP BY iv.id,iv.document_no HAVING COUNT(j.id)>1
 UNION ALL
 SELECT 'INVOICE_AR_BALANCE',iv.document_no,
        format('invoice total %s paid %s; AR original %s outstanding %s; posted receipts allocated %s',
            iv.total_amount,iv.paid_amount,COALESCE(a.original_amount,0),COALESCE(a.outstanding_amount,0),COALESCE(aa.paid,0))
 FROM inv iv LEFT JOIN erp.ar_open_items a ON a.sales_invoice_id=iv.id AND a.entity_id=iv.entity_id AND a.site_id=iv.site_id
 LEFT JOIN allocation_by_ar aa ON aa.ar_id=a.id
 WHERE iv.status IN ('POSTED','PARTIALLY_PAID','PAID') AND
  (a.id IS NULL OR ABS(iv.total_amount-a.original_amount)>0.02
   OR ABS(iv.paid_amount-COALESCE(aa.paid,0))>0.02
   OR ABS(a.outstanding_amount-(iv.total_amount-iv.paid_amount))>0.02
   OR (iv.status='PAID' AND a.outstanding_amount>0.02)
   OR (iv.status='POSTED' AND iv.paid_amount>0.02))
 UNION ALL
 SELECT 'RECEIPT_ALLOCATION_TOTAL',r.document_no,
        format('receipt amount %s allocations %s line count %s',r.amount,a.amount,a.lines)
 FROM receipt r JOIN receipt_alloc a ON a.receipt_id=r.id
 WHERE a.lines=0 OR ABS(r.amount-a.amount)>0.01
 UNION ALL
 SELECT 'RECEIPT_GL',r.document_no,
        format('receipt amount %s journal count %s debit %s credit %s bank debit %s AR credit %s',
          r.amount,g.posted_count,g.debit,g.credit,g.bank_debit,g.ar_credit)
 FROM receipt r JOIN receipt_gl g ON g.receipt_id=r.id
 WHERE g.posted_count<>1 OR ABS(g.debit-g.credit)>0.01 OR ABS(g.debit-r.amount)>0.02
   OR ABS(g.bank_debit-r.amount)>0.02 OR ABS(g.ar_credit-r.amount)>0.02
 UNION ALL
 SELECT 'RECEIPT_SCOPE_MISMATCH',r.document_no,
        format('receipt customer/site %s/%s conflicts with allocation AR',r.customer_id,r.site_id)
 FROM receipt r JOIN erp.customer_receipt_allocations ra ON ra.customer_receipt_id=r.id
 JOIN erp.ar_open_items a ON a.id=ra.ar_open_item_id
 WHERE r.entity_id<>a.entity_id OR r.site_id<>a.site_id OR r.customer_id<>a.customer_id
 UNION ALL
 SELECT 'RECEIPT_DUP_BANK_REF',MAX(r.document_no),
        format('same bank reference %s is used by %s POSTED receipts',r.external_reference,COUNT(*))
 FROM receipt r WHERE NULLIF(BTRIM(r.external_reference),'') IS NOT NULL
 GROUP BY r.bank_account_id,r.external_reference HAVING COUNT(*)>1
),
result AS (
 SELECT COUNT(*) AS n,COALESCE(jsonb_agg(jsonb_build_object('code',code,'document',document_no,'detail',detail)
       ORDER BY code,document_no),'[]'::jsonb) AS findings FROM issues
)
SELECT n AS d3f_findings,CASE WHEN n>0 THEN 'true' ELSE 'false' END AS d3f_has_issues,
       findings::text AS d3f_findings_json FROM result
\gset
SELECT jsonb_pretty(:'d3f_findings_json'::jsonb) AS findings;
\echo -----------------------------------------------------------------------------
\echo TOTAL FINDINGS: :d3f_findings
ROLLBACK;
\if :d3f_has_issues
\echo D3F_RESULT:FAIL
\else
\echo D3F_RESULT:PASS
\endif
