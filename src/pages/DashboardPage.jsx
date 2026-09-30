import React from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Banknote, Boxes, CircleDollarSign, ShoppingBag, Truck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import TrendChart from '../components/TrendChart';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { quickActions } from '../data/navigation';
import { useOrg } from '../context/OrgContext';

const salesTrend = [
  { label: 'Mar', value: 4.1 }, { label: 'Apr', value: 4.6 }, { label: 'Mei', value: 4.4 },
  { label: 'Jun', value: 5.2 }, { label: 'Jul', value: 5.8 }, { label: 'Agu', value: 6.1 }, { label: 'Sep', value: 6.7 }
];

const recentOrders = [
  { id: 'SO-2609-0108', customer: 'PT Sinar Retail Indonesia', value: 'Rp 184.500.000', site: 'JKT-HO', status: 'Approved' },
  { id: 'SO-2609-0107', customer: 'CV Prima Niaga', value: 'Rp 76.250.000', site: 'TGR-WH', status: 'Picking' },
  { id: 'SO-2609-0106', customer: 'PT Arunika Mart', value: 'Rp 129.800.000', site: 'CKR-DC', status: 'Credit Hold' },
  { id: 'SO-2609-0105', customer: 'UD Sejahtera Abadi', value: 'Rp 43.900.000', site: 'JKT-HO', status: 'Delivered' }
];

export default function DashboardPage() {
  const { entity, site } = useOrg();
  const navigate = useNavigate();
  const quickPaths = {
    'Sales Order': '/transactions/distribution/sales-order',
    'Delivery Order': '/transactions/distribution/delivery-order',
    'Jurnal Umum': '/finance',
    'Stock Transfer': '/warehouse'
  };
  return (
    <>
      <PageHeader
        eyebrow={`${entity.code} · ${site.code}`}
        title="Executive Dashboard"
        description="Ringkasan operasional, penjualan, cash flow, persediaan, dan exception yang perlu ditindaklanjuti."
      />

      <div className="stats-grid">
        <StatCard title="Net Sales MTD" value="Rp 6,72 M" hint="vs Agustus" trend={9.8} icon={CircleDollarSign} />
        <StatCard title="Gross Margin" value="24,8%" hint="target 23,5%" trend={2.1} icon={Banknote} />
        <StatCard title="AR Outstanding" value="Rp 3,14 M" hint="31,2% overdue" trend={-4.6} icon={ShoppingBag} />
        <StatCard title="Inventory Value" value="Rp 8,93 M" hint="DOH 37 hari" trend={3.4} icon={Boxes} />
      </div>

      <div className="dashboard-grid">
        <SectionCard title="Sales Performance" subtitle="Net sales 7 bulan terakhir · dalam miliar rupiah" className="span-2">
          <TrendChart data={salesTrend} />
          <div className="chart-summary-row">
            <div><span className="muted">YTD Sales</span><strong>Rp 37,4 M</strong></div>
            <div><span className="muted">Target YTD</span><strong>Rp 39,0 M</strong></div>
            <div><span className="muted">Achievement</span><strong>95,9%</strong></div>
          </div>
        </SectionCard>

        <SectionCard title="Attention Center" subtitle="Exception prioritas hari ini">
          <div className="attention-list">
            <div className="attention-item warning-card"><AlertTriangle size={18} /><div><strong>17 invoice overdue</strong><span>Rp 980,4 jt perlu follow-up collection.</span></div></div>
            <div className="attention-item danger-card"><Boxes size={18} /><div><strong>8 item di bawah safety stock</strong><span>3 item berdampak ke open sales order.</span></div></div>
            <div className="attention-item info-card"><Truck size={18} /><div><strong>5 inbound terlambat</strong><span>PO melewati ETA lebih dari 2 hari.</span></div></div>
          </div>
        </SectionCard>
      </div>

      <div className="dashboard-grid dashboard-grid--lower">
        <SectionCard title="Sales Order Terbaru" subtitle="Order terbaru lintas site" className="span-2" action={<button className="btn btn-ghost">Lihat semua</button>}>
          <DataTable
            columns={[
              { key: 'id', label: 'No. SO' },
              { key: 'customer', label: 'Customer' },
              { key: 'site', label: 'Site' },
              { key: 'value', label: 'Nilai' },
              { key: 'status', label: 'Status', render: (value) => {
                const tone = value === 'Delivered' ? 'success' : value === 'Credit Hold' ? 'danger' : value === 'Picking' ? 'warning' : 'info';
                return <StatusPill tone={tone}>{value}</StatusPill>;
              }}
            ]}
            rows={recentOrders}
          />
        </SectionCard>

        <SectionCard title="Quick Actions" subtitle="Akses transaksi paling sering dipakai">
          <div className="quick-action-grid">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return <button key={action.label} className="quick-action" onClick={() => navigate(quickPaths[action.label])}><span><Icon size={19} /></span><strong>{action.label}</strong><small>Buka workspace transaksi</small></button>;
            })}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
