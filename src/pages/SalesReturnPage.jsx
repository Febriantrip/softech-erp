import React, { useMemo, useState } from 'react';
import { BadgeDollarSign, Boxes, ClipboardCheck, PackageCheck, RotateCcw, Search, ShieldCheck, Trash2 } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import Modal from '../components/Modal';
import StatusPill from '../components/StatusPill';
import AuditTimeline from '../components/AuditTimeline';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, dateTimeLabel, money, number, statusTone } from '../utils/erp';

function CreateReturnModal({ open, onClose, data, onCreate }) {
  const eligible = data.salesOrders.filter((row) => ['Shipped','Partially Shipped','Delivered','Invoiced','Closed'].includes(row.status) && row.lines.some((line) => Number(line.shipped || 0) > 0));
  const [salesOrderId, setSalesOrderId] = useState(eligible[0]?.id || '');
  const [reason, setReason] = useState('Customer return after delivery inspection.');
  const selected = data.salesOrders.find((row) => row.id === salesOrderId);
  const buildLines = (order) => (order?.lines || []).filter((line) => Number(line.shipped || 0) > 0).map((line) => ({ sku: line.sku, qty: Math.min(1, Number(line.shipped || 0)), disposition: 'Restock' }));
  const [lines, setLines] = useState(buildLines(selected));

  React.useEffect(() => {
    if (!open) return;
    const first = eligible[0]?.id || '';
    setSalesOrderId(first);
    setLines(buildLines(data.salesOrders.find((row) => row.id === first)));
    setReason('Customer return after delivery inspection.');
  }, [open]);

  const switchOrder = (id) => { setSalesOrderId(id); setLines(buildLines(data.salesOrders.find((row) => row.id === id))); };
  const total = lines.reduce((sum, line) => { const src = selected?.lines.find((row) => row.sku === line.sku); const item = data.items.find((row) => row.sku === line.sku); return sum + Number(line.qty || 0) * Number(src?.price || 0) * (1 + Number(item?.taxRate || 0) / 100); }, 0);

  return <Modal open={open} onClose={onClose} title="New Sales Return" subtitle="Buat RMA dari order yang sudah shipped/delivered. Qty return tidak boleh melebihi shipped quantity yang belum pernah direturn." wide footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!salesOrderId || !lines.some((line) => Number(line.qty) > 0)} onClick={() => { const id = onCreate({ salesOrderId, reason, lines }); if (id) onClose(); }}>Create Draft</button></>}>
    <div className="form-grid">
      <label className="field"><span>Source Sales Order</span><select value={salesOrderId} onChange={(e) => switchOrder(e.target.value)}>{eligible.map((row) => <option key={row.id} value={row.id}>{row.id} · {data.customers.find((x) => x.id === row.customerId)?.name}</option>)}</select></label>
      <label className="field"><span>Warehouse</span><input disabled value={data.warehouses.find((row) => row.id === selected?.warehouseId)?.name || '-'} /></label>
      <label className="field field--full"><span>Return Reason</span><textarea rows="3" value={reason} onChange={(e) => setReason(e.target.value)} /></label>
    </div>
    <div className="line-editor">{lines.map((line, index) => { const source = selected?.lines.find((row) => row.sku === line.sku); const item = data.items.find((row) => row.sku === line.sku); return <div className="line-editor-row" key={line.sku}>
      <div className="line-price"><span>Item</span><strong>{line.sku}</strong><small>{item?.name}</small></div>
      <label className="field"><span>Return Qty</span><input type="number" min="0" max={source?.shipped || 0} value={line.qty} onChange={(e) => setLines((prev) => prev.map((row, i) => i === index ? { ...row, qty: e.target.value } : row))}/></label>
      <div className="line-price"><span>Shipped</span><strong>{number(source?.shipped || 0)} {item?.uom}</strong></div>
      <div className="line-price"><span>Unit Price</span><strong>{money(source?.price || 0)}</strong></div>
      <button className="icon-btn danger-soft" onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}><Trash2 size={14}/></button>
    </div>; })}</div>
    <div className="modal-total"><span>Estimated Credit Incl. Tax</span><strong>{money(total)}</strong></div>
  </Modal>;
}

