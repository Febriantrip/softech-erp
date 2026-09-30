import React, { useMemo, useState } from 'react';
import { ArrowRight, ArrowRightLeft, CalendarDays, PackageCheck, Plus, Search, Trash2, Truck, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import AuditTimeline from '../components/AuditTimeline';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, dateTimeLabel, money, number, statusTone } from '../utils/erp';

function TransferModal({ open, onClose, data, onCreate }) {
  const first = data.warehouses[0]?.id || '';
  const second = data.warehouses.find((row) => row.id !== first)?.id || first;
  const blank = () => ({ sku: data.items[0]?.sku || '', qty: 1 });
  const [form, setForm] = useState({ fromWarehouseId: first, toWarehouseId: second, requestedBy: 'Inventory Planning', notes: '', lines: [blank()] });

  React.useEffect(() => {
    if (open) setForm({ fromWarehouseId: first, toWarehouseId: second, requestedBy: 'Inventory Planning', notes: '', lines: [blank()] });
  }, [open, first, second]);

  const setLine = (index, patch) => setForm((prev) => ({ ...prev, lines: prev.lines.map((line, i) => i === index ? { ...line, ...patch } : line) }));
  const transferValue = form.lines.reduce((sum, line) => {
    const stock = data.inventory.find((row) => row.warehouseId === form.fromWarehouseId && row.sku === line.sku);
    const item = data.items.find((row) => row.sku === line.sku);
    return sum + Number(line.qty || 0) * Number(stock?.avgCost || item?.standardCost || 0);
  }, 0);
  const invalid = !form.fromWarehouseId || !form.toWarehouseId || form.fromWarehouseId === form.toWarehouseId || !form.lines.some((line) => Number(line.qty) > 0);

  return <Modal open={open} onClose={onClose} title="New Inter-Site Transfer" subtitle="Transfer stock antar warehouse/site dengan in-transit control dan carrying cost." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={invalid} onClick={() => { const id = onCreate(form); if (id) onClose(); }}>Create Draft</button></>}>
    <div className="form-grid">
      <label className="field"><span>From Warehouse</span><select value={form.fromWarehouseId} onChange={(e) => setForm({ ...form, fromWarehouseId: e.target.value })}>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="field"><span>To Warehouse</span><select value={form.toWarehouseId} onChange={(e) => setForm({ ...form, toWarehouseId: e.target.value })}>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="field field--full"><span>Requested By</span><input value={form.requestedBy} onChange={(e) => setForm({ ...form, requestedBy: e.target.value })}/></label>
    </div>
    <div className="modal-line-head"><div><strong>Transfer Lines</strong><small>Release hanya bisa dilakukan jika available stock source mencukupi.</small></div><button className="btn btn-sm" onClick={() => setForm({ ...form, lines: [...form.lines, blank()] })}><Plus size={14}/> Item</button></div>
    <div className="line-editor">{form.lines.map((line, index) => {
      const item = data.items.find((row) => row.sku === line.sku);
      const stock = data.inventory.find((row) => row.warehouseId === form.fromWarehouseId && row.sku === line.sku);
      const available = Math.max(0, Number(stock?.onHand || 0) - Number(stock?.reserved || 0) - Number(stock?.qualityHold || 0));
      return <div className="line-editor-row" key={`${index}-${line.sku}`}>
        <label className="field"><span>Item</span><select value={line.sku} onChange={(e) => setLine(index, { sku: e.target.value })}>{data.items.map((row) => <option key={row.sku} value={row.sku}>{row.sku} · {row.name}</option>)}</select></label>
        <label className="field"><span>Qty</span><input type="number" min="1" value={line.qty} onChange={(e) => setLine(index, { qty: e.target.value })}/></label>
        <div className="line-price"><span>Available</span><strong>{number(available)} {item?.uom}</strong></div>
        <div className="line-price"><span>Avg Cost</span><strong>{money(stock?.avgCost || item?.standardCost || 0)}</strong></div>
        <button className="icon-btn danger-soft" disabled={form.lines.length === 1} onClick={() => setForm({ ...form, lines: form.lines.filter((_, i) => i !== index) })}><Trash2 size={14}/></button>
      </div>;
    })}</div>
    <label className="field"><span>Notes</span><textarea rows="3" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}/></label>
    <div className="modal-total"><span>Transfer Carrying Value</span><strong>{money(transferValue)}</strong></div>
  </Modal>;
}

