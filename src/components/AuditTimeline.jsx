import React from 'react';
import { Clock3 } from 'lucide-react';
import { dateTimeLabel } from '../utils/erp';

export default function AuditTimeline({ items = [] }) {
  return (
    <div className="audit-timeline">
      {[...items].reverse().map((entry, index) => (
        <div className="audit-row" key={`${entry.at}-${index}`}>
          <span className="audit-dot"><Clock3 size={12} /></span>
          <div><strong>{entry.action}</strong><small>{entry.by} · {dateTimeLabel(entry.at)}</small></div>
        </div>
      ))}
      {!items.length && <div className="empty-state-inline">Belum ada activity.</div>}
    </div>
  );
}
