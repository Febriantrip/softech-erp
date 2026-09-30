import React, { useMemo, useState } from 'react';
import { Calculator, CheckCircle2, ClipboardCheck, Search, ShieldCheck, TriangleAlert, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import AuditTimeline from '../components/AuditTimeline';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, dateTimeLabel, money, number, statusTone } from '../utils/erp';

function CreateStockTakeModal({ open, onClose, data, onCreate }) {
  const [warehouseId, setWarehouseId] = useState(data.warehouses[0]?.id || '');
  const [scope, setScope] = useState('Cycle Count · All Active SKU');
  React.useEffect(() => { if (open) { setWarehouseId(data.warehouses[0]?.id || ''); setScope('Cycle Count · All Active SKU'); } }, [open, data.warehouses]);
  const skuCount = data.inventory.filter((row) => row.warehouseId === warehouseId).length;
  return <Modal open={open} onClose={onClose} title="Open Stock Take" subtitle="Snapshot system quantity lalu lakukan count, approval variance, dan GL posting." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" onClick={() => { const id = onCreate({ warehouseId, scope }); if (id) onClose(); }}>Open Count Sheet</button></>}>
    <div className="form-grid"><label className="field"><span>Warehouse</span><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="field"><span>Count Scope</span><select value={scope} onChange={(e) => setScope(e.target.value)}><option>Cycle Count · All Active SKU</option><option>Full Stock Opname</option><option>Fast Moving Review</option><option>High Value Review</option></select></label></div>
    <div className="inventory-count-preview"><ClipboardCheck size={18}/><div><strong>{skuCount} SKU akan disnapshot</strong><span>System quantity tidak berubah sampai variance disetujui dan diposting.</span></div></div>
  </Modal>;
}

