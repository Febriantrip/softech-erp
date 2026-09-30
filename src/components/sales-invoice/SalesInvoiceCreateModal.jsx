import React, { useEffect, useMemo, useState } from 'react';
import Modal from '../Modal';
import { financeApi } from '../../api/finance';
import { money, number } from '../../utils/erp';

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const money2 = n => Number(n||0);
const lineTotals = (row,qty) => {
  const gross = Math.round(qty * Number(row.unitPrice||0)*100)/100;
  const discount = Math.round(gross*Number(row.discountPercent||0))/100;
  const dpp = Math.round((gross-discount)*100)/100;
  const tax = Math.round(dpp*Number(row.taxRate||0))/100;
  return { gross, discount, dpp, tax, total: dpp+tax };
};

export default function SalesInvoiceCreateModal({open,onClose,scope,sources,onCreate}) {
  const [sourceId,setSourceId] = useState('');
  const [date,setDate] = useState(today);
  const [source,setSource] = useState(null);
  const [qty,setQty] = useState({});
  const [error,setError] = useState('');
  const [loading,setLoading] = useState(false);
  const [busy,setBusy] = useState(false);
  useEffect(()=>{ if(open){setSourceId('');setSource(null);setQty({});setDate(today());setError('');}},[open,scope?.entityCode,scope?.siteCode]);
  useEffect(()=>{
    if(!open||!sourceId||!scope){setSource(null);return;}
    let active=true;
    setLoading(true);setError('');setSource(null);
    financeApi.salesInvoiceSource(scope,sourceId).then(data=>{
      if(!active)return;
      setSource(data);setDate(old=>old<data.podDate?data.podDate:old);setQty(Object.fromEntries((data.lines||[]).map(l=>[l.shipmentLineId,String(l.availableQty)])));
    }).catch(err=>{if(active)setError(err.message)}).finally(()=>{if(active)setLoading(false)});
    return ()=>{active=false};
  },[open,sourceId,scope?.entityCode,scope?.siteCode]);
  const validations=useMemo(()=>{
    if(!source)return {lines:[],error:'Pilih Shipment lebih dahulu.',total:0};
    const lines=(source.lines||[]).map(l=>({line:l,qty:Number(qty[l.shipmentLineId]??0)}));
    const invalid=lines.find(x=>!Number.isFinite(x.qty)||x.qty<0||x.qty>Number(x.line.availableQty)+0.000001);
    if(invalid)return {lines,error:`Qty ${invalid.line.sku} tidak boleh melebihi sisa Shipment ${number(invalid.line.availableQty)} ${invalid.line.uom}.`,total:0};
    const selected=lines.filter(x=>x.qty>0);
    if(!selected.length)return {lines,error:'Pilih minimal satu item dengan Qty Invoice di atas nol.',total:0};
    return {lines,error:'',total:selected.reduce((sum,x)=>sum+lineTotals(x.line,x.qty).total,0)};
  },[source,qty]);
  const submit=async()=>{
    if(!scope||!source||validations.error||busy||!date||date<source.podDate)return;
    setBusy(true);setError('');
    try {
      await onCreate({sourceId:source.id,date,lines:validations.lines.filter(x=>x.qty>0).map(x=>({shipmentLineId:x.line.shipmentLineId,qty:x.qty}))});
      onClose();
    } catch(err){setError(err.message)}finally{setBusy(false)}
  };
  return <Modal wide open={open} onClose={()=>!busy&&onClose()} title="Create Sales Invoice" subtitle="Dari Shipment DELIVERED yang belum ditagihkan. Qty per baris bisa parsial." footer={<><button className="btn" disabled={busy} onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={busy||loading||!!validations.error||!date||(source&&date<source.podDate)} onClick={submit}>{busy?'Membuat...':'Create Draft'}</button></>}>
    <div className="si-create">
      <p className="si-hint">POD harus selesai sebelum penagihan. Draft langsung mengunci alokasi qty agar tidak terinvoice ganda. Hapus Draft untuk melepasnya.</p>
      <div className="si-create-head">
        <label className="field"><span>Shipment yang bisa ditagihkan</span><select value={sourceId} onChange={e=>setSourceId(e.target.value)} disabled={busy}><option value="">Pilih Shipment</option>{sources.map(s=><option key={s.id} value={s.id}>{s.documentNo} · {s.partyName} · Sisa {number(s.availableQty)} · {s.salesOrderNo}</option>)}</select></label>
        <label className="field"><span>Invoice Date</span><input type="date" min={source?.podDate||undefined} value={date} onChange={e=>setDate(e.target.value)} disabled={busy}/></label>
      </div>
      {loading&&<p className="si-hint">Memuat qty, harga, diskon, dan pajak dari PostgreSQL...</p>}
      {source&&<>
        <div className="si-source-label"><strong>{source.documentNo}</strong><span>{source.customerName} · SO {source.salesOrderNo}</span></div>
        <div className="si-scroll"><table className="data-table"><thead><tr><th>Item</th><th>Shipped</th><th>Sudah Invoice</th><th>Sisa</th><th>Qty Invoice</th><th>Harga</th><th>Diskon</th><th>PPN</th><th>Line Total</th></tr></thead><tbody>{source.lines.map(l=>{
          const picked=Number(qty[l.shipmentLineId]??0);
          const over=picked>l.availableQty+0.000001||picked<0||!Number.isFinite(picked);
          return <tr key={l.shipmentLineId}><td><strong>{l.sku}</strong><small>{l.itemName}</small></td><td>{number(l.shippedQty)}</td><td>{number(l.invoicedQty)}</td><td>{number(l.availableQty)} {l.uom}</td><td><input className={over?'si-invalid':''} aria-label={`Qty invoice ${l.sku}`} type="number" min="0" max={l.availableQty} step="any" value={qty[l.shipmentLineId]??''} onChange={e=>setQty(old=>({...old,[l.shipmentLineId]:e.target.value}))}/></td><td>{money(l.unitPrice)}</td><td>{number(l.discountPercent)}%</td><td>{number(l.taxRate)}%</td><td>{over?'—':money2(lineTotals(l,picked).total).toLocaleString('id-ID')}</td></tr>;
        })}</tbody></table></div>
        <div className="si-total"><span>Estimasi Invoice (termasuk pajak)</span><strong>{money(validations.total)}</strong></div>
      </>}
      {(error||(!loading&&source&&(validations.error||(date<source.podDate?`Invoice Date tidak boleh sebelum POD ${source.podDate}.`:""))))&&<div role="alert" className="si-alert">{error||validations.error||(date<source.podDate?`Invoice Date tidak boleh sebelum POD ${source.podDate}.`:"")}</div>}
      {!loading&&sources.length===0&&<p className="si-hint">Belum ada Shipment DELIVERED dengan qty belum ditagihkan pada Entity/Site ini.</p>}
    </div>
  </Modal>;
}
