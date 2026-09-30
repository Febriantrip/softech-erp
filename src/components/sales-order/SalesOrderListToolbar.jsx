import React, { useMemo } from 'react';
import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';

const uniq = (rows, key) => [...new Map(rows.filter((r) => r[key]).map((r) => [r[key], r])).values()];

export default function SalesOrderListToolbar({ rows, filters, setFilters, resetFilters, resultCount }) {
  const statuses = useMemo(() => [...new Set(rows.map((r) => r.status).filter(Boolean))].sort(), [rows]);
  const customers = useMemo(() => uniq(rows, 'customerCode'), [rows]);
  const warehouses = useMemo(() => uniq(rows, 'warehouseCode'), [rows]);
  const patch = (key, value) => setFilters((prev) => ({ ...prev, [key]: value }));

  return <div className="so-list-toolbar">
    <div className="so-list-search"><Search size={15}/><input value={filters.query} onChange={(e) => patch('query', e.target.value)} placeholder="Cari SO, customer, PO, warehouse..."/></div>
    <div className="so-filter-grid">
      <label><span>Status</span><select value={filters.status} onChange={(e) => patch('status', e.target.value)}><option value="ALL">Semua</option>{statuses.map((v) => <option key={v} value={v}>{v}</option>)}</select></label>
      <label><span>Customer</span><select value={filters.customer} onChange={(e) => patch('customer', e.target.value)}><option value="ALL">Semua</option>{customers.map((r) => <option key={r.customerCode} value={r.customerCode}>{r.customerName}</option>)}</select></label>
      <label><span>Warehouse</span><select value={filters.warehouse} onChange={(e) => patch('warehouse', e.target.value)}><option value="ALL">Semua</option>{warehouses.map((r) => <option key={r.warehouseCode} value={r.warehouseCode}>{r.warehouseCode}</option>)}</select></label>
      <label><span>Pajak</span><select value={filters.tax} onChange={(e) => patch('tax', e.target.value)}><option value="ALL">Semua</option><option value="TAXED">Ada Pajak</option><option value="NON_TAX">Tanpa Pajak</option></select></label>
      <label><span>Dari</span><input type="date" value={filters.dateFrom} onChange={(e) => patch('dateFrom', e.target.value)}/></label>
      <label><span>Sampai</span><input type="date" value={filters.dateTo} onChange={(e) => patch('dateTo', e.target.value)}/></label>
      <label><span>Urutkan</span><select value={filters.sort} onChange={(e) => patch('sort', e.target.value)}><option value="NEWEST">Terbaru</option><option value="OLDEST">Terlama</option><option value="TOTAL_DESC">Total terbesar</option><option value="TOTAL_ASC">Total terkecil</option><option value="DOCUMENT_ASC">Nomor SO</option></select></label>
    </div>
    <div className="so-filter-footer"><span><SlidersHorizontal size={13}/> {resultCount} dari {rows.length} dokumen</span><button className="btn btn-sm" onClick={resetFilters}><RotateCcw size={13}/> Reset Filter</button></div>
  </div>;
}
