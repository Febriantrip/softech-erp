import React from 'react';
import { BarChart3, Download, FileText, Printer } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ModuleCatalog from '../components/ModuleCatalog';
import { reportGroups } from '../data/erpModules';

export default function ReportsPage() {
  return (
    <>
      <PageHeader eyebrow="06 · Report" title="Report Center" description="Standard report, user-defined report, operational inquiry, financial summary, exception log, barcode printing, dan downloadable output." />
      <div className="stats-grid">
        <StatCard title="Standard Reports" value="86" hint="Across modules" trend={3.2} icon={FileText} />
        <StatCard title="User Reports" value="24" hint="Published" trend={8.1} icon={BarChart3} />
        <StatCard title="Exports Today" value="39" hint="XLSX, CSV, PDF" trend={5.4} icon={Download} />
        <StatCard title="Print Jobs" value="12" hint="Barcode & documents" trend={-2.4} icon={Printer} />
      </div>
      <ModuleCatalog groups={reportGroups} compact />
    </>
  );
}
