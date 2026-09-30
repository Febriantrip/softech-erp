import React, { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Database, RefreshCw, Send, ShieldCheck, Truck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import SalesOrderActionButtons from '../components/sales-order/SalesOrderActionButtons';
import SalesOrderEditor, { emptySalesOrder } from '../components/sales-order/SalesOrderEditor';
import SalesOrderDetailModal from '../components/sales-order/SalesOrderDetailModal';
import SalesOrderListToolbar from '../components/sales-order/SalesOrderListToolbar';
import { coreApi } from '../api/core';
import { useCoreBootstrap, useCoreList } from '../hooks/useCoreWorkspace';
import { useSalesOrderListView } from '../hooks/useSalesOrderListView';
import { dateLabel, money, statusTone } from '../utils/erp';

export default function ApiSalesOrderPage() {
  const navigate = useNavigate();
  const loader = useCallback((scope) => coreApi.salesOrders(scope), []);
  const { scope, rows, loading, error, refresh } = useCoreList(loader);
  const masters = useCoreBootstrap();
  const listView = useSalesOrderListView(rows);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState(emptySalesOrder());

  const total = rows.reduce((sum, row) => sum + Number(row.total || 0), 0);
  const taxTotal = rows.reduce((sum, row) => sum + Number(row.tax || 0), 0);
  const reserved = rows.filter((row) => row.status === 'RESERVED').length;
  const shipped = rows.filter((row) => row.status === 'SHIPPED').length;

  const openCreate = () => {
    setEditing(null);
    setForm(emptySalesOrder(masters.data || {}));
    setEditorOpen(true);
  };

  const loadDetail = async (row, open = true) => {
    if (!scope || !row?.id) return null;
    setBusy(`${row.id}:detail`);
    setMessage('');
    try {
      const loaded = await coreApi.salesOrder(scope, row.id);
      setDetail(loaded);
      if (open) setDetailOpen(true);
      return loaded;
    } catch (e) {
      setMessage(e.message);
      return null;
    } finally {
      setBusy('');
    }
  };

  const openEdit = async (row) => {
    const loaded = await loadDetail(row, false);
    if (!loaded) return;
    setEditing(row);
    setForm({
      customerCode: loaded.customer?.code || '',
      warehouseCode: loaded.warehouse?.code || '',
      orderDate: String(loaded.orderDate || '').slice(0, 10),
      requestedDeliveryDate: loaded.requestedDeliveryDate ? String(loaded.requestedDeliveryDate).slice(0, 10) : '',
      customerPo: loaded.customerPo || '',
      paymentTerms: loaded.paymentTerms || '',
      billingAddress: loaded.billingAddress || '',
      shippingAddress: loaded.shippingAddress || '',
      salesperson: loaded.salesperson || '',
      notes: loaded.notes || '',
      internalNotes: loaded.internalNotes || '',
      revisionNo: Number(loaded.revisionNo || 0),
      lines: (loaded.lines || []).map((line) => ({
        sku: line.sku,
        description: line.description || '',
        qty: line.qty,
        unitPrice: line.unitPrice,
        discountPercent: line.discountPercent || 0,
        taxCode: line.taxCode || '',
      })),
    });
    setEditorOpen(true);
  };

  const payload = () => ({
    ...form,
    ...(!editing && scope?.siteCode ? { siteCode: scope.siteCode } : {}),
    revisionNo: editing ? Number(form.revisionNo || 0) : undefined,
    lines: form.lines.map((line) => ({
      ...line,
      qty: Number(line.qty),
      unitPrice: Number(line.unitPrice || 0),
      discountPercent: Number(line.discountPercent || 0),
    })),
  });

  const save = async () => {
    if (!scope) return;
    setBusy(editing ? 'edit' : 'create');
    setMessage('');
    try {
      const result = editing
        ? await coreApi.updateSalesOrder(scope, editing.id, payload())
        : await coreApi.createSalesOrder(scope, payload());
      setMessage(`${result.documentNo || editing?.documentNo} ${editing ? 'updated' : 'created'} in PostgreSQL`);
      setEditorOpen(false);
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  const run = async (row, action) => {
    if (!scope) return;
    setBusy(`${row.id}:${action}`);
    setMessage('');
    try {
      const result = await coreApi.salesAction(scope, row.id, action);
      setMessage(`${result.documentNo || row.documentNo} → ${result.status}`);
      await refresh();
      if (detailOpen && detail?.id === row.id) {
        const refreshed = await coreApi.salesOrder(scope, row.id);
        setDetail(refreshed);
      }
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  const createPicking = async (row) => {
    if (!scope || !row?.id) return;
    setBusy(`${row.id}:picking`);
    setMessage('');
    try {
      const result = await coreApi.createPickingOrder(scope, row.id);
      setMessage(`${result.documentNo} created from ${row.documentNo}`);
      setDetailOpen(false);
      navigate('/transactions/distribution/picking-order');
    } catch (e) {
      setMessage(e.message);
      await refresh();
      if (detailOpen && detail?.id === row.id) {
        const refreshed = await coreApi.salesOrder(scope, row.id).catch(() => null);
        if (refreshed) setDetail(refreshed);
      }
    } finally {
      setBusy('');
    }
  };

  const remove = async (row) => {
    if (!scope || !window.confirm(`Hapus draft ${row.documentNo}? Tindakan ini tidak dapat dibatalkan.`)) return false;
    setBusy(`${row.id}:delete`);
    setMessage('');
    try {
      await coreApi.deleteSalesOrder(scope, row.id);
      setMessage(`${row.documentNo} deleted`);
      await refresh();
      return true;
    } catch (e) {
      setMessage(e.message);
      return false;
    } finally {
      setBusy('');
    }
  };

  const requestCancel = (row) => {
    setDetailOpen(false);
    setCancelTarget(row);
  };

  const cancel = async () => {
    if (!scope || !cancelTarget || !cancelReason.trim()) return;
    setBusy(`${cancelTarget.id}:cancel`);
    setMessage('');
    try {
      await coreApi.cancelSalesOrder(scope, cancelTarget.id, cancelReason.trim());
      setMessage(`${cancelTarget.documentNo} cancelled`);
      setCancelTarget(null);
      setCancelReason('');
      await refresh();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setBusy('');
    }
  };

  const columns = [
    { key: 'documentNo', label: 'Sales Order', render: (value, row) => <button className="table-link so-doc-link" onClick={() => loadDetail(row)}><strong>{value}</strong><small>{row.customerPo || 'No customer PO'}</small></button> },
    { key: 'orderDate', label: 'Date', render: (value) => dateLabel(value) },
    { key: 'customerName', label: 'Customer' },
    { key: 'warehouseCode', label: 'Warehouse' },
    { key: 'dpp', label: 'DPP', render: (value) => money(value) },
    { key: 'tax', label: 'PPN', render: (value) => money(value) },
    { key: 'total', label: 'Grand Total', render: (value) => <strong>{money(value)}</strong> },
    { key: 'status', label: 'Status', render: (value) => <StatusPill tone={statusTone(value)}>{value}</StatusPill> },
    { key: 'action', label: 'Action', render: (_, row) => <SalesOrderActionButtons order={row} busy={busy.startsWith(row.id)} onDetail={loadDetail} onEdit={openEdit} onDelete={remove} onTransition={run} onCancel={requestCancel} onCreatePicking={createPicking}/> },
  ];

  const pageStart = listView.filteredRows.length === 0 ? 0 : (listView.page - 1) * listView.pageSize + 1;
  const pageEnd = Math.min(listView.page * listView.pageSize, listView.filteredRows.length);

  return <>
    <PageHeader eyebrow="Production Core / Sales" title="Sales Order · Detailed PostgreSQL" description="PPN/DPP, discount, controlled lifecycle, tax summary, fulfillment, approval, related documents, dan audit trail dari PostgreSQL." actionLabel="Sales Order Baru" onAction={openCreate}/>
    <div className="v11-mode-banner"><Database size={16}/><div><strong>POSTGRESQL SOURCE OF TRUTH</strong><span>{scope ? `${scope.entityCode}${scope.siteCode ? ` · ${scope.siteCode}` : ' · All Sites'}` : 'Select legal entity'} · seluruh total dihitung ulang oleh backend.</span></div><button className="btn btn-sm" onClick={refresh} disabled={loading}><RefreshCw size={13}/> Refresh</button></div>
    {message && <div className="v10-inline-note"><strong>Sales Order</strong><span>{message}</span></div>}
    {error && <div className="v10-inline-note warning"><strong>API unavailable</strong><span>{error}</span></div>}

    <div className="stats-grid"><StatCard title="Sales Orders" value={String(rows.length)} hint="PostgreSQL documents" icon={Database}/><StatCard title="Order Value" value={money(total)} hint="grand total" icon={Send}/><StatCard title="PPN / Tax" value={money(taxTotal)} hint="current scope" icon={ShieldCheck}/><StatCard title="Reserved / Shipped" value={`${reserved} / ${shipped}`} hint="fulfillment lifecycle" icon={Truck}/></div>

    <SectionCard title="Detailed Sales Orders" subtitle="Filter, cari, urutkan, lalu buka dokumen untuk detail transaksi lengkap.">
      <SalesOrderListToolbar rows={rows} filters={listView.filters} setFilters={listView.setFilters} resetFilters={listView.resetFilters} resultCount={listView.filteredRows.length}/>
      <DataTable rows={listView.pagedRows} columns={columns} emptyText={loading ? 'Memuat data dari PostgreSQL...' : 'Tidak ada Sales Order yang cocok dengan filter.'}/>
      <div className="so-pagination"><span>{pageStart}-{pageEnd} dari {listView.filteredRows.length}</span><div><button className="icon-btn" disabled={listView.page <= 1} onClick={() => listView.setPage((page) => Math.max(1, page - 1))}><ChevronLeft size={15}/></button><strong>{listView.page} / {listView.totalPages}</strong><button className="icon-btn" disabled={listView.page >= listView.totalPages} onClick={() => listView.setPage((page) => Math.min(listView.totalPages, page + 1))}><ChevronRight size={15}/></button></div></div>
    </SectionCard>

    <Modal open={editorOpen} onClose={() => setEditorOpen(false)} title={editing ? `Edit ${editing.documentNo}` : 'Create Detailed Sales Order'} subtitle={editing ? 'Hanya draft yang dapat diedit. Semua total dihitung ulang server-side.' : 'Nomor dokumen dibuat atomic oleh PostgreSQL.'} wide footer={<><button className="btn" onClick={() => setEditorOpen(false)}>Batal</button><button className="btn btn-primary" disabled={Boolean(busy) || !form.customerCode || !form.warehouseCode || form.lines.some((line) => !line.sku || Number(line.qty) <= 0)} onClick={save}>{editing ? 'Simpan Perubahan' : 'Create in PostgreSQL'}</button></>}><SalesOrderEditor form={form} setForm={setForm} masters={masters.data || {}}/></Modal>

    <SalesOrderDetailModal
      open={detailOpen}
      onClose={() => setDetailOpen(false)}
      detail={detail}
      busy={Boolean(busy)}
      onEdit={async (row) => { setDetailOpen(false); await openEdit(row); }}
      onDelete={async (row) => { if (await remove(row)) setDetailOpen(false); }}
      onTransition={run}
      onCancel={requestCancel}
      onCreatePicking={createPicking}
    />

    <Modal open={Boolean(cancelTarget)} onClose={() => setCancelTarget(null)} title={`Cancel ${cancelTarget?.documentNo || ''}`} subtitle="Cancel tidak menghapus audit trail. Reserved stock akan dilepas otomatis." footer={<><button className="btn" onClick={() => setCancelTarget(null)}>Kembali</button><button className="btn btn-primary" disabled={!cancelReason.trim() || Boolean(busy)} onClick={cancel}>Confirm Cancel</button></>}><label className="field"><span>Alasan pembatalan</span><textarea rows="4" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Wajib diisi untuk audit trail"/></label></Modal>
  </>;
}
