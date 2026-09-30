import React from 'react';
import { CheckCircle2, Circle, ClipboardList, PackageCheck, Truck } from 'lucide-react';
import { number } from '../../utils/erp';

const labels = ['Draft', 'Approval', 'Approved', 'Reserved', 'Picking', 'Shipped'];

export default function SalesOrderFulfillmentTab({ detail }) {
  const f = detail.fulfillment || {};
  const related = detail.relatedDocuments || [];
  const pickings = related.filter((row) => row.documentType === 'PICKING_ORDER' && row.status !== 'CANCELLED');
  const deliveries = related.filter((row) => row.documentType === 'DELIVERY_ORDER' && row.status !== 'CANCELLED');
  const shipments = related.filter((row) => row.documentType === 'SHIPMENT' && row.status !== 'CANCELLED');
  const cancelled = detail.status === 'CANCELLED';
  let idx = detail.status === 'DRAFT' ? 0 : detail.status === 'PENDING_APPROVAL' ? 1 : detail.status === 'APPROVED' ? 2 : 3;
  if (pickings.length || deliveries.length) idx = Math.max(idx, 4);
  if (shipments.length || ['PARTIALLY_SHIPPED', 'SHIPPED'].includes(detail.status)) idx = 5;

  return <div className="so-tab-stack">
    <div className={`so-lifecycle ${cancelled ? 'cancelled' : ''}`}>{labels.map((label, index) => <React.Fragment key={label}><div className={`so-lifecycle-step ${!cancelled && index <= idx ? 'done' : ''} ${!cancelled && index === idx ? 'current' : ''}`}>{!cancelled && index <= idx ? <CheckCircle2 size={16}/> : <Circle size={16}/>}<span>{label}</span></div>{index < labels.length - 1 && <div className={`so-lifecycle-line ${!cancelled && index < idx ? 'done' : ''}`}/>}</React.Fragment>)}</div>
    {cancelled && <div className="so-cancel-banner"><strong>Lifecycle dihentikan</strong><span>{detail.cancelReason || 'Sales Order telah dibatalkan.'}</span></div>}
    <div className="so-fulfillment-grid"><article><PackageCheck size={18}/><span>Ordered Qty</span><strong>{number(f.orderedQty)}</strong></article><article><PackageCheck size={18}/><span>Reserved Qty</span><strong>{number(f.reservedQty)}</strong></article><article><ClipboardList size={18}/><span>Picked Qty</span><strong>{number(f.pickedQty)}</strong></article><article><Truck size={18}/><span>Delivery Qty</span><strong>{number(f.deliveryQty)}</strong></article><article><Truck size={18}/><span>Shipped Qty</span><strong>{number(f.shippedQty)}</strong></article><article><Truck size={18}/><span>Remaining to Ship</span><strong>{number(f.remainingToShipQty)}</strong></article></div>
    <div className="so-fulfillment-docs"><span><ClipboardList size={14}/> Picking <strong>{pickings.length}</strong></span><span><Truck size={14}/> Delivery Order <strong>{deliveries.length}</strong></span><span><Truck size={14}/> Shipment <strong>{shipments.length}</strong></span>{deliveries.some((row) => row.status === 'LOADED') && <em>Ready for Shipment · D3-C</em>}</div>
    <div className="so-detail-table"><table className="data-table"><thead><tr><th>Item</th><th>Ordered</th><th>Reserved</th><th>Picked</th><th>Shipped</th><th>Remaining</th></tr></thead><tbody>{(detail.lines || []).map((l) => <tr key={l.id}><td><strong>{l.sku}</strong><small>{l.itemName}</small></td><td>{number(l.qty)} {l.uom}</td><td>{number(l.reservedQty)} {l.uom}</td><td>{number(l.pickedQty)} {l.uom}</td><td>{number(l.shippedQty)} {l.uom}</td><td>{number(Math.max(0, Number(l.qty || 0) - Number(l.shippedQty || 0)))} {l.uom}</td></tr>)}</tbody></table></div>
  </div>;
}
