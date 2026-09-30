import React from 'react';
import { createPortal } from 'react-dom';
import { dateLabel, money, number } from '../../utils/erp';
export default function PurchaseOrderPrint({detail}){
 if(!detail||typeof document==='undefined')return null;
 return createPortal(<section className="po-print-sheet" aria-hidden="true">
  <header><div><small>PURCHASE ORDER</small><h1>{detail.company?.legalName||detail.entityCode}</h1><p>{detail.site?.name} · {detail.company?.taxId||''}</p></div><div><h2>{detail.documentNo}</h2><p>{dateLabel(detail.orderDate)}</p><strong>{detail.status}</strong></div></header>
  {detail.status==='CANCELLED'&&<h2 className="po-print-cancel">CANCELLED · {detail.cancelReason}</h2>}
  <div className="po-print-info"><div><small>SUPPLIER</small><h3>{detail.supplier?.name}</h3><p>{detail.supplier?.code}</p><p>Terms: {detail.paymentTerms}</p></div><div><small>DELIVER TO</small><h3>{detail.warehouse?.name}</h3><p>{detail.site?.code} / {detail.warehouse?.code}</p><p>ETA: {dateLabel(detail.etaDate)}</p></div></div>
  <p>Supplier Reference: {detail.supplierReference||'—'} · Revision #{detail.revisionNo}</p>
  <table><thead><tr><th>#</th><th>SKU / Item</th><th>Qty</th><th>Unit Price</th><th>Disc.</th><th>DPP</th><th>Tax</th><th>Total</th></tr></thead><tbody>{detail.lines.map(l=><tr key={l.id}><td>{l.lineNo}</td><td><strong>{l.sku}</strong><br/>{l.itemName}</td><td>{number(l.qty)} {l.uom}</td><td>{money(l.unitPrice)}</td><td>{number(l.discountPercent)}%</td><td>{money(l.dpp)}</td><td>{money(l.taxAmount)}</td><td>{money(l.lineTotal)}</td></tr>)}</tbody></table>
  <div className="po-print-bottom"><div><strong>Notes</strong><p>{detail.notes||'—'}</p></div><div><p>Subtotal <strong>{money(detail.subtotal)}</strong></p><p>Discount <strong>- {money(detail.discount)}</strong></p><p>DPP <strong>{money(detail.dpp)}</strong></p><p>Tax <strong>{money(detail.tax)}</strong></p><h3>GRAND TOTAL <strong>{money(detail.total)}</strong></h3></div></div>
  <footer><div>Prepared By<br/><br/><strong>{detail.createdBy||'System'}</strong></div><div>Approved By<br/><br/><strong>______________________</strong></div><div>{detail.entityCode} / {detail.siteCode}<br/>{detail.documentNo}</div></footer>
 </section>,document.body);
}
