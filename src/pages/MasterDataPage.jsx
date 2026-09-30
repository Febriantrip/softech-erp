import React, { useMemo, useState } from 'react';
import { Building2, MapPinned, Package, Plus, Store, UsersRound, Warehouse } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ModuleCatalog from '../components/ModuleCatalog';
import DataTable from '../components/DataTable';
import StatusPill from '../components/StatusPill';
import Modal from '../components/Modal';
import { masterGroups } from '../data/erpModules';
import { useERPData } from '../context/ERPDataContext';
import { money, number } from '../utils/erp';

export default function MasterDataPage() {
  const { data, addCustomer, addSupplier, addItem, addWarehouse, addWarehouseLocation } = useERPData();
  const [tab, setTab] = useState('customers');
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});

  const meta = {
    customers: { title: 'Customer Master', singular: 'Customer', icon: UsersRound, count: data.customers.length },
    suppliers: { title: 'Supplier Master', singular: 'Supplier', icon: Store, count: data.suppliers.length },
    items: { title: 'Item Master', singular: 'Item', icon: Package, count: data.items.length },
    warehouses: { title: 'Warehouse Master', singular: 'Warehouse', icon: Warehouse, count: data.warehouses.length },
    locations: { title: 'Warehouse Location Master', singular: 'Location', icon: MapPinned, count: data.warehouseLocations.length }
  };
  const current = meta[tab];

  const resetForm = (type) => {
    if (type === 'customer') setForm({ code: '', name: '', paymentTerm: 'NET 30', creditLimit: 0, shipTo: '' });
    if (type === 'supplier') setForm({ code: '', name: '', paymentTerm: 'NET 30', taxId: '', leadTimeDays: 5, rating: 'B', defaultWarehouseId: data.warehouses[0]?.id || '' });
    if (type === 'item') setForm({ sku: '', name: '', uom: 'CTN', price: 0, standardCost: 0, reorderPoint: 0, maxStock: 0, taxRate: 11 });
    if (type === 'warehouse') setForm({ code: '', name: '', site: 'JKT-HO', defaultLocation: 'GENERAL' });
    if (type === 'location') setForm({ warehouseId: data.warehouses[0]?.id || '', code: '', type: 'Storage', zone: 'General', pickPriority: 999 });
    setModal(type);
  };

  const modalTypeForTab = tab === 'customers' ? 'customer' : tab === 'suppliers' ? 'supplier' : tab === 'items' ? 'item' : tab === 'warehouses' ? 'warehouse' : 'location';
  const save = () => {
    if (modal === 'customer' && form.name && form.code) addCustomer({ ...form, creditLimit: Number(form.creditLimit || 0) });
    if (modal === 'supplier' && form.name && form.code) addSupplier({ ...form, leadTimeDays: Number(form.leadTimeDays || 0) });
    if (modal === 'item' && form.name && form.sku) addItem({ ...form, price: Number(form.price || 0), standardCost: Number(form.standardCost || 0), reorderPoint: Number(form.reorderPoint || 0), maxStock: Number(form.maxStock || 0), taxRate: Number(form.taxRate || 0) });
    if (modal === 'warehouse' && form.name && form.code) addWarehouse(form);
    if (modal === 'location' && form.warehouseId && form.code) addWarehouseLocation({ ...form, pickPriority: Number(form.pickPriority || 999) });
    setModal(null);
  };

  const rows = useMemo(() => {
    if (tab === 'customers') return data.customers;
    if (tab === 'suppliers') return data.suppliers;
    if (tab === 'items') return data.items;
    if (tab === 'warehouses') return data.warehouses;
    return data.warehouseLocations.map((row) => ({ ...row, warehouse: data.warehouses.find((w) => w.id === row.warehouseId)?.code || row.warehouseId }));
  }, [tab, data]);

  return (
    <>
      <PageHeader eyebrow="04 · Master" title="Master Data" description="Operational master aktif untuk Customer, Supplier, Item, dan Warehouse. Semua langsung dipakai oleh Sales, Purchase, Warehouse, AR/AP, dan Finance." />
      <section className="surface-card core-master-card">
        <div className="core-master-head">
          <div><strong>Operational Core Masters</strong><span>Data master utama sudah menjadi source-of-truth transaksi demo, termasuk supplier procurement.</span></div>
          <button className="btn btn-primary" onClick={() => resetForm(modalTypeForTab)}><Plus size={15}/> Tambah {current.singular}</button>
        </div>
        <div className="master-tabs">
          <button className={tab==='customers'?'active':''} onClick={()=>setTab('customers')}><UsersRound size={15}/> Customers <b>{data.customers.length}</b></button>
          <button className={tab==='suppliers'?'active':''} onClick={()=>setTab('suppliers')}><Store size={15}/> Suppliers <b>{data.suppliers.length}</b></button>
          <button className={tab==='items'?'active':''} onClick={()=>setTab('items')}><Package size={15}/> Items <b>{data.items.length}</b></button>
          <button className={tab==='warehouses'?'active':''} onClick={()=>setTab('warehouses')}><Warehouse size={15}/> Warehouses <b>{data.warehouses.length}</b></button>
          <button className={tab==='locations'?'active':''} onClick={()=>setTab('locations')}><MapPinned size={15}/> Locations <b>{data.warehouseLocations.length}</b></button>
        </div>
        <div className="core-master-title"><div><h3>{current.title}</h3><p>{current.count} active records</p></div></div>
        {tab === 'customers' && <DataTable rows={rows} columns={[
          {key:'code',label:'Code'},{key:'name',label:'Customer'},{key:'paymentTerm',label:'Payment Term'},{key:'creditLimit',label:'Credit Limit',render:(v)=>money(v)},{key:'creditUsed',label:'Credit Used',render:(v)=>money(v)},{key:'shipTo',label:'Default Ship-to'},{key:'status',label:'Status',render:(v)=><StatusPill tone="success">{v}</StatusPill>}
        ]}/>} 
        {tab === 'suppliers' && <DataTable rows={rows} columns={[
          {key:'code',label:'Code'},{key:'name',label:'Supplier'},{key:'paymentTerm',label:'Payment Term'},{key:'taxId',label:'Tax ID'},{key:'leadTimeDays',label:'Lead Time',render:(v)=>`${number(v)} days`},{key:'rating',label:'Rating'},{key:'status',label:'Status',render:(v)=><StatusPill tone="success">{v}</StatusPill>}
        ]}/>} 
        {tab === 'items' && <DataTable rows={rows} columns={[
          {key:'sku',label:'SKU'},{key:'name',label:'Item Name'},{key:'uom',label:'Base UOM'},{key:'price',label:'Sales Price',render:(v)=>money(v)},{key:'standardCost',label:'Std Cost',render:(v)=>money(v)},{key:'reorderPoint',label:'Reorder Point',render:(v)=>number(v)},{key:'maxStock',label:'Max Stock',render:(v)=>number(v)},{key:'taxRate',label:'Tax',render:(v)=>`${number(v)}%`},{key:'status',label:'Status',render:(v)=><StatusPill tone="success">{v}</StatusPill>}
        ]}/>} 
        {tab === 'warehouses' && <DataTable rows={rows} columns={[
          {key:'code',label:'Code'},{key:'name',label:'Warehouse'},{key:'site',label:'Site'},{key:'defaultLocation',label:'Default Location'}
        ]}/>} 
        {tab === 'locations' && <DataTable rows={rows} columns={[
          {key:'warehouse',label:'Warehouse'},{key:'code',label:'Location'},{key:'type',label:'Type'},{key:'zone',label:'Zone'},{key:'pickPriority',label:'Pick Priority',render:(v)=>number(v)},{key:'status',label:'Status',render:(v)=><StatusPill tone="success">{v}</StatusPill>}
        ]}/>} 
      </section>
      <div className="master-catalog-divider"><Building2 size={16}/><div><strong>Extended Master Catalog</strong><span>Financial, distribution, POS, manufacturing optional, fixed asset, grouping, extra fields, dan HR.</span></div></div>
      <ModuleCatalog groups={masterGroups} compact />

      <Modal open={Boolean(modal)} onClose={()=>setModal(null)} title={`Tambah ${modal === 'customer' ? 'Customer' : modal === 'supplier' ? 'Supplier' : modal === 'item' ? 'Item' : modal === 'warehouse' ? 'Warehouse' : 'Location'}`} subtitle="Record tersimpan di local demo store dan langsung tersedia pada transaksi." footer={<><button className="btn" onClick={()=>setModal(null)}>Batal</button><button className="btn btn-primary" onClick={save}>Simpan</button></>}>
        {modal === 'customer' && <div className="form-grid"><label className="field"><span>Customer Code</span><input value={form.code||''} onChange={(e)=>setForm({...form,code:e.target.value})}/></label><label className="field"><span>Customer Name</span><input value={form.name||''} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Payment Term</span><select value={form.paymentTerm||'NET 30'} onChange={(e)=>setForm({...form,paymentTerm:e.target.value})}><option>COD</option><option>NET 14</option><option>NET 21</option><option>NET 30</option><option>NET 45</option></select></label><label className="field"><span>Credit Limit</span><input type="number" value={form.creditLimit||0} onChange={(e)=>setForm({...form,creditLimit:e.target.value})}/></label><label className="field field--full"><span>Default Ship-to</span><input value={form.shipTo||''} onChange={(e)=>setForm({...form,shipTo:e.target.value})}/></label></div>}
        {modal === 'supplier' && <div className="form-grid"><label className="field"><span>Supplier Code</span><input value={form.code||''} onChange={(e)=>setForm({...form,code:e.target.value})}/></label><label className="field"><span>Supplier Name</span><input value={form.name||''} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Payment Term</span><select value={form.paymentTerm||'NET 30'} onChange={(e)=>setForm({...form,paymentTerm:e.target.value})}><option>COD</option><option>NET 14</option><option>NET 21</option><option>NET 30</option><option>NET 45</option></select></label><label className="field"><span>Lead Time (days)</span><input type="number" min="0" value={form.leadTimeDays||0} onChange={(e)=>setForm({...form,leadTimeDays:e.target.value})}/></label><label className="field"><span>Tax ID / NPWP</span><input value={form.taxId||''} onChange={(e)=>setForm({...form,taxId:e.target.value})}/></label><label className="field"><span>Rating</span><select value={form.rating||'B'} onChange={(e)=>setForm({...form,rating:e.target.value})}><option>A</option><option>B</option><option>C</option></select></label><label className="field field--full"><span>Default Warehouse</span><select value={form.defaultWarehouseId||''} onChange={(e)=>setForm({...form,defaultWarehouseId:e.target.value})}>{data.warehouses.map((r)=><option key={r.id} value={r.id}>{r.code} · {r.name}</option>)}</select></label></div>}
        {modal === 'item' && <div className="form-grid"><label className="field"><span>SKU</span><input value={form.sku||''} onChange={(e)=>setForm({...form,sku:e.target.value})}/></label><label className="field"><span>Item Name</span><input value={form.name||''} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Base UOM</span><select value={form.uom||'CTN'} onChange={(e)=>setForm({...form,uom:e.target.value})}><option>PCS</option><option>CTN</option><option>BOX</option><option>KG</option><option>SET</option></select></label><label className="field"><span>Sales Price</span><input type="number" value={form.price||0} onChange={(e)=>setForm({...form,price:e.target.value})}/></label><label className="field"><span>Standard Cost</span><input type="number" value={form.standardCost||0} onChange={(e)=>setForm({...form,standardCost:e.target.value})}/></label><label className="field"><span>Reorder Point</span><input type="number" min="0" value={form.reorderPoint||0} onChange={(e)=>setForm({...form,reorderPoint:e.target.value})}/></label><label className="field"><span>Max Stock</span><input type="number" min="0" value={form.maxStock||0} onChange={(e)=>setForm({...form,maxStock:e.target.value})}/></label><label className="field"><span>Tax %</span><input type="number" value={form.taxRate||11} onChange={(e)=>setForm({...form,taxRate:e.target.value})}/></label></div>}
        {modal === 'warehouse' && <div className="form-grid"><label className="field"><span>Warehouse Code</span><input value={form.code||''} onChange={(e)=>setForm({...form,code:e.target.value})}/></label><label className="field"><span>Warehouse Name</span><input value={form.name||''} onChange={(e)=>setForm({...form,name:e.target.value})}/></label><label className="field"><span>Site Code</span><input value={form.site||''} onChange={(e)=>setForm({...form,site:e.target.value})}/></label><label className="field"><span>Default Location</span><input value={form.defaultLocation||''} onChange={(e)=>setForm({...form,defaultLocation:e.target.value})}/></label></div>}
        {modal === 'location' && <div className="form-grid"><label className="field"><span>Warehouse</span><select value={form.warehouseId||''} onChange={(e)=>setForm({...form,warehouseId:e.target.value})}>{data.warehouses.map((row)=><option key={row.id} value={row.id}>{row.code} · {row.name}</option>)}</select></label><label className="field"><span>Location Code</span><input value={form.code||''} onChange={(e)=>setForm({...form,code:e.target.value})} placeholder="A-01-01"/></label><label className="field"><span>Location Type</span><select value={form.type||'Storage'} onChange={(e)=>setForm({...form,type:e.target.value})}><option>Inbound</option><option>Storage</option><option>Pick Face</option><option>Staging</option><option>Quarantine</option><option>Return</option><option>Virtual</option></select></label><label className="field"><span>Zone</span><input value={form.zone||''} onChange={(e)=>setForm({...form,zone:e.target.value})}/></label><label className="field field--full"><span>Pick Priority</span><input type="number" min="1" value={form.pickPriority||999} onChange={(e)=>setForm({...form,pickPriority:e.target.value})}/></label></div>}
      </Modal>
    </>
  );
}
