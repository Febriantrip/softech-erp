import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, CalendarDays, MapPin, PackageCheck, RefreshCw, Search, Truck, UserRound, XCircle } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import StatusPill from '../components/StatusPill';
import DocumentLifecycle from '../components/DocumentLifecycle';
import Modal from '../components/Modal';
import { coreApi } from '../api/core';
import { useCoreList } from '../hooks/useCoreWorkspace';
import { dateTimeLabel, number, statusTone } from '../utils/erp';

export default function ApiPickingOrderPage() {
  const navigate = useNavigate();
  const loader = useCallback((scope) => coreApi.pickingOrders(scope), []);
  const list = useCoreList(loader);
  const { scope } = list;
  const [selectedId, setSelectedId] = useState('');
  const [detail, setDetail] = useState(null);
  const [draftLines, setDraftLines] = useState([]);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [deliveryOpen, setDeliveryOpen] = useState(false);
  const [deliveryLines, setDeliveryLines] = useState([]);

  const docs = useMemo(() => list.rows.filter((row) => `${row.documentNo} ${row.salesOrderNo} ${row.customerName} ${row.status}`.toLowerCase().includes(query.toLowerCase())), [list.rows, query]);
  const lineValidation = useMemo(() => {
    const byId = {};
    let firstError = '';
    for (const line of detail?.lines || []) {
      const draft = draftLines.find((row) => row.id === line.id) || {};
      const raw = draft.pickedQty ?? line.pickedQty ?? 0;
      const picked = raw === '' ? 0 : Number(raw);
      const requested = Number(line.requestedQty || 0);
      let error = '';
      if (!Number.isFinite(picked) || picked < 0) error = `Picked Qty ${line.sku} harus 0 atau lebih.`;
      else if (picked > requested + 0.000001) error = `Picked Qty ${line.sku} (${number(picked)} ${line.uom}) tidak boleh melebihi Requested (${number(requested)} ${line.uom}).`;
      if (error) {
        byId[line.id] = error;
        if (!firstError) firstError = error;
      }
    }
    return { byId, firstError, hasError: Object.keys(byId).length > 0 };
  }, [detail?.lines, draftLines]);

  const load = useCallback(async (id) => {
    if (!scope || !id) return;
    setBusy(`load:${id}`);
    try {
      const row = await coreApi.pickingOrder(scope, id);
      setDetail(row);
      setDraftLines((row.lines || []).map((line) => ({ id: line.id, pickedQty: Number(line.pickedQty || 0), location: line.location || '', lotNo: line.lotNo || '' })));
    } catch (e) { setMessage(e.message); }
    finally { setBusy(''); }
  }, [scope?.entityCode, scope?.siteCode]);

  useEffect(() => {
    const next = selectedId && list.rows.some((row) => row.id === selectedId) ? selectedId : list.rows[0]?.id || '';
    if (next !== selectedId) setSelectedId(next);
    if (next) void load(next); else setDetail(null);
  }, [list.rows, selectedId, load]);

  const refreshAll = async () => { await list.refresh(); if (selectedId) await load(selectedId); };
  const saveProgress = async () => {
    if (!scope || !detail) return;
    if (lineValidation.hasError) { setMessage(lineValidation.firstError); return; }
    setBusy('save'); setMessage('');
    try {
      await coreApi.updatePickingOrder(scope, detail.id, { lines: draftLines.map((line) => ({ ...line, pickedQty: Number(line.pickedQty || 0) })) });
      setMessage(`${detail.documentNo} progress tersimpan.`); await refreshAll();
    } catch (e) { setMessage(e.message); } finally { setBusy(''); }
  };
  const complete = async () => {
    if (!scope || !detail) return;
    if (lineValidation.hasError) { setMessage(lineValidation.firstError); return; }
    setBusy('complete'); setMessage('');
    try {
      const payload = { lines: draftLines.map((line) => ({ ...line, pickedQty: Number(line.pickedQty || 0) })) };
      const result = await coreApi.completePickingOrder(scope, detail.id, payload);
      setMessage(`${result.documentNo || detail.documentNo} → COMPLETED`);
      await refreshAll();
    }
    catch (e) { setMessage(e.message); } finally { setBusy(''); }
  };
  const cancel = async () => {
    if (!scope || !detail || !cancelReason.trim()) return;
    setBusy('cancel'); setMessage('');
    try { await coreApi.cancelPickingOrder(scope, detail.id, cancelReason.trim()); setCancelOpen(false); setCancelReason(''); setMessage(`${detail.documentNo} dibatalkan.`); await list.refresh(); }
    catch (e) { setMessage(e.message); } finally { setBusy(''); }
  };
  const editLine = (id, patch) => setDraftLines((rows) => rows.map((line) => line.id === id ? { ...line, ...patch } : line));
  const openDelivery = () => { const rows=(detail?.lines||[]).filter((line)=>Number(line.availableForDeliveryQty||0)>0.000001).map((line)=>({pickingLineId:line.id,sku:line.sku,uom:line.uom,max:Number(line.availableForDeliveryQty||0),qty:Number(line.availableForDeliveryQty||0)})); setDeliveryLines(rows); setDeliveryOpen(true); };
  const createDelivery = async () => { if(!scope||!detail)return; const lines=deliveryLines.filter((line)=>Number(line.qty)>0).map((line)=>({pickingLineId:line.pickingLineId,qty:Number(line.qty)})); if(!lines.length){setMessage('Pilih minimal satu qty untuk Delivery Order.');return} const invalid=deliveryLines.find((line)=>Number(line.qty)<0||Number(line.qty)>line.max+0.000001); if(invalid){setMessage(`Delivery Qty ${invalid.sku} tidak boleh melebihi ${number(invalid.max)} ${invalid.uom}.`);return} setBusy('delivery');setMessage('');try{const result=await coreApi.createDeliveryOrder(scope,detail.id,{lines});setDeliveryOpen(false);setMessage(`${result.documentNo} berhasil dibuat.`);await refreshAll();navigate('/transactions/distribution/delivery-order')}catch(e){setMessage(e.message)}finally{setBusy('')} };
  const deliveryAvailable = detail?.status === 'COMPLETED' && (detail?.lines||[]).some((line)=>Number(line.availableForDeliveryQty||0)>0.000001);
  const editable = detail && ['OPEN', 'IN_PROGRESS'].includes(detail.status);
  const currentIndex = detail?.status === 'COMPLETED' ? 3 : detail?.status === 'IN_PROGRESS' ? 2 : detail?.status === 'CANCELLED' ? 0 : 1;

  if (!detail && !list.loading && list.rows.length === 0) {
    return <><PageHeader eyebrow="Transaction / Distribution / Picking Order" title="Picking Order · PostgreSQL" description="Picking dibuat dari reserved Sales Order dan disimpan di PostgreSQL."/><div className="surface-card empty-state-large">Belum ada picking order. Buka Sales Order RESERVED lalu pilih <strong>Create Picking</strong>.</div></>;
  }

  return <>
    <PageHeader eyebrow="Transaction / Distribution / Picking Order" title="Picking Order · PostgreSQL" description="Reserved stock → actual picked qty → shortage. On Hand tidak berubah pada tahap Picking."/>
    {message && <div className="v10-inline-note"><strong>Picking</strong><span>{message}</span></div>}
    {list.error && <div className="v10-inline-note warning"><strong>API</strong><span>{list.error}</span></div>}
    <div className="document-layout">
      <aside className="surface-card document-list-pane">
        <div className="document-list-head"><label><Search size={15}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari PKO / SO / customer..."/></label><button className="icon-btn" onClick={list.refresh}><RefreshCw size={14}/></button></div>
        <div className="document-list">{docs.map((row) => <button key={row.id} className={`document-row ${row.id === selectedId ? 'active' : ''}`} onClick={() => { setSelectedId(row.id); void load(row.id); }}><div className="document-row__top"><strong>{row.documentNo}</strong><StatusPill tone={statusTone(row.status)}>{row.status}</StatusPill></div><span>{row.salesOrderNo} · {row.customerName}</span><div className="document-row__meta"><small>{dateTimeLabel(row.createdAt)}</small><strong>{number(row.pickedQty)} / {number(row.requestedQty)}</strong></div></button>)}</div>
      </aside>
      <section className="document-workspace">
        {!detail ? <div className="surface-card empty-state-large">Memuat picking order...</div> : <>
          <div className="surface-card document-hero">
            <div className="document-hero__top"><div><div className="doc-kicker">PKO · {detail.warehouse?.code} · {detail.salesOrder?.documentNo}</div><h2>{detail.documentNo}</h2><p>{detail.customer?.name}</p></div><div className="document-hero-actions"><StatusPill tone={statusTone(detail.status)}>{detail.status}</StatusPill><div className="action-row">{editable && <><button className="btn" disabled={!!busy || lineValidation.hasError} onClick={saveProgress}><PackageCheck size={14}/> Save Progress</button><button className="btn btn-primary" disabled={!!busy || lineValidation.hasError || draftLines.every((line) => Number(line.pickedQty) <= 0)} onClick={complete}>Complete Picking</button></>}{deliveryAvailable && <button className="btn btn-primary" disabled={!!busy} onClick={openDelivery}><Truck size={14}/> Create Delivery Order</button>}{['OPEN','IN_PROGRESS','COMPLETED'].includes(detail.status) && <button className="btn" disabled={!!busy} onClick={() => setCancelOpen(true)}><XCircle size={14}/> Cancel</button>}</div></div></div>
            <div className="doc-summary-grid"><div><CalendarDays size={15}/><span>Created</span><strong>{dateTimeLabel(detail.createdAt)}</strong></div><div><UserRound size={15}/><span>Picker</span><strong>{detail.picker || 'Belum mulai'}</strong></div><div><MapPin size={15}/><span>Warehouse</span><strong>{detail.warehouse?.name}</strong></div><div><Box size={15}/><span>SO Status</span><strong>{detail.salesOrder?.status}</strong></div></div>
          </div>
          <DocumentLifecycle steps={['Created', 'Released', 'Picking', 'Completed']} currentIndex={currentIndex} label={detail.status}/>
          {detail.status === 'COMPLETED' && <div className="v10-inline-note"><strong>Picking selesai</strong><span>Qty sudah dipilih dan siap menjadi sumber Delivery Order pada D3-B. Reserved stock belum dikurangi dan On Hand belum berubah.</span></div>}
          <section className="surface-card document-section"><header><div><h3>Picking Lines</h3><p>Partial picking didukung. Picked tidak boleh melebihi Requested; selisih di bawah Requested dicatat sebagai shortage.</p></div><span>{detail.lines?.length || 0} lines</span></header>{lineValidation.hasError && <div className="v10-inline-note warning" role="alert"><strong>Qty tidak valid</strong><span>{lineValidation.firstError} Koreksi Picked Qty sebelum Save Progress atau Complete Picking.</span></div>}<div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Requested</th><th>Picked</th><th>Shortage</th><th>DO Allocated</th><th>Available for DO</th><th>Location</th><th>Lot</th></tr></thead><tbody>{(detail.lines || []).map((line) => { const draft = draftLines.find((x) => x.id === line.id) || {}; const picked = Number(draft.pickedQty ?? line.pickedQty ?? 0); const requested = Number(line.requestedQty || 0); const overPicked = Number.isFinite(picked) && picked > requested + 0.000001; return <tr key={line.id}><td><strong>{line.sku}</strong><small>{line.itemName}</small></td><td>{number(line.requestedQty)} {line.uom}</td><td>{editable ? <input className="table-input" type="number" min="0" max={line.requestedQty} step="0.001" value={draft.pickedQty ?? 0} aria-invalid={!!lineValidation.byId[line.id]} title={lineValidation.byId[line.id] || ''} onChange={(e) => editLine(line.id, { pickedQty: e.target.value })}/> : number(line.pickedQty)}</td><td>{overPicked ? `Over +${number(picked - requested)}` : number(Math.max(0, requested - picked))}</td><td>{number(line.deliveryAllocatedQty || 0)} {line.uom}</td><td><strong>{number(line.availableForDeliveryQty || 0)} {line.uom}</strong></td><td>{editable ? <input className="table-input" value={draft.location || ''} onChange={(e) => editLine(line.id, { location: e.target.value })} placeholder="A-01-01"/> : line.location || '-'}</td><td>{editable ? <input className="table-input" value={draft.lotNo || ''} onChange={(e) => editLine(line.id, { lotNo: e.target.value })} placeholder="LOT"/> : line.lotNo || '-'}</td></tr>; })}</tbody></table></div></section>
        </>}
      </section>
    </div>
    <Modal open={cancelOpen} onClose={() => setCancelOpen(false)} title={`Cancel ${detail?.documentNo || ''}`} subtitle="Picking yang dibatalkan tidak mengonsumsi reserved quantity." footer={<><button className="btn" onClick={() => setCancelOpen(false)}>Kembali</button><button className="btn btn-primary" disabled={!cancelReason.trim() || !!busy} onClick={cancel}>Cancel Picking</button></>}><label className="field"><span>Alasan pembatalan</span><textarea rows="4" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Wajib diisi untuk audit trail"/></label></Modal>
    <Modal open={deliveryOpen} onClose={() => setDeliveryOpen(false)} title={`Create Delivery Order · ${detail?.documentNo || ''}`} subtitle="Pilih qty completed Picking yang akan dialokasikan ke DO ini. Partial Delivery Order didukung." footer={<><button className="btn" onClick={() => setDeliveryOpen(false)}>Kembali</button><button className="btn btn-primary" disabled={!!busy || !deliveryLines.some((line)=>Number(line.qty)>0)} onClick={createDelivery}>Create Delivery Order</button></>}><div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Available Picked</th><th>Delivery Qty</th></tr></thead><tbody>{deliveryLines.map((line)=><tr key={line.pickingLineId}><td><strong>{line.sku}</strong></td><td>{number(line.max)} {line.uom}</td><td><input className="table-input" type="number" min="0" max={line.max} step="0.001" value={line.qty} onChange={(e)=>setDeliveryLines((rows)=>rows.map((row)=>row.pickingLineId===line.pickingLineId?{...row,qty:e.target.value}:row))}/></td></tr>)}</tbody></table></div></Modal>
  </>;
}
