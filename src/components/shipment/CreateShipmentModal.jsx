import React from 'react';
import Modal from '../Modal';
import { number } from '../../utils/erp';

export default function CreateShipmentModal({ open, onClose, detail, lines, setLines, plan, setPlan, onCreate, busy }) {
  const setQty = (id, value) => setLines((rows) => rows.map((row) => row.deliveryLineId === id ? { ...row, qty: value } : row));
  return <Modal open={open} onClose={onClose} wide title={`Create Shipment · ${detail?.documentNo || ''}`} subtitle="Shipment mengalokasikan loaded quantity. Stock fisik baru keluar saat Dispatch." footer={<><button className="btn" onClick={onClose}>Kembali</button><button className="btn btn-primary" disabled={!!busy} onClick={onCreate}>Create Shipment</button></>}>
    <div className="inline-form">
      <label className="field"><span>Scheduled At</span><input type="datetime-local" value={plan.scheduledAt} onChange={(e)=>setPlan({...plan,scheduledAt:e.target.value})}/></label>
      <label className="field"><span>Carrier</span><input value={plan.carrier} onChange={(e)=>setPlan({...plan,carrier:e.target.value})}/></label>
      <label className="field"><span>Vehicle</span><input value={plan.vehicle} onChange={(e)=>setPlan({...plan,vehicle:e.target.value})}/></label>
      <label className="field"><span>Driver</span><input value={plan.driver} onChange={(e)=>setPlan({...plan,driver:e.target.value})}/></label>
      <label className="field"><span>Route</span><input value={plan.route} onChange={(e)=>setPlan({...plan,route:e.target.value})}/></label>
      <label className="field"><span>Tracking No.</span><input value={plan.trackingNo} onChange={(e)=>setPlan({...plan,trackingNo:e.target.value})}/></label>
      <label className="field"><span>Reference</span><input value={plan.referenceNo} onChange={(e)=>setPlan({...plan,referenceNo:e.target.value})}/></label>
      <label className="field"><span>Notes</span><textarea rows="2" value={plan.notes} onChange={(e)=>setPlan({...plan,notes:e.target.value})}/></label>
    </div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>Item</th><th>Loaded</th><th>Already Allocated</th><th>Available</th><th>Shipment Qty</th></tr></thead><tbody>{lines.map((line)=><tr key={line.deliveryLineId}><td><strong>{line.sku}</strong><small>{line.itemName}</small></td><td>{number(line.loadedQty)} {line.uom}</td><td>{number(line.allocatedQty)} {line.uom}</td><td>{number(line.max)} {line.uom}</td><td><input className="qty-input" type="number" min="0" max={line.max} step="0.001" value={line.qty} onChange={(e)=>setQty(line.deliveryLineId,e.target.value)}/></td></tr>)}</tbody></table></div>
  </Modal>;
}
