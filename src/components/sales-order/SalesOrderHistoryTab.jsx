import React from 'react';
import { Clock3 } from 'lucide-react';

export default function SalesOrderHistoryTab({ items = [], emptyText = 'Belum ada activity.' }) {
  if (!items.length) return <div className="so-empty-panel">{emptyText}</div>;
  return <div className="so-history-list">{items.map((item, index) => <div className="so-history-row" key={`${item.occurredAt || item.requestId || 'event'}-${index}`}><span className="so-history-icon"><Clock3 size={14}/></span><div><strong>{String(item.action || item.status || 'activity').replaceAll('_', ' ')}</strong><span>{item.actor || 'System'}{item.status ? ` · ${item.status}` : ''}</span><small>{item.occurredAt ? new Date(item.occurredAt).toLocaleString('id-ID') : '—'}{item.requestId ? ` · ${item.requestId}` : ''}</small></div></div>)}</div>;
}
