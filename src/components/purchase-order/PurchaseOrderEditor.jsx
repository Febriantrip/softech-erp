import React, { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { money, number } from '../../utils/erp';

const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => isoDate(new Date());
const future = days => {const d=new Date();d.setDate(d.getDate()+days);return isoDate(d);};
export function emptyPurchaseOrder(masters = {}, scope = {}) {
  const supplier = masters.suppliers?.[0];
  const warehouses = (masters.warehouses || []).filter(w => !scope.siteCode || w.siteCode === scope.siteCode);
  const item = masters.items?.[0];
  return {supplierCode:supplier?.code||'', warehouseCode:warehouses[0]?.code||'',
    orderDate:today(), etaDate:future(Number(supplier?.leadTimeDays??5)),
    supplierReference:'', paymentTerms:supplier?.paymentTerms||'', notes:'',
    lines:[{sku:item?.sku||'', description:'', qty:1,unitPrice:Number(item?.standardCost||0), discountPercent:0,taxCode:''}]};
}
export default function PurchaseOrderEditor({form,setForm,masters={},scope={}}){
  const suppliers=masters.suppliers||[]; const warehouses=(masters.warehouses||[]).filter(w=>!scope.siteCode||w.siteCode===scope.siteCode);
  const items=masters.items||[]; const taxCodes=masters.taxCodes||[];
  const patch=(key,value)=>setForm(v=>({...v,[key]:value}));
  const patchLine=(index,key,value)=>setForm(v=>({...v,lines:v.lines.map((l,i)=>i===index?{...l,[key]:value}:l)}));
  const summary=useMemo(()=>form.lines.reduce((sum,l)=>{
    const qty=Number(l.qty||0),price=Number(l.unitPrice||0),disc=Number(l.discountPercent||0);
    const rate=Number(taxCodes.find(t=>t.code===l.taxCode)?.rate??items.find(i=>i.sku===l.sku)?.taxRate??0);
    const gross=Math.round(qty*price*100)/100;
    const unit=Math.round(price*(100-disc)/100*1000000)/1000000;
    const net=Math.round(qty*unit*100)/100;const discount=Math.round((gross-net)*100)/100;
    const tax=Math.round(net*rate)/100;
    return {gross:sum.gross+gross,discount:sum.discount+discount,net:sum.net+net,tax:sum.tax+tax};
  },{gross:0,discount:0,net:0,tax:0}),[form.lines,items,taxCodes]);
  return <div className="po-editor">
    <div className="po-form-grid">
      <label className="field"><span>Supplier</span><select value={form.supplierCode} onChange={e=>{const supplier=suppliers.find(s=>s.code===e.target.value);setForm(v=>({...v,supplierCode:e.target.value,paymentTerms:supplier?.paymentTerms||v.paymentTerms}))}}>{suppliers.map(s=><option key={s.id} value={s.code}>{s.code} · {s.name}</option>)}</select></label>
      <label className="field"><span>Warehouse</span><select value={form.warehouseCode} onChange={e=>patch('warehouseCode',e.target.value)}>{warehouses.map(w=><option key={w.id} value={w.code}>{w.code} · {w.name} ({w.siteCode})</option>)}</select></label>
      <label className="field"><span>Order Date</span><input type="date" value={form.orderDate} onChange={e=>patch('orderDate',e.target.value)}/></label>
      <label className="field"><span>ETA</span><input type="date" value={form.etaDate} min={form.orderDate} onChange={e=>patch('etaDate',e.target.value)}/></label>
      <label className="field"><span>Supplier Reference</span><input value={form.supplierReference||''} onChange={e=>patch('supplierReference',e.target.value)} placeholder="Quotation / vendor reference"/></label>
      <label className="field"><span>Payment Terms</span><input value={form.paymentTerms||''} onChange={e=>patch('paymentTerms',e.target.value)} placeholder="NET 30"/></label>
    </div>
    <div className="po-editor-heading"><strong>Purchase Order Lines</strong><button className="btn btn-sm" type="button" onClick={()=>setForm(v=>({...v,lines:[...v.lines,{sku:items[0]?.sku||'',description:'',qty:1,unitPrice:Number(items[0]?.standardCost||0),discountPercent:0,taxCode:''}]}))}><Plus size={14}/> Add Item</button></div>
    <div className="po-line-list">{form.lines.map((line,index)=><div className="po-line" key={index}>
      <label className="field po-line-sku"><span>SKU</span><select value={line.sku} onChange={e=>{const item=items.find(i=>i.sku===e.target.value);setForm(v=>({...v,lines:v.lines.map((l,i)=>i===index?{...l,sku:e.target.value,unitPrice:Number(item?.standardCost||0)}:l)}))}}>{items.map(i=><option key={i.id} value={i.sku}>{i.sku} · {i.name}</option>)}</select></label>
      <label className="field"><span>Qty Transaksi ({items.find(i=>i.sku===line.sku)?.uom||'UOM'})</span><input type="number" min="0.000001" step="any" value={line.qty} onChange={e=>patchLine(index,'qty',e.target.value)}/></label>
      <label className="field"><span>Qty Inventory · Read only</span><input type="text" readOnly value={`${number(Number(line.qty||0))} ${items.find(i=>i.sku===line.sku)?.uom||''}`}/><small>Legacy quantity remains in current inventory base UOM. Setting an alternative UOM does not convert existing stock.</small></label>
      <label className="field"><span>Unit Price</span><input type="number" min="0" step="any" value={line.unitPrice} onChange={e=>patchLine(index,'unitPrice',e.target.value)}/></label>
      <label className="field"><span>Discount %</span><input type="number" min="0" max="100" step="0.01" value={line.discountPercent??0} onChange={e=>patchLine(index,'discountPercent',e.target.value)}/></label>
      <label className="field"><span>Tax</span><select value={line.taxCode||''} onChange={e=>patchLine(index,'taxCode',e.target.value)}><option value="">Item default</option>{taxCodes.map(t=><option key={t.id} value={t.code}>{t.code} · {t.rate}%</option>)}</select></label>
      <button type="button" className="icon-btn" disabled={form.lines.length===1} title="Remove line" onClick={()=>setForm(v=>({...v,lines:v.lines.filter((_,i)=>i!==index)}))}><Trash2 size={15}/></button>
      <label className="field po-line-description"><span>Description</span><input value={line.description||''} onChange={e=>patchLine(index,'description',e.target.value)}/></label>
    </div>)}</div>
    <div className="po-edit-summary"><span>Subtotal <strong>{money(summary.gross)}</strong></span><span>Discount <strong>- {money(summary.discount)}</strong></span><span>DPP <strong>{money(summary.net)}</strong></span><span>Tax <strong>{money(summary.tax)}</strong></span><span className="po-total">Total <strong>{money(summary.net+summary.tax)}</strong></span></div>
    <label className="field"><span>Notes</span><textarea rows={2} value={form.notes||''} onChange={e=>patch('notes',e.target.value)}/></label>
    <small>Harga net setelah diskon menjadi procurement unit cost untuk receiving dan supplier invoice; angka final dihitung server.</small>
  </div>;
}
