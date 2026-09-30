import React, { useEffect, useMemo, useState } from 'react';
import { BookOpenCheck, Building2, Lock, Network, RotateCcw, ShieldCheck } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import StatusPill from '../components/StatusPill';
import { useERPData } from '../context/ERPDataContext';

const initialTasks = [
  { id: 1, area: 'Sales', task: 'Pastikan seluruh delivery periode sudah invoiced', owner: 'Sales Accounting', done: true },
  { id: 2, area: 'AR', task: 'Reconcile AR open item terhadap GL control account', owner: 'AR Team', done: true },
  { id: 3, area: 'Purchase', task: 'Review GRNI dan unmatched vendor invoice', owner: 'AP Team', done: false },
  { id: 4, area: 'Inventory', task: 'Posting stock opname dan valuation adjustment', owner: 'Warehouse Finance', done: false },
  { id: 5, area: 'Bank', task: 'Bank reconciliation seluruh rekening', owner: 'Treasury', done: false },
  { id: 6, area: 'Tax', task: 'Validasi PPN keluaran dan masukan', owner: 'Tax', done: false },
  { id: 7, area: 'GL', task: 'Review journal dan pastikan debit = credit', owner: 'Accounting', done: false }
];

export default function ClosingPage() {
  const { data, scope, currentEntity, setAccountingPeriodStatus } = useERPData();
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedPeriodId, setSelectedPeriodId] = useState(data.accountingPeriods.find((p)=>p.status==='Open')?.id || data.accountingPeriods[0]?.id);

  useEffect(() => {
    if (!data.accountingPeriods.some((period) => period.id === selectedPeriodId)) {
      setSelectedPeriodId(data.accountingPeriods.find((period) => period.status === 'Open')?.id || data.accountingPeriods[0]?.id || '');
    }
  }, [data.accountingPeriods, selectedPeriodId]);

  const selectedPeriod = data.accountingPeriods.find((p)=>p.id===selectedPeriodId) || data.accountingPeriods[0];
  const progress = useMemo(() => Math.round((tasks.filter((task) => task.done).length / tasks.length) * 100), [tasks]);
  const toggle = (id) => setTasks((current) => current.map((task) => task.id === id ? { ...task, done: !task.done } : task));
  const allDone = tasks.every((task)=>task.done);
  const unpostedSales = data.salesInvoices.filter((inv)=>inv.date>=selectedPeriod?.startDate && inv.date<=selectedPeriod?.endDate && inv.postingStatus!=='Posted').length;
  const unpostedPurchase = data.purchaseInvoices.filter((inv)=>inv.date>=selectedPeriod?.startDate && inv.date<=selectedPeriod?.endDate && inv.postingStatus!=='Posted').length;
  const unposted = unpostedSales + unpostedPurchase;
  const periodJournals = data.journals.filter((j)=>j.date>=selectedPeriod?.startDate && j.date<=selectedPeriod?.endDate);
  const imbalance = periodJournals.some((j)=>Math.abs((j.lines||[]).reduce((s,l)=>s+Number(l.debit||0)-Number(l.credit||0),0))>0.5);
  const openStockTakes = data.stockTakes.filter((row)=>row.date>=selectedPeriod?.startDate && row.date<=selectedPeriod?.endDate && row.status!=='Posted').length;
  const inTransitTransfers = data.stockTransfers.filter((row)=>row.date>=selectedPeriod?.startDate && row.date<=selectedPeriod?.endDate && row.status==='In Transit').length;
  const openIntercompany = data.intercompanyTransactions.filter((row)=>row.date>=selectedPeriod?.startDate && row.date<=selectedPeriod?.endDate && ['Draft','In Transit'].includes(row.status)).length;
  const openSalesReturns = data.salesReturns.filter((row)=>row.date>=selectedPeriod?.startDate && row.date<=selectedPeriod?.endDate && !['Posted','Cancelled'].includes(row.status)).length;
  const openPurchaseReturns = data.purchaseReturns.filter((row)=>row.date>=selectedPeriod?.startDate && row.date<=selectedPeriod?.endDate && !['Posted','Cancelled'].includes(row.status)).length;
  const returnGate = openSalesReturns + openPurchaseReturns;
  const inventoryGate = openStockTakes + inTransitTransfers;
  const entityMode = scope.mode === 'ENTITY';
  const canClose = Boolean(entityMode && selectedPeriod && selectedPeriod.status==='Open' && allDone && unposted===0 && !imbalance && inventoryGate===0 && openIntercompany===0 && returnGate===0);

  const changePeriod = (status) => {
    if (!entityMode || !selectedPeriod) return false;
    if (status === 'Closed' && !canClose) return false;
    return setAccountingPeriodStatus(selectedPeriod.id, status);
  };

  return (
    <>
      <PageHeader eyebrow={`Financial Control / ${entityMode ? currentEntity?.code || 'Entity' : 'Group View'}`} title="Closing Period" description={entityMode ? `Month-end close khusus ${currentEntity?.name}. Accounting period, ledger, inventory, dan intercompany gate dipisahkan per legal entity.` : 'Group Consolidated tidak menutup period secara langsung. Pilih satu legal entity pada selector atas, selesaikan closing masing-masing, lalu kembali ke Consolidation.'} actionLabel={entityMode ? (selectedPeriod?.status==='Closed' ? 'Reopen Period' : canClose ? 'Close Period' : undefined) : undefined} onAction={() => selectedPeriod?.status==='Closed' ? changePeriod('Open') : changePeriod('Closed')} />
      {!entityMode && <div className="surface-card inventory-warning"><Building2 size={18}/><div><strong>ENTITY SCOPE REQUIRED</strong><span>Closing Period adalah kontrol legal-entity. Gunakan selector Entity / Group di topbar untuk membuka NDU atau NDT. Group-level close dan elimination dilakukan dari menu Consolidation.</span></div></div>}
      <div className="filter-strip"><label className="field compact-field"><span>Accounting Period</span><select disabled={!entityMode} value={selectedPeriodId} onChange={(e)=>setSelectedPeriodId(e.target.value)}>{data.accountingPeriods.map((p)=><option key={p.id} value={p.id}>{p.label} · {p.status}</option>)}</select></label><div className="filter-strip-note"><Lock size={14}/>{selectedPeriod?.status==='Closed'?'Posting blocked for this entity period':'Posting allowed for this entity period'}</div></div>
      <div className="stats-grid">
        <StatCard title="Closing Progress" value={`${progress}%`} hint={`${currentEntity?.code || 'Group'} · ${selectedPeriod?.label || '-'}`} trend={0} icon={BookOpenCheck} />
        <StatCard title="Unposted Invoice" value={String(unposted)} hint={`${unpostedSales} sales · ${unpostedPurchase} purchase`} trend={0} icon={ShieldCheck} />
        <StatCard title="Inventory Gate" value={String(inventoryGate)} hint={`${openStockTakes} stock take · ${inTransitTransfers} transfer`} trend={0} icon={Lock} />
        <StatCard title="Intercompany Gate" value={String(openIntercompany)} hint="draft / in-transit IC documents" trend={0} icon={Network} />
        <StatCard title="Return Gate" value={String(returnGate)} hint={`${openSalesReturns} sales · ${openPurchaseReturns} purchase`} trend={0} icon={RotateCcw} />
      </div>
      <SectionCard title="Month-End Checklist" subtitle="Entity period hanya dapat ditutup ketika operational posting gate, journal balance, dan intercompany cut-off sudah bersih.">
        <div className="closing-progress"><div className="closing-progress__bar" style={{ width: `${progress}%` }} /><span>{progress}% complete</span></div>
        <div className="closing-list">{tasks.map((task) => <button key={task.id} className={`closing-row ${task.done ? 'done' : ''}`} onClick={() => toggle(task.id)}><span className={`check-circle ${task.done ? 'checked' : ''}`}>{task.done ? '✓' : ''}</span><span className="closing-row__main"><strong>{task.task}</strong><small>{task.area} · {task.owner}</small></span><StatusPill tone={task.done ? 'success' : 'warning'}>{task.done ? 'Selesai' : 'Pending'}</StatusPill></button>)}</div>
        <div className={`closing-gate ${canClose?'ok':'blocked'}`}><div><strong>{selectedPeriod?.status==='Closed'?'Period locked':canClose?'Ready to close':'Close gate belum terpenuhi'}</strong><span>{selectedPeriod?.status==='Closed'?'Period entity ini sudah terkunci. Reopen hanya untuk authorized adjustment.':`Checklist ${allDone?'OK':'belum lengkap'} · invoice ${unposted} · inventory ${inventoryGate} · returns ${returnGate} · intercompany ${openIntercompany} · journal ${imbalance?'tidak balance':'balance'}.`}</span></div><button className="btn btn-primary" disabled={!entityMode || (selectedPeriod?.status!=='Closed' && !canClose)} onClick={()=>selectedPeriod?.status==='Closed'?changePeriod('Open'):changePeriod('Closed')}>{selectedPeriod?.status==='Closed'?'Reopen':'Close Period'}</button></div>
      </SectionCard>
    </>
  );
}
