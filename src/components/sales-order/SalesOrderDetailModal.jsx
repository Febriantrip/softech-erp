import React, { useEffect, useState } from 'react';
import { FileText, History, Link2, Package, ReceiptText, ShieldCheck, Truck } from 'lucide-react';
import Modal from '../Modal';
import SalesOrderActionButtons from './SalesOrderActionButtons';
import SalesOrderAuditTab from './SalesOrderAuditTab';
import SalesOrderFulfillmentTab from './SalesOrderFulfillmentTab';
import SalesOrderHistoryTab from './SalesOrderHistoryTab';
import SalesOrderItemsTab from './SalesOrderItemsTab';
import SalesOrderOverviewTab from './SalesOrderOverviewTab';
import SalesOrderPrintDocument from './SalesOrderPrintDocument';
import SalesOrderRelatedDocumentsTab from './SalesOrderRelatedDocumentsTab';
import SalesOrderTaxTab from './SalesOrderTaxTab';

const tabs = [
  ['overview', 'Overview', FileText],
  ['items', 'Items', Package],
  ['tax', 'Taxes & Charges', ReceiptText],
  ['fulfillment', 'Fulfillment', Truck],
  ['approval', 'Approval', ShieldCheck],
  ['related', 'Related Documents', Link2],
  ['audit', 'Audit Trail', History],
];

export default function SalesOrderDetailModal({ open, onClose, detail, busy, onEdit, onDelete, onTransition, onCancel, onCreatePicking }) {
  const [active, setActive] = useState('overview');
  useEffect(() => { if (open) setActive('overview'); }, [open, detail?.id]);

  const printDocument = () => {
    if (!detail || typeof window === 'undefined') return;
    const oldTitle = document.title;
    const restore = () => { document.title = oldTitle; window.removeEventListener('afterprint', restore); };
    document.title = `Sales Order ${detail.documentNo}`;
    window.addEventListener('afterprint', restore);
    window.print();
  };

  const content = !detail ? <div className="empty-cell">Memuat detail...</div> : active === 'items' ? <SalesOrderItemsTab lines={detail.lines}/>
    : active === 'tax' ? <SalesOrderTaxTab detail={detail}/>
    : active === 'fulfillment' ? <SalesOrderFulfillmentTab detail={detail}/>
    : active === 'approval' ? <SalesOrderHistoryTab items={detail.approvalHistory || []} emptyText="Belum ada approval history."/>
    : active === 'related' ? <SalesOrderRelatedDocumentsTab rows={detail.relatedDocuments || []}/>
    : active === 'audit' ? <SalesOrderAuditTab items={detail.auditTrail || detail.audit || []}/>
    : <SalesOrderOverviewTab detail={detail}/>;

  const footer = detail ? <div className="so-detail-footer"><span>{detail.entityCode} / {detail.siteCode} · Revision #{detail.revisionNo || 0}</span><SalesOrderActionButtons order={detail} busy={busy} showDetail={false} onPrint={printDocument} onEdit={onEdit} onDelete={onDelete} onTransition={onTransition} onCancel={onCancel} onCreatePicking={onCreatePicking}/></div> : null;

  return <>
    <Modal open={open} onClose={onClose} title={detail?.documentNo || 'Sales Order Detail'} subtitle={detail ? `${detail.status} · PostgreSQL source of truth` : 'PostgreSQL source of truth'} wide footer={footer}>
      <div className="so-detail-workspace">
        <nav className="so-detail-tabs" aria-label="Sales Order detail sections">{tabs.map(([key, label, Icon]) => <button key={key} className={active === key ? 'active' : ''} onClick={() => setActive(key)}><Icon size={14}/><span>{label}</span></button>)}</nav>
        <section className="so-detail-tab-body">{content}</section>
      </div>
    </Modal>
    {open && detail && <SalesOrderPrintDocument detail={detail}/>} 
  </>;
}
