import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CircleDollarSign,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FileText,
  Landmark,
  PackageCheck,
  ReceiptText,
  Store,
  Truck,
  WalletCards,
  ArrowRightLeft,
  Calculator,
  RotateCcw,
  PackageX
} from 'lucide-react';
import PageHeader from '../components/PageHeader';
import ModuleCatalog from '../components/ModuleCatalog';
import {
  distributionTransactions,
  financialTransactions,
  fixedAssetTransactions,
  manufacturingTransactions,
  posTransactions
} from '../data/erpModules';

const configs = {
  distribution: {
    eyebrow: '01 · Transaction',
    title: 'Sales & Distribution Transactions',
    description: 'Seluruh transaksi distributor dari request, quotation, order, allocation, picking, delivery, shipment, receiving, transfer, return, sampai inventory adjustment.',
    groups: [
      { title: 'Distribution', description: 'Order-to-cash, procure-to-pay, fulfillment, transfer, dan logistics.', items: distributionTransactions }
    ]
  },
  financials: {
    eyebrow: '01 · Transaction', title: 'Financial Transactions',
    description: 'Transaksi invoice, collection, payment, cash/bank, checks, journal, debit/credit note, dan refund.',
    groups: [{ title: 'Financials', items: financialTransactions }]
  },
  'fixed-assets': {
    eyebrow: '01 · Transaction', title: 'Fixed Asset Transactions',
    description: 'Lifecycle aset tetap mulai addition, adjustment, transfer, sampai disposal.',
    groups: [{ title: 'Fixed Assets', items: fixedAssetTransactions }]
  },
  manufacturing: {
    eyebrow: '01 · Transaction · Optional', title: 'Manufacturing Transactions',
    description: 'Modul opsional untuk distributor yang memiliki repacking, assembly, kitting, atau proses produksi.',
    groups: [{ title: 'Manufacturing', items: manufacturingTransactions }]
  },
  pos: {
    eyebrow: '01 · Transaction · POS', title: 'Point of Sale Transactions',
    description: 'Transaksi loyalty point yang terhubung ke add-on Point of Sale.',
    groups: [{ title: 'Point of Sale', items: posTransactions }]
  }
};

const salesFlow = [
  ['Quotation', 'Penawaran & price validation', ClipboardCheck, null],
  ['Sales Order', 'Credit, stock & approval', CircleDollarSign, '/transactions/distribution/sales-order'],
  ['Picking', 'Reservation & warehouse task', PackageCheck, '/transactions/distribution/picking-order'],
  ['Delivery Order', 'Delivery release & load', Truck, '/transactions/distribution/delivery-order'],
  ['Shipment', 'Dispatch & proof of delivery', Truck, '/transactions/distribution/shipment']
];

const purchaseFlow = [
  ['Purchase Request', 'Internal demand & approval', ClipboardList, '/transactions/distribution/purchase-request'],
  ['RFQ', 'Supplier sourcing & quote', Store, '/transactions/distribution/rfq'],
  ['Purchase Order', 'Commitment & approval', FileCheck2, '/transactions/distribution/purchase-order'],
  ['Receiving', 'Goods receipt to staging', Truck, '/transactions/distribution/receiving'],
  ['Put Away', 'Inbound to available stock', PackageCheck, '/transactions/distribution/receiving']
];

const inventoryFlow = [
  ['Inventory Position', 'On hand, reserved, inbound', PackageCheck, '/warehouse'],
  ['Inter-Site Transfer', 'Source → in-transit → destination', ArrowRightLeft, '/warehouse/stock-transfer'],
  ['Stock Take', 'Count, variance & approval', ClipboardCheck, '/warehouse/stock-take'],
  ['Valuation', 'Weighted average & lot status', Calculator, '/warehouse/valuation']
];

