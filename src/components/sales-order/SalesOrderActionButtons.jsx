import React from 'react';
import { ClipboardList, Eye, LockKeyhole, Pencil, Printer, Send, ShieldCheck, Trash2, XCircle } from 'lucide-react';

export default function SalesOrderActionButtons({
  order,
  busy = false,
  showDetail = true,
  onDetail,
  onEdit,
  onDelete,
  onTransition,
  onCancel,
  onPrint,
  onCreatePicking,
}) {
  if (!order) return null;
  const disabled = Boolean(busy);
  const pickingAvailableQty = Number(order.pickingAvailableQty ?? order.fulfillment?.pickingAvailableQty ?? 0);
  const pickingAllocatedQty = Number(order.pickingAllocatedQty ?? order.fulfillment?.pickingAllocatedQty ?? 0);
  const canCreatePicking = Boolean(onCreatePicking) && pickingAvailableQty > 0.000001;
  const pickingLabel = pickingAllocatedQty > 0.000001 ? 'Picking Sisa' : 'Create Picking';
  const action = (name) => () => onTransition?.(order, name);

  return <div className="action-row v11-row-actions so-action-row">
    {showDetail && <button className="btn btn-sm" disabled={disabled} onClick={() => onDetail?.(order)}><Eye size={13}/> Detail</button>}
    {onPrint && <button className="btn btn-sm" disabled={disabled} onClick={() => onPrint(order)}><Printer size={13}/> Print</button>}
    {order.status === 'DRAFT' && <>
      <button className="btn btn-sm" disabled={disabled} onClick={() => onEdit?.(order)}><Pencil size={13}/> Edit</button>
      <button className="btn btn-sm" disabled={disabled} onClick={() => onDelete?.(order)}><Trash2 size={13}/> Hapus</button>
      <button className="btn btn-sm btn-primary" disabled={disabled} onClick={action('submit')}><Send size={13}/> Submit</button>
    </>}
    {order.status === 'PENDING_APPROVAL' && <>
      <button className="btn btn-sm" disabled={disabled} onClick={action('approve')}><ShieldCheck size={13}/> Approve</button>
      <button className="btn btn-sm" disabled={disabled} onClick={() => onCancel?.(order)}><XCircle size={13}/> Cancel</button>
    </>}
    {order.status === 'APPROVED' && <>
      <button className="btn btn-sm" disabled={disabled} onClick={action('reserve')}><LockKeyhole size={13}/> Reserve</button>
      <button className="btn btn-sm" disabled={disabled} onClick={() => onCancel?.(order)}><XCircle size={13}/> Cancel</button>
    </>}
    {order.status === 'RESERVED' && <>
      {canCreatePicking && <button className="btn btn-sm btn-primary" disabled={disabled} title={`Qty tersedia untuk picking: ${pickingAvailableQty}`} onClick={() => onCreatePicking(order)}><ClipboardList size={13}/> {pickingLabel}</button>}
      <button className="btn btn-sm" disabled={disabled} onClick={() => onCancel?.(order)}><XCircle size={13}/> Cancel</button>
    </>}
    {order.status === 'PARTIALLY_SHIPPED' && canCreatePicking && <button className="btn btn-sm btn-primary" disabled={disabled} title={`Qty tersedia untuk picking: ${pickingAvailableQty}`} onClick={() => onCreatePicking(order)}><ClipboardList size={13}/> {pickingLabel}</button>}
  </div>;
}
