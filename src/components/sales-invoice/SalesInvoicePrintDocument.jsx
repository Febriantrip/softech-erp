import React from 'react';
import { createPortal } from 'react-dom';
import {dateLabel,money,number} from '../../utils/erp';

export default function SalesInvoicePrintDocument({detail}) {
  if(!detail||typeof document==='undefined')return null;
  return createPortal(<section className="so-print-sheet invoice-print-sheet" aria-hidden="true">
    <header className="so-print-header"><div><span className="so-print-kicker">SALES INVOICE</span><h1>{detail.company?.legalName}</h1><p>{detail.site?.name} · {detail.company?.taxId?`Tax ID ${detail.company.taxId}`:''}</p></div><div className="so-print-doc-meta"><strong>{detail.documentNo}</strong><span>{dateLabel(detail.invoiceDate)}</span><b>{detail.status}</b></div></header>
    {detail.status==='DRAFT'&&<div className="invoice-print-draft">DRAFT · BELUM DIPOSTING · BUKAN TAGIHAN FINAL</div>}
    <div className="so-print-parties"><div><span>Bill To</span><strong>{detail.customer?.code} · {detail.customer?.name}</strong><p>{detail.billingAddress||'—'}</p></div><div><span>Reference</span><strong>SO: {detail.salesOrderNo}</strong><p>Shipment: {detail.shipmentNo||'Legacy Invoice'}</p><p>Customer PO: {detail.customerPo||'—'}</p></div></div>
    <div className="so-print-facts"><div><span>Invoice Date</span><strong>{dateLabel(detail.invoiceDate)}</strong></div><div><span>Due Date</span><strong>{dateLabel(detail.dueDate)}</strong></div><div><span>Payment Terms</span><strong>{detail.paymentTerms||'—'}</strong></div></div>
    <table className="so-print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Harga</th><th>Disc</th><th>DPP</th><th>PPN</th><th>Total</th></tr></thead><tbody>{detail.lines.map(l=><tr key={l.id}><td>{l.lineNo}</td><td><strong>{l.sku}</strong><span>{l.itemName}</span></td><td>{number(l.qty)} {l.uom}</td><td>{money(l.unitPrice)}</td><td>{number(l.discountPercent)}%</td><td>{money(l.dpp)}</td><td>{money(l.tax)}</td><td>{money(l.total)}</td></tr>)}</tbody></table>
    <div className="invoice-print-total"><div><span>Subtotal</span><strong>{money(detail.subtotal)}</strong></div><div><span>Discount</span><strong>-{money(detail.discount)}</strong></div><div><span>DPP</span><strong>{money(detail.dpp)}</strong></div><div><span>PPN</span><strong>{money(detail.tax)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(detail.total)}</strong></div></div>
    <footer className="so-print-footer"><div><span>Issued By</span><strong>________________</strong><small>Finance</small></div><div><span>Received By</span><strong>________________</strong><small>Customer</small></div><div><span>Document Status</span><strong>{detail.status}</strong><small>{detail.journalNo||'Unposted'}</small></div></footer>
  </section>,document.body);
}
