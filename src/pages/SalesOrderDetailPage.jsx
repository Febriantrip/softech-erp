import React, { useMemo, useState } from 'react';
import { CalendarDays, CircleDollarSign, CreditCard, MapPin, PackageCheck, Plus, Search, Trash2, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import AuditTimeline from '../components/AuditTimeline';
import DocumentLifecycle from '../components/DocumentLifecycle';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money, number, soTotal, statusTone } from '../utils/erp';

const lifecycle = ['Draft', 'Approval', 'Approved', 'Allocated', 'Picked', 'Delivery', 'Shipment', 'Delivered'];
const stepMap = {
  Draft: 0, 'Pending Approval': 1, 'Credit Hold': 1, Approved: 2,
  'Partially Allocated': 3, Allocated: 3, Picking: 4, 'Partially Picked': 4, Picked: 4,
  'Delivery Draft': 5, 'Ready to Ship': 5, 'Shipment Planned': 6, Shipped: 6, 'Partially Shipped': 6,
  Delivered: 7, 'Partially Delivered': 7
};

function NewSalesOrderModal({ open, onClose, onCreate, customers, items, warehouses }) {
  const [form, setForm] = useState(() => ({
    customerId: customers[0]?.id || '', warehouseId: warehouses[0]?.id || '',
    requestedDate: new Date(Date.now() + 86400000).toISOString().slice(0, 10), notes: '',
    lines: [{ sku: items[0]?.sku || '', qty: 1 }]
  }));

  const total = form.lines.reduce((sum, line) => {
    const item = items.find((row) => row.sku === line.sku);
    return sum + Number(line.qty || 0) * Number(item?.price || 0);
  }, 0);

  const updateLine = (index, patch) => setForm((prev) => ({ ...prev, lines: prev.lines.map((line, i) => i === index ? { ...line, ...patch } : line) }));
  const addLine = () => setForm((prev) => ({ ...prev, lines: [...prev.lines, { sku: items[0]?.sku || '', qty: 1 }] }));
  const removeLine = (index) => setForm((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }));
  const valid = form.customerId && form.warehouseId && form.lines.length && form.lines.every((line) => line.sku && Number(line.qty) > 0);

  const submit = () => {
    if (!valid) return;
    onCreate({ ...form, lines: form.lines.map((line) => ({ ...line, price: items.find((row) => row.sku === line.sku)?.price || 0 })) });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Sales Order Baru" subtitle="Draft order dengan customer, warehouse, request date, dan item lines." wide
      footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!valid} onClick={submit}>Simpan Draft</button></>}>
      <div className="form-grid form-grid--3">
        <label className="field"><span>Customer</span><select value={form.customerId} onChange={(e) => setForm({ ...form, customerId: e.target.value })}>{customers.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <label className="field"><span>Warehouse</span><select value={form.warehouseId} onChange={(e) => setForm({ ...form, warehouseId: e.target.value })}>{warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
        <label className="field"><span>Requested Delivery</span><input type="date" value={form.requestedDate} onChange={(e) => setForm({ ...form, requestedDate: e.target.value })} /></label>
      </div>
      <label className="field"><span>Notes</span><textarea rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Catatan order / delivery instruction" /></label>
      <div className="modal-line-head"><div><strong>Order Lines</strong><small>Harga otomatis dari item master.</small></div><button className="btn btn-sm" onClick={addLine}><Plus size={14}/> Tambah Item</button></div>
      <div className="line-editor">
        {form.lines.map((line, index) => {
          const item = items.find((row) => row.sku === line.sku);
          return <div className="line-editor-row" key={index}>
            <label className="field"><span>Item</span><select value={line.sku} onChange={(e) => updateLine(index, { sku: e.target.value })}>{items.map((row) => <option key={row.sku} value={row.sku}>{row.sku} · {row.name}</option>)}</select></label>
            <label className="field field--qty"><span>Qty</span><input type="number" min="1" value={line.qty} onChange={(e) => updateLine(index, { qty: e.target.value })} /></label>
            <div className="line-price"><span>Unit Price</span><strong>{money(item?.price)}</strong></div>
            <div className="line-price"><span>Line Total</span><strong>{money(Number(line.qty || 0) * Number(item?.price || 0))}</strong></div>
            <button className="icon-btn danger-soft" disabled={form.lines.length === 1} onClick={() => removeLine(index)}><Trash2 size={16}/></button>
          </div>;
        })}
      </div>
      <div className="modal-total"><span>Grand Total</span><strong>{money(total)}</strong></div>
    </Modal>
  );
}

