import React from 'react';
import { createPortal } from 'react-dom';
import { dateLabel, number } from '../../utils/erp';

export default function DeliveryOrderPrintDocument({ detail }) {
  if (!detail || typeof document === 'undefined') return null;
  return createPortal(<section className="so-print-sheet do-print-sheet" aria-hidden="true">
    <header className="so-print-header"><div><span className="so-print-kicker">DELIVERY ORDER</span><h1>{detail.company?.legalName || detail.entityCode}</h1><p>{detail.site?.name || detail.siteCode}{detail.company?.taxId ? ` · Tax ID ${detail.company.taxId}` : ''}</p></div><div className="so-print-doc-meta"><strong>{detail.documentNo}</strong><span>{dateLabel(detail.deliveryDate)}</span><b>{detail.status}</b></div></header>
    {detail.status === 'CANCELLED' && <div className="so-print-cancelled">CANCELLED · {detail.cancelReason || 'Delivery Order dibatalkan'}</div>}
    <div className="so-print-parties"><div><span>Customer</span><strong>{detail.customer?.code} · {detail.customer?.name}</strong><p>{detail.shippingAddress || 'Shipping address belum diisi.'}</p></div><div><span>Source</span><strong>{detail.salesOrder?.documentNo}</strong><p>Picking {detail.pickingOrder?.documentNo} · {detail.warehouse?.code} / {detail.warehouse?.name}</p></div></div>
    <div className="so-print-facts"><div><span>Carrier</span><strong>{detail.carrier || '—'}</strong></div><div><span>Vehicle</span><strong>{detail.vehicle || '—'}</strong></div><div><span>Driver</span><strong>{detail.driver || '—'}</strong></div><div><span>Loading Dock</span><strong>{detail.dock || '—'}</strong></div><div><span>Delivery Date</span><strong>{dateLabel(detail.deliveryDate)}</strong></div><div><span>Total Qty</span><strong>{number((detail.lines || []).reduce((s,l)=>s+Number(l.qty||0),0))}</strong></div></div>
    <table className="so-print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Location</th><th>Lot</th></tr></thead><tbody>{(detail.lines || []).map((line,index)=><tr key={line.id}><td>{line.lineNo || index+1}</td><td><strong>{line.sku}</strong><span>{line.itemName}</span></td><td>{number(line.qty)} {line.uom}</td><td>{line.location || '—'}</td><td>{line.lotNo || '—'}</td></tr>)}</tbody></table>
    <div className="so-print-lower"><div className="so-print-notes"><span>Notes</span><p>{detail.notes || '—'}</p></div><div className="so-print-notes"><span>Traceability</span><p>Sales Order: {detail.salesOrder?.documentNo}</p><p>Picking Order: {detail.pickingOrder?.documentNo}</p></div></div>
    <footer className="so-print-footer"><div><span>Warehouse</span><strong>{detail.warehouse?.name}</strong><small>{detail.warehouse?.code}</small></div><div><span>Prepared / Loaded By</span><strong>{detail.driver || '________________'}</strong><small>Signature</small></div><div><span>Customer Receiver</span><strong>________________</strong><small>Name / Signature</small></div></footer>
  </section>, document.body);
}
