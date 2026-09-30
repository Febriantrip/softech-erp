import React, { useMemo, useState } from 'react';
import { Boxes, Calculator, Clock3, Layers3, PackageSearch, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import { useERPData } from '../context/ERPDataContext';
import { dateLabel, money, number } from '../utils/erp';

export default function InventoryValuationPage() {
  const { data } = useERPData();
  const [warehouseId, setWarehouseId] = useState(data.warehouses[0]?.id || 'ALL');
  const rows = useMemo(() => data.inventory.filter((row) => warehouseId === 'ALL' || row.warehouseId === warehouseId).map((row) => {
    const item = data.items.find((x) => x.sku === row.sku);
    const warehouse = data.warehouses.find((x) => x.id === row.warehouseId);
    const avgCost = Number(row.avgCost || item?.standardCost || 0);
    const onHand = Number(row.onHand || 0);
    const reserved = Number(row.reserved || 0);
    const qualityHold = Number(row.qualityHold || 0);
    const quarantine = Number(row.quarantine || 0);
    const available = Math.max(0, onHand - reserved - qualityHold);
    const reorderPoint = Number(item?.reorderPoint || 0);
    return { id: `${row.warehouseId}-${row.sku}`, warehouse: warehouse?.code || row.warehouseId, sku: row.sku, item: item?.name || row.sku, uom: item?.uom || '-', onHand, reserved, qualityHold, quarantine, available, avgCost, inventoryValue: onHand * avgCost, availableValue: available * avgCost, reorderPoint, planning: available <= reorderPoint ? 'Replenish' : 'OK' };
  }), [data.inventory, data.items, data.warehouses, warehouseId]);
  const totalValue = rows.reduce((sum, row) => sum + row.inventoryValue, 0);
  const availableValue = rows.reduce((sum, row) => sum + row.availableValue, 0);
  const reservedValue = rows.reduce((sum, row) => sum + Number(row.reserved || 0) * Number(row.avgCost || 0), 0);
  const qualityHoldValue = rows.reduce((sum, row) => sum + Number(row.qualityHold || 0) * Number(row.avgCost || 0), 0);
  const quarantineValue = rows.reduce((sum, row) => sum + Number(row.quarantine || 0) * Number(row.avgCost || 0), 0);
  const inTransitValue = data.stockTransfers.filter((row) => row.status === 'In Transit' && (warehouseId === 'ALL' || row.fromWarehouseId === warehouseId || row.toWarehouseId === warehouseId)).reduce((sum, transfer) => sum + transfer.lines.reduce((s, line) => s + Number(line.shippedQty || 0) * Number(line.unitCost || 0), 0), 0);
  const lotRows = data.lotBalances.filter((row) => warehouseId === 'ALL' || row.warehouseId === warehouseId).map((row) => ({ ...row, warehouse: data.warehouses.find((x) => x.id === row.warehouseId)?.code || row.warehouseId, item: data.items.find((x) => x.sku === row.sku)?.name || row.sku, qualityHold: Number(row.holdQty || 0), available: Math.max(0, Number(row.onHand || 0) - Number(row.reserved || 0) - Number(row.holdQty || 0)), expiry: dateLabel(row.expiryDate) }));
  const expiring = lotRows.filter((row) => {
    if (!row.expiryDate) return false;
    const days = (new Date(row.expiryDate).getTime() - Date.now()) / 86400000;
    return days <= 180;
  }).length;

  return <>
    <PageHeader eyebrow="Warehouse / Costing" title="Inventory Valuation" description="Weighted-average carrying cost, on-hand valuation, reserved value, in-transit inventory, lot/expiry visibility, dan replenishment signal." />
    <div className="filter-strip"><label className="field compact-field"><span>Warehouse Scope</span><select value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}><option value="ALL">All Warehouses</option>{data.warehouses.map((row) => <option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><div className="filter-strip-note"><Calculator size={15}/><span>Cost method: Moving Weighted Average · operational valuation</span></div></div>
    <div className="stats-grid"><StatCard title="Inventory Value" value={money(totalValue)} hint="physical on-hand" icon={Warehouse}/><StatCard title="Available Value" value={money(availableValue)} hint="after reservation & quality hold" icon={PackageSearch}/><StatCard title="Reserved Value" value={money(reservedValue)} hint="committed to sales" icon={Boxes}/><StatCard title="Quality Hold Value" value={money(qualityHoldValue)} hint="blocked from allocation" icon={Boxes}/><StatCard title="Quarantine Value" value={money(quarantineValue)} hint="returns awaiting disposition" icon={Boxes}/><StatCard title="In Transit Value" value={money(inTransitValue)} hint="inter-site carrying value" icon={Layers3}/></div>
    <SectionCard title="Inventory Valuation by SKU" subtitle="Average cost bergerak saat put-away purchase dan saat inter-site receipt. Shipment menggunakan avg cost untuk COGS."><DataTable rows={rows} columns={[{key:'warehouse',label:'Warehouse'},{key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'onHand',label:'On Hand',render:(v)=>number(v)},{key:'reserved',label:'Reserved',render:(v)=>number(v)},{key:'qualityHold',label:'Quality Hold',render:(v)=>number(v)},{key:'quarantine',label:'Quarantine',render:(v)=>number(v)},{key:'available',label:'Available',render:(v)=>number(v)},{key:'avgCost',label:'Avg Cost',render:(v)=>money(v)},{key:'inventoryValue',label:'Inventory Value',render:(v)=>money(v)},{key:'reorderPoint',label:'ROP',render:(v)=>number(v)},{key:'planning',label:'Planning',render:(v)=><StatusPill tone={v==='OK'?'success':'warning'}>{v}</StatusPill>}]}/></SectionCard>
    <SectionCard title="Lot / Expiry Status" subtitle={`${lotRows.length} lot tracked · ${expiring} lot within 180-day expiry window`} action={<Clock3 size={17}/>}><DataTable rows={lotRows} columns={[{key:'warehouse',label:'Warehouse'},{key:'location',label:'Location'},{key:'sku',label:'SKU'},{key:'item',label:'Item'},{key:'lot',label:'Lot'},{key:'expiry',label:'Expiry'},{key:'onHand',label:'On Hand',render:(v)=>number(v)},{key:'reserved',label:'Reserved',render:(v)=>number(v)},{key:'qualityHold',label:'Quality Hold',render:(v)=>number(v)},{key:'quarantine',label:'Quarantine',render:(v)=>number(v)},{key:'available',label:'Available',render:(v)=>number(v)}]}/></SectionCard>
  </>;
}