export default function StockTransferPage() {
  const { data, createStockTransfer, releaseStockTransfer, receiveStockTransfer } = useERPData();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(data.stockTransfers[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);

  const docs = useMemo(() => data.stockTransfers.filter((row) => {
    const from = data.warehouses.find((w) => w.id === row.fromWarehouseId)?.code || '';
    const to = data.warehouses.find((w) => w.id === row.toWarehouseId)?.code || '';
    return `${row.id} ${row.status} ${from} ${to}`.toLowerCase().includes(query.toLowerCase());
  }), [data.stockTransfers, data.warehouses, query]);
  const selected = data.stockTransfers.find((row) => row.id === selectedId) || data.stockTransfers[0];
  const from = data.warehouses.find((row) => row.id === selected?.fromWarehouseId);
  const to = data.warehouses.find((row) => row.id === selected?.toWarehouseId);
  const totalQty = selected?.lines.reduce((sum, line) => sum + Number(line.qty || 0), 0) || 0;
  const shippedQty = selected?.lines.reduce((sum, line) => sum + Number(line.shippedQty || 0), 0) || 0;
  const receivedQty = selected?.lines.reduce((sum, line) => sum + Number(line.receivedQty || 0), 0) || 0;
  const carryingValue = selected?.lines.reduce((sum, line) => sum + Number(line.shippedQty || line.qty || 0) * Number(line.unitCost || 0), 0) || 0;
  const releaseBlocked = selected?.status === 'Draft' && selected.lines.some((line) => {
    const stock = data.inventory.find((row) => row.warehouseId === selected.fromWarehouseId && row.sku === line.sku);
    return Math.max(0, Number(stock?.onHand || 0) - Number(stock?.reserved || 0) - Number(stock?.qualityHold || 0)) < Number(line.qty || 0);
  });

  return <>
    <PageHeader eyebrow="Warehouse / Inventory Control" title="Inter-Site Stock Transfer" description="Transfer antar warehouse dengan source availability check, in-transit visibility, receiving, movement ledger, dan carrying cost." actionLabel="Transfer Baru" onAction={() => setCreateOpen(true)} />
    {!selected ? <div className="surface-card empty-state-large">Belum ada Stock Transfer.</div> : <div className="document-layout">
      <aside className="surface-card document-list-pane">
        <div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari transfer, site, status..."/></label><span>{docs.length} transfer</span></div>
        <div className="document-list">{docs.map((row) => {
          const rowFrom = data.warehouses.find((w) => w.id === row.fromWarehouseId)?.code;
          const rowTo = data.warehouses.find((w) => w.id === row.toWarehouseId)?.code;
          return <button key={row.id} className={`document-row ${selected.id === row.id ? 'active' : ''}`} onClick={() => setSelectedId(row.id)}><div className="document-row__top"><strong>{row.id}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{rowFrom} → {rowTo}</span><div className="document-row__meta"><small>{dateLabel(row.date)}</small><strong>{number(row.lines.reduce((s, l) => s + Number(l.qty || 0), 0))} qty</strong></div></button>;
        })}</div>
      </aside>

      <section className="document-workspace">
        <div className="surface-card document-hero">
          <div className="document-hero__top"><div><div className="doc-kicker">INTER-SITE · {from?.site} → {to?.site}</div><h2>{selected.id}</h2><p>{from?.name} → {to?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{selected.status === 'Draft' && <button className="btn btn-primary" disabled={releaseBlocked} onClick={() => releaseStockTransfer(selected.id)}><Truck size={14}/> Release Transfer</button>}{selected.status === 'In Transit' && <button className="btn btn-primary" onClick={() => receiveStockTransfer(selected.id)}><PackageCheck size={14}/> Receive Transfer</button>}</div></div></div>
          <div className="doc-summary-grid"><div><CalendarDays size={15}/><span>Transfer Date</span><strong>{dateLabel(selected.date)}</strong></div><div><Warehouse size={15}/><span>Source</span><strong>{from?.code}</strong></div><div><ArrowRightLeft size={15}/><span>Destination</span><strong>{to?.code}</strong></div><div><Truck size={15}/><span>Released</span><strong>{dateTimeLabel(selected.releasedAt)}</strong></div></div>
        </div>
        {releaseBlocked && <div className="surface-card inventory-warning"><strong>Release blocked</strong><span>Ada line yang melebihi available stock setelah reservation. Kurangi qty atau replenishment source warehouse.</span></div>}
        <div className="finance-mini-strip"><div><span>Requested Qty</span><strong>{number(totalQty)}</strong></div><div><span>Shipped Qty</span><strong>{number(shippedQty)}</strong></div><div><span>Received Qty</span><strong>{number(receivedQty)}</strong></div><div><span>Carrying Value</span><strong>{money(carryingValue)}</strong></div></div>
        <div className="document-content-grid">
          <section className="surface-card document-section"><header><div><h3>Transfer Lines</h3><p>Stock source keluar saat Release. Destination on-hand bertambah saat Receive.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>SKU</th><th>Item</th><th>Requested</th><th>Shipped</th><th>Received</th><th>UOM</th><th>Avg Cost</th><th>Line Value</th></tr></thead><tbody>{selected.lines.map((line) => { const item = data.items.find((row) => row.sku === line.sku); return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{number(line.qty)}</td><td>{number(line.shippedQty)}</td><td>{number(line.receivedQty)}</td><td>{item?.uom}</td><td>{money(line.unitCost)}</td><td>{money(Number(line.shippedQty || line.qty || 0) * Number(line.unitCost || 0))}</td></tr>; })}</tbody></table></div>
          </section>
          <aside className="document-side-stack"><section className="surface-card document-section compact-info"><header><div><h3>Movement Model</h3><p>Physical stock dan in-transit dipisahkan.</p></div></header><div className="transfer-route"><div><Warehouse size={17}/><strong>{from?.code}</strong><span>On Hand</span></div><ArrowRight size={16}/><div><Truck size={17}/><strong>In Transit</strong><span>{selected.status === 'In Transit' ? number(shippedQty) : '0'} qty</span></div><ArrowRight size={16}/><div><Warehouse size={17}/><strong>{to?.code}</strong><span>On Hand</span></div></div></section><section className="surface-card document-section compact-info"><header><div><h3>Audit Trail</h3><p>Release dan receiving traceability.</p></div></header><AuditTimeline items={selected.audit || []}/></section></aside>
        </div>
      </section>
    </div>}
    <TransferModal open={createOpen} onClose={() => setCreateOpen(false)} data={data} onCreate={(payload) => { const id = createStockTransfer(payload); if (id) setSelectedId(id); return id; }}/>
  </>;
}
