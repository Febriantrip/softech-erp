import React,{useState} from 'react';
import { CalendarDays, FileText, ReceiptText, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import SalesInvoiceCreateModal from '../components/sales-invoice/SalesInvoiceCreateModal';
import SalesInvoiceDetailModal from '../components/sales-invoice/SalesInvoiceDetailModal';
import SalesInvoicePrintDocument from '../components/sales-invoice/SalesInvoicePrintDocument';
import {financeApi} from '../api/finance';
import {useFinanceBootstrap,useFinanceList} from '../hooks/useFinanceWorkspace';
import {dateLabel,money,statusTone} from '../utils/erp';
import '../sales-invoice.css';

export default function ApiSalesInvoicePage(){
  const list=useFinanceList(financeApi.salesInvoices);
  const boot=useFinanceBootstrap();
  const [creating,setCreating]=useState(false);
  const [detail,setDetail]=useState(null);
  const [showDetail,setShowDetail]=useState(false);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState('');
  const refresh=async()=>{await Promise.all([list.refresh(),boot.refresh()])};
  const openDetail=async id=>{
    if(!list.scope)return;
    setError('');setBusy(id);
    try{setDetail(await financeApi.salesInvoiceDetail(list.scope,id));setShowDetail(true)}
    catch(err){setError(err.message)}finally{setBusy('')}
  };
  const post=async row=>{
    if(!list.scope||busy||!window.confirm(`Posting ${row.documentNo}? Jurnal dan piutang dibuat permanen. Draft tidak bisa dihapus setelah posting.`))return;
    setBusy(row.id);setError('');
    try{await financeApi.postSalesInvoice(list.scope,row.id);await refresh()}
    catch(err){setError(err.message)}finally{setBusy('')}
  };
  const remove=async row=>{
    if(!list.scope||busy||!window.confirm(`Hapus draft ${row.documentNo}? Alokasi qty pada Shipment kembali tersedia.`))return;
    setBusy(row.id);setError('');
    try{await financeApi.deleteSalesInvoice(list.scope,row.id);await refresh()}
    catch(err){setError(err.message)}finally{setBusy('')}
  };
  const created=async payload=>{if(!list.scope)throw Error('Pilih Entity/Site dahulu.');await financeApi.createSalesInvoice(list.scope,payload);await refresh()};
  const outstanding=list.rows.reduce((sum,r)=>sum+Math.max(0,Number(r.total)-Number(r.paidAmount)),0);
  return <>
    <PageHeader eyebrow="Finance API / Receivable" title="Sales Invoice · Shipment Based" description="Penagihan parsial per Shipment DELIVERED. Alokasi qty, discount, PPN, AR dan GL dikendalikan PostgreSQL." actionLabel="Create Invoice" onAction={()=>setCreating(true)}/>
    {(error||list.error||boot.error)&&<div role="alert" className="surface-card si-alert">{error||list.error||boot.error}</div>}
    <div className="stats-grid"><StatCard title="Invoices" value={String(list.rows.length)} hint="API-backed" icon={FileText}/><StatCard title="Draft" value={String(list.rows.filter(r=>r.status==='DRAFT').length)} hint="Qty sudah teralokasi" icon={CalendarDays}/><StatCard title="Outstanding" value={money(outstanding)} hint="Invoice less paid" icon={WalletCards}/><StatCard title="Ready Shipments" value={String(boot.data?.salesInvoiceSources?.length||0)} hint="POD + qty belum ditagih" icon={ReceiptText}/></div>
    <SectionCard title="Sales Invoice Register" subtitle="Create Draft mengalokasikan shipped qty. Posting mencatat Dr AR / Cr Revenue (setelah diskon) / Cr Output Tax.">
      <DataTable rows={list.rows} emptyText="Belum ada Sales Invoice pada Entity/Site ini" columns={[
        {key:'documentNo',label:'Invoice',render:(_,r)=><button className="si-link" onClick={()=>openDetail(r.id)}>{r.documentNo}</button>},
        {key:'invoiceDate',label:'Date',render:v=>dateLabel(v)},
        {key:'customerName',label:'Customer'},
        {key:'shipmentNo',label:'Shipment',render:v=>v||'Legacy SO invoice'},
        {key:'salesOrderNo',label:'SO'},
        {key:'discount',label:'Discount',render:v=>money(v)},
        {key:'dpp',label:'DPP',render:v=>money(v)},
        {key:'tax',label:'Tax',render:v=>money(v)},
        {key:'total',label:'Total',render:v=>money(v)},
        {key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},
        {key:'action',label:'Action',render:(_,r)=><div className="si-actions"><button className="btn btn-sm" disabled={!!busy} onClick={()=>openDetail(r.id)}>Detail</button>{r.status==='DRAFT'&&<><button className="btn btn-sm btn-primary" disabled={!!busy} onClick={()=>post(r)}>Post</button>{r.shipmentNo&&<button className="btn btn-sm" disabled={!!busy} onClick={()=>remove(r)}>Hapus</button>}</>}</div>}
      ]}/>
    </SectionCard>
    <SalesInvoiceCreateModal open={creating} scope={list.scope} sources={boot.data?.salesInvoiceSources||[]} onClose={()=>setCreating(false)} onCreate={created}/>
    <SalesInvoiceDetailModal open={showDetail} detail={detail} onClose={()=>setShowDetail(false)} onPrint={()=>window.print()}/>
    {showDetail&&<SalesInvoicePrintDocument detail={detail}/>}
  </>;
}