const reverseLogisticsFlow = [
  ['Sales Return', 'RMA → quarantine → credit note', RotateCcw, '/transactions/distribution/sales-return'],
  ['Purchase Return', 'Return-to-vendor → debit note', RotateCcw, '/transactions/distribution/purchase-return'],
  ['Replenishment', 'ROP / max stock planning', ArrowRightLeft, '/warehouse/replenishment'],
  ['Quality & Recall', 'Hold, scrap, lot trace', PackageX, '/warehouse/quality-control']
];

const salesFinanceFlow = [
  ['Sales Invoice', 'Billing shipped quantity', FileText, '/transactions/financials/sales-invoice'],
  ['AR Open Item', 'Receivable & aging', CircleDollarSign, '/ar-ap'],
  ['Receipt', 'Cash / bank allocation', ReceiptText, '/transactions/financials/receipts'],
  ['Journal / GL', 'Automatic posting', Landmark, '/finance']
];

const purchaseFinanceFlow = [
  ['Purchase Invoice', '3-way match PO · GRN · invoice', FileCheck2, '/transactions/financials/purchase-invoice'],
  ['AP Open Item', 'Payable & aging', WalletCards, '/ar-ap'],
  ['Supplier Payment', 'Cash / bank disbursement', ReceiptText, '/transactions/financials/supplier-payments'],
  ['Journal / GL', 'Automatic posting', Landmark, '/finance']
];

function FlowCard({ title, subtitle, steps, navigate }) {
  return <section className="surface-card process-flow-card">
    <div className="process-flow-head"><div><strong>{title}</strong><span>{subtitle}</span></div></div>
    <div className="process-flow" style={{ gridTemplateColumns: Array.from({ length: steps.length * 2 - 1 }, (_, index) => index % 2 === 0 ? 'minmax(0,1fr)' : 'auto').join(' ') }}>
      {steps.map(([stepTitle, desc, Icon, path], index) => <React.Fragment key={stepTitle}>
        <button className={`flow-step ${path ? 'flow-step--active' : ''}`} onClick={() => path && navigate(path)}>
          <span><Icon size={17}/></span><div><strong>{stepTitle}</strong><small>{desc}</small></div>
        </button>
        {index < steps.length - 1 && <ArrowRight className="flow-arrow" size={16}/>} 
      </React.Fragment>)}
    </div>
  </section>;
}

export default function TransactionHubPage({ type = 'distribution' }) {
  const navigate = useNavigate();
  const cfg = configs[type] || configs.distribution;
  return (
    <>
      <PageHeader eyebrow={cfg.eyebrow} title={cfg.title} description={cfg.description} />
      {type === 'distribution' && <>
        <FlowCard title="Order-to-cash fulfillment flow" subtitle="Flow utama penjualan distributor dari order sampai shipment." steps={salesFlow} navigate={navigate}/>
        <FlowCard title="Procure-to-pay inbound flow" subtitle="Flow pembelian dari internal demand sampai stock tersedia di warehouse." steps={purchaseFlow} navigate={navigate}/>
        <FlowCard title="Inventory control & costing flow" subtitle="Control stock antar-site, cycle count, movement ledger, dan inventory valuation." steps={inventoryFlow} navigate={navigate}/>
        <FlowCard title="Reverse logistics & quality flow" subtitle="Customer/supplier returns, replenishment, quarantine, quality disposition, dan lot recall trace." steps={reverseLogisticsFlow} navigate={navigate}/>
      </>}
      {type === 'financials' && <>
        <FlowCard title="Order-to-cash financial flow" subtitle="Billing sampai posting GL dan settlement AR." steps={salesFinanceFlow} navigate={navigate}/>
        <FlowCard title="Procure-to-pay financial flow" subtitle="Vendor invoice, AP, supplier payment, dan bank disbursement sampai GL." steps={purchaseFinanceFlow} navigate={navigate}/>
      </>}
      <ModuleCatalog groups={cfg.groups} compact />
    </>
  );
}
