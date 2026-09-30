import React, { useMemo, useState } from 'react';
import { CalendarDays, CircleDollarSign, FileText, Search, UserRound, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import AuditTimeline from '../components/AuditTimeline';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money, number, statusTone } from '../utils/erp';

function CreateInvoiceModal({ open, onClose, orders, customers, onCreate }) {
  const [salesOrderId, setSalesOrderId] = useState(orders[0]?.id || '');
  React.useEffect(() => { if (open) setSalesOrderId(orders[0]?.id || ''); }, [open, orders]);
  const order = orders.find((row) => row.id === salesOrderId);
  const customer = customers.find((row) => row.id === order?.customerId);
  return <Modal open={open} onClose={onClose} title="Create Sales Invoice" subtitle="Invoice dibuat dari actual shipped quantity agar billing mengikuti fulfillment." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!salesOrderId} onClick={() => { const id = onCreate(salesOrderId); if (id) onClose(); }}>Create Draft</button></>}>
    <label className="field"><span>Delivered / Shipped Sales Order</span><select value={salesOrderId} onChange={(e) => setSalesOrderId(e.target.value)}>{orders.length ? orders.map((row) => <option key={row.id} value={row.id}>{row.id} · {customers.find((c) => c.id === row.customerId)?.name}</option>) : <option value="">Tidak ada order yang siap diinvoiced</option>}</select></label>
    {order && <div className="invoice-source-preview"><div><span>Customer</span><strong>{customer?.name}</strong></div><div><span>Payment Term</span><strong>{customer?.paymentTerm}</strong></div><div><span>Shipped Lines</span><strong>{order.lines.filter((line) => Number(line.shipped) > 0).length}</strong></div><div><span>Fulfillment</span><strong>{order.status}</strong></div></div>}
  </Modal>;
}

