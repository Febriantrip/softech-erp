import React, { useState } from 'react';
import { BadgeCheck, CircleDollarSign, FileClock, PackageCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';

const rows = [
  { id: 'SO-2609-0108', date: '05 Sep 2026', customer: 'PT Sinar Retail Indonesia', channel: 'B2B', total: 'Rp 184.500.000', fulfillment: '0 / 22', status: 'Approved' },
  { id: 'SO-2609-0107', date: '05 Sep 2026', customer: 'CV Prima Niaga', channel: 'Salesman', total: 'Rp 76.250.000', fulfillment: '8 / 12', status: 'Picking' },
  { id: 'SO-2609-0106', date: '04 Sep 2026', customer: 'PT Arunika Mart', channel: 'B2B', total: 'Rp 129.800.000', fulfillment: '0 / 17', status: 'Credit Hold' },
  { id: 'SO-2609-0105', date: '04 Sep 2026', customer: 'UD Sejahtera Abadi', channel: 'Direct', total: 'Rp 43.900.000', fulfillment: '11 / 11', status: 'Delivered' }
];

export default function SalesPage() {
  const [toast, setToast] = useState('');
  const createOrder = () => {
    setToast('Draft Sales Order baru dibuat untuk demo UI.');
    setTimeout(() => setToast(''), 2200);
  };
  return (
    <>
      <PageHeader eyebrow="Order to Cash" title="Penjualan" description="Kelola quotation, sales order, approval kredit, fulfillment, delivery, invoice, retur, dan promosi." actionLabel="Sales Order Baru" onAction={createOrder} />
      {toast && <div className="toast">{toast}</div>}
      <div className="stats-grid">
        <StatCard title="Open Sales Order" value="Rp 2,48 M" hint="186 order aktif" trend={7.2} icon={FileClock} />
        <StatCard title="Ready to Ship" value="Rp 712 jt" hint="43 order" trend={12.4} icon={PackageCheck} />
        <StatCard title="Credit Hold" value="Rp 286 jt" hint="9 customer" trend={-8.1} icon={CircleDollarSign} />
        <StatCard title="Fulfillment Rate" value="96,7%" hint="30 hari terakhir" trend={1.8} icon={BadgeCheck} />
      </div>
      <SectionCard title="Sales Order" subtitle="Monitoring seluruh order dari draft sampai invoiced" action={<div className="segmented"><button className="active">Semua</button><button>Open</button><button>Hold</button><button>Done</button></div>}>
        <DataTable columns={[
          { key: 'id', label: 'No. SO' }, { key: 'date', label: 'Tanggal' }, { key: 'customer', label: 'Customer' }, { key: 'channel', label: 'Channel' }, { key: 'total', label: 'Grand Total' }, { key: 'fulfillment', label: 'Fulfillment' },
          { key: 'status', label: 'Status', render: (value) => <StatusPill tone={value === 'Delivered' ? 'success' : value === 'Credit Hold' ? 'danger' : value === 'Picking' ? 'warning' : 'info'}>{value}</StatusPill> }
        ]} rows={rows} />
      </SectionCard>
    </>
  );
}
