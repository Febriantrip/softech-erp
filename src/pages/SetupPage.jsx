import React from 'react';
import PageHeader from '../components/PageHeader';
import ModuleCatalog from '../components/ModuleCatalog';
import { setupGroups } from '../data/erpModules';

export default function SetupPage() {
  return (
    <>
      <PageHeader eyebrow="05 · Setup" title="Setup & Configuration" description="Konfigurasi bisnis, numbering, tax, approval, automation, barcode, integration behavior, validation, dan utilities. Dipisahkan dari Master Data supaya governance lebih rapi." />
      <ModuleCatalog groups={setupGroups} compact />
    </>
  );
}
