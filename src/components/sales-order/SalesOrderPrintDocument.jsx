import React from 'react';
import { createPortal } from 'react-dom';
import { dateLabel, number } from '../../utils/erp';

function currency(value, code = 'IDR') {
  try {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: code || 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));
  } catch {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 }).format(Number(value || 0));
  }
}

export default function SalesOrderPrintDocument({ detail }) {
  if (!detail || typeof document === 'undefined') return null;
  const company = detail.company || {};
  const site = detail.site || { code: detail.siteCode, name: detail.siteCode };
  const approved = [...(detail.approvalHistory || [])].reverse().find((item) => item.status === 'APPROVED');
  const taxRows = detail.taxSummary || [];

  return createPortal(<section className="so-print-sheet" aria-hidden="true">
    <header className="so-print-header">
      <div><span className="so-print-kicker">SALES ORDER</span><h1>{company.legalName || company.code || detail.entityCode}</h1><p>{site.name || site.code}{company.taxId ? ` · Tax ID ${company.taxId}` : ''}</p></div>
      <div className="so-print-doc-meta"><strong>{detail.documentNo}</strong><span>{dateLabel(detail.orderDate)}</span><b>{detail.status}</b></div>
    </header>

    {detail.status === 'CANCELLED' && <div className="so-print-cancelled">CANCELLED · {detail.cancelReason || 'Sales Order dibatalkan'}</div>}

    <div className="so-print-parties">
      <div><span>Customer</span><strong>{detail.customer?.code} · {detail.customer?.name}</strong><p>{detail.billingAddress || 'Billing address belum diisi.'}</p></div>
      <div><span>Delivery To</span><strong>{detail.warehouse?.code} · {detail.warehouse?.name}</strong><p>{detail.shippingAddress || 'Shipping address belum diisi.'}</p></div>
    </div>

    <div className="so-print-facts">
      <div><span>Customer PO</span><strong>{detail.customerPo || '—'}</strong></div>
      <div><span>Requested Delivery</span><strong>{detail.requestedDeliveryDate ? dateLabel(detail.requestedDeliveryDate) : '—'}</strong></div>
      <div><span>Payment Terms</span><strong>{detail.paymentTerms || '—'}</strong></div>
      <div><span>Salesperson / PIC</span><strong>{detail.salesperson || '—'}</strong></div>
      <div><span>Currency</span><strong>{detail.currency || company.currency || 'IDR'}</strong></div>
      <div><span>Revision</span><strong>#{detail.revisionNo || 0}</strong></div>
    </div>

    <table className="so-print-table"><thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Unit Price</th><th>Discount</th><th>DPP</th><th>Tax</th><th>Total</th></tr></thead><tbody>{(detail.lines || []).map((line, index) => <tr key={line.id || `${line.sku}-${index}`}><td>{line.lineNo || index + 1}</td><td><strong>{line.sku}</strong><span>{line.itemName}</span>{line.description && <small>{line.description}</small>}</td><td>{number(line.qty)} {line.uom}</td><td>{currency(line.unitPrice, detail.currency)}</td><td>{number(line.discountPercent)}%<span>{currency(line.discountAmount, detail.currency)}</span></td><td>{currency(line.dpp, detail.currency)}</td><td>{line.taxCode || `${number(line.taxRate)}%`}<span>{currency(line.taxAmount, detail.currency)}</span></td><td>{currency(line.lineTotal, detail.currency)}</td></tr>)}</tbody></table>

    <div className="so-print-lower">
      <div className="so-print-notes"><span>Notes</span><p>{detail.notes || '—'}</p>{taxRows.length > 0 && <><span>Tax Summary</span>{taxRows.map((tax, index) => <p key={`${tax.taxCode}-${index}`}>{tax.taxCode || tax.taxName}: DPP {currency(tax.dpp, detail.currency)} · Tax {currency(tax.taxAmount, detail.currency)}</p>)}</>}</div>
      <div className="so-print-totals"><div><span>Subtotal</span><strong>{currency(detail.subtotal, detail.currency)}</strong></div><div><span>Discount</span><strong>- {currency(detail.discount, detail.currency)}</strong></div><div><span>DPP</span><strong>{currency(detail.dpp, detail.currency)}</strong></div><div><span>PPN / Tax</span><strong>{currency(detail.tax, detail.currency)}</strong></div><div className="grand"><span>Grand Total</span><strong>{currency(detail.total, detail.currency)}</strong></div></div>
    </div>

    <footer className="so-print-footer">
      <div><span>Prepared By</span><strong>{detail.createdBy || 'System'}</strong><small>{detail.createdAt ? new Date(detail.createdAt).toLocaleString('id-ID') : '—'}</small></div>
      <div><span>Approved By</span><strong>{approved?.actor || '—'}</strong><small>{approved?.occurredAt ? new Date(approved.occurredAt).toLocaleString('id-ID') : '—'}</small></div>
      <div><span>Document Scope</span><strong>{detail.entityCode} / {detail.siteCode}</strong><small>Revision #{detail.revisionNo || 0}</small></div>
    </footer>
  </section>, document.body);
}
