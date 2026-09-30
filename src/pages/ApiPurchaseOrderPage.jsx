import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Database, FileText, PackageCheck, Pencil, Plus, Printer, RefreshCw, Send, ShieldCheck, Trash2, Truck, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import SectionCard from '../components/SectionCard';
import StatCard from '../components/StatCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import PurchaseOrderEditor, { emptyPurchaseOrder } from '../components/purchase-order/PurchaseOrderEditor';
import PurchaseOrderDetail from '../components/purchase-order/PurchaseOrderDetail';
import PurchaseOrderPrint from '../components/purchase-order/PurchaseOrderPrint';
import GoodsReceiptEditor, { receiptDraft, validateReceiptDraft } from '../components/goods-receipt/GoodsReceiptEditor';
import GoodsReceiptDetail from '../components/goods-receipt/GoodsReceiptDetail';
import { coreApi } from '../api/core';
import { useCoreBootstrap, useCoreList } from '../hooks/useCoreWorkspace';
import { dateLabel, money, number, statusTone } from '../utils/erp';
import '../purchase-order-d4a.css';
import '../goods-receipt-d4b.css';

const payload=(form,scope,editing)=>({
 ...(!editing && scope?.siteCode ? {siteCode:scope.siteCode}:{}),
 warehouseCode:form.warehouseCode,supplierCode:form.supplierCode,orderDate:form.orderDate,etaDate:form.etaDate,
 supplierReference:form.supplierReference,paymentTerms:form.paymentTerms,notes:form.notes,
 ...(editing?{revisionNo:form.revisionNo}:{}),
 lines:form.lines.map(l=>({sku:l.sku,description:l.description||'',qty:Number(l.qty),unitPrice:Number(l.unitPrice),discountPercent:Number(l.discountPercent||0),taxCode:l.taxCode||''}))
});

