import React, { useMemo, useState } from 'react';
import { Building2, Factory, Globe2, MapPin, Plus, ShieldCheck, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatCard from '../components/StatCard';
import SectionCard from '../components/SectionCard';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { useERPData } from '../context/ERPDataContext';
import { money } from '../utils/erp';

function EntityModal({ open, onClose, onCreate, groupId }) {
  const [form, setForm] = useState({ code: '', name: '', groupId, baseCurrency: 'IDR', country: 'ID', taxId: '' });
  React.useEffect(() => { if (open) setForm({ code: '', name: '', groupId, baseCurrency: 'IDR', country: 'ID', taxId: '' }); }, [open, groupId]);
  return <Modal open={open} onClose={onClose} title="New Legal Entity" subtitle="Legal entity baru akan memiliki ledger dan accounting period terpisah." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.code || !form.name} onClick={() => { const id = onCreate(form); if (id) onClose(); }}>Create Entity</button></>}>
    <div className="form-grid">
      <label className="field"><span>Entity Code</span><input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="NDB"/></label>
      <label className="field"><span>Legal Name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} placeholder="PT Nusantara Distribusi Barat"/></label>
      <label className="field"><span>Base Currency</span><select value={form.baseCurrency} onChange={(e)=>setForm({...form,baseCurrency:e.target.value})}><option>IDR</option><option>USD</option><option>SGD</option></select></label>
      <label className="field"><span>Country</span><input value={form.country} onChange={(e)=>setForm({...form,country:e.target.value.toUpperCase()})}/></label>
      <label className="field field--full"><span>Tax ID / NPWP</span><input value={form.taxId} onChange={(e)=>setForm({...form,taxId:e.target.value})}/></label>
    </div>
  </Modal>;
}

