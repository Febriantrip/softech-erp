import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import ReceiptAmountInput from './ReceiptAmountInput';
import { money } from '../../utils/erp';

const initial = () => ({customerCode:'', allocations:[], amount:'', receiptDate:new Date(Date.now()-new Date().getTimezoneOffset()*60000).toISOString().slice(0,10), bankAccountCode:'', method:'Bank Transfer', reference:''});
const asCents = value => Math.round(Number(value || 0) * 100);

export default function ReceiptAllocationModal({open, onClose, arRows, bankAccounts, onPost, busy}) {
  const [form,setForm] = useState(initial);
  const [error,setError] = useState('');
  const customers = useMemo(() => [...new Map(arRows.filter(r=>Number(r.outstanding)>0).map(r=>[r.partyCode,r.partyName])).entries()], [arRows]);
  const bankOptions = useMemo(() => bankAccounts.filter(b=>b.currency==='IDR'), [bankAccounts]);
  useEffect(() => {
    if (!open) return;
    setForm({...initial(),bankAccountCode:bankOptions[0]?.code||''});
    setError('');
  }, [open,bankOptions[0]?.code]);
  const options = arRows.filter(r=>r.partyCode===form.customerCode && Number(r.outstanding)>0);
  const totalCents = form.allocations.reduce((sum,r)=>sum+asCents(r.amount),0);
  const amountCents = asCents(form.amount);
  const valid = form.customerCode && form.bankAccountCode && form.allocations.length>0 && totalCents>0 &&
    form.allocations.every(line=>asCents(line.amount)>0 && asCents(line.amount)<=asCents(options.find(r=>r.invoiceId===line.salesInvoiceId)?.outstanding)) &&
    totalCents===amountCents && form.receiptDate && form.method;
  const updateAllocations = lines => setForm(f=>({...f,allocations:lines,amount:(lines.reduce((sum,r)=>sum+asCents(r.amount),0)/100).toFixed(2)}));
  const toggle = row => {
    const existing = form.allocations.some(x=>x.salesInvoiceId===row.invoiceId);
    if (!existing && String(row.invoiceDate).slice(0,10) > form.receiptDate) setForm(f=>({...f,receiptDate:String(row.invoiceDate).slice(0,10)}));
    updateAllocations(existing?form.allocations.filter(x=>x.salesInvoiceId!==row.invoiceId):[...form.allocations,{salesInvoiceId:row.invoiceId,amount:Number(row.outstanding).toFixed(2)}]);
  };
  const submit = async () => {
    setError('');
    if (!valid) {setError('Periksa alokasi: total receipt harus sama dengan jumlah alokasi dan tidak boleh melebihi outstanding.');return;}
    try {await onPost({bankAccountCode:form.bankAccountCode,receiptDate:form.receiptDate,method:form.method,reference:form.reference,amount:Number(form.amount),allocations:form.allocations.map(r=>({...r,amount:Number(r.amount)}))});}
    catch (err) {setError(err?.message || 'Receipt gagal diposting.');}
  };
  return <Modal open={open} onClose={()=>{if(!busy)onClose()}} title="Receive Customer Payment" subtitle="Satu customer dan satu site · satu receipt untuk beberapa invoice · posting atomic" wide footer={<><button className="btn" disabled={busy} onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy||!valid} onClick={submit}>{busy?'Posting...':'Post Receipt'}</button></>}>
    <div className="d3e-form">
      <label className="field"><span>Customer *</span><select value={form.customerCode} onChange={e=>setForm(f=>({...f,customerCode:e.target.value,allocations:[],amount:''}))}><option value="">Pilih customer</option>{customers.map(([code,name])=><option key={code} value={code}>{code} · {name}</option>)}</select></label>
      <label className="field"><span>Receipt Date *</span><input type="date" value={form.receiptDate} onChange={e=>setForm(f=>({...f,receiptDate:e.target.value}))}/></label>
      <label className="field"><span>Bank / Cash *</span><select value={form.bankAccountCode} onChange={e=>setForm(f=>({...f,bankAccountCode:e.target.value}))}><option value="">Pilih akun</option>{bankOptions.map(b=><option key={b.id} value={b.code}>{b.code} · {b.name} · {money(b.balance)}</option>)}</select></label>
      <label className="field"><span>Method *</span><select value={form.method} onChange={e=>setForm(f=>({...f,method:e.target.value}))}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Virtual Account</option></select></label>
      <label className="field d3e-full"><span>Reference / Bank Transaction ID</span><input maxLength={120} value={form.reference} onChange={e=>setForm(f=>({...f,reference:e.target.value}))} placeholder="Masukkan referensi asli transaksi bank"/></label>
    </div>
    <div className="d3e-allocations">
      <h4>Alokasi Invoice</h4>
      {!form.customerCode ? <p>Pilih customer untuk melihat invoice yang masih outstanding.</p> : options.length===0 ? <p>Belum ada invoice terbuka untuk customer ini.</p> : options.map(row=>{
        const selected=form.allocations.find(x=>x.salesInvoiceId===row.invoiceId);
        return <div className="d3e-allocation" key={row.invoiceId}>
          <label className="d3e-invoice-check"><input type="checkbox" checked={Boolean(selected)} onChange={()=>toggle(row)}/><span><strong>{row.documentNo}</strong><small>Outstanding {money(row.outstanding)} · Due {String(row.dueDate).slice(0,10)}</small></span></label>
          {selected&&<label className="field"><span>Amount</span><ReceiptAmountInput value={selected.amount} onChange={amount=>updateAllocations(form.allocations.map(a=>a.salesInvoiceId===row.invoiceId?{...a,amount}:a))} /></label>}
        </div>;
      })}
    </div>
    <div className="d3e-totals"><label className="field"><span>Total Receipt</span><ReceiptAmountInput value={form.amount} onChange={amount=>setForm(f=>({...f,amount}))} /></label><div><small>Total allocated</small><strong>{money(totalCents/100)}</strong><small>{form.allocations.length} invoice dipilih</small></div></div>
    {form.allocations.length>0&&amountCents!==totalCents&&<p role="alert" className="d3e-error">Selisih {money(Math.abs(amountCents-totalCents)/100)}. Receipt tidak bisa diposting sebelum totalnya sama. Overpayment belum didukung; gunakan proses customer deposit ketika tersedia.</p>}
    {error&&<p role="alert" className="d3e-error">{error}</p>}
  </Modal>;
}
