import React,{useMemo,useState} from 'react';
import { Building2,CircleDollarSign,WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import ReceiptAllocationModal from '../components/customer-receipt/ReceiptAllocationModal';
import ReceiptDetailModal from '../components/customer-receipt/ReceiptDetailModal';
import { financeApi } from '../api/finance';
import { useFinanceBootstrap,useFinanceList } from '../hooks/useFinanceWorkspace';
import { dateLabel,money,statusTone } from '../utils/erp';
import '../customer-receipt.css';

export default function ApiReceiptsPage(){
  const receipts=useFinanceList(financeApi.receipts);
  const ar=useFinanceList(financeApi.ar);
  const boot=useFinanceBootstrap();
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [detail,setDetail]=useState(null);
  const [detailLoading,setDetailLoading]=useState(false);
  const [detailError,setDetailError]=useState('');
  const [query,setQuery]=useState('');
  const [message,setMessage]=useState('');
  const filtered=useMemo(()=>receipts.rows.filter(r=>`${r.documentNo} ${r.partyName} ${r.reference} ${r.journalNo}`.toLowerCase().includes(query.toLowerCase())),[receipts.rows,query]);
  const refresh=async()=>Promise.all([receipts.refresh(),ar.refresh(),boot.refresh()]);
  const post=async payload=>{
    if(!receipts.scope)throw new Error('Entity/site belum dipilih.');
    setBusy(true);setMessage('');
    try{const result=await financeApi.createReceipt(receipts.scope,payload);setOpen(false);setMessage(`Receipt ${result.documentNo||''} berhasil diposting.`);await refresh();}
    finally{setBusy(false)}
  };
  const showDetail=async id=>{
    if(!receipts.scope)return;
    setDetail(null);setDetailError('');setDetailLoading(true);
    try{setDetail(await financeApi.receiptDetail(receipts.scope,id))}
    catch(err){setDetailError(err?.message||'Gagal memuat receipt detail.')}
    finally{setDetailLoading(false)}
  };
  const totalAR=ar.rows.reduce((sum,r)=>sum+Number(r.outstanding||0),0);
  const bankTotal=(boot.data?.bankAccounts||[]).reduce((sum,r)=>sum+Number(r.balance||0),0);
  return <>
    <PageHeader eyebrow="Finance API / Receivable" title="Customer Receipts" description="Satu receipt bisa melunasi beberapa invoice customer yang sama. AR, bank dan GL diposting atomically." actionLabel="Receive Payment" onAction={()=>setOpen(true)}/>
    {(receipts.error||ar.error||boot.error)&&<div className="surface-card v12-api-alert" role="alert">{receipts.error||ar.error||boot.error}</div>}
    {message&&<div className="surface-card d3e-success" role="status">{message}</div>}
    <div className="stats-grid"><StatCard title="Open AR" value={money(totalAR)} hint={`${ar.rows.filter(r=>Number(r.outstanding)>0).length} open item`} icon={CircleDollarSign}/><StatCard title="Receipts" value={String(receipts.rows.length)} hint="posted register" icon={WalletCards}/><StatCard title="Cash & Bank" value={money(bankTotal)} hint="entity accounts" icon={Building2}/></div>
    <SectionCard title="Receipt Register" subtitle="Bank/Cash Dr · Accounts Receivable Cr · allocation per invoice tersimpan.">
      <div className="d3e-search"><input aria-label="Cari receipt" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Cari receipt, customer, reference atau jurnal..."/><button className="btn" onClick={refresh}>Refresh</button></div>
      <DataTable rows={filtered} columns={[{key:'documentNo',label:'Receipt'},{key:'date',label:'Date',render:v=>dateLabel(v)},{key:'partyName',label:'Customer'},{key:'bankAccountCode',label:'Bank/Cash'},{key:'method',label:'Method'},{key:'reference',label:'Reference'},{key:'amount',label:'Amount',render:v=>money(v)},{key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},{key:'journalNo',label:'Journal'},{key:'id',label:'Action',render:v=><button className="btn" onClick={()=>showDetail(v)}>Detail</button>}]}/>
    </SectionCard>
    <ReceiptAllocationModal open={open} onClose={()=>setOpen(false)} arRows={ar.rows} bankAccounts={boot.data?.bankAccounts||[]} onPost={post} busy={busy}/>
    <ReceiptDetailModal detail={detail} loading={detailLoading} error={detailError} onClose={()=>{setDetail(null);setDetailError('')}}/>
  </>;
}
