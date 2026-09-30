import React from 'react';
import Modal from '../Modal';
import { dateLabel,money } from '../../utils/erp';

export default function ReceiptDetailModal({detail,onClose,loading,error}) {
  return <Modal open={loading||Boolean(detail)||Boolean(error)} onClose={onClose} title={detail?.documentNo||'Receipt Detail'} subtitle="Persisted allocations · PostgreSQL source of truth" wide>
    {loading?<p>Memuat receipt...</p>:error?<p role="alert" className="d3e-error">{error}</p>:detail&&<>
      <div className="d3e-summary"><div><small>Customer</small><strong>{detail.partyName}</strong></div><div><small>Receipt Date</small><strong>{dateLabel(detail.date)}</strong></div><div><small>Bank / Method</small><strong>{detail.bankAccountCode} · {detail.method}</strong></div><div><small>Journal</small><strong>{detail.journalNo}</strong></div></div>
      <p>Reference: <strong>{detail.reference||'—'}</strong></p>
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Invoice</th><th>Allocated Amount</th><th>Current Outstanding</th></tr></thead><tbody>{(detail.allocations||[]).map(a=><tr key={a.invoiceId}><td>{a.invoiceNo}</td><td>{money(a.amount)}</td><td>{money(a.currentOutstanding)}</td></tr>)}</tbody></table></div>
      <div className="d3e-totals"><strong>Total Receipt</strong><strong>{money(detail.amount)}</strong></div>
    </>}
  </Modal>;
}
