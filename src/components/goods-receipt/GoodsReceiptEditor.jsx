import React from 'react';
import { number } from '../../utils/erp';

const field=(value)=>value===''?'':String(value);

export function receiptDraft(po){
 return (po?.lines||[]).filter(l=>Number(l.qty)-Number(l.receivedQty)>0).map(l=>({
  sku:l.sku,acceptedQty:'',rejectedQty:'',lotNo:'',putAwayLocation:'GENERAL',
 }));
}
export function validateReceiptDraft(po,draft){
 if(!po||!draft.length)return 'PO ini tidak mempunyai sisa qty yang dapat diterima.';
 let acceptedTotal=0;
 for(const line of po.lines||[]){
  const remaining=Number(line.qty)-Number(line.receivedQty);
  const input=draft.find(d=>d.sku===line.sku);
  if(!input)continue;
  const accepted=Number(input.acceptedQty||0),rejected=Number(input.rejectedQty||0);
  if(!Number.isFinite(accepted)||!Number.isFinite(rejected)||accepted<0||rejected<0)return `Qty ${line.sku} tidak valid.`;
  if(accepted+rejected>remaining+0.0000001)return `${line.sku}: Accepted + Rejected tidak boleh melebihi sisa PO ${number(remaining)} ${line.uom||''}.`;
  acceptedTotal+=accepted;
 }
 if(acceptedTotal<=0)return 'Isi minimal satu Accepted Qty lebih besar dari 0.';
 return '';
}
export default function GoodsReceiptEditor({ po, draft, setDraft }){
 const change=(sku,key,value)=>setDraft(current=>current.map(l=>l.sku===sku?{...l,[key]:value}:l));
 const alert=validateReceiptDraft(po,draft);
 return <div className="grn-editor">
  <div className="grn-instruction"><strong>{po.documentNo} · {po.supplier?.name}</strong><span>Qty tidak terisi = 0. Penerimaan tidak otomatis mengambil seluruh sisa PO. Stock masuk ke Inbound, On Hand bertambah setelah Put Away.</span></div>
  <div className="grn-table-wrap"><table className="grn-table"><thead><tr><th>Item</th><th>PO Qty</th><th>Sudah Terima</th><th>Sisa PO</th><th>Accepted *</th><th>Rejected</th><th>Lot</th><th>Location</th></tr></thead><tbody>
   {(po.lines||[]).filter(l=>Number(l.qty)>Number(l.receivedQty)).map(line=>{
    const input=draft.find(d=>d.sku===line.sku)||{};
    const remaining=Number(line.qty)-Number(line.receivedQty);
    const accepted=Number(input.acceptedQty||0),rejected=Number(input.rejectedQty||0);
    const invalid=!Number.isFinite(accepted)||!Number.isFinite(rejected)||accepted<0||rejected<0||accepted+rejected>remaining+0.0000001;
    return <tr key={line.id} className={invalid?'grn-line-invalid':''}><td><strong>{line.sku}</strong><small>{line.itemName}</small><small>{line.uom}</small></td>
     <td>{number(line.qty)}</td><td>{number(line.receivedQty)}</td><td><strong>{number(remaining)}</strong></td>
     <td><input aria-label={`Accepted ${line.sku}`} type="number" min="0" max={remaining} step="any" value={field(input.acceptedQty)} onChange={e=>change(line.sku,'acceptedQty',e.target.value)}/></td>
     <td><input aria-label={`Rejected ${line.sku}`} type="number" min="0" max={remaining} step="any" value={field(input.rejectedQty)} onChange={e=>change(line.sku,'rejectedQty',e.target.value)}/></td>
     <td><input aria-label={`Lot ${line.sku}`} maxLength={100} value={input.lotNo||''} onChange={e=>change(line.sku,'lotNo',e.target.value)}/></td>
     <td><input aria-label={`Location ${line.sku}`} maxLength={80} value={input.putAwayLocation||''} onChange={e=>change(line.sku,'putAwayLocation',e.target.value)}/></td>
    </tr>;
   })}
  </tbody></table></div>
  {alert&&<div className="grn-warning" role="alert">{alert}</div>}
  <div className="grn-totals"><span>Accepted: <strong>{number(draft.reduce((s,l)=>s+Number(l.acceptedQty||0),0))}</strong></span><span>Rejected: <strong>{number(draft.reduce((s,l)=>s+Number(l.rejectedQty||0),0))}</strong></span></div>
 </div>;
}
