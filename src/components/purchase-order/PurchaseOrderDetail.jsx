import React from 'react';
import { dateLabel, money, number } from '../../utils/erp';
import StatusPill from '../StatusPill';

export default function PurchaseOrderDetail({detail}){
 if(!detail)return null;
 return <div className="po-detail">
  {detail.status==='CANCELLED'&&<div className="po-alert">CANCELLED · {detail.cancelReason||'No cancellation reason recorded'}</div>}
  <div className="po-facts">
   <div><small>Supplier</small><strong>{detail.supplier?.code} · {detail.supplier?.name}</strong></div>
   <div><small>Warehouse</small><strong>{detail.warehouse?.code} · {detail.warehouse?.name}</strong></div>
   <div><small>Order / ETA</small><strong>{dateLabel(detail.orderDate)} / {dateLabel(detail.etaDate)}</strong></div>
   <div><small>Supplier Reference</small><strong>{detail.supplierReference||'—'}</strong></div>
   <div><small>Payment Terms</small><strong>{detail.paymentTerms||'—'}</strong></div>
   <div><small>Revision</small><strong>#{detail.revisionNo}</strong></div>
  </div>
  <div className="table-wrap"><table className="data-table"><thead><tr><th>#</th><th>SKU / Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>DPP</th><th>Tax</th><th>Total</th><th>Received</th></tr></thead><tbody>{detail.lines.map(l=><tr key={l.id}><td>{l.lineNo}</td><td><strong>{l.sku}</strong><br/>{l.itemName}{l.description&&<small className="po-muted">{l.description}</small>}</td><td>{number(l.qty)} {l.uom}</td><td>{money(l.unitPrice)}</td><td>{number(l.discountPercent)}%<small className="po-muted">{money(l.discountAmount)}</small></td><td>{money(l.dpp)}</td><td>{l.taxCode||`${number(l.taxRate)}%`}<small className="po-muted">{money(l.taxAmount)}</small></td><td>{money(l.lineTotal)}</td><td>{number(l.receivedQty)}/{number(l.qty)}</td></tr>)}</tbody></table></div>
  <div className="po-detail-bottom"><div><strong>Tax Summary</strong>{detail.taxSummary.map((r,i)=><p key={i}>{r.taxCode}: DPP {money(r.dpp)} · Tax {money(r.taxAmount)}</p>)}<strong>Notes</strong><p>{detail.notes||'—'}</p></div>
   <div className="po-edit-summary"><span>Subtotal <strong>{money(detail.subtotal)}</strong></span><span>Discount <strong>- {money(detail.discount)}</strong></span><span>DPP <strong>{money(detail.dpp)}</strong></span><span>Tax <strong>{money(detail.tax)}</strong></span><span className="po-total">Grand Total <strong>{money(detail.total)}</strong></span></div>
  </div>
  <section className="po-detail-relations"><strong>Goods Receipts</strong>{detail.relatedDocuments.length===0?<p>Belum ada Goods Receipt.</p>:detail.relatedDocuments.map(r=><p key={r.id}>{r.documentNo} · <StatusPill>{r.status}</StatusPill></p>)}</section>
  <section className="po-detail-relations"><strong>Audit Trail</strong>{detail.auditTrail.length===0?<p>Belum ada audit event.</p>:detail.auditTrail.map((a,i)=><details key={i}><summary>{dateLabel(a.occurredAt)} · {a.action} · {a.actor||'System'}</summary><pre>{a.after}</pre></details>)}</section>
 </div>;
}
