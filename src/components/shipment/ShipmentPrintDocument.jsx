import React from 'react';
import { createPortal } from 'react-dom';
import { dateTimeLabel, number } from '../../utils/erp';

export default function ShipmentPrintDocument({ detail }) {
  if (!detail || typeof document === 'undefined') return null;
  return createPortal(<section className="so-print-sheet shipment-print-sheet" aria-hidden="true">
    <header className="so-print-header"><div><span className="so-print-kicker">SHIPMENT / DELIVERY MANIFEST</span><h1>{detail.company?.legalName || detail.entityCode}</h1><p>{detail.site?.name || detail.siteCode}{detail.company?.taxId ? ` · Tax ID ${detail.company.taxId}` : ''}</p></div><div className="so-print-doc-meta"><strong>{detail.documentNo}</strong><span>{dateTimeLabel(detail.dispatchedAt || detail.scheduledAt || detail.createdAt)}</span><b>{detail.status}</b></div></header>
    {detail.status === 'CANCELLED' && <div className="so-print-cancelled">CANCELLED · {detail.cancelReason || 'Shipment dibatalkan'}</div>}
    <div className="so-print-parties"><div><span>Customer</span><strong>{detail.customer?.code} · {detail.customer?.name}</strong><p>Sales Order {detail.salesOrder?.documentNo}</p></div><div><span>Source</span><strong>{detail.deliveryOrder?.documentNo || 'Legacy direct shipment'}</strong><p>{detail.warehouse?.code} · {detail.warehouse?.name}</p></div></div>
    <div className="so-print-facts"><div><span>Carrier</span><strong>{detail.carrier || '—'}</strong></div><div><span>Vehicle</span><strong>{detail.vehicle || '—'}</strong></div><div><span>Driver</span><strong>{detail.driver || '—'}</strong></div><div><span>Route</span><strong>{detail.route || '—'}</strong></div><div><span>Tracking</span><strong>{detail.trackingNo || '—'}</strong></div><div><span>Reference</span><strong>{detail.referenceNo || '—'}</strong></div></div>
    <table className="so-print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Location</th><th>Lot</th></tr></thead><tbody>{(detail.lines||[]).map((line,index)=><tr key={line.id}><td>{line.lineNo||index+1}</td><td><strong>{line.sku}</strong><span>{line.itemName}</span></td><td>{number(line.qty)} {line.uom}</td><td>{line.location||'—'}</td><td>{line.lotNo||'—'}</td></tr>)}</tbody></table>
    <div className="so-print-lower"><div className="so-print-notes"><span>Notes</span><p>{detail.notes || '—'}</p></div><div className="so-print-notes"><span>Proof of Delivery</span><p>Recipient: {detail.pod?.recipient || '________________'}</p><p>Reference: {detail.pod?.reference || '________________'}</p><p>Received: {detail.pod?.receivedAt ? dateTimeLabel(detail.pod.receivedAt) : '________________'}</p></div></div>
    <footer className="so-print-footer"><div><span>Dispatcher</span><strong>________________</strong><small>Name / Signature</small></div><div><span>Driver</span><strong>{detail.driver || '________________'}</strong><small>Signature</small></div><div><span>Customer Receiver</span><strong>{detail.pod?.recipient || '________________'}</strong><small>Name / Signature</small></div></footer>
  </section>, document.body);
}
