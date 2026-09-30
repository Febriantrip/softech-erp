import React from 'react';
import {
  Braces,
  Boxes,
  Database,
  HardDriveDownload,
  Network,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  Workflow,
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import StatusPill from '../components/StatusPill';
import DataTable from '../components/DataTable';
import { runtimeConfig } from '../config/runtime';
import { usePlatformHealth } from '../hooks/usePlatformHealth';

const stages = [
  { id: 'V10', layer: 'Production Foundation', status: 'Completed', scope: 'Go API · PostgreSQL schema · Redis · Docker · typed API boundary' },
  { id: 'V11', layer: 'Core Transaction Migration', status: 'Active', scope: 'Sales · Purchase · Warehouse · Inventory are PostgreSQL-backed in API mode' },
  { id: 'V12', layer: 'Financial Engine', status: 'Next', scope: 'GL · AR · AP · Posting · Closing in PostgreSQL' },
  { id: 'V13', layer: 'Enterprise Engine', status: 'Planned', scope: 'Intercompany · Consolidation · Governance backend' },
  { id: 'V14', layer: 'Reporting & BI', status: 'Planned', scope: 'Financial statements · analytics · materialized reporting' },
  { id: 'V15', layer: 'Add-on Ecosystem', status: 'Planned', scope: 'Sales Mate · Driver Mate · POS · Supplier Portal' },
];

function dependencyTone(reachable) {
  return reachable ? 'success' : 'danger';
}

export default function ProductionFoundationPage() {
  const { loading, live, ready, error, checkedAt, refresh } = usePlatformHealth();
  const apiOnline = Boolean(live);
  const platformReady = Boolean(ready?.status === 'ready');
  const dependencies = ready?.dependencies || [
    { name: 'postgresql', address: 'postgres:5432', reachable: false, latencyMs: 0 },
    { name: 'redis', address: 'redis:6379', reachable: false, latencyMs: 0 },
  ];

  return <>
    <PageHeader
      eyebrow="Platform / Production Architecture"
      title="V11 Core Transaction Migration"
      description="Production bridge tahap kedua: Sales Order, Purchase Order, Receiving, Warehouse dan Inventory punya PostgreSQL transaction service nyata, sementara prototype mode tetap tersedia sebagai fallback aman."
    />

    <div className="stats-grid">
      <StatCard title="ERP API" value={apiOnline ? 'ONLINE' : 'OFFLINE'} hint={live ? `${live.service} · ${live.environment}` : 'run Go API / Docker stack'} trend={apiOnline ? 1 : -1} icon={ServerCog}/>
      <StatCard title="Platform Ready" value={platformReady ? 'READY' : 'DEGRADED'} hint="PostgreSQL + Redis dependency gate" trend={platformReady ? 1 : -1} icon={Network}/>
      <StatCard title="Frontend Mode" value={runtimeConfig.dataMode.toUpperCase()} hint={runtimeConfig.isApiMode ? 'API data source enabled' : 'V9 transaction engine remains prototype'} trend={0} icon={Braces}/>
      <StatCard title="Architecture" value="MODULAR" hint="monolith first · service extraction later" trend={0} icon={Workflow}/>
    </div>

    <section className="surface-card v10-architecture-card">
      <div className="v10-architecture-copy">
        <span className="v10-kicker">TARGET RUNTIME</span>
        <h3>React ERP → Go API → PostgreSQL + Redis</h3>
        <p>V11 mengaktifkan core transaction slice pertama. Saat VITE_DATA_MODE=api, Sales Order, Purchase Order dan Warehouse membaca/menulis PostgreSQL melalui Go API. Prototype mode tetap menjaga flow V9 saat backend belum dijalankan.</p>
      </div>
      <div className="v10-stack-flow" aria-label="Production architecture">
        <div><Braces size={18}/><strong>React + Vite</strong><span>TypeScript transition</span></div>
        <i>→</i>
        <div><ServerCog size={18}/><strong>Go API</strong><span>REST /api/v1</span></div>
        <i>→</i>
        <div><Database size={18}/><strong>PostgreSQL</strong><span>source of truth</span></div>
        <b>+</b>
        <div><Boxes size={18}/><strong>Redis</strong><span>cache · queue · lock</span></div>
      </div>
    </section>

    <div className="v10-grid">
      <SectionCard
        title="Runtime Health"
        subtitle={`API ${runtimeConfig.apiBaseUrl} · checked ${checkedAt ? checkedAt.toLocaleTimeString('id-ID') : '-'}`}
        action={<button className="btn btn-sm" disabled={loading} onClick={() => refresh()}><RefreshCw size={14} className={loading ? 'spin-soft' : ''}/> Refresh</button>}
      >
        <div className="v10-health-list">
          <div className="v10-health-row"><div><ServerCog size={16}/><span><strong>Go API</strong><small>Liveness endpoint</small></span></div><StatusPill tone={apiOnline ? 'success' : 'danger'}>{apiOnline ? 'Online' : 'Offline'}</StatusPill></div>
          {dependencies.map((dep) => <div className="v10-health-row" key={dep.name}><div>{dep.name === 'postgresql' ? <Database size={16}/> : <Boxes size={16}/>}<span><strong>{dep.name}</strong><small>{dep.address} · {dep.latencyMs || 0} ms</small></span></div><StatusPill tone={dependencyTone(dep.reachable)}>{dep.reachable ? 'Reachable' : 'Unavailable'}</StatusPill></div>)}
        </div>
        {error && <div className="v10-inline-note warning"><strong>Health check</strong><span>{error}. V9 tetap dapat berjalan karena data mode default masih Prototype.</span></div>}
      </SectionCard>

      <SectionCard title="Foundation Controls" subtitle="Guardrails yang sudah disiapkan sebelum transaction repository migration.">
        <div className="v10-control-list">
          <div><ShieldCheck size={16}/><span><strong>Bootstrap Authentication</strong><small>Signed HS256 token, auth middleware, entity/site scope validation.</small></span></div>
          <div><Network size={16}/><span><strong>API Boundary</strong><small>Versioned REST JSON, request ID, CORS, security headers, graceful shutdown.</small></span></div>
          <div><Database size={16}/><span><strong>PostgreSQL Foundation</strong><small>Entity/site/access, document sequence, audit, idempotency, outbox schema.</small></span></div>
          <div><HardDriveDownload size={16}/><span><strong>Docker Runtime</strong><small>Frontend, Go API, PostgreSQL 18, Redis 7, persistent volumes.</small></span></div>
        </div>
      </SectionCard>
    </div>

    <SectionCard title="Production Migration Roadmap" subtitle="Tidak ada big-bang rewrite. Domain dipindahkan satu per satu dari prototype adapter ke backend repository.">
      <DataTable rows={stages} columns={[
        { key: 'id', label: 'Stage', render: (value) => <strong>{value}</strong> },
        { key: 'layer', label: 'Layer' },
        { key: 'scope', label: 'Scope' },
        { key: 'status', label: 'Status', render: (value) => <StatusPill tone={value === 'Active' ? 'success' : value === 'Completed' ? 'success' : value === 'Next' ? 'warning' : 'neutral'}>{value}</StatusPill> },
      ]}/>
    </SectionCard>

    <section className="surface-card v10-boundary-note">
      <ShieldCheck size={18}/>
      <div><strong>Safe migration boundary</strong><span>API mode sekarang sudah mengganti source of truth untuk workspace Sales Order, Purchase Order, Receiving dan Warehouse. Semua command memakai idempotency key, PostgreSQL transaction, row lock/versioning, server numbering, audit event dan outbox. Mode Prototype tetap tersedia untuk safe fallback.</span></div>
    </section>
  </>;
}
