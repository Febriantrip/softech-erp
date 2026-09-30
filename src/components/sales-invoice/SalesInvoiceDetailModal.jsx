import React from 'react';
import Modal from '../Modal';
import { dateLabel, money, number } from '../../utils/erp';

export default function SalesInvoiceDetailModal({open,detail,onClose,onPrint}) {
  return <Modal wide open={open} onClose={onClose} title={detail?.documentNo||'Sales Invoice'} subtitle={detail?`${detail.customer?.name} · ${detail.status}`:'Memuat detail dari PostgreSQL...'} footer={<><button className="btn" onClick={onClose}>Tutup</button><button className="btn btn-primary" onClick={onPrint} disabled={!detail}>Print A4</button></>}>
    {detail&&<div className="si-detail">
      <div className="si-facts"><div><span>Invoice Date</span><strong>{dateLabel(detail.invoiceDate)}</strong></div><div><span>Due Date</span><strong>{dateLabel(detail.dueDate)}</strong></div><div><span>SO</span><strong>{detail.salesOrderNo}</strong></div><div><span>Shipment</span><strong>{detail.shipmentNo||'Legacy Invoice'}</strong></div><div><span>Terms</span><strong>{detail.paymentTerms||'—'}</strong></div><div><span>Journal</span><strong>{detail.journalNo||'Belum posting'}</strong></div></div>
      <div className="si-scroll"><table className="data-table"><thead><tr><th>Item</th><th>Qty</th><th>Harga</th><th>Gross</th><th>Discount</th><th>DPP</th><th>Tax</th><th>Total</th></tr></thead><tbody>{detail.lines.map(l=><tr key={l.id}><td><strong>{l.sku}</strong><small>{l.itemName}</small></td><td>{number(l.qty)} {l.uom}</td><td>{money(l.unitPrice)}</td><td>{money(l.gross)}</td><td>{money(l.discount)}</td><td>{money(l.dpp)}</td><td>{money(l.tax)}</td><td>{money(l.total)}</td></tr>)}</tbody></table></div>
      <div className="si-totals"><div><span>Subtotal</span><strong>{money(detail.subtotal)}</strong></div><div><span>Discount</span><strong>- {money(detail.discount)}</strong></div><div><span>DPP</span><strong>{money(detail.dpp)}</strong></div><div><span>PPN / Tax</span><strong>{money(detail.tax)}</strong></div><div className="si-grand"><span>Grand Total</span><strong>{money(detail.total)}</strong></div></div>
    </div>}
  </Modal>;
}
