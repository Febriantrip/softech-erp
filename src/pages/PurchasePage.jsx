import React from 'react';
import { CalendarClock, ClipboardCheck, PackageOpen, Receipt, ArrowRight, ClipboardList, Store, FileCheck2, Truck, WalletCards } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money, statusTone } from '../utils/erp';

const steps = [
  ['Purchase Request', ClipboardList, '/transactions/distribution/purchase-request'],
  ['RFQ', Store, '/transactions/distribution/rfq'],
  ['Purchase Order', FileCheck2, '/transactions/distribution/purchase-order'],
  ['Receiving', Truck, '/transactions/distribution/receiving'],
  ['Purchase Invoice', Receipt, '/transactions/financials/purchase-invoice'],
  ['Supplier Payment', WalletCards, '/transactions/financials/supplier-payments']
];

export default function PurchasePage() {
  const { data } = useERPData();
  const navigate = useNavigate();
  const openPO = data.purchaseOrders.filter((po) => !['Closed','Cancelled'].includes(po.status));
  const openValue = openPO.reduce((sum, po) => sum + po.lines.reduce((s,l)=>s+Number(l.qty||0)*Number(l.price||0),0), 0);
  const today = new Date(); today.setHours(0,0,0,0);
  const nextWeek = new Date(today); nextWeek.setDate(nextWeek.getDate()+7);
  const incoming = openPO.filter((po)=>{const eta=new Date(`${po.eta}T00:00:00`);return eta>=today&&eta<=nextWeek;});
  const incomingValue = incoming.reduce((sum, po) => sum + po.lines.reduce((s,l)=>s+Number(l.qty||0)*Number(l.price||0),0), 0);
  const late = openPO.filter((po)=>new Date(`${po.eta}T00:00:00`)<today && !['Received','Invoiced','Closed'].includes(po.status));
  const postedInvoices = data.purchaseInvoices.filter((inv)=>inv.postingStatus==='Posted');
  const matchRate = data.purchaseInvoices.length ? (data.purchaseInvoices.filter((inv)=>inv.matchStatus==='Matched').length/data.purchaseInvoices.length)*100 : 100;
  const rows = openPO.slice(0,12).map((po)=>{
    const supplier=data.suppliers.find((s)=>s.id===po.supplierId);
    const ordered=po.lines.reduce((s,l)=>s+Number(l.qty||0),0); const received=po.lines.reduce((s,l)=>s+Number(l.receivedQty||0),0);
    const value=po.lines.reduce((s,l)=>s+Number(l.qty||0)*Number(l.price||0),0);
    return {id:po.id,supplier:supplier?.name||po.supplierId,eta:dateLabel(po.eta),total:value,received:ordered?Math.round(received/ordered*100):0,status:po.status};
  });
  return (
    <>
      <PageHeader eyebrow="Procure to Pay" title="Pembelian" description="Purchase Request, RFQ, Purchase Order, receiving, put away, vendor invoice, AP, dan payment dalam satu procure-to-pay flow." actionLabel="Open Purchase Order" onAction={()=>navigate('/transactions/distribution/purchase-order')} />
      <div className="stats-grid">
        <StatCard title="Open PO" value={money(openValue)} hint={`${openPO.length} PO aktif`} icon={Receipt} />
        <StatCard title="Incoming 7 Days" value={money(incomingValue)} hint={`${incoming.length} inbound schedule`} icon={PackageOpen} />
        <StatCard title="Late Delivery" value={`${late.length} PO`} hint="ETA terlewat" icon={CalendarClock} />
        <StatCard title="3-Way Match" value={`${matchRate.toFixed(1)}%`} hint={`${postedInvoices.length} posted purchase invoice`} icon={ClipboardCheck} />
      </div>

      <section className="surface-card purchase-command-center">
        <div className="purchase-command-head"><div><strong>Procure-to-Pay Workspace</strong><span>Masuk ke setiap dokumen tanpa mencari menu satu per satu.</span></div></div>
        <div className="purchase-command-grid">{steps.map(([title,Icon,path],index)=><React.Fragment key={title}><button onClick={()=>navigate(path)}><span><Icon size={18}/></span><strong>{title}</strong><small>{index===0?'Demand & approval':index===1?'Supplier sourcing':index===2?'Commit & approve':index===3?'GRN & put away':index===4?'3-way match & AP':'Bank disbursement'}</small></button>{index<steps.length-1&&<ArrowRight size={15}/>}</React.Fragment>)}</div>
      </section>

      <SectionCard title="Live Purchase Order" subtitle="Data langsung dari Procure-to-Pay transaction engine.">
        <DataTable columns={[
          { key: 'id', label: 'No. PO', render:(v)=><button className="table-link" onClick={()=>navigate('/transactions/distribution/purchase-order')}>{v}</button> },
          { key: 'supplier', label: 'Supplier' },
          { key: 'eta', label: 'ETA' },
          { key: 'total', label: 'PO Value', render:(v)=>money(v) },
          { key: 'received', label: 'Received', render:(v)=>`${v}%` },
          { key: 'status', label: 'Status', render: (value) => <StatusPill tone={statusTone(value)}>{value}</StatusPill> }
        ]} rows={rows} emptyText="Belum ada Purchase Order." />
      </SectionCard>
    </>
  );
}