export default function ApiPurchaseOrderPage(){
 const poLoader=useCallback(scope=>coreApi.purchaseOrders(scope),[]);
 const receiptLoader=useCallback(scope=>coreApi.receipts(scope),[]);
 const list=useCoreList(poLoader),receipts=useCoreList(receiptLoader),masters=useCoreBootstrap();
 const {scope}=list;
 const [open,setOpen]=useState(false),[form,setForm]=useState(null),[editing,setEditing]=useState(null);
 const [detail,setDetail]=useState(null),[busy,setBusy]=useState(''),[message,setMessage]=useState('');
 const [receiveRow,setReceiveRow]=useState(null),[receiptDraftLines,setReceiptDraftLines]=useState([]),[receiptDetail,setReceiptDetail]=useState(null),[search,setSearch]=useState(''),[statusFilter,setStatusFilter]=useState('ALL'),[page,setPage]=useState(1);
 const refreshAll=useCallback(async()=>Promise.all([list.refresh(),receipts.refresh(),masters.refresh()]),[list.refresh,receipts.refresh,masters.refresh]);
 useEffect(()=>{setDetail(null);setEditing(null);setOpen(false);setReceiveRow(null);setReceiptDetail(null);setReceiptDraftLines([]);setPage(1);setMessage('')},[scope?.entityCode,scope?.siteCode]);
 const beginCreate=()=>{if(!scope){setMessage('Pilih legal entity dan site lebih dahulu.');return}setEditing(null);setForm(emptyPurchaseOrder(masters.data||{},scope));setOpen(true)};
 const loadDetail=async(id)=>{if(!scope)return null;try{const d=await coreApi.purchaseOrderDetail(scope,id);setDetail(d);return d}catch(e){setMessage(e.message);return null}};
 const beginEdit=async(row)=>{if(!scope)return;setBusy('detail');const d=await loadDetail(row.id);setBusy('');if(!d||d.status!=='DRAFT')return;
  setEditing(d);setForm({supplierCode:d.supplier.code,warehouseCode:d.warehouse.code,orderDate:d.orderDate,etaDate:d.etaDate||'',supplierReference:d.supplierReference||'',paymentTerms:d.paymentTerms||'',notes:d.notes||'',revisionNo:d.revisionNo,lines:d.lines.map(l=>({sku:l.sku,description:l.description||'',qty:l.qty,unitPrice:l.unitPrice,discountPercent:l.discountPercent,taxCode:l.taxCode||''}))});setOpen(true)};
 const save=async()=>{if(!scope||!form)return;setBusy('save');setMessage('');try{
  const data=payload(form,scope,!!editing);
  const skus=data.lines.map(l=>l.sku);
  if(!data.supplierCode||!data.warehouseCode||!data.orderDate||!data.etaDate||data.lines.length===0)throw Error('Lengkapi supplier, warehouse, tanggal, ETA, dan minimal satu item.');
  if(data.etaDate<data.orderDate)throw Error('ETA tidak boleh sebelum Order Date.');
  if(new Set(skus).size!==skus.length)throw Error('SKU duplikat dalam satu PO tidak diperbolehkan.');
  if(data.lines.some(l=>!l.sku||!Number.isFinite(l.qty)||l.qty<=0||!Number.isFinite(l.unitPrice)||l.unitPrice<0||!Number.isFinite(l.discountPercent)||l.discountPercent<0||l.discountPercent>100))throw Error('Cek SKU, qty, harga, dan diskon 0–100%.');
  const res=editing?await coreApi.updatePurchaseOrder(scope,editing.id,data):await coreApi.createPurchaseOrder(scope,data);
  setMessage(`${res.documentNo}: ${editing?'draft updated':'created'} · ${money(res.total)}`);setOpen(false);setEditing(null);
  await refreshAll();if(detail?.id===res.id)await loadDetail(res.id);
 }catch(e){setMessage(e.message)}finally{setBusy('')}};
 const run=async(row,action)=>{if(!scope)return;setBusy(`${row.id}:${action}`);setMessage('');try{
  let res;if(action==='delete'){
   if(!window.confirm(`Hapus DRAFT ${row.documentNo}?`))return;
   res=await coreApi.deletePurchaseOrder(scope,row.id);
  }else if(action==='cancel'){
   const reason=window.prompt(`Alasan pembatalan ${row.documentNo}:`);
   if(reason===null)return;
   if(!reason.trim())throw Error('Alasan pembatalan wajib diisi.');
   res=await coreApi.cancelPurchaseOrder(scope,row.id,reason);
  }else res=await coreApi.purchaseAction(scope,row.id,action);
  setMessage(`${res.documentNo||row.documentNo} → ${res.status}`);
  if(action==='delete'){setDetail(null)}else if(detail?.id===row.id)await loadDetail(row.id);
  await refreshAll();
 }catch(e){setMessage(e.message)}finally{setBusy('')}};
 const beginReceive=async(row)=>{if(!scope)return;setBusy('receive:load');setMessage('');try{const d=await coreApi.purchaseOrderDetail(scope,row.id);if(!['APPROVED','PARTIALLY_RECEIVED'].includes(d.status))throw Error('PO tidak lagi dapat diterima. Refresh daftar.');setReceiveRow(d);setReceiptDraftLines(receiptDraft(d));}catch(e){setMessage(e.message)}finally{setBusy('')}};
 const receiveError=receiveRow?validateReceiptDraft(receiveRow,receiptDraftLines):'';
 const receive=async()=>{if(!scope||!receiveRow)return;const problem=validateReceiptDraft(receiveRow,receiptDraftLines);if(problem){setMessage(problem);return}setBusy('receive');setMessage('');try{
  const lines=receiptDraftLines.filter(l=>Number(l.acceptedQty||0)+Number(l.rejectedQty||0)>0).map(l=>({sku:l.sku,acceptedQty:Number(l.acceptedQty||0),rejectedQty:Number(l.rejectedQty||0),lotNo:l.lotNo||'',putAwayLocation:l.putAwayLocation||'GENERAL'}));
  const res=await coreApi.receivePurchaseOrder(scope,receiveRow.id,{lines});setMessage(`${res.documentNo}: accepted ${number(res.acceptedQty)}, rejected ${number(res.rejectedQty)} · ${res.purchaseOrderStatus}`);const poID=receiveRow.id;setReceiveRow(null);setReceiptDraftLines([]);await refreshAll();if(detail?.id===poID)await loadDetail(poID);await loadReceiptDetail(res.id)
 }catch(e){setMessage(e.message);await refreshAll()}finally{setBusy('')}};
 const loadReceiptDetail=async(id)=>{if(!scope)return;try{const d=await coreApi.goodsReceiptDetail(scope,id);setReceiptDetail(d);return d}catch(e){setMessage(e.message);return null}};
 const putAway=async(row)=>{if(!scope)return;if(!window.confirm(`Put Away ${row.documentNo}? Accepted qty akan berpindah dari Inbound ke On Hand.`))return;setBusy(`grn:${row.id}`);setMessage('');try{const res=await coreApi.putAwayReceipt(scope,row.id);setMessage(`${res.documentNo}: ${number(res.putawayQty)} put away to On Hand`);await refreshAll();if(receiptDetail?.id===row.id)await loadReceiptDetail(row.id)}catch(e){setMessage(e.message);await refreshAll()}finally{setBusy('')}};
 const filtered=useMemo(()=>list.rows.filter(r=>{
  if(statusFilter!=='ALL'&&r.status!==statusFilter)return false;
  const hay=[r.documentNo,r.supplierCode,r.supplierName,r.warehouseCode].join(' ').toLowerCase();return hay.includes(search.trim().toLowerCase());
 }),[list.rows,search,statusFilter]);
 useEffect(()=>setPage(1),[search,statusFilter]);
 const pages=Math.max(1,Math.ceil(filtered.length/10)),visible=filtered.slice((Math.min(page,pages)-1)*10,Math.min(page,pages)*10);
 const poColumns=useMemo(()=>[
  {key:'documentNo',label:'Purchase Order',render:(_,r)=><button className="po-doc-link" onClick={()=>loadDetail(r.id)}>{r.documentNo}</button>},
  {key:'orderDate',label:'Date',render:v=>dateLabel(v)},
  {key:'etaDate',label:'ETA',render:v=>dateLabel(v)},
  {key:'supplierName',label:'Supplier'},
  {key:'warehouseCode',label:'Warehouse'},
  {key:'qty',label:'Ordered',render:v=>number(v)},
  {key:'receivedQty',label:'Received',render:v=>number(v)},
  {key:'total',label:'Total',render:v=>money(v)},
  {key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},
  {key:'action',label:'Actions',render:(_,r)=><div className="action-row v11-row-actions po-actions">
   <button className="btn btn-sm" disabled={!!busy} onClick={()=>loadDetail(r.id)}><FileText size={13}/> Detail</button>
   {r.status==='DRAFT'&&<><button className="btn btn-sm" disabled={!!busy} onClick={()=>beginEdit(r)}><Pencil size={13}/> Edit</button><button className="btn btn-sm" disabled={!!busy} onClick={()=>run(r,'submit')}><Send size={13}/> Submit</button><button className="btn btn-sm" disabled={!!busy} onClick={()=>run(r,'delete')}><Trash2 size={13}/> Delete</button></>}
   {r.status==='PENDING_APPROVAL'&&<button className="btn btn-sm" disabled={!!busy} onClick={()=>run(r,'approve')}><ShieldCheck size={13}/> Approve</button>}
   {['PENDING_APPROVAL','APPROVED'].includes(r.status)&&<button className="btn btn-sm" disabled={!!busy} onClick={()=>run(r,'cancel')}><XCircle size={13}/> Cancel</button>}
   {['APPROVED','PARTIALLY_RECEIVED'].includes(r.status)&&Number(r.qty)>Number(r.receivedQty)&&<button className="btn btn-sm btn-primary" disabled={!!busy} onClick={()=>beginReceive(r)}><Truck size={13}/> Receive</button>}
  </div>}
 ],[busy,scope,detail]);
 const receiptColumns=[{key:'documentNo',label:'GRN',render:(_,r)=><button className="grn-doc-link" onClick={()=>loadReceiptDetail(r.id)}>{r.documentNo}</button>},{key:'purchaseOrderNo',label:'PO'},{key:'receiptDate',label:'Receipt Date',render:v=>dateLabel(v)},{key:'acceptedQty',label:'Accepted',render:v=>number(v)},{key:'rejectedQty',label:'Rejected',render:v=>number(v)},{key:'status',label:'Status',render:v=><StatusPill tone={statusTone(v)}>{v}</StatusPill>},{key:'action',label:'Action',render:(_,r)=><div className="action-row"><button className="btn btn-sm" onClick={()=>loadReceiptDetail(r.id)}><FileText size={13}/> Detail</button>{r.status==='RECEIVED'&&<button className="btn btn-sm btn-primary" disabled={!!busy} onClick={()=>putAway(r)}><PackageCheck size={13}/> Put Away</button>}</div>}];
 return <>
  <PageHeader eyebrow="Production Core / Procurement" title="Purchase Orders · PostgreSQL" description="D4-A: detail, supplier reference, discounts, taxes, draft revision, approval, print, audit, and site scope." actionLabel="Purchase Order Baru" onAction={beginCreate}/>
  <div className="v11-mode-banner"><Database size={16}/><div><strong>PROCUREMENT WORKFLOW</strong><span>{scope?`${scope.entityCode} · ${scope.siteCode||'All Sites'}`:'Select legal entity'} · PO approval and receiving are PostgreSQL-backed.</span></div><button className="btn btn-sm" disabled={list.loading} onClick={refreshAll}><RefreshCw size={13}/> Refresh</button></div>
  {message&&<div className="v10-inline-note"><strong>Purchase Order</strong><span>{message}</span></div>}
  {list.error&&<div className="v10-inline-note warning"><strong>API unavailable</strong><span>{list.error}</span></div>}
  <div className="stats-grid"><StatCard title="Purchase Orders" value={String(list.rows.length)} hint="server-backed" icon={Database}/><StatCard title="Approved / Open" value={String(list.rows.filter(r=>['APPROVED','PARTIALLY_RECEIVED'].includes(r.status)).length)} hint="receiving eligible" icon={ShieldCheck}/><StatCard title="Goods Receipts" value={String(receipts.rows.length)} hint="inbound" icon={Truck}/><StatCard title="Waiting Put Away" value={String(receipts.rows.filter(r=>r.status==='RECEIVED').length)} hint="not on-hand yet" icon={PackageCheck}/></div>
  <SectionCard title="Purchase Orders" subtitle="Document scope and state transitions enforced by backend."><div className="po-list-toolbar"><input aria-label="Search Purchase Orders" placeholder="Search PO / Supplier / Warehouse" value={search} onChange={e=>setSearch(e.target.value)}/><select aria-label="PO status" value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}><option value="ALL">All Status</option>{['DRAFT','PENDING_APPROVAL','APPROVED','PARTIALLY_RECEIVED','RECEIVED','PUT_AWAY','CANCELLED'].map(s=><option key={s}>{s}</option>)}</select></div><DataTable rows={visible} columns={poColumns} emptyText={list.loading?'Memuat PostgreSQL...':'Tidak ada Purchase Order.'}/><div className="po-pages"><span>{filtered.length} PO · Page {Math.min(page,pages)} / {pages}</span><div><button className="btn btn-sm" disabled={page<=1} onClick={()=>setPage(v=>v-1)}>Previous</button><button className="btn btn-sm" disabled={page>=pages} onClick={()=>setPage(v=>v+1)}>Next</button></div></div></SectionCard>
  <SectionCard title="Goods Receipts" subtitle="Accepted/Rejected per item · partial GRN · Inbound → Put Away → On Hand."><DataTable rows={receipts.rows} columns={receiptColumns} emptyText="Belum ada Goods Receipt."/></SectionCard>
  <Modal open={open} onClose={()=>{if(!busy){setOpen(false);setEditing(null)}}} title={editing?`Edit ${editing.documentNo}`:'Create Purchase Order'} subtitle="Supplier / price / discount / tax snapshot will be saved in PostgreSQL." wide footer={<><button className="btn" disabled={!!busy} onClick={()=>setOpen(false)}>Batal</button><button className="btn btn-primary" disabled={!!busy||!form?.supplierCode||!form?.warehouseCode} onClick={save}>{busy==='save'?'Saving...':editing?'Save Draft':'Create PO'}</button></>}>
   {form&&<PurchaseOrderEditor form={form} setForm={setForm} masters={masters.data||{}} scope={scope||{}}/>}
  </Modal>
  <Modal open={!!detail&&!open} onClose={()=>setDetail(null)} title={detail?.documentNo||'Purchase Order'} subtitle={detail?`${detail.status} · ${detail.entityCode}/${detail.siteCode}`:''} wide footer={<><button className="btn" onClick={()=>setDetail(null)}>Close</button><button className="btn" onClick={()=>window.print()}><Printer size={14}/> Print A4</button>{detail?.status==='DRAFT'&&<button className="btn btn-primary" onClick={()=>beginEdit(detail)}><Pencil size={14}/> Edit Draft</button>}</>}>
   {detail&&<PurchaseOrderDetail detail={detail}/>} 
  </Modal>
  {detail&&!open&&<PurchaseOrderPrint detail={detail}/>}
  <Modal open={!!receiveRow} onClose={()=>{if(!busy){setReceiveRow(null);setReceiptDraftLines([])}}} title={`Receive ${receiveRow?.documentNo||''}`} subtitle="D4-B · Partial receiving and quantity matching" wide footer={<><button className="btn" disabled={!!busy} onClick={()=>setReceiveRow(null)}>Batal</button><button className="btn btn-primary" disabled={!!busy||!!receiveError} onClick={receive}><Truck size={14}/> Post Receiving</button></>}>
   {receiveRow&&<GoodsReceiptEditor po={receiveRow} draft={receiptDraftLines} setDraft={setReceiptDraftLines}/>}
  </Modal>
  <Modal open={!!receiptDetail} onClose={()=>setReceiptDetail(null)} title={receiptDetail?.documentNo||'Goods Receipt'} subtitle="Canonical PostgreSQL Goods Receipt" wide footer={<><button className="btn" onClick={()=>setReceiptDetail(null)}>Close</button>{receiptDetail?.status==='RECEIVED'&&<button className="btn btn-primary" disabled={!!busy} onClick={()=>putAway(receiptDetail)}><PackageCheck size={14}/> Put Away</button>}</>}>
   {receiptDetail&&<GoodsReceiptDetail detail={receiptDetail}/>}
  </Modal>
 </>;
}
