import React from 'react';
import { money, number } from '../../utils/erp';

export default function SalesOrderItemsTab({ lines = [] }) {
  return <div className="so-detail-table so-items-table"><table className="data-table"><thead><tr><th>Item</th><th>Qty</th><th>On Hand</th><th>WH Reserved</th><th>Available</th><th>This SO</th><th>Price</th><th>Disc</th><th>DPP</th><th>Tax</th><th>Total</th></tr></thead><tbody>{lines.length === 0 ? <tr><td colSpan="11" className="empty-cell">Tidak ada line item.</td></tr> : lines.map((l) => <tr key={l.id}><td><strong>{l.sku}</strong><small>{l.itemName}</small>{l.description && <small>{l.description}</small>}</td><td>{number(l.qty)} {l.uom}</td><td>{number(l.onHandStock)}</td><td>{number(l.warehouseReservedStock)}</td><td><strong>{number(l.availableStock)}</strong></td><td>{number(l.reservedQty)}</td><td>{money(l.unitPrice)}</td><td>{number(l.discountPercent)}%</td><td>{money(l.dpp)}</td><td>{l.taxCode || `${number(l.taxRate)}%`}<small>{money(l.taxAmount)}</small></td><td>{money(l.lineTotal)}</td></tr>)}</tbody></table></div>;
}
