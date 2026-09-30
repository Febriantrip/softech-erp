import React from 'react';
import StatusPill from '../StatusPill';
import { dateLabel, money, number, statusTone } from '../../utils/erp';

export default function GoodsReceiptDetail({ detail }) {
 if(!detail)return null;
 return <div className="grn-detail">
  <div className="grn-detail-head"><div><small>GOODS RECEIPT</small><h3>{detail.documentNo}</h3><span>PO {detail.purchaseOrder.documentNo} · {detail.supplier.name}</span></div><StatusPill tone={statusTone(detail.status)}>{detail.status}</StatusPill></div>
  <div className="grn-detail-meta"><div><small>Receipt Date</small><strong>{dateLabel(detail.receiptDate)}</strong></div><div><small>Warehouse</small><strong>{detail.warehouse.code} · {detail.warehouse.name}</strong></div><div><small>Entity / Site</small><strong>{detail.company.code} / {detail.siteCode}</strong></div><div><small>PO Status</small><strong>{detail.purchaseOrder.status}</strong></div></div>
  <div className="grn-table-wrap"><table className="grn-table"><thead><tr><th>Item</th><th>Expected</th><th>Accepted</th><th>Rejected</th><th>Lot</th><th>Location</th><th>Net Cost</th><th>Accepted Value</th></tr></thead><tbody>{detail.lines.map(l=><tr key={`${l.lineNo}:${l.sku}`}><td><strong>{l.sku}</strong><small>{l.itemName}</small></td><td>{number(l.expectedQty)}</td><td>{number(l.acceptedQty)}</td><td>{number(l.rejectedQty)}</td><td>{l.lotNo||'—'}</td><td>{l.putAwayLocation||'—'}</td><td>{money(l.unitCost)}</td><td>{money(l.lineCost)}</td></tr>)}</tbody></table></div>
  <div className="grn-totals"><span>Accepted: <strong>{number(detail.acceptedQty)}</strong></span><span>Rejected: <strong>{number(detail.rejectedQty)}</strong></span><span>Accepted Value: <strong>{money(detail.inboundValue)}</strong></span></div>
  <div className="grn-instruction"><strong>{detail.status==='PUT_AWAY'?'Stock posted to On Hand':'Inbound staging only'}</strong><span>{detail.status==='PUT_AWAY'?'This GRN has already been put away. The same GRN cannot post stock again.':'Accepted Qty is tracked in Inbound. On Hand is not increased until Put Away.'}</span></div>
 </div>;
}