export default function StockTakePage() {
  const { data, createStockTake, updateStockTakeLine, submitStockTake, approveStockTake, postStockTake } = useERPData();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(data.stockTakes[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);

  const docs = useMemo(() => data.stockTakes.filter((row) => `${row.id} ${row.scope} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [data.stockTakes, query]);
  const selected = data.stockTakes.find((row) => row.id === selectedId) || data.stockTakes[0];
  const warehouse = data.warehouses.find((row) => row.id === selected?.warehouseId);
  const counted = selected?.lines.filter((line) => line.countQty !== null && line.countQty !== undefined).length || 0;
  const totalLines = selected?.lines.length || 0;
  const netVariance = selected?.lines.reduce((sum, line) => sum + Number(line.variance || 0), 0) || 0;
  const varianceValue = selected?.lines.reduce((sum, line) => sum + Number(line.variance || 0) * Number(line.unitCost || 0), 0) || 0;
  const absVarianceValue = selected?.lines.reduce((sum, line) => sum + Math.abs(Number(line.variance || 0) * Number(line.unitCost || 0)), 0) || 0;
  const snapshotChanged = selected?.status === 'Approved' && selected.lines.some((line) => {
    const current = data.inventory.find((row) => row.warehouseId === selected.warehouseId && row.sku === line.sku);
    return Number(current?.onHand || 0) !== Number(line.systemQty || 0);
  });

  return <>
    <PageHeader eyebrow="Warehouse / Inventory Control" title="Stock Take & Cycle Count" description="Count sheet, system snapshot, variance approval, inventory adjustment, audit trail, dan automatic GL posting." actionLabel="Stock Take Baru" onAction={() => setCreateOpen(true)} />
    {!selected ? <div className="surface-card empty-state-large">Belum ada Stock Take.</div> : <div className="document-layout">
      <aside className="surface-card document-list-pane"><div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari stock take, scope, status..."/></label><span>{docs.length} count</span></div><div className="document-list">{docs.map((row) => <button key={row.id} className={`document-row ${selected.id === row.id ? 'active' : ''}`} onClick={() => setSelectedId(row.id)}><div className="document-row__top"><strong>{row.id}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{data.warehouses.find((w) => w.id === row.warehouseId)?.code} · {row.scope}</span><div className="document-row__meta"><small>{dateLabel(row.date)}</small><strong>{row.lines.length} SKU</strong></div></button>)}</div></aside>
      <section className="document-workspace">
        <div className="surface-card document-hero"><div className="document-hero__top"><div><div className="doc-kicker">INVENTORY CONTROL · {selected.scope}</div><h2>{selected.documentNo || selected.id}</h2><p>{warehouse?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{selected.status === 'Counting' && <button className="btn btn-primary" disabled={counted !== totalLines} onClick={() => submitStockTake(selected.id)}><ClipboardCheck size={14}/> Submit Count</button>}{selected.status === 'Pending Approval' && <button className="btn btn-primary" onClick={() => approveStockTake(selected.id)}><ShieldCheck size={14}/> Approve Variance</button>}{selected.status === 'Approved' && <button className="btn btn-primary" disabled={snapshotChanged} onClick={() => postStockTake(selected.id)}><CheckCircle2 size={14}/> Post Stock Take</button>}</div></div></div><div className="doc-summary-grid"><div><Warehouse size={15}/><span>Warehouse</span><strong>{warehouse?.code}</strong></div><div><ClipboardCheck size={15}/><span>Counted</span><strong>{counted}/{totalLines} SKU</strong></div><div><Calculator size={15}/><span>Net Variance</span><strong>{number(netVariance)}</strong></div><div><CheckCircle2 size={15}/><span>Posted</span><strong>{dateTimeLabel(selected.postedAt)}</strong></div></div></div>
        <div className="finance-mini-strip"><div><span>Count Progress</span><strong>{totalLines ? Math.round(counted / totalLines * 100) : 0}%</strong></div><div><span>Net Variance</span><strong>{netVariance > 0 ? '+' : ''}{number(netVariance)}</strong></div><div><span>Net Value Impact</span><strong className={varianceValue < 0 ? 'negative-number' : 'positive-number'}>{money(varianceValue)}</strong></div><div><span>Absolute Variance</span><strong>{money(absVarianceValue)}</strong></div></div>
        {snapshotChanged && <div className="surface-card inventory-warning"><TriangleAlert size={18}/><div><strong>POSTING BLOCKED · SNAPSHOT CHANGED</strong><span>On-hand inventory berubah setelah count snapshot dibuat. Untuk menjaga auditability, Stock Take ini tidak boleh diposting. Buat Stock Take baru agar system quantity diambil ulang.</span></div></div>}
        <div className="document-content-grid">
          <section className="surface-card document-section"><header><div><h3>Count Sheet</h3><p>Count quantity hanya editable selama status Counting.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>SKU</th><th>Item</th><th>System Qty</th><th>Count Qty</th><th>Variance</th><th>Unit Cost</th><th>Value Impact</th></tr></thead><tbody>{selected.lines.map((line) => { const item = data.items.find((row) => row.sku === line.sku); const value = Number(line.variance || 0) * Number(line.unitCost || 0); return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{number(line.systemQty)}</td><td>{selected.status === 'Counting' ? <input className="table-input" type="number" min="0" value={line.countQty ?? ''} onChange={(e) => updateStockTakeLine(selected.id, line.sku, e.target.value)}/> : number(line.countQty)}</td><td><strong className={Number(line.variance) < 0 ? 'negative-number' : Number(line.variance) > 0 ? 'positive-number' : ''}>{Number(line.variance) > 0 ? '+' : ''}{number(line.variance)}</strong></td><td>{money(line.unitCost)}</td><td className={value < 0 ? 'negative-number' : value > 0 ? 'positive-number' : ''}>{money(value)}</td></tr>; })}</tbody></table></div></section>
          <aside className="document-side-stack"><section className="surface-card document-section compact-info"><header><div><h3>Control Status</h3><p>Variance tidak menyentuh stock sampai posting.</p></div></header><div className="related-row static"><div><span>Requested By</span><strong>{selected.requestedBy}</strong></div></div><div className="related-row static"><div><span>Approved By</span><strong>{selected.approvedBy || '-'}</strong></div></div><div className="related-row static"><div><span>GL Journal</span><strong>{selected.journalId || '-'}</strong></div></div></section><section className="surface-card document-section compact-info"><header><div><h3>Audit Trail</h3><p>Count, approval, dan posting history.</p></div></header><AuditTimeline items={selected.audit || []}/></section></aside>
        </div>
      </section>
    </div>}
    <CreateStockTakeModal open={createOpen} onClose={() => setCreateOpen(false)} data={data} onCreate={(payload) => { const id = createStockTake(payload); if (id) setSelectedId(id); return id; }}/>
  </>;
}
