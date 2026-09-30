import React, { useMemo, useState } from 'react';
import { CircleDollarSign, HandCoins, Hourglass, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money } from '../utils/erp';

function agingInfo(dueDate, outstanding) {
  if (Number(outstanding) <= 0) return { label: 'Closed', overdue: false, days: 0 };
  const today = new Date(); today.setHours(0,0,0,0);
  const due = new Date(`${dueDate}T00:00:00`);
  const days = Math.floor((today - due) / 86400000);
  return days > 0 ? { label: `${days} hari overdue`, overdue: true, days } : { label: 'Current', overdue: false, days };
}

export default function ArApPage() {
  const { data } = useERPData();
  const navigate = useNavigate();
  const [tab, setTab] = useState('AR');
  const arRows = useMemo(() => data.arOpenItems.filter((row) => Number(row.outstanding) > 0).map((row) => {
    const customer = data.customers.find((x) => x.id === row.customerId);
    const aging = agingInfo(row.dueDate, row.outstanding);
    return { party: customer?.name || row.customerId, doc: row.invoiceId, due: dateLabel(row.dueDate), amount: money(row.outstanding), age: aging.label, status: aging.overdue ? 'Overdue' : 'Open', raw: row };
  }), [data.arOpenItems, data.customers]);
  const apRows = useMemo(() => data.apOpenItems.filter((row) => Number(row.outstanding) > 0).map((row) => {
    const aging = agingInfo(row.dueDate, row.outstanding);
    const supplier = data.suppliers?.find((x) => x.id === row.supplierId);
    return { party: supplier?.name || row.supplier || row.supplierId, doc: row.billId, due: dateLabel(row.dueDate), amount: money(row.outstanding), age: aging.label, status: aging.overdue ? 'Overdue' : 'Open', raw: row };
  }), [data.apOpenItems, data.suppliers]);
  const rows = tab === 'AR' ? arRows : apRows;
  const arOutstanding = data.arOpenItems.reduce((sum,row)=>sum+Number(row.outstanding||0),0);
  const arOverdue = data.arOpenItems.filter((row)=>agingInfo(row.dueDate,row.outstanding).overdue).reduce((sum,row)=>sum+Number(row.outstanding||0),0);
  const apOutstanding = data.apOpenItems.reduce((sum,row)=>sum+Number(row.outstanding||0),0);
  const dueWeek = [...data.arOpenItems, ...data.apOpenItems].filter((row)=>{const diff=(new Date(`${row.dueDate}T00:00:00`)-new Date())/86400000; return diff>=0&&diff<=7;}).reduce((s,row)=>s+Number(row.outstanding||0),0);

  return (
    <>
      <PageHeader eyebrow="Receivable & Payable" title="AR / AP Control Center" description="Open-item ledger, aging, collection, supplier payment, customer exposure, dan reconciliation ke general ledger." actionLabel={tab === 'AR' ? 'Receive Payment' : 'Pay Supplier'} onAction={tab === 'AR' ? () => navigate('/transactions/financials/receipts') : () => navigate('/transactions/financials/supplier-payments')} />
      <div className="stats-grid">
        <StatCard title="AR Outstanding" value={money(arOutstanding)} hint={`${arRows.length} open item`} trend={0} icon={WalletCards} />
        <StatCard title="AR Overdue" value={money(arOverdue)} hint={`${arOutstanding ? ((arOverdue/arOutstanding)*100).toFixed(1) : 0}% dari AR`} trend={0} icon={Hourglass} />
        <StatCard title="AP Outstanding" value={money(apOutstanding)} hint={`${apRows.length} vendor bill`} trend={0} icon={HandCoins} />
        <StatCard title="Due Next 7 Days" value={money(dueWeek)} hint="AR + AP upcoming" trend={0} icon={CircleDollarSign} />
      </div>
      <SectionCard title="Outstanding Documents" subtitle="Open-item aging berdasarkan due date" action={<div className="segmented"><button className={tab === 'AR' ? 'active' : ''} onClick={() => setTab('AR')}>Receivable</button><button className={tab === 'AP' ? 'active' : ''} onClick={() => setTab('AP')}>Payable</button></div>}>
        <DataTable columns={[
          { key: 'party', label: tab === 'AR' ? 'Customer' : 'Supplier' }, { key: 'doc', label: 'Document' }, { key: 'due', label: 'Due Date' }, { key: 'amount', label: 'Outstanding' }, { key: 'age', label: 'Aging' },
          { key: 'status', label: 'Status', render: (value) => <StatusPill tone={value === 'Overdue' ? 'danger' : 'info'}>{value}</StatusPill> }
        ]} rows={rows} />
        {tab === 'AR' && <div className="ar-footer-actions"><span>AR berasal dari Sales Invoice yang sudah diposting. Receipt akan mengurangi outstanding dan customer credit exposure.</span><div><button className="btn" onClick={() => navigate('/transactions/financials/sales-invoice')}>Open Sales Invoice</button><button className="btn btn-primary" onClick={() => navigate('/transactions/financials/receipts')}>Receive Payment</button></div></div>}
        {tab === 'AP' && <div className="ar-footer-actions"><span>AP berasal dari Purchase Invoice yang sudah lolos 3-way match dan diposting. Supplier Payment akan mengurangi outstanding dan saldo bank/cash.</span><div><button className="btn" onClick={() => navigate('/transactions/financials/purchase-invoice')}>Open Purchase Invoice</button><button className="btn btn-primary" onClick={() => navigate('/transactions/financials/supplier-payments')}>Pay Supplier</button></div></div>}
      </SectionCard>
    </>
  );
}
