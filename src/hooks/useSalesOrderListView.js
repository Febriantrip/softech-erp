import { useEffect, useMemo, useState } from 'react';

export const SALES_ORDER_PAGE_SIZE = 10;

export const emptySalesOrderFilters = () => ({
  query: '',
  status: 'ALL',
  customer: 'ALL',
  warehouse: 'ALL',
  tax: 'ALL',
  dateFrom: '',
  dateTo: '',
  sort: 'NEWEST',
});

const asDateKey = (value) => String(value || '').slice(0, 10);

export function useSalesOrderListView(rows = []) {
  const [filters, setFilters] = useState(emptySalesOrderFilters);
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    const list = rows.filter((row) => {
      if (q) {
        const haystack = [
          row.documentNo,
          row.customerCode,
          row.customerName,
          row.warehouseCode,
          row.customerPo,
          row.paymentTerms,
          row.status,
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (filters.status !== 'ALL' && row.status !== filters.status) return false;
      if (filters.customer !== 'ALL' && row.customerCode !== filters.customer) return false;
      if (filters.warehouse !== 'ALL' && row.warehouseCode !== filters.warehouse) return false;
      if (filters.tax === 'TAXED' && Number(row.tax || 0) <= 0) return false;
      if (filters.tax === 'NON_TAX' && Number(row.tax || 0) > 0) return false;
      const orderDate = asDateKey(row.orderDate);
      if (filters.dateFrom && orderDate < filters.dateFrom) return false;
      if (filters.dateTo && orderDate > filters.dateTo) return false;
      return true;
    });

    return [...list].sort((a, b) => {
      switch (filters.sort) {
        case 'OLDEST': return asDateKey(a.orderDate).localeCompare(asDateKey(b.orderDate));
        case 'TOTAL_DESC': return Number(b.total || 0) - Number(a.total || 0);
        case 'TOTAL_ASC': return Number(a.total || 0) - Number(b.total || 0);
        case 'DOCUMENT_ASC': return String(a.documentNo || '').localeCompare(String(b.documentNo || ''));
        default: return asDateKey(b.orderDate).localeCompare(asDateKey(a.orderDate)) || String(b.documentNo || '').localeCompare(String(a.documentNo || ''));
      }
    });
  }, [rows, filters]);

  useEffect(() => { setPage(1); }, [filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / SALES_ORDER_PAGE_SIZE));
  useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

  const pagedRows = useMemo(() => {
    const start = (page - 1) * SALES_ORDER_PAGE_SIZE;
    return filteredRows.slice(start, start + SALES_ORDER_PAGE_SIZE);
  }, [filteredRows, page]);

  return {
    filters,
    setFilters,
    resetFilters: () => setFilters(emptySalesOrderFilters()),
    filteredRows,
    pagedRows,
    page,
    setPage,
    totalPages,
    pageSize: SALES_ORDER_PAGE_SIZE,
  };
}
