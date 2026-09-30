import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRightLeft, Boxes, ClipboardCheck, History, PackageSearch, RefreshCw, Scale, ShieldAlert, Sparkles, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { useERPData } from '../context/ERPDataContext';
import { dateTimeLabel, number } from '../utils/erp';

export default function WarehousePage() {
  const navigate = useNavigate();
  const { data, adjustStock } = useERPData();
  const [warehouseId, setWarehouseId] = useState(data.warehouses[0]?.id || '');
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustment, setAdjustment] = useState({ sku: data.items[0]?.sku || '', qty: 0, reason: 'Cycle count adjustment' });
  const rows = useMemo(() => data.inventory.filter((row) => row.warehouseId === warehouseId).map((row) => {
    const item = data.items.find((x) => x.sku === row.sku);
    const inbound = Number(row.inbound || 0);
    const quarantine = Number(row.quarantine || 0);
    const qualityHold = Number(row.qualityHold || 0);
    const available = Math.max(0, Number(row.onHand) - Number(row.reserved) - qualityHold);
    const reserveRatio = Number(row.onHand) ? (Number(row.reserved) + qualityHold) / Number(row.onHand) : 0;
    return { id: `${warehouseId}-${row.sku}`, sku: row.sku, item: item?.name || '-', uom: item?.uom || '-', onHand: row.onHand, inbound, quarantine, qualityHold, reserved: row.reserved, available, health: available <= 0 ? 'Critical' : reserveRatio > .7 ? 'Low' : 'Healthy' };
  }), [data.inventory, data.items, warehouseId]);
  const movementRows = data.stockMovements.filter((row) => row.warehouseId === warehouseId).slice(0, 25).map((row) => ({ ...row, when: dateTimeLabel(row.at), item: data.items.find((x)=>x.sku===row.sku)?.name || row.sku }));
  const totalOnHand = rows.reduce((s,r)=>s+Number(r.onHand),0);
  const totalInbound = rows.reduce((s,r)=>s+Number(r.inbound||0),0);
  const totalReserved = rows.reduce((s,r)=>s+Number(r.reserved),0);
  const totalQuarantine = rows.reduce((s,r)=>s+Number(r.quarantine||0),0);
  const totalQualityHold = rows.reduce((s,r)=>s+Number(r.qualityHold||0),0);
  const totalAvailable = rows.reduce((s,r)=>s+Number(r.available),0);
  const critical = rows.filter((r)=>r.health!=='Healthy').length;
  const currentWarehouse = data.warehouses.find((row)=>row.id===warehouseId);
  const inTransitOut = data.stockTransfers.filter((row)=>row.status==='In Transit' && row.fromWarehouseId===warehouseId).reduce((sum,row)=>sum+row.lines.reduce((s,line)=>s+Number(line.shippedQty||0),0),0);
  const inTransitIn = data.stockTransfers.filter((row)=>row.status==='In Transit' && row.toWarehouseId===warehouseId).reduce((sum,row)=>sum+row.lines.reduce((s,line)=>s+Number(line.shippedQty||0),0),0);
  const inventoryValue = rows.reduce((sum,row)=>{const stock=data.inventory.find((x)=>x.warehouseId===warehouseId&&x.sku===row.sku); const item=data.items.find((x)=>x.sku===row.sku); return sum+Number(row.onHand||0)*Number(stock?.avgCost||item?.standardCost||0);},0);
  const planningRows = rows.map((row)=>{const item=data.items.find((x)=>x.sku===row.sku); const reorderPoint=Number(item?.reorderPoint||0); const maxStock=Number(item?.maxStock||0); const projected=Number(row.available||0)+Number(row.inbound||0)+data.stockTransfers.filter((t)=>t.status==='In Transit'&&t.toWarehouseId===warehouseId).reduce((s,t)=>s+t.lines.filter((l)=>l.sku===row.sku).reduce((a,l)=>a+Number(l.shippedQty||0),0),0); const suggested=Math.max(0,maxStock-projected); return {...row,reorderPoint,projected,suggested,signal:projected<=reorderPoint?'Replenish':'OK'};}).filter((row)=>row.signal==='Replenish').sort((a,b)=>b.suggested-a.suggested);

  const submitAdjustment=()=>{
    const qty=Number(adjustment.qty);
    if(!adjustment.sku || !qty) return;
    adjustStock({warehouseId,sku:adjustment.sku,qty,reason:adjustment.reason||'Manual adjustment'});
    setAdjustment((prev)=>({...prev,qty:0}));
    setAdjustOpen(false);
  };

  return <>
    <PageHeader eyebrow="Inventory & Fulfillment" title="Warehouse" description="Live inventory projection dari inbound receiving, put-away, on-hand, reservation, shipment issue, dan stock movement ledger." actionLabel="Inventory Adjustment" onAction={()=>setAdjustOpen(true)} />
    <div className="filter-strip"><label className="field compact-field"><span>Active Warehouse</span><select value={warehouseId} onChange={(e)=>setWarehouseId(e.target.value)}>{data.warehouses.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><div className="filter-strip-note"><Warehouse size={15}/><span>{currentWarehouse?.name} · Default location {currentWarehouse?.defaultLocation}</span></div></div>
    <section className="surface-card warehouse-command-center"><div className="warehouse-command-head"><div><strong>Inventory Control Center</strong><span>Transfer, stock take, costing, dan operational ledger dalam satu control plane.</span></div></div><div className="warehouse-command-grid"><button onClick={()=>navigate('/warehouse/stock-transfer')}><span><ArrowRightLeft size={17}/></span><div><strong>Inter-Site Transfer</strong><small>Move stock with in-transit control</small></div></button><button onClick={()=>navigate('/warehouse/stock-take')}><span><ClipboardCheck size={17}/></span><div><strong>Stock Take</strong><small>Count, approve variance, post GL</small></div></button><button onClick={()=>navigate('/warehouse/valuation')}><span><Scale size={17}/></span><div><strong>Inventory Valuation</strong><small>Weighted average, lots, expiry</small></div></button><button onClick={()=>navigate('/warehouse/replenishment')}><span><Sparkles size={17}/></span><div><strong>Replenishment</strong><small>ROP, max stock, source excess</small></div></button><button onClick={()=>navigate('/warehouse/quality-control')}><span><ShieldAlert size={17}/></span><div><strong>Quality Control</strong><small>Hold, scrap, lot recall trace</small></div></button></div></section>
    <div className="stats-grid"><StatCard title="On Hand" value={number(totalOnHand)} hint="available after put-away" icon={Warehouse}/><StatCard title="Inbound" value={number(totalInbound)} hint="received, waiting put-away" icon={RefreshCw}/><StatCard title="Reserved" value={number(totalReserved)} hint="committed to sales orders" icon={Boxes}/><StatCard title="Available" value={number(totalAvailable)} hint={`${critical} low / critical SKU`} icon={PackageSearch}/><StatCard title="In Transit In" value={number(inTransitIn)} hint={`${number(inTransitOut)} outbound in transit`} icon={ArrowRightLeft}/><StatCard title="Quarantine" value={number(totalQuarantine)} hint="customer returns awaiting disposition" icon={Boxes}/><StatCard title="Quality Hold" value={number(totalQualityHold)} hint="excluded from available stock" icon={ShieldAlert}/><StatCard title="Inventory Value" value={new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0,notation:'compact'}).format(inventoryValue)} hint="moving weighted average" icon={Scale}/></div>
    <SectionCard title="Inventory Position" subtitle="Receiving masuk ke inbound staging dulu. Put Away memindahkan inbound ke on-hand; reservation tidak mengurangi physical on-hand."><DataTable columns={[
      {key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'uom',label:'UOM'},{key:'onHand',label:'On Hand',render:(v)=>number(v)},{key:'inbound',label:'Inbound',render:(v)=>number(v)},{key:'quarantine',label:'Quarantine',render:(v)=>number(v)},{key:'qualityHold',label:'Quality Hold',render:(v)=>number(v)},{key:'reserved',label:'Reserved',render:(v)=>number(v)},{key:'available',label:'Available',render:(v)=>number(v)},{key:'health',label:'Health',render:(v)=><StatusPill tone={v==='Healthy'?'success':v==='Low'?'warning':'danger'}>{v}</StatusPill>}
    ]} rows={rows}/></SectionCard>
    <SectionCard title="Replenishment Signals" subtitle="Projected availability = available + inbound + inter-site transfer in transit. Suggested qty menuju max-stock planning level."><DataTable columns={[
      {key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'available',label:'Available',render:(v)=>number(v)},{key:'inbound',label:'Inbound',render:(v)=>number(v)},{key:'projected',label:'Projected',render:(v)=>number(v)},{key:'reorderPoint',label:'Reorder Point',render:(v)=>number(v)},{key:'suggested',label:'Suggested Qty',render:(v)=><strong>{number(v)}</strong>},{key:'signal',label:'Signal',render:(v)=><StatusPill tone="warning">{v}</StatusPill>}
    ]} rows={planningRows} emptyText="Semua SKU masih di atas reorder point."/></SectionCard>
    <SectionCard title="Stock Movement Ledger" subtitle="Audit trail movement fisik beserta carrying cost. Reservation sengaja tidak dicatat sebagai movement fisik." action={<History size={17}/>}><DataTable columns={[
      {key:'when',label:'Time'},{key:'type',label:'Movement Type'},{key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'qty',label:'Qty',render:(v)=><strong className={Number(v)<0?'negative-number':'positive-number'}>{Number(v)>0?'+':''}{number(v)}</strong>},{key:'unitCost',label:'Unit Cost',render:(v)=>v?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v):'-'},{key:'value',label:'Value',render:(v)=>v?new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(v):'-'},{key:'ref',label:'Reference'}
    ]} rows={movementRows} emptyText="Belum ada stock movement untuk warehouse ini."/></SectionCard>
    <Modal open={adjustOpen} onClose={()=>setAdjustOpen(false)} title="Inventory Adjustment" subtitle={`Adjustment fisik untuk ${currentWarehouse?.code}`} footer={<><button className="btn" onClick={()=>setAdjustOpen(false)}>Batal</button><button className="btn btn-primary" onClick={submitAdjustment}>Post Adjustment</button></>}>
      <div className="form-grid"><label className="field"><span>Item</span><select value={adjustment.sku} onChange={(e)=>setAdjustment({...adjustment,sku:e.target.value})}>{data.items.map((row)=><option key={row.sku} value={row.sku}>{row.sku} · {row.name}</option>)}</select></label><label className="field"><span>Qty Adjustment</span><input type="number" value={adjustment.qty} onChange={(e)=>setAdjustment({...adjustment,qty:e.target.value})} placeholder="Gunakan negatif untuk stock out"/></label></div><label className="field"><span>Reason / Reference</span><input value={adjustment.reason} onChange={(e)=>setAdjustment({...adjustment,reason:e.target.value})}/></label>
    </Modal>
  </>;
}
