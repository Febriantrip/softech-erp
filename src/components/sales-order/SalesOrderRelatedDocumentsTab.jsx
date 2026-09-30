import React from 'react';
import { FileText, Link2 } from 'lucide-react';
import StatusPill from '../StatusPill';
import { dateLabel, statusTone } from '../../utils/erp';

export default function SalesOrderRelatedDocumentsTab({ rows = [] }) {
  if (!rows.length) return <div className="so-empty-panel"><Link2 size={18}/>Belum ada dokumen turunan untuk Sales Order ini.</div>;
  return <div className="so-related-list">{rows.map((row) => <article key={`${row.documentType}-${row.id}`}><span className="so-related-icon"><FileText size={17}/></span><div><small>{String(row.documentType || '').replaceAll('_', ' ')}</small><strong>{row.documentNo}</strong><span>{dateLabel(row.documentDate)}</span></div><div className="so-related-state">{row.relation && <em>{String(row.relation).replaceAll('_', ' ')}</em>}<StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div></article>)}</div>;
}
