import React from 'react';
import { BellRing, KeyRound, ListChecks, Network, ShieldCheck, Workflow } from 'lucide-react';
import PageHeader from '../components/PageHeader';

const settings = [
  ['Roles & Permissions', 'Role-based access per module, entity, site dan action.', ShieldCheck],
  ['Approval Workflow', 'Matrix approval berdasarkan nilai, dokumen, entity dan department.', Workflow],
  ['Number Sequence', 'Format nomor dokumen per entity/site/tahun/bulan.', ListChecks],
  ['Integration', 'API, webhook, marketplace, bank, tax dan external WMS/TMS.', Network],
  ['Notifications', 'In-app, email, WhatsApp gateway dan escalation rule.', BellRing],
  ['Security & Audit', 'MFA, session policy, audit trail, segregation of duties.', KeyRound]
];

export default function SettingsPage() {
  return (
    <>
      <PageHeader eyebrow="Administration" title="Pengaturan Sistem" description="Konfigurasi global ERP, workflow, akses, integrasi, numbering, fiscal period, dan keamanan." />
      <div className="report-grid">
        {settings.map(([title, desc, Icon]) => (
          <button key={title} className="report-card surface-card"><span className="icon-bubble"><Icon size={21} /></span><div><strong>{title}</strong><p>{desc}</p></div><span className="report-card__link">Konfigurasi →</span></button>
        ))}
      </div>
    </>
  );
}