export default function SalesReturnPage() {
  const { data, createSalesReturn, submitSalesReturn, approveSalesReturn, receiveSalesReturn, updateSalesReturnDisposition, postSalesReturn } = useERPData();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(data.salesReturns[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const rows = useMemo(() => data.salesReturns.filter((row) => `${row.id} ${row.documentNo} ${row.status} ${data.customers.find((x) => x.id === row.customerId)?.name || ''}`.toLowerCase().includes(query.toLowerCase())), [data.salesReturns, data.customers, query]);
  const selected = data.salesReturns.find((row) => row.id === selectedId) || data.salesReturns[0];
  const customer = data.customers.find((row) => row.id === selected?.customerId);
  const warehouse = data.warehouses.find((row) => row.id === selected?.warehouseId);
  const gross = selected?.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0) * (1 + Number(line.taxRate || 0) / 100), 0) || 0;
  const quarantine = selected?.lines.reduce((sum, line) => sum + Number(line.receivedQty || 0), 0) || 0;
  const restock = selected?.lines.filter((line) => line.disposition === 'Restock').reduce((sum, line) => sum + Number(line.receivedQty || 0), 0) || 0;
  const damaged = selected?.lines.filter((line) => line.disposition === 'Damaged').reduce((sum, line) => sum + Number(line.receivedQty || 0), 0) || 0;
  const creditNote = data.salesCreditNotes.find((row) => row.id === selected?.creditNoteId);

  return <>
    <PageHeader eyebrow="Distribution / Reverse Logistics" title="Sales Return & RMA" description="Governed customer return dari delivered sales order, quarantine receiving, quality disposition, restock COGS reversal, dan credit note posting." actionLabel="Sales Return Baru" onAction={() => setCreateOpen(true)} />
    {!selected ? <div className="surface-card empty-state-large">Belum ada Sales Return.</div> : <div className="document-layout">
      <aside className="surface-card document-list-pane"><div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari return, customer, status..."/></label><span>{rows.length} return</span></div><div className="document-list">{rows.map((row) => <button key={row.id} className={`document-row ${selected.id === row.id ? 'active' : ''}`} onClick={() => setSelectedId(row.id)}><div className="document-row__top"><strong>{row.id}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{data.customers.find((x) => x.id === row.customerId)?.name || row.customerId}</span><div className="document-row__meta"><small>{dateLabel(row.date)}</small><strong>{money(row.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0), 0))}</strong></div></button>)}</div></aside>
      <section className="document-workspace">
        <div className="surface-card document-hero"><div className="document-hero__top"><div><div className="doc-kicker">RMA · {selected.documentNo || selected.id}</div><h2>{selected.id}</h2><p>{customer?.name} · {warehouse?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{selected.status === 'Draft' && <button className="btn btn-primary" onClick={() => submitSalesReturn(selected.id)}><ShieldCheck size={14}/> Submit Approval</button>}{selected.status === 'Pending Approval' && <button className="btn btn-primary" onClick={() => approveSalesReturn(selected.id)}><ClipboardCheck size={14}/> Approve</button>}{selected.status === 'Approved' && <button className="btn btn-primary" onClick={() => receiveSalesReturn(selected.id)}><Boxes size={14}/> Receive to Quarantine</button>}{selected.status === 'Quarantine Received' && <button className="btn btn-primary" onClick={() => postSalesReturn(selected.id)}><BadgeDollarSign size={14}/> Post Credit Note</button>}</div></div></div><div className="doc-summary-grid"><div><RotateCcw size={15}/><span>Source SO</span><strong>{selected.salesOrderId}</strong></div><div><Boxes size={15}/><span>Quarantine Qty</span><strong>{number(quarantine)}</strong></div><div><PackageCheck size={15}/><span>Restock Qty</span><strong>{number(restock)}</strong></div><div><BadgeDollarSign size={15}/><span>Credit Value</span><strong>{money(gross)}</strong></div></div></div>
        <div className="finance-mini-strip"><div><span>Requested Qty</span><strong>{number(selected.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0))}</strong></div><div><span>Restock</span><strong>{number(restock)}</strong></div><div><span>Damaged</span><strong>{number(damaged)}</strong></div><div><span>Credit Note</span><strong>{creditNote?.id || '-'}</strong></div></div>
        <div className="document-content-grid"><section className="surface-card document-section"><header><div><h3>Return Lines & Inspection</h3><p>Return masuk quarantine terlebih dahulu. Hanya disposition Restock yang menjadi available stock lagi.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>SKU</th><th>Item</th><th>Requested</th><th>Received</th><th>Lot</th><th>Disposition</th><th>Unit Price</th><th>Unit Cost</th></tr></thead><tbody>{selected.lines.map((line) => { const item = data.items.find((row) => row.sku === line.sku); return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{number(line.qty)}</td><td>{number(line.receivedQty)}</td><td>{line.lot || '-'}</td><td>{selected.status === 'Quarantine Received' ? <select className="table-input" value={line.disposition || 'Restock'} onChange={(e) => updateSalesReturnDisposition(selected.id, line.sku, e.target.value)}><option>Restock</option><option>Damaged</option></select> : <StatusPill tone={line.disposition === 'Damaged' ? 'danger' : 'success'}>{line.disposition}</StatusPill>}</td><td>{money(line.unitPrice)}</td><td>{money(line.unitCost)}</td></tr>; })}</tbody></table></div></section><aside className="document-side-stack"><section className="surface-card document-section compact-info"><header><div><h3>Financial Effect</h3><p>Credit note dan restock accounting.</p></div></header><div className="related-row static"><div><span>Sales Invoice</span><strong>{selected.salesInvoiceId || 'No posted invoice'}</strong></div></div><div className="related-row static"><div><span>Customer Credit</span><strong>{creditNote ? money(creditNote.total) : '-'}</strong></div></div><div className="related-row static"><div><span>Credit Status</span><strong>{creditNote?.status || '-'}</strong></div></div></section><section className="surface-card document-section compact-info"><header><div><h3>Audit Trail</h3><p>RMA, approval, warehouse, finance.</p></div></header><AuditTimeline items={selected.audit || []}/></section></aside></div>
      </section>
    </div>}
    <CreateReturnModal open={createOpen} onClose={() => setCreateOpen(false)} data={data} onCreate={(payload) => { const id = createSalesReturn(payload); if (id) setSelectedId(id); return id; }}/>
  </>;
}
