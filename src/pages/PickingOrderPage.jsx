import React, { useMemo, useState } from 'react';
import { Box, CalendarDays, MapPin, Search, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import DocumentLifecycle from '../components/DocumentLifecycle';
import { useERPData } from '../context/ERPDataContext';
import { dateTimeLabel, number, statusTone } from '../utils/erp';

export default function PickingOrderPage() {
  const navigate = useNavigate();
  const { data, completePicking, createDeliveryFromPicking } = useERPData();
  const [selectedId, setSelectedId] = useState(data.pickings[0]?.id);
  const [query, setQuery] = useState('');
  const docs = useMemo(() => data.pickings.filter((row) => {
    const so = data.salesOrders.find((x) => x.id === row.salesOrderId);
    const customer = data.customers.find((x) => x.id === so?.customerId);
    return `${row.id} ${row.salesOrderId} ${customer?.name || ''} ${row.status}`.toLowerCase().includes(query.toLowerCase());
  }), [data.pickings, data.salesOrders, data.customers, query]);
  const selected = data.pickings.find((row) => row.id === selectedId) || data.pickings[0];

  if (!selected) {
    return <><PageHeader eyebrow="Transaction / Distribution / Picking Order" title="Picking Order" description="Belum ada picking order. Buat dari Sales Order yang sudah dialokasikan." /><div className="surface-card empty-state-large">Belum ada picking order. Buka Sales Order → Reserve Stock → Create Picking.</div></>;
  }

  const order = data.salesOrders.find((row) => row.id === selected.salesOrderId);
  const customer = data.customers.find((row) => row.id === order?.customerId);
  const warehouse = data.warehouses.find((row) => row.id === selected.warehouseId);
  const delivery = data.deliveryOrders.find((row) => row.pickingId === selected.id && row.status !== 'Cancelled');
  const currentIndex = selected.status === 'Completed' ? 3 : selected.status === 'In Progress' ? 2 : 1;

  return (
    <>
      <PageHeader eyebrow="Transaction / Distribution / Picking Order" title="Picking Order" description="Warehouse task dari stock reservation sampai picked quantity, location, lot, dan handoff ke Delivery Order." />
      <div className="document-layout">
        <aside className="surface-card document-list-pane">
          <div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari PKO / SO / customer..." /></label><span>{docs.length} picking order</span></div>
          <div className="document-list">{docs.map((row) => <button key={row.id} className={`document-row ${row.id === selected.id ? 'active' : ''}`} onClick={() => setSelectedId(row.id)}><div className="document-row__top"><strong>{row.id}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{row.salesOrderId}</span><div className="document-row__meta"><small>{dateTimeLabel(row.createdAt)}</small><strong>{row.lines.reduce((s,l)=>s+Number(l.allocatedQty),0)} qty</strong></div></button>)}</div>
        </aside>

        <section className="document-workspace">
          <div className="surface-card document-hero">
            <div className="document-hero__top"><div><div className="doc-kicker">PKO · {warehouse?.code} · {order?.id}</div><h2>{selected.id}</h2><p>{customer?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{selected.status !== 'Completed' && <button className="btn btn-primary" onClick={() => completePicking(selected.id)}>Complete Picking</button>}{selected.status === 'Completed' && !delivery && <button className="btn btn-primary" onClick={() => { createDeliveryFromPicking(selected.id); navigate('/transactions/distribution/delivery-order'); }}>Create Delivery Order</button>}{delivery && <button className="btn" onClick={() => navigate('/transactions/distribution/delivery-order')}>Open {delivery.id}</button>}</div></div></div>
            <div className="doc-summary-grid"><div><CalendarDays size={15}/><span>Created</span><strong>{dateTimeLabel(selected.createdAt)}</strong></div><div><UserRound size={15}/><span>Picker</span><strong>{selected.picker}</strong></div><div><MapPin size={15}/><span>Warehouse</span><strong>{warehouse?.name}</strong></div><div><Box size={15}/><span>Total allocated</span><strong>{number(selected.lines.reduce((s,l)=>s+Number(l.allocatedQty),0))}</strong></div></div>
          </div>
          <DocumentLifecycle steps={['Created', 'Released', 'Picking', 'Completed']} currentIndex={currentIndex} label={selected.status} />
          <section className="surface-card document-section"><header><div><h3>Picking Lines</h3><p>Location assignment, lot, allocated qty, dan actual picked qty.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Description</th><th>Location</th><th>Lot</th><th>Allocated</th><th>Picked</th><th>Variance</th></tr></thead><tbody>{selected.lines.map((line) => { const item=data.items.find((x)=>x.sku===line.sku); return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{line.location}</td><td>{line.lot}</td><td>{number(line.allocatedQty)}</td><td>{number(line.pickedQty)}</td><td>{number(Number(line.allocatedQty)-Number(line.pickedQty))}</td></tr>; })}</tbody></table></div></section>
        </section>
      </div>
    </>
  );
}
