import React, { useMemo, useState } from 'react';
import { ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const routes = {
  'Purchase Request': '/transactions/distribution/purchase-request',
  'Request For Quotation': '/transactions/distribution/rfq',
  'Purchase Order': '/transactions/distribution/purchase-order',
  Receiving: '/transactions/distribution/receiving',
  'Put Away': '/transactions/distribution/receiving',
  'Sales Order': '/transactions/distribution/sales-order',
  'Delivery Order': '/transactions/distribution/delivery-order',
  Shipment: '/transactions/distribution/shipment',
  'Picking Order': '/transactions/distribution/picking-order',
  Picking: '/transactions/distribution/picking-order',
  'Closing Accounting Period': '/closing',
  'Reopen Accounting Period': '/closing',
  'Year End Closing': '/closing',
  'Bank Reconciliation': '/finance',
  Journal: '/finance',
  'System Generated Journal': '/finance',
  'Purchase Invoice': '/transactions/financials/purchase-invoice',
  'Payment Run': '/transactions/financials/supplier-payments',
  'Cash Disbursement': '/transactions/financials/supplier-payments',
  'Bank Disbursement': '/transactions/financials/supplier-payments',
  'Sales Invoice': '/transactions/financials/sales-invoice',
  'Cash Receipt': '/transactions/financials/receipts',
  'Bank Receipt': '/transactions/financials/receipts',
  'Collection Run': '/ar-ap',
  'Location Transfer Order': '/warehouse/stock-transfer',
  'Location Transfer': '/warehouse/stock-transfer',
  'Inter Site Transfer': '/warehouse/stock-transfer',
  'Inter Site Receipt': '/warehouse/stock-transfer',
  'Stock Take': '/warehouse/stock-take',
  'Recalculate Inventory': '/warehouse/valuation',
  'Inventory Cost Revaluation': '/warehouse/valuation',
  'Roll Up Standard Cost': '/warehouse/valuation',
  'Lot Serial Status': '/warehouse/valuation',
  'Inventory Valuation': '/warehouse/valuation',
  'Stock Movement Ledger': '/warehouse',
  'Inventory Aging': '/warehouse/valuation',
  'Replenishment Recommendation': '/warehouse',
  'Inventory Cost Addition': '/warehouse/valuation',
  'Inventory Cost Deduction': '/warehouse/valuation',
  'Inventory Adjustment IN': '/warehouse',
  'Inventory Adjustment Out': '/warehouse',
  'Replenishment Order': '/warehouse/replenishment',
  'Sales Return Order': '/transactions/distribution/sales-return',
  'Sales Return': '/transactions/distribution/sales-return',
  'Purchase Return Order': '/transactions/distribution/purchase-return',
  'Purchase Return': '/transactions/distribution/purchase-return',
  'Sales Rejection': '/warehouse/quality-control',
  'Sales Return Invoice': '/transactions/distribution/sales-return',
  'Purchase Return Invoice': '/transactions/distribution/purchase-return',
  'AP Debit Note': '/transactions/distribution/purchase-return',
  'AR Credit Note': '/transactions/distribution/sales-return',
  'User Login': '/security',
  'User Group': '/security',
  'Custom Menu': '/security',
  'Setting Privilege': '/security',
  'Role Based Access Control': '/security',
  'Entity & Site Access': '/security',
  'Approval Matrix': '/security',
  'Maker Checker Control': '/security',
  'Approval Delegation': '/security',
  'Document Numbering': '/security',
  'Document Locking': '/security',
  'Session Security': '/security',
  'Audit Explorer': '/security',
  'Notification Center': '/security',
  'System Policy': '/security'
};

function normalize(groups) {
  if (!groups?.length) return [];
  if (typeof groups[0] === 'string') return [{ title: 'Functions', items: groups }];
  return groups;
}

export default function ModuleCatalog({ groups, compact = false, onItem }) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();
  const normalized = normalize(groups);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return normalized;
    return normalized
      .map((group) => ({ ...group, items: group.items.filter((item) => item.toLowerCase().includes(q)) }))
      .filter((group) => group.items.length);
  }, [normalized, query]);

  const open = (item) => {
    if (onItem) return onItem(item);
    if (routes[item]) return navigate(routes[item]);
  };

  return (
    <div className="module-catalog">
      <label className="catalog-search">
        <Search size={16} />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cari menu atau proses..." />
        <span>{normalized.reduce((sum, group) => sum + group.items.length, 0)} fungsi</span>
      </label>

      <div className="catalog-groups">
        {filtered.map((group) => (
          <section key={group.title} className="surface-card catalog-section">
            <header>
              <div>
                <h3>{group.title}</h3>
                {group.description && <p>{group.description}</p>}
              </div>
              <span className="catalog-count">{group.items.length}</span>
            </header>
            <div className={`catalog-grid ${compact ? 'catalog-grid--compact' : ''}`}>
              {group.items.map((item, index) => {
                const clickable = Boolean(routes[item] || onItem);
                return (
                  <button key={item} className={`catalog-item ${clickable ? 'catalog-item--linked' : ''}`} onClick={() => open(item)}>
                    <span className="catalog-number">{String(index + 1).padStart(2, '0')}</span>
                    <span className="catalog-name">{item}</span>
                    {clickable && <ArrowRight size={14} />}
                  </button>
                );
              })}
            </div>
          </section>
        ))}
        {!filtered.length && <div className="surface-card catalog-empty">Tidak ada fungsi yang cocok dengan “{query}”.</div>}
      </div>
    </div>
  );
}
