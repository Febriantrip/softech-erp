import React from 'react';
import StatusPill from '../StatusPill';
import { dateLabel, money, statusTone } from '../../utils/erp';

export default function SalesOrderOverviewTab({ detail }) {
  return <div className="so-tab-stack">
    {detail.status === 'CANCELLED' && <div className="so-cancel-banner"><strong>Dokumen dibatalkan</strong><span>{detail.cancelReason || 'Alasan pembatalan tidak tersedia.'}</span>{detail.cancelledAt && <small>{new Date(detail.cancelledAt).toLocaleString('id-ID')}</small>}</div>}
    <div className="so-detail-head"><div><span>Status</span><StatusPill tone={statusTone(detail.status)}>{detail.status}</StatusPill></div><div><span>Customer</span><strong>{detail.customer?.code} · {detail.customer?.name}</strong></div><div><span>Warehouse</span><strong>{detail.warehouse?.code} · {detail.warehouse?.name}</strong></div><div><span>Revision</span><strong>#{detail.revisionNo || 0}</strong></div></div>
    <div className="so-detail-grid"><div><span>Order Date</span><strong>{dateLabel(detail.orderDate)}</strong></div><div><span>Requested Delivery</span><strong>{detail.requestedDeliveryDate ? dateLabel(detail.requestedDeliveryDate) : '—'}</strong></div><div><span>Customer PO</span><strong>{detail.customerPo || '—'}</strong></div><div><span>Payment Terms</span><strong>{detail.paymentTerms || '—'}</strong></div><div><span>Salesperson</span><strong>{detail.salesperson || '—'}</strong></div><div><span>Entity / Site</span><strong>{detail.entityCode} / {detail.siteCode}</strong></div></div>
    <div className="so-overview-bottom"><div className="so-notes"><h4>Billing Address</h4><p>{detail.billingAddress || '—'}</p><h4>Shipping Address</h4><p>{detail.shippingAddress || '—'}</p><h4>Customer Notes</h4><p>{detail.notes || '—'}</p><h4>Internal Notes</h4><p>{detail.internalNotes || '—'}</p></div><div className="so-order-summary detail"><div><span>Subtotal</span><strong>{money(detail.subtotal)}</strong></div><div><span>Discount</span><strong>- {money(detail.discount)}</strong></div><div><span>DPP</span><strong>{money(detail.dpp)}</strong></div><div><span>PPN / Tax</span><strong>{money(detail.tax)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(detail.total)}</strong></div></div></div>
  </div>;
}
