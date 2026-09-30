import React, { useMemo, useState } from 'react';
import { Building2, CalendarDays, CircleDollarSign, Search, WalletCards } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money, statusTone } from '../utils/erp';

function ReceiptModal({ open, onClose, data, onCreate }) {
  const openAr = data.arOpenItems.filter((row) => Number(row.outstanding) > 0);
  const [form, setForm] = useState({ invoiceId: openAr[0]?.invoiceId || '', amount: openAr[0]?.outstanding || 0, accountId: data.bankAccounts[0]?.id || '', method: 'Bank Transfer', reference: '', date: new Date().toISOString().slice(0,10) });
  React.useEffect(() => { if (!open) return; const first=data.arOpenItems.find((row)=>Number(row.outstanding)>0); setForm({ invoiceId:first?.invoiceId||'', amount:first?.outstanding||0, accountId:data.bankAccounts[0]?.id||'', method:'Bank Transfer', reference:'', date:new Date().toISOString().slice(0,10) }); }, [open, data.arOpenItems, data.bankAccounts]);
  const ar = data.arOpenItems.find((row)=>row.invoiceId===form.invoiceId);
  const invoice = data.salesInvoices.find((row)=>row.id===form.invoiceId);
  const customer = data.customers.find((row)=>row.id===invoice?.customerId);
  const submit=()=>{ const id=onCreate({...form,amount:Number(form.amount)}); if(id) onClose(); };
  return <Modal open={open} onClose={onClose} title="Receive Customer Payment" subtitle="Allocate receipt langsung ke AR open item dan post journal bank/cash vs AR." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.invoiceId||Number(form.amount)<=0} onClick={submit}>Post Receipt</button></>}>
    <div className="form-grid"><label className="field field--full"><span>Open Invoice</span><select value={form.invoiceId} onChange={(e)=>{const next=data.arOpenItems.find((row)=>row.invoiceId===e.target.value);setForm({...form,invoiceId:e.target.value,amount:next?.outstanding||0});}}>{openAr.length?openAr.map((row)=>{const inv=data.salesInvoices.find((i)=>i.id===row.invoiceId);const c=data.customers.find((x)=>x.id===row.customerId);return <option key={row.id} value={row.invoiceId}>{row.invoiceId} · {c?.name} · {money(row.outstanding)}</option>}):<option value="">Tidak ada AR terbuka</option>}</select></label><label className="field"><span>Receipt Date</span><input type="date" value={form.date} onChange={(e)=>setForm({...form,date:e.target.value})}/></label><label className="field"><span>Amount</span><input type="number" min="1" max={ar?.outstanding||0} value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})}/></label><label className="field"><span>Bank / Cash Account</span><select value={form.accountId} onChange={(e)=>setForm({...form,accountId:e.target.value})}>{data.bankAccounts.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="field"><span>Method</span><select value={form.method} onChange={(e)=>setForm({...form,method:e.target.value})}><option>Bank Transfer</option><option>Cash</option><option>Cheque</option><option>Virtual Account</option></select></label><label className="field field--full"><span>Bank Reference</span><input value={form.reference} onChange={(e)=>setForm({...form,reference:e.target.value})} placeholder="TRX / VA / cheque reference"/></label></div>
    {invoice&&<div className="invoice-source-preview"><div><span>Customer</span><strong>{customer?.name}</strong></div><div><span>Invoice</span><strong>{invoice.id}</strong></div><div><span>Outstanding</span><strong>{money(ar?.outstanding)}</strong></div><div><span>After Receipt</span><strong>{money(Math.max(0,Number(ar?.outstanding||0)-Number(form.amount||0)))}</strong></div></div>}
  </Modal>;
}

export default function ReceiptsPage(){
  const {data,createReceipt}=useERPData();
  const [query,setQuery]=useState('');
  const [open,setOpen]=useState(false);
  const receipts=useMemo(()=>data.receipts.filter((row)=>{const c=data.customers.find((x)=>x.id===row.customerId);return `${row.id} ${row.invoiceId} ${c?.name||''} ${row.reference||''}`.toLowerCase().includes(query.toLowerCase())}),[data.receipts,data.customers,query]);
  const totalToday=data.receipts.filter((r)=>r.date===new Date().toISOString().slice(0,10)).reduce((s,r)=>s+Number(r.amount),0);
  return <>
    <PageHeader eyebrow="Transaction / Financials / Receipt" title="Cash & Bank Receipt" description="Customer receipt, AR allocation, bank/cash posting, dan automatic GL journal." actionLabel="Receive Payment" onAction={()=>setOpen(true)}/>
    <div className="stats-grid"><div className="surface-card finance-kpi"><WalletCards/><span>Receipt Today</span><strong>{money(totalToday)}</strong><small>{data.receipts.filter((r)=>r.date===new Date().toISOString().slice(0,10)).length} receipt</small></div><div className="surface-card finance-kpi"><CircleDollarSign/><span>Open AR</span><strong>{money(data.arOpenItems.reduce((s,r)=>s+Number(r.outstanding),0))}</strong><small>{data.arOpenItems.filter((r)=>Number(r.outstanding)>0).length} item</small></div><div className="surface-card finance-kpi"><Building2/><span>Bank Balance</span><strong>{money(data.bankAccounts.filter((r)=>r.type==='Bank').reduce((s,r)=>s+Number(r.balance),0))}</strong><small>operational accounts</small></div><div className="surface-card finance-kpi"><CalendarDays/><span>Accounting Period</span><strong>{data.accountingPeriods.find((p)=>p.status==='Open')?.label||'-'}</strong><small>posting gate active</small></div></div>
    <section className="surface-card document-section"><header><div><h3>Receipt Register</h3><p>Semua payment yang sudah dialokasikan dan diposting.</p></div><label className="catalog-search receipt-search"><Search size={15}/><input value={query} onChange={(e)=>setQuery(e.target.value)} placeholder="Cari receipt, invoice, customer..."/></label></header><div className="table-wrap"><table className="data-table"><thead><tr><th>Receipt</th><th>Date</th><th>Customer</th><th>Invoice</th><th>Method</th><th>Reference</th><th>Amount</th><th>Status</th><th>Journal</th></tr></thead><tbody>{receipts.map((row)=>{const c=data.customers.find((x)=>x.id===row.customerId);return <tr key={row.id}><td><strong>{row.id}</strong></td><td>{dateLabel(row.date)}</td><td>{c?.name}</td><td>{row.invoiceId}</td><td>{row.method}</td><td>{row.reference||'-'}</td><td>{money(row.amount)}</td><td><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></td><td>{row.journalId}</td></tr>})}</tbody></table></div></section>
    <ReceiptModal open={open} onClose={()=>setOpen(false)} data={data} onCreate={createReceipt}/>
  </>;
}
