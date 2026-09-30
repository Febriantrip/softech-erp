import React, { useMemo, useState } from 'react';
import { CalendarDays, MapPin, Search, Truck, UserRound } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import DocumentLifecycle from '../components/DocumentLifecycle';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, dateTimeLabel, number, statusTone } from '../utils/erp';

const steps = ['Draft', 'Ready to Load', 'Loading', 'Loaded', 'Dispatched', 'Delivered'];
const idx = { Draft:0, 'Ready to Load':1, Loading:2, Loaded:3, 'Shipment Planned':3, Dispatched:4, Delivered:5 };

export default function DeliveryOrderPage() {
  const navigate = useNavigate();
  const { data, updateDelivery, setDeliveryStatus, createShipmentFromDelivery } = useERPData();
  const [selectedId, setSelectedId] = useState(data.deliveryOrders[0]?.id);
  const [query, setQuery] = useState('');
  const docs = useMemo(() => data.deliveryOrders.filter((row) => `${row.id} ${row.salesOrderId} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [data.deliveryOrders, query]);
  const selected = data.deliveryOrders.find((row) => row.id === selectedId) || data.deliveryOrders[0];

  if (!selected) return <><PageHeader eyebrow="Transaction / Distribution / Delivery Order" title="Delivery Order" description="Belum ada DO. Selesaikan Picking Order lalu buat Delivery Order." /><div className="surface-card empty-state-large">Belum ada Delivery Order. Flow: Sales Order → Picking Order → Complete Picking → Create Delivery Order.</div></>;
  const order = data.salesOrders.find((row) => row.id === selected.salesOrderId);
  const customer = data.customers.find((row) => row.id === selected.customerId);
  const warehouse = data.warehouses.find((row) => row.id === selected.warehouseId);
  const shipment = data.shipments.find((row) => row.deliveryOrderId === selected.id && row.status !== 'Cancelled');

  return <>
    <PageHeader eyebrow="Transaction / Distribution / Delivery Order" title="Delivery Order" description="Outbound release dengan delivery date, dock, vehicle, driver, picked lot, loading status, dan shipment handoff." />
    <div className="document-layout">
      <aside className="surface-card document-list-pane"><div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari DO / SO / status..." /></label><span>{docs.length} delivery order</span></div><div className="document-list">{docs.map((row)=><button key={row.id} className={`document-row ${row.id===selected.id?'active':''}`} onClick={()=>setSelectedId(row.id)}><div className="document-row__top"><strong>{row.id}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{row.salesOrderId}</span><div className="document-row__meta"><small>{dateTimeLabel(row.createdAt)}</small><strong>{row.lines.reduce((s,l)=>s+Number(l.qty),0)} qty</strong></div></button>)}</div></aside>
      <section className="document-workspace">
        <div className="surface-card document-hero"><div className="document-hero__top"><div><div className="doc-kicker">DO · {warehouse?.code} · {order?.id}</div><h2>{selected.id}</h2><p>{customer?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">
          {selected.status==='Draft' && <button className="btn btn-primary" onClick={()=>setDeliveryStatus(selected.id,'Ready to Load')}>Release to Loading</button>}
          {selected.status==='Ready to Load' && <button className="btn btn-primary" onClick={()=>setDeliveryStatus(selected.id,'Loading')}>Start Loading</button>}
          {selected.status==='Loading' && <button className="btn btn-primary" onClick={()=>setDeliveryStatus(selected.id,'Loaded')}>Complete Loading</button>}
          {selected.status==='Loaded' && !shipment && <button className="btn btn-primary" onClick={()=>{createShipmentFromDelivery(selected.id); navigate('/transactions/distribution/shipment');}}>Create Shipment</button>}
          {shipment && <button className="btn" onClick={()=>navigate('/transactions/distribution/shipment')}>Open {shipment.id}</button>}
        </div></div></div>
        <div className="doc-summary-grid"><div><CalendarDays size={15}/><span>Delivery date</span><strong>{dateLabel(selected.deliveryDate)}</strong></div><div><UserRound size={15}/><span>Driver</span><strong>{selected.driver||'Unassigned'}</strong></div><div><MapPin size={15}/><span>Loading dock</span><strong>{selected.dock}</strong></div><div><Truck size={15}/><span>Vehicle</span><strong>{selected.vehicle||'Unassigned'}</strong></div></div></div>
        <DocumentLifecycle steps={steps} currentIndex={idx[selected.status] ?? 0} label={selected.status} />
        <div className="document-content-grid">
          <section className="surface-card document-section"><header><div><h3>Delivery Lines</h3><p>Picked stock yang akan dilepas ke pengiriman.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Description</th><th>Lot</th><th>Pick Location</th><th>Delivery Qty</th></tr></thead><tbody>{selected.lines.map((line)=>{const item=data.items.find((x)=>x.sku===line.sku);return <tr key={line.sku}><td><strong>{line.sku}</strong></td><td>{item?.name}</td><td>{line.lot}</td><td>{line.location}</td><td>{number(line.qty)} {item?.uom}</td></tr>})}</tbody></table></div></section>
          <aside className="document-side-stack"><section className="surface-card document-section compact-info"><header><div><h3>Loading Plan</h3><p>Bisa diubah sebelum shipment dibuat.</p></div></header><div className="inline-form"><label className="field"><span>Dock</span><input value={selected.dock||''} onChange={(e)=>updateDelivery(selected.id,{dock:e.target.value})}/></label><label className="field"><span>Vehicle</span><input value={selected.vehicle||''} onChange={(e)=>updateDelivery(selected.id,{vehicle:e.target.value})} placeholder="B 9123 KRN - CDD Box"/></label><label className="field"><span>Driver</span><input value={selected.driver||''} onChange={(e)=>updateDelivery(selected.id,{driver:e.target.value})} placeholder="Nama driver"/></label></div></section><section className="surface-card document-section compact-info"><header><div><h3>Traceability</h3><p>Source dan downstream document.</p></div></header><div className="related-row static"><div><span>Sales Order</span><strong>{selected.salesOrderId}</strong></div></div><div className="related-row static"><div><span>Picking Order</span><strong>{selected.pickingId}</strong></div></div><div className="related-row static"><div><span>Shipment</span><strong>{shipment?.id||'Not generated'}</strong></div></div></section></aside>
        </div>
      </section>
    </div>
  </>;
}