export default function SalesOrderDetailPage() {
  const navigate = useNavigate();
  const { data, createSalesOrder, submitSalesOrder, approveSalesOrder, reserveSalesOrder, createPickingFromSalesOrder, createSalesInvoiceFromOrder } = useERPData();
  const [selectedId, setSelectedId] = useState(data.salesOrders[0]?.id);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const documents = useMemo(() => data.salesOrders.filter((order) => {
    const customer = data.customers.find((row) => row.id === order.customerId);
    return `${order.id} ${customer?.name || ''} ${order.status}`.toLowerCase().includes(query.toLowerCase());
  }), [data.salesOrders, data.customers, query]);
  const selected = data.salesOrders.find((order) => order.id === selectedId) || data.salesOrders[0];

  const handleCreate = (payload) => {
    const id = createSalesOrder(payload);
    setSelectedId(id);
  };

  if (!selected) return null;
  const customer = data.customers.find((row) => row.id === selected.customerId);
  const warehouse = data.warehouses.find((row) => row.id === selected.warehouseId);
  const total = soTotal(selected);
  const availableCredit = Math.max(0, Number(customer?.creditLimit || 0) - Number(customer?.creditUsed || 0));
  const existingPicking = data.pickings.find((row) => row.salesOrderId === selected.id && row.status !== 'Cancelled');

  const actionButtons = [];
  if (selected.status === 'Draft') actionButtons.push(<button key="submit" className="btn btn-primary" onClick={() => submitSalesOrder(selected.id)}>Submit Order</button>);
  if (['Pending Approval', 'Credit Hold'].includes(selected.status)) actionButtons.push(<button key="approve" className="btn btn-primary" onClick={() => approveSalesOrder(selected.id)}>{selected.status === 'Credit Hold' ? 'Approve Credit Override' : 'Approve Order'}</button>);
  if (['Approved', 'Partially Allocated', 'Allocated'].includes(selected.status)) actionButtons.push(<button key="reserve" className="btn" onClick={() => reserveSalesOrder(selected.id)}><PackageCheck size={15}/> Reserve Stock</button>);
  if (!existingPicking && selected.lines.some((line) => Number(line.allocated) > 0)) actionButtons.push(<button key="pick" className="btn btn-primary" onClick={() => { createPickingFromSalesOrder(selected.id); navigate('/transactions/distribution/picking-order'); }}>Create Picking</button>);
  if (existingPicking) actionButtons.push(<button key="open-pick" className="btn" onClick={() => navigate('/transactions/distribution/picking-order')}>Open {existingPicking.id}</button>);
  const existingInvoice = data.salesInvoices.find((row) => row.salesOrderId === selected.id && row.status !== 'Cancelled');
  if (['Delivered','Partially Delivered','Shipped','Partially Shipped'].includes(selected.status) && !existingInvoice) actionButtons.push(<button key="invoice" className="btn btn-primary" onClick={() => { createSalesInvoiceFromOrder(selected.id); navigate('/transactions/financials/sales-invoice'); }}>Create Sales Invoice</button>);
  if (existingInvoice) actionButtons.push(<button key="open-invoice" className="btn" onClick={() => navigate('/transactions/financials/sales-invoice')}>Open {existingInvoice.id}</button>);

  return (
    <>
      <PageHeader eyebrow="Transaction / Distribution / Sales Order" title="Sales Order" description="Transactional sales order: credit control, approval, stock reservation, picking handoff, fulfillment, dan audit trail." actionLabel="Sales Order Baru" onAction={() => setCreateOpen(true)} />
      <div className="document-layout">
        <aside className="surface-card document-list-pane">
          <div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari SO, customer, status..." /></label><span>{documents.length} sales order</span></div>
          <div className="document-list">{documents.map((order) => {
            const c = data.customers.find((row) => row.id === order.customerId);
            return <button key={order.id} className={`document-row ${order.id === selected.id ? 'active' : ''}`} onClick={() => setSelectedId(order.id)}>
              <div className="document-row__top"><strong>{order.id}</strong><StatusPill tone={statusTone(order.status)}>{order.status}</StatusPill></div>
              <span>{c?.name}</span><div className="document-row__meta"><small>{dateLabel(order.date)}</small><strong>{money(soTotal(order))}</strong></div>
            </button>;
          })}</div>
        </aside>

        <section className="document-workspace">
          <div className="surface-card document-hero">
            <div className="document-hero__top"><div><div className="doc-kicker">SO · {warehouse?.code} · {selected.approvalStatus}</div><h2>{selected.documentNo || selected.id}</h2><p>{customer?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{actionButtons}</div></div></div>
            <div className="doc-summary-grid">
              <div><CalendarDays size={15}/><span>Document date</span><strong>{dateLabel(selected.date)}</strong></div>
              <div><UserRound size={15}/><span>Owner</span><strong>{selected.owner}</strong></div>
              <div><MapPin size={15}/><span>Warehouse</span><strong>{warehouse?.code} · {warehouse?.name}</strong></div>
              <div><CircleDollarSign size={15}/><span>Grand total</span><strong>{money(total)}</strong></div>
            </div>
          </div>

          <DocumentLifecycle steps={lifecycle} currentIndex={stepMap[selected.status] ?? 0} label={`${selected.status} · requested ${dateLabel(selected.requestedDate)}`} />

          <div className="document-content-grid">
            <section className="surface-card document-section">
              <header><div><h3>Order Lines</h3><p>Qty, reservation, picking, shipment, price, dan availability.</p></div><span>{selected.lines.length} lines</span></header>
              <div className="table-wrap"><table className="data-table document-lines"><thead><tr><th>Item</th><th>Description</th><th>Order</th><th>Available</th><th>Allocated</th><th>Picked</th><th>Shipped</th><th>Price</th><th>Total</th></tr></thead><tbody>
                {selected.lines.map((line) => {
                  const item = data.items.find((row) => row.sku === line.sku);
                  const stock = data.inventory.find((row) => row.warehouseId === selected.warehouseId && row.sku === line.sku);
                  const available = Math.max(0, Number(stock?.onHand || 0) - Number(stock?.reserved || 0) - Number(stock?.qualityHold || 0));
                  return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{number(line.qty)} {item?.uom}</td><td>{number(available)}</td><td>{number(line.allocated)}</td><td>{number(line.picked)}</td><td>{number(line.shipped)}</td><td>{money(line.price)}</td><td>{money(Number(line.qty) * Number(line.price))}</td></tr>;
                })}
              </tbody></table></div>
              <div className="doc-totals"><div><span>Subtotal</span><strong>{money(total)}</strong></div><div><span>Discount</span><strong>{money(selected.discount)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(total)}</strong></div></div>
            </section>

            <aside className="document-side-stack">
              <section className="surface-card document-section compact-info"><header><div><h3>Credit Control</h3><p>Customer exposure saat order disubmit.</p></div></header>
                <div className="credit-meter"><div><span>Credit limit</span><strong>{money(customer?.creditLimit)}</strong></div><div><span>Used</span><strong>{money(customer?.creditUsed)}</strong></div><div><span>Available</span><strong>{money(availableCredit)}</strong></div><div className="credit-bar"><span style={{ width: `${Math.min(100, ((Number(customer?.creditUsed || 0) + total) / Math.max(1, Number(customer?.creditLimit || 1))) * 100)}%` }} /></div><small>Term: {customer?.paymentTerm} · Ship-to: {customer?.shipTo}</small></div>
              </section>
              <section className="surface-card document-section compact-info"><header><div><h3>Related Documents</h3><p>Traceability end-to-end.</p></div></header>
                {Object.entries({ Quotation: selected.related?.quotation, 'Credit Approval': selected.related?.creditApproval, 'Picking Order': selected.related?.pickingOrder, 'Delivery Order': selected.related?.deliveryOrder, Shipment: selected.related?.shipment }).map(([label, value]) => <div className="related-row static" key={label}><div><span>{label}</span><strong>{value || 'Not generated'}</strong></div></div>)}
              </section>
              <section className="surface-card document-section compact-info"><header><div><h3>Activity & Audit</h3><p>Immutable-style transaction history demo.</p></div></header><AuditTimeline items={selected.audit} /></section>
            </aside>
          </div>
        </section>
      </div>
      <NewSalesOrderModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={handleCreate} customers={data.customers} items={data.items} warehouses={data.warehouses} />
    </>
  );
}
