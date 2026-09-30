import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';

export function emptySalesOrder(masters={}) {
  const customer=masters.customers?.[0], wh=masters.warehouses?.[0], item=masters.items?.[0];
  return { customerCode:customer?.code||'', warehouseCode:wh?.code||'', orderDate:new Date().toISOString().slice(0,10), requestedDeliveryDate:'', customerPo:'', paymentTerms:String(customer?.paymentTerms||''), billingAddress:'', shippingAddress:'', salesperson:'', notes:'', internalNotes:'', lines:[{sku:item?.sku||'',description:'',qty:1,unitPrice:Number(item?.salesPrice||0),discountPercent:0,taxCode:''}] };
}

export default function SalesOrderEditor({form,setForm,masters}){
  const taxCodes=masters?.taxCodes||[];
  const summary=useMemo(()=>form.lines.reduce((a,l)=>{const qty=Number(l.qty||0),price=Number(l.unitPrice||0),disc=Math.min(100,Math.max(0,Number(l.discountPercent||0))),tax=taxCodes.find(t=>t.code===l.taxCode)?.rate ?? masters?.items?.find(i=>i.sku===l.sku)?.taxRate ?? 0;const gross=qty*price,d=gross*disc/100,dpp=gross-d,t=dpp*Number(tax||0)/100;return {subtotal:a.subtotal+gross,discount:a.discount+d,dpp:a.dpp+dpp,tax:a.tax+t,total:a.total+dpp+t}}, {subtotal:0,discount:0,dpp:0,tax:0,total:0}),[form.lines,masters,taxCodes]);
  const money=(v)=>new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v||0);
  const patch=(k,v)=>setForm({...form,[k]:v});
  const patchLine=(i,k,v)=>setForm({...form,lines:form.lines.map((x,j)=>j===i?{...x,[k]:v}:x)});
  return <>
    <div className="so-detail-form-grid">
      <label className="field"><span>Customer</span><select value={form.customerCode} onChange={e=>{const c=masters.customers?.find(x=>x.code===e.target.value);setForm({...form,customerCode:e.target.value,paymentTerms:String(c?.paymentTerms||form.paymentTerms||'')})}}>{(masters.customers||[]).map(r=><option key={r.id} value={r.code}>{r.code} · {r.name}</option>)}</select></label>
      <label className="field"><span>Warehouse</span><select value={form.warehouseCode} onChange={e=>patch('warehouseCode',e.target.value)}>{(masters.warehouses||[]).map(r=><option key={r.id} value={r.code}>{r.code} · {r.name}</option>)}</select></label>
      <label className="field"><span>Order Date</span><input type="date" value={form.orderDate} onChange={e=>patch('orderDate',e.target.value)}/></label>
      <label className="field"><span>Requested Delivery</span><input type="date" value={form.requestedDeliveryDate||''} onChange={e=>patch('requestedDeliveryDate',e.target.value)}/></label>
      <label className="field"><span>Customer PO</span><input value={form.customerPo||''} onChange={e=>patch('customerPo',e.target.value)} placeholder="PO/reference customer"/></label>
      <label className="field"><span>Payment Terms</span><input value={form.paymentTerms||''} onChange={e=>patch('paymentTerms',e.target.value)} placeholder="NET 30"/></label>
      <label className="field"><span>Salesperson / PIC</span><input value={form.salesperson||''} onChange={e=>patch('salesperson',e.target.value)}/></label>
    </div>
    <div className="so-address-grid">
      <label className="field"><span>Billing Address</span><textarea rows="2" value={form.billingAddress||''} onChange={e=>patch('billingAddress',e.target.value)}/></label>
      <label className="field"><span>Shipping Address</span><textarea rows="2" value={form.shippingAddress||''} onChange={e=>patch('shippingAddress',e.target.value)}/></label>
    </div>
    <div className="modal-line-head"><div><strong>Order Lines</strong><small>Discount dan pajak dihitung ulang di backend.</small></div><button type="button" className="btn btn-sm" onClick={()=>setForm({...form,lines:[...form.lines,{sku:masters.items?.[0]?.sku||'',description:'',qty:1,unitPrice:Number(masters.items?.[0]?.salesPrice||0),discountPercent:0,taxCode:''}]})}><Plus size={13}/> Item</button></div>
    <div className="so-line-list">{form.lines.map((line,i)=><div className="so-line-editor" key={i}>
      <label className="field so-item-field"><span>SKU / Item</span><select value={line.sku} onChange={e=>{const it=masters.items?.find(x=>x.sku===e.target.value);setForm({...form,lines:form.lines.map((x,j)=>j===i?{...x,sku:e.target.value,unitPrice:Number(it?.salesPrice||0)}:x)})}}>{(masters.items||[]).map(r=><option key={r.id} value={r.sku}>{r.sku} · {r.name}</option>)}</select></label>
      <label className="field"><span>Qty</span><input type="number" min="0.000001" step="any" value={line.qty} onChange={e=>patchLine(i,'qty',e.target.value)}/></label>
      <label className="field"><span>Unit Price</span><input type="number" min="0" step="any" value={line.unitPrice} onChange={e=>patchLine(i,'unitPrice',e.target.value)}/></label>
      <label className="field"><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={line.discountPercent||0} onChange={e=>patchLine(i,'discountPercent',e.target.value)}/></label>
      <label className="field"><span>Tax Code</span><select value={line.taxCode||''} onChange={e=>patchLine(i,'taxCode',e.target.value)}><option value="">Item default</option>{taxCodes.map(t=><option key={t.id} value={t.code}>{t.code} · {t.rate}%</option>)}</select></label>
      <button type="button" className="icon-btn so-remove-line" disabled={form.lines.length===1} onClick={()=>setForm({...form,lines:form.lines.filter((_,j)=>j!==i)})}><Trash2 size={15}/></button>
      <label className="field so-description-field"><span>Description</span><input value={line.description||''} onChange={e=>patchLine(i,'description',e.target.value)} placeholder="Optional line note"/></label>
    </div>)}</div>
    <div className="so-order-summary"><div><span>Subtotal</span><strong>{money(summary.subtotal)}</strong></div><div><span>Discount</span><strong>- {money(summary.discount)}</strong></div><div><span>DPP</span><strong>{money(summary.dpp)}</strong></div><div><span>PPN / Tax</span><strong>{money(summary.tax)}</strong></div><div className="grand"><span>Grand Total</span><strong>{money(summary.total)}</strong></div></div>
    <div className="so-address-grid"><label className="field"><span>Customer Notes</span><textarea rows="2" value={form.notes||''} onChange={e=>patch('notes',e.target.value)}/></label><label className="field"><span>Internal Notes</span><textarea rows="2" value={form.internalNotes||''} onChange={e=>patch('internalNotes',e.target.value)}/></label></div>
  </>;
}
