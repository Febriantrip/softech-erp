import React from 'react';
import PageHeader from '../components/PageHeader';
import ModuleCatalog from '../components/ModuleCatalog';
import { preliminaryGroups } from '../data/erpModules';

export default function PreliminarySetupPage() {
  return (
    <>
      <PageHeader eyebrow="08 · Preliminary Preparation" title="Preliminary Setup" description="Konfigurasi awal implementasi ERP: entity, site, COA format, year setup, print setup, extra fields, ID structure, integration baseline, dan foundational options." />
      <ModuleCatalog groups={preliminaryGroups} compact />
    </>
  );
}
