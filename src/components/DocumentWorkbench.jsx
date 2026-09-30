import React, { useMemo, useState } from 'react';
import { CalendarDays, ChevronRight, CircleDollarSign, MapPin, Package, Search, Truck, UserRound } from 'lucide-react';
import PageHeader from './PageHeader';
import StatusPill from './StatusPill';

const toneFor = (status) => {
  const value = status.toLowerCase();
  if (value.includes('delivered') || value.includes('shipped') || value.includes('approved') || value.includes('ready')) return 'success';
  if (value.includes('hold') || value.includes('blocked')) return 'danger';
  if (value.includes('picking') || value.includes('loading') || value.includes('partial')) return 'warning';
  return 'info';
};

export default function DocumentWorkbench({ config }) {
  const [selectedId, setSelectedId] = useState(config.documents[0].id);
  const [query, setQuery] = useState('');
  const selected = config.documents.find((doc) => doc.id === selectedId) || config.documents[0];
  const docs = useMemo(() => config.documents.filter((doc) => `${doc.id} ${doc.customer} ${doc.status}`.toLowerCase().includes(query.toLowerCase())), [config.documents, query]);

  return (
    <>
      <PageHeader eyebrow={config.eyebrow} title={config.title} description={config.description} actionLabel={config.actionLabel} />
      <div className="document-layout">
        <aside className="surface-card document-list-pane">
          <div className="document-list-head">
            <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Cari ${config.shortName}...`} /></label>
            <span>{docs.length} dokumen</span>
          </div>
          <div className="document-list">
            {docs.map((doc) => (
              <button key={doc.id} className={`document-row ${doc.id === selected.id ? 'active' : ''}`} onClick={() => setSelectedId(doc.id)}>
                <div className="document-row__top"><strong>{doc.id}</strong><StatusPill tone={toneFor(doc.status)}>{doc.status}</StatusPill></div>
                <span>{doc.customer}</span>
                <div className="document-row__meta"><small>{doc.date}</small><strong>{doc.total}</strong></div>
              </button>
            ))}
          </div>
        </aside>

        <section className="document-workspace">
          <div className="surface-card document-hero">
            <div className="document-hero__top">
              <div>
                <div className="doc-kicker">{config.shortName} · {selected.entity} · {selected.site}</div>
                <h2>{selected.id}</h2>
                <p>{selected.customer}</p>
              </div>
              <StatusPill tone={toneFor(selected.status)}>{selected.status}</StatusPill>
            </div>
            <div className="doc-summary-grid">
              <div><CalendarDays size={15}/><span>Document date</span><strong>{selected.date}</strong></div>
              <div><UserRound size={15}/><span>Owner</span><strong>{selected.owner}</strong></div>
              <div><MapPin size={15}/><span>{config.locationLabel || 'Location'}</span><strong>{selected.location}</strong></div>
              <div><CircleDollarSign size={15}/><span>Grand total</span><strong>{selected.total}</strong></div>
            </div>
          </div>

          <div className="surface-card lifecycle-card">
            <div className="lifecycle-head"><strong>Document lifecycle</strong><span>{selected.progressLabel}</span></div>
            <div className="lifecycle-track">
              {config.lifecycle.map((step, index) => (
                <React.Fragment key={step}>
                  <div className={`lifecycle-step ${index <= selected.step ? 'done' : ''} ${index === selected.step ? 'current' : ''}`}>
                    <span>{index + 1}</span><small>{step}</small>
                  </div>
                  {index < config.lifecycle.length - 1 && <div className={`lifecycle-line ${index < selected.step ? 'done' : ''}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="document-content-grid">
            <section className="surface-card document-section">
              <header><div><h3>{config.lineTitle}</h3><p>{config.lineSubtitle}</p></div><span>{selected.lines.length} lines</span></header>
              <div className="table-wrap">
                <table className="data-table document-lines">
                  <thead><tr>{config.columns.map((col) => <th key={col.key}>{col.label}</th>)}</tr></thead>
                  <tbody>{selected.lines.map((line, idx) => <tr key={idx}>{config.columns.map((col) => <td key={col.key}>{line[col.key]}</td>)}</tr>)}</tbody>
                </table>
              </div>
              <div className="doc-totals">
                {selected.totals.map(([label, value], index) => <div key={label} className={index === selected.totals.length - 1 ? 'grand' : ''}><span>{label}</span><strong>{value}</strong></div>)}
              </div>
            </section>

            <aside className="document-side-stack">
              <section className="surface-card document-section compact-info">
                <header><div><h3>{config.sideTitle}</h3><p>{config.sideSubtitle}</p></div></header>
                {selected.info.map(([label, value, icon]) => {
                  const Icon = icon === 'truck' ? Truck : icon === 'package' ? Package : MapPin;
                  return <div key={label} className="info-row"><Icon size={15}/><div><span>{label}</span><strong>{value}</strong></div></div>;
                })}
              </section>
              <section className="surface-card document-section compact-info">
                <header><div><h3>Related documents</h3><p>Traceability antar dokumen.</p></div></header>
                {selected.related.map(([label, value]) => <button className="related-row" key={label}><div><span>{label}</span><strong>{value}</strong></div><ChevronRight size={15}/></button>)}
              </section>
            </aside>
          </div>
        </section>
      </div>
    </>
  );
}