function SiteModal({ open, onClose, onCreate, entities }) {
  const [form, setForm] = useState({ entityId: entities[0]?.id || '', code: '', name: '', type: 'Branch', city: '' });
  React.useEffect(() => { if (open) setForm({ entityId: entities[0]?.id || '', code: '', name: '', type: 'Branch', city: '' }); }, [open, entities]);
  return <Modal open={open} onClose={onClose} title="New Site" subtitle="Site berada di bawah satu legal entity dan menjadi scope operational transaction." footer={<><button className="btn" onClick={onClose}>Batal</button><button className="btn btn-primary" disabled={!form.entityId || !form.code || !form.name} onClick={() => { const id = onCreate(form); if (id) onClose(); }}>Create Site</button></>}>
    <div className="form-grid">
      <label className="field field--full"><span>Legal Entity</span><select value={form.entityId} onChange={(e)=>setForm({...form,entityId:e.target.value})}>{entities.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label>
      <label className="field"><span>Site Code</span><input value={form.code} onChange={(e)=>setForm({...form,code:e.target.value.toUpperCase()})} placeholder="BDG-BR"/></label>
      <label className="field"><span>Site Name</span><input value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></label>
      <label className="field"><span>Type</span><select value={form.type} onChange={(e)=>setForm({...form,type:e.target.value})}><option>Head Office</option><option>Branch</option><option>Distribution Center</option><option>Warehouse</option></select></label>
      <label className="field"><span>City</span><input value={form.city} onChange={(e)=>setForm({...form,city:e.target.value})}/></label>
    </div>
  </Modal>;
}

export default function EnterpriseStructurePage() {
  const { rawData, scope, currentEntity, addLegalEntity, addSite, setEntityScope, setGroupScope } = useERPData();
  const [entityOpen, setEntityOpen] = useState(false);
  const [siteOpen, setSiteOpen] = useState(false);
  const group = rawData.consolidationGroups.find((row)=>row.id===scope.groupId) || rawData.consolidationGroups[0];
  const entities = rawData.legalEntities.filter((row)=>row.groupId===group?.id);
  const sites = rawData.sites.filter((row)=>entities.some((e)=>e.id===row.entityId)).map((row)=>({ ...row, entity: entities.find((e)=>e.id===row.entityId)?.code || row.entityId, warehouseCount: rawData.warehouses.filter((w)=>w.siteId===row.id).length }));
  const inventoryValue = useMemo(() => rawData.inventory.reduce((sum,row)=>{ const wh=rawData.warehouses.find((x)=>x.id===row.warehouseId); if(!wh || !entities.some((e)=>e.id===wh.entityId)) return sum; const item=rawData.items.find((x)=>x.sku===row.sku); return sum + Number(row.onHand||0)*Number(row.avgCost||item?.standardCost||0); },0),[rawData,entities]);

  return <>
    <PageHeader eyebrow="Enterprise / Organization" title="Entity & Site Structure" description="Legal entity, branch/site, warehouse ownership, accounting scope, dan access boundary untuk ERP multi-company." actionLabel="New Entity" onAction={()=>setEntityOpen(true)} />
    <div className="stats-grid">
      <StatCard title="Legal Entities" value={String(entities.length)} hint={group?.name || 'Consolidation group'} icon={Building2}/>
      <StatCard title="Operational Sites" value={String(sites.length)} hint={`${rawData.warehouses.length} warehouses`} icon={MapPin}/>
      <StatCard title="Group Inventory" value={money(inventoryValue)} hint="carrying value across entities" icon={Warehouse}/>
      <StatCard title="Base Currency" value={group?.currency || 'IDR'} hint="consolidation currency" icon={Globe2}/>
    </div>

    <section className="enterprise-entity-grid">
      {entities.map((entity)=>{
        const entitySites=rawData.sites.filter((s)=>s.entityId===entity.id);
        const wh=rawData.warehouses.filter((w)=>w.entityId===entity.id);
        const bank=rawData.bankAccounts.filter((b)=>b.entityId===entity.id).reduce((s,b)=>s+Number(b.balance||0),0);
        const period=rawData.accountingPeriods.find((p)=>p.entityId===entity.id&&p.year===2026&&p.month===9);
        return <article key={entity.id} className={`surface-card enterprise-entity-card ${currentEntity?.id===entity.id&&scope.mode==='ENTITY'?'active':''}`}>
          <div className="enterprise-entity-card__top"><span className={`enterprise-entity-mark token-${entity.colorToken||'violet'}`}><Building2 size={18}/></span><div><small>LEGAL ENTITY</small><h3>{entity.code}</h3><p>{entity.name}</p></div><StatusPill tone={period?.status==='Closed'?'success':'info'}>{period?.status || 'No Period'}</StatusPill></div>
          <div className="enterprise-entity-metrics"><div><span>Sites</span><strong>{entitySites.length}</strong></div><div><span>Warehouses</span><strong>{wh.length}</strong></div><div><span>Bank/Cash</span><strong>{money(bank)}</strong></div></div>
          <div className="enterprise-entity-actions"><button className="btn" onClick={()=>setEntityScope(entity.id)}>Open Entity</button><button className="btn btn-ghost" onClick={()=>setGroupScope(group.id)}>Group View</button></div>
        </article>;
      })}
    </section>

    <SectionCard title="Sites & Operational Ownership" subtitle="Setiap warehouse dan transaction akan mewarisi entity/site dari struktur ini." action={<button className="btn btn-primary" onClick={()=>setSiteOpen(true)}><Plus size={14}/> New Site</button>}>
      <DataTable rows={sites} columns={[
        {key:'entity',label:'Entity'},{key:'code',label:'Site Code'},{key:'name',label:'Site Name'},{key:'type',label:'Type'},{key:'city',label:'City'},{key:'warehouseCount',label:'Warehouses'},{key:'status',label:'Status',render:(v)=><StatusPill tone="success">{v}</StatusPill>}
      ]}/>
    </SectionCard>

    <section className="surface-card enterprise-principles"><div><ShieldCheck size={19}/><div><strong>Enterprise boundary aktif</strong><span>Sales, Purchase, Warehouse, AR/AP, Bank, Journal, Closing Period, dan approval sekarang memakai legal entity/site scope. Transfer lintas legal entity tidak boleh memakai Stock Transfer biasa dan harus masuk Intercompany.</span></div></div><Factory size={28}/></section>

    <EntityModal open={entityOpen} onClose={()=>setEntityOpen(false)} onCreate={addLegalEntity} groupId={group?.id}/>
    <SiteModal open={siteOpen} onClose={()=>setSiteOpen(false)} onCreate={addSite} entities={entities}/>
  </>;
}
