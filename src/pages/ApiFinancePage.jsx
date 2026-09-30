import React, { useMemo, useState } from 'react';
import { BookOpenText, Landmark, RefreshCw, Scale } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { financeApi } from '../api/finance';
import { useFinanceBootstrap, useFinanceList } from '../hooks/useFinanceWorkspace';
import { dateLabel, money, statusTone } from '../utils/erp';

export default function ApiFinancePage(){
  const journals=useFinanceList(financeApi.journals); const tb=useFinanceList(financeApi.trialBalance); const boot=useFinanceBootstrap();
  const [open,setOpen]=useState(false); const [form,setForm]=useState({postingDate:new Date().toISOString().slice(0,10),description:'',debitAccount:'590100',creditAccount:'100100',amount:0});
  const totals=useMemo(()=>{const revenue=tb.rows.filter(r=>r.type==='REVENUE').reduce((s,r)=>s+Math.max(0,-Number(r.balance||0)),0);const expense=tb.rows.filter(r=>r.type==='EXPENSE').reduce((s,r)=>s+Math.max(0,Number(r.balance||0)),0);const assets=tb.rows.filter(r=>r.type==='ASSET').reduce((s,r)=>s+Number(r.balance||0),0);return{revenue,expense,assets}},[tb.rows]);
  const refresh=async()=>{await Promise.all([journals.refresh(),tb.refresh(),boot.refresh()])};
  const post=async()=>{if(!journals.scope||Number(form.amount)<=0)return;await financeApi.postManualJournal(journals.scope,{postingDate:form.postingDate,description:form.description,lines:[{accountCode:form.debitAccount,debit:Number(form.amount),credit:0,memo:form.description},{accountCode:form.creditAccount,debit:0,credit:Number(form.amount),memo:form.description}]});setOpen(false);await refresh();};
  const manualAccounts=(boot.data?.accounts||[]).filter(a=>a.allowManualPosting);
  return <>
    <PageHeader eyebrow="Finance API / General Ledger" title="Finance & Accounting" description="PostgreSQL-backed double-entry ledger, trial balance, period controls, dan immutable posted journals." actionLabel="Manual Journal" onAction={()=>setOpen(true)}/>
    {(journals.error||tb.error||boot.error)&&<div className="surface-card v12-api-alert">{journals.error||tb.error||boot.error}</div>}
    <div className="stats-grid"><StatCard title="Posted Revenue" value={money(totals.revenue)} hint="credit balance revenue" icon={BookOpenText}/><StatCard title="Posted Expense" value={money(totals.expense)} hint="including COGS" icon={Scale}/><StatCard title="Asset Balance" value={money(totals.assets)} hint="GL debit less credit" icon={Landmark}/><StatCard title="Journal Entries" value={String(journals.rows.length)} hint="PostgreSQL ledger" icon={RefreshCw}/></div>
    <SectionCard title="General Ledger Journal Register" subtitle="Posted entries are immutable. Correction harus melalui reversal/correction flow, bukan edit ledger."><DataTable rows={journals.rows} columns={[{key:'documentNo',label:'Journal'},{key:'postingDate',label:'Date',render:v=>dateLabel(v)},{key:'sourceType',label:'Source'},{key:'referenceId',label:'Reference'},{key:'description',label:'Description'},{key:'debit',label:'Debit',render:v=>money(v)},{key:'credit',label:'Credit',render:v=>money(v)},{key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>}]} /></SectionCard>
    <SectionCard title="Trial Balance" subtitle="Balance diturunkan dari journal lines yang POSTED, bukan editable account balance."><DataTable rows={tb.rows.map(r=>({...r,id:r.code}))} columns={[{key:'code',label:'Account'},{key:'name',label:'Account Name'},{key:'type',label:'Type'},{key:'debit',label:'Debit',render:v=>money(v)},{key:'credit',label:'Credit',render:v=>money(v)},{key:'balance',label:'Net Debit/(Credit)',render:v=>money(v)}]} /></SectionCard>
    <Modal open={open} onClose={()=>setOpen(false)} title="Post Manual Journal" subtitle="Control accounts AR/AP/Inventory/Tax/Revenue/COGS diblokir untuk manual posting." footer={<><button className="btn" onClick={()=>setOpen(false)}>Batal</button><button className="btn btn-primary" onClick={post} disabled={!journals.scope||Number(form.amount)<=0}>Post Journal</button></>}>
      <div className="form-grid"><label className="field"><span>Posting Date</span><input type="date" value={form.postingDate} onChange={e=>setForm({...form,postingDate:e.target.value})}/></label><label className="field"><span>Amount</span><input type="number" min="1" value={form.amount} onChange={e=>setForm({...form,amount:e.target.value})}/></label><label className="field"><span>Debit Account</span><select value={form.debitAccount} onChange={e=>setForm({...form,debitAccount:e.target.value})}>{manualAccounts.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label><label className="field"><span>Credit Account</span><select value={form.creditAccount} onChange={e=>setForm({...form,creditAccount:e.target.value})}>{manualAccounts.map(a=><option key={a.code} value={a.code}>{a.code} · {a.name}</option>)}</select></label><label className="field field--full"><span>Description</span><input value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Journal explanation"/></label></div>
    </Modal>
  </>;
}
