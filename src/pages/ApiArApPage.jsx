import React,{useMemo,useState} from 'react';
import { CircleDollarSign,ReceiptText } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { financeApi } from '../api/finance';
import { useFinanceList } from '../hooks/useFinanceWorkspace';
import { dateLabel,money,statusTone } from '../utils/erp';
import '../customer-receipt.css';

const buckets=['CURRENT','1-30','31-60','61-90','90+'];
export default function ApiArApPage(){
  const ar=useFinanceList(financeApi.ar);
  const ap=useFinanceList(financeApi.ap);
  const [tab,setTab]=useState('AR');
  const [bucket,setBucket]=useState('ALL');
  const [query,setQuery]=useState('');
  const rows=tab==='AR'?ar.rows:ap.rows;
  const open=rows.filter(r=>Number(r.outstanding)>0);
  const total=open.reduce((s,r)=>s+Number(r.outstanding),0);
  const overdue=tab==='AR'?open.filter(r=>Number(r.daysPastDue)>0).reduce((s,r)=>s+Number(r.outstanding),0):open.filter(r=>new Date(r.dueDate)<new Date()).reduce((s,r)=>s+Number(r.outstanding),0);
  const aging=useMemo(()=>Object.fromEntries(buckets.map(name=>[name,ar.rows.filter(r=>r.agingBucket===name).reduce((s,r)=>s+Number(r.outstanding||0),0)])),[ar.rows]);
  const visible=useMemo(()=>rows.filter(r=>(tab!=='AR'||bucket==='ALL'||r.agingBucket===bucket)&&`${r.documentNo} ${r.partyName}`.toLowerCase().includes(query.toLowerCase())),[rows,tab,bucket,query]);
  const changeTab=next=>{setTab(next);setBucket('ALL');setQuery('')};
  return <>
    <PageHeader eyebrow="Finance API / Subledger" title="Accounts Receivable & Payable" description="AR aging berdasarkan tanggal jatuh tempo PostgreSQL; settlement hanya melalui posted receipt/payment."/>
    <div className="stats-grid"><StatCard title={tab==='AR'?'Open AR':'Open AP'} value={money(total)} hint={`${open.length} open item`} icon={CircleDollarSign}/><StatCard title="Overdue" value={money(overdue)} hint="past due open balance" icon={ReceiptText}/></div>
    <div className="segmented-control v12-subledger-toggle"><button className={tab==='AR'?'active':''} onClick={()=>changeTab('AR')}>Receivable</button><button className={tab==='AP'?'active':''} onClick={()=>changeTab('AP')}>Payable</button></div>
    {(ar.error||ap.error)&&<div className="surface-card v12-api-alert" role="alert">{ar.error||ap.error}</div>}
    {tab==='AR'&&<section aria-label="AR Aging" className="d3e-aging">{buckets.map(name=><button key={name} aria-pressed={bucket===name} onClick={()=>setBucket(bucket===name?'ALL':name)}><small>{name==='CURRENT'?'Current':`${name} days past due`}</small><strong>{money(aging[name]||0)}</strong></button>)}</section>}
    <SectionCard title={tab==='AR'?'AR Open Items':'AP Open Items'} subtitle={tab==='AR'?`As of ${ar.rows[0]?.asOfDate||'database CURRENT_DATE'} · ${bucket==='ALL'?'All aging buckets':bucket}`:'Saldo berubah hanya lewat posted supplier payment allocation.'}>
      <div className="d3e-search"><input value={query} onChange={e=>setQuery(e.target.value)} aria-label="Cari invoice atau customer" placeholder="Cari invoice atau customer..."/><button className="btn" onClick={()=>{void ar.refresh();void ap.refresh()}}>Refresh</button></div>
      <DataTable rows={visible} columns={[{key:'documentNo',label:'Document'},{key:'partyName',label:tab==='AR'?'Customer':'Supplier'},{key:'invoiceDate',label:'Invoice Date',render:v=>dateLabel(v)},{key:'dueDate',label:'Due Date',render:v=>dateLabel(v)},{key:'originalAmount',label:'Original',render:v=>money(v)},{key:'outstanding',label:'Outstanding',render:v=>money(v)},...(tab==='AR'?[{key:'agingBucket',label:'Aging'},{key:'daysPastDue',label:'Days overdue'}]:[]),{key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},{key:'siteCode',label:'Site'}]}/>
    </SectionCard>
  </>;
}
