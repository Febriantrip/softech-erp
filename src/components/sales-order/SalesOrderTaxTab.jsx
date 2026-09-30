import React from 'react';
import { money, number } from '../../utils/erp';

export default function SalesOrderTaxTab({ detail }) {
  const rows = detail.taxSummary || [];
  return <div className="so-tax-layout"><div className="so-detail-table"><table className="data-table"><thead><tr><th>Tax Code</th><th>Treatment</th><th>Rate</th><th>Lines</th><th>DPP</th><th>Tax</th><th>Total</th></tr></thead><tbody>{rows.length === 0 ? <tr><td colSpan="7" className="empty-cell">Tidak ada ringkasan pajak.</td></tr> : rows.map((row, index) => <tr key={`${row.taxCode}-${row.rate}-${index}`}><td><strong>{row.taxCode}</strong><small>{row.taxName}</small></td><td><span className="so-tax-treatment">{String(row.treatment || '').replaceAll('_', ' ')}</span></td><td>{number(row.rate)}%</td><td>{number(row.lineCount)}</td><td>{money(row.dpp)}</td><td>{money(row.taxAmount)}</td><td>{money(row.total)}</td></tr>)}</tbody></table></div><div className="so-order-summary detail"><div><span>Subtotal</span><strong>{money(detail.subtotal)}</strong></div><div><span>Discount</span><strong>- {money(detail.discount)}</strong></div><div><span>DPP</span><strong>{money(detail.dpp)}</strong></div><div><span>PPN / Tax</span><strong>{money(detail.tax)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(detail.total)}</strong></div></div></div>;
}
