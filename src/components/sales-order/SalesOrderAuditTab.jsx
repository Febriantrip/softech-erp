import React from 'react';
import { Clock3, FileJson2 } from 'lucide-react';

function parsed(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return value; }
}

function meaningful(value) {
  const v = parsed(value);
  if (v == null) return false;
  if (typeof v === 'string') return v.trim() !== '' && v.trim() !== '{}';
  if (Array.isArray(v)) return v.length > 0;
  return Object.keys(v).length > 0;
}

function JsonPanel({ label, value }) {
  if (!meaningful(value)) return null;
  const v = parsed(value);
  const rendered = typeof v === 'string' ? v : JSON.stringify(v, null, 2);
  return <div className="so-audit-json"><span>{label}</span><pre>{rendered}</pre></div>;
}

export default function SalesOrderAuditTab({ items = [] }) {
  if (!items.length) return <div className="so-empty-panel">Belum ada audit trail.</div>;
  return <div className="so-audit-list">{items.map((item, index) => {
    const hasPayload = meaningful(item.before) || meaningful(item.after) || meaningful(item.metadata);
    return <article className="so-audit-row" key={item.id || `${item.occurredAt || 'event'}-${index}`}>
      <span className="so-history-icon"><Clock3 size={14}/></span>
      <div className="so-audit-main">
        <div className="so-audit-title"><strong>{String(item.action || item.status || 'activity').replaceAll('_', ' ')}</strong>{item.status && <span className="so-audit-status">{item.status}</span>}</div>
        <span>{item.actor || 'System'}{item.module ? ` · ${item.module}` : ''}</span>
        <small>{item.occurredAt ? new Date(item.occurredAt).toLocaleString('id-ID') : '—'}{item.requestId ? ` · Request ${item.requestId}` : ''}</small>
        {hasPayload && <details className="so-audit-details"><summary><FileJson2 size={13}/> Payload audit</summary><div className="so-audit-json-grid"><JsonPanel label="Before" value={item.before}/><JsonPanel label="After" value={item.after}/><JsonPanel label="Metadata" value={item.metadata}/></div></details>}
      </div>
    </article>;
  })}</div>;
}