export default function SalesInvoicePage() {
  const { data, createSalesInvoiceFromOrder, postSalesInvoice } = useERPData();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState(data.salesInvoices[0]?.id);
  const [createOpen, setCreateOpen] = useState(false);
  const eligibleOrders = useMemo(() => data.salesOrders.filter((order) => ['Delivered','Partially Delivered','Shipped','Partially Shipped'].includes(order.status) && !data.salesInvoices.some((inv) => inv.salesOrderId === order.id && inv.status !== 'Cancelled')), [data.salesOrders, data.salesInvoices]);
  const docs = useMemo(() => data.salesInvoices.filter((inv) => {
    const customer = data.customers.find((row) => row.id === inv.customerId);
    return `${inv.id} ${customer?.name || ''} ${inv.status} ${inv.salesOrderId || ''}`.toLowerCase().includes(query.toLowerCase());
  }), [data.salesInvoices, data.customers, query]);
  const selected = data.salesInvoices.find((row) => row.id === selectedId) || data.salesInvoices[0];
  const handleCreate = (salesOrderId) => { const id = createSalesInvoiceFromOrder(salesOrderId); if (id) setSelectedId(id); return id; };

  return <>
    <PageHeader eyebrow="Transaction / Financials / Sales Invoice" title="Sales Invoice" description="Billing dari shipped quantity, tax calculation, AR open-item creation, dan automatic journal posting." actionLabel="Create Invoice" onAction={() => setCreateOpen(true)} />
    {!selected ? <div className="surface-card empty-state-large">Belum ada invoice. Create invoice dari Sales Order yang sudah shipped/delivered.</div> : <div className="document-layout">
      <aside className="surface-card document-list-pane"><div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari invoice, customer, SO..."/></label><span>{docs.length} invoice</span></div><div className="document-list">{docs.map((inv) => { const c=data.customers.find((row)=>row.id===inv.customerId); return <button key={inv.id} className={`document-row ${selected?.id===inv.id?'active':''}`} onClick={()=>setSelectedId(inv.id)}><div className="document-row__top"><strong>{inv.id}</strong><StatusPill tone={statusTone(inv.status)}>{inv.status}</StatusPill></div><span>{c?.name}</span><div className="document-row__meta"><small>{dateLabel(inv.date)}</small><strong>{money(inv.total)}</strong></div></button>; })}</div></aside>
      <section className="document-workspace">
        {(() => { const customer=data.customers.find((row)=>row.id===selected.customerId); const outstanding=Math.max(0, Number(selected.total)-Number(selected.paidAmount||0)); return <>
          <div className="surface-card document-hero"><div className="document-hero__top"><div><div className="doc-kicker">INV · {selected.postingStatus} · {selected.currency}</div><h2>{selected.documentNo || selected.id}</h2><p>{customer?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(selected.status)}>{selected.status}</StatusPill><div className="action-row">{selected.postingStatus!=='Posted' && <button className="btn btn-primary" onClick={()=>postSalesInvoice(selected.id)}>Post Invoice</button>}</div></div></div><div className="doc-summary-grid"><div><CalendarDays size={15}/><span>Invoice Date</span><strong>{dateLabel(selected.date)}</strong></div><div><CalendarDays size={15}/><span>Due Date</span><strong>{dateLabel(selected.dueDate)}</strong></div><div><CircleDollarSign size={15}/><span>Invoice Total</span><strong>{money(selected.total)}</strong></div><div><WalletCards size={15}/><span>Outstanding</span><strong>{money(outstanding)}</strong></div></div></div>
          <div className="finance-mini-strip"><div><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div><div><span>PPN</span><strong>{money(selected.tax)}</strong></div><div><span>Paid</span><strong>{money(selected.paidAmount)}</strong></div><div><span>Posting</span><strong>{selected.postingStatus}</strong></div></div>
          <div className="document-content-grid"><section className="surface-card document-section"><header><div><h3>Invoice Lines</h3><p>Qty berasal dari shipped quantity, bukan sekadar ordered quantity.</p></div><span>{selected.lines.length} lines</span></header><div className="table-wrap"><table className="data-table"><thead><tr><th>SKU</th><th>Description</th><th>Qty</th><th>Unit Price</th><th>Tax</th><th>Line Total</th></tr></thead><tbody>{selected.lines.map((line)=><tr key={`${selected.id}-${line.sku}`}><td><strong>{line.sku}</strong></td><td>{line.description}</td><td>{number(line.qty)}</td><td>{money(line.price)}</td><td>{line.taxRate}%</td><td>{money(Number(line.qty)*Number(line.price)*(1+Number(line.taxRate)/100))}</td></tr>)}</tbody></table></div><div className="doc-totals"><div><span>Subtotal</span><strong>{money(selected.subtotal)}</strong></div><div><span>PPN</span><strong>{money(selected.tax)}</strong></div><div className="grand"><span>Total Invoice</span><strong>{money(selected.total)}</strong></div></div></section>
          <aside className="document-side-stack"><section className="surface-card document-section compact-info"><header><div><h3>Financial Link</h3><p>Traceability billing → AR → GL.</p></div></header><div className="related-row static"><div><span>Sales Order</span><strong>{selected.salesOrderId || '-'}</strong></div></div><div className="related-row static"><div><span>Shipment</span><strong>{selected.shipmentId || '-'}</strong></div></div><div className="related-row static"><div><span>AR Open Item</span><strong>{selected.arItemId || 'Created when posted'}</strong></div></div><div className="related-row static"><div><span>Journal</span><strong>{selected.journalId || 'Created when posted'}</strong></div></div></section><section className="surface-card document-section compact-info"><header><div><h3>Invoice Audit</h3><p>Billing activity trail.</p></div></header><AuditTimeline items={selected.audit || []}/></section></aside></div>
        </>; })()}
      </section>
    </div>}
    <CreateInvoiceModal open={createOpen} onClose={()=>setCreateOpen(false)} orders={eligibleOrders} customers={data.customers} onCreate={handleCreate}/>
  </>;
}
