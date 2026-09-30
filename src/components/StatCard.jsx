import React from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';

export default function StatCard({ title, value, hint, trend = 0, icon: Icon }) {
  const positive = trend >= 0;
  return (
    <article className="stat-card surface-card">
      <div className="stat-card__top">
        <div>
          <p className="eyebrow">{title}</p>
          <h3>{value}</h3>
        </div>
        {Icon && <span className="icon-bubble"><Icon size={20} /></span>}
      </div>
      <div className="stat-card__footer">
        <span className={positive ? 'trend positive' : 'trend negative'}>
          {positive ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
          {Math.abs(trend)}%
        </span>
        <span className="muted">{hint}</span>
      </div>
    </article>
  );
}
