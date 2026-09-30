import React from 'react';
import { Calculator, Landmark, PackageSearch, RefreshCw } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import ModuleCatalog from '../components/ModuleCatalog';
import { processes } from '../data/erpModules';

export default function ProcessesPage() {
  return (
    <>
      <PageHeader eyebrow="03 · Process" title="Operational & Periodic Processes" description="Batch process dan controlled process untuk inventory, costing, bank, journal, tax, collection, period close, year-end, dan data maintenance." />
      <div className="stats-grid">
        <StatCard title="Scheduled Jobs" value="16" hint="12 healthy, 4 manual" trend={2.1} icon={RefreshCw} />
        <StatCard title="Inventory Jobs" value="5" hint="Costing & stock" trend={0.8} icon={PackageSearch} />
        <StatCard title="Finance Jobs" value="11" hint="GL, bank, tax" trend={4.2} icon={Landmark} />
        <StatCard title="Last Revaluation" value="31 Aug" hint="Completed" trend={1.2} icon={Calculator} />
      </div>
      <ModuleCatalog groups={[{ title: 'Processes', description: 'Jalankan dengan role, approval, lock, audit log, dan parameter yang sesuai.', items: processes }]} compact />
    </>
  );
}
