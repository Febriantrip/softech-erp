import React from 'react';

export default function SectionCard({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={`surface-card section-card ${className}`}>
      <header className="section-card__header">
        <div>
          <h3>{title}</h3>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      <div className="section-card__body">{children}</div>
    </section>
  );
}
