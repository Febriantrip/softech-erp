import React, { useState } from 'react';
import { Blocks, Check, ExternalLink, PlugZap } from 'lucide-react';
import PageHeader from '../components/PageHeader';
import { addons } from '../data/erpModules';

export default function AddonsPage() {
  const [toast, setToast] = useState('');
  const openAddon = (name) => {
    setToast(`${name} adalah aplikasi add-on terpisah. Integrasinya memakai API dan SSO ERP core.`);
    setTimeout(() => setToast(''), 2600);
  };
  return (
    <>
      <PageHeader eyebrow="09 · Add-on Application" title="Add-on Applications" description="Aplikasi terpisah dari ERP core. Masing-masing dapat di-deploy, diberi license, dan dikembangkan independen, tetapi tetap memakai master data, SSO, API, dan audit dari ERP utama." />
      {toast && <div className="toast">{toast}</div>}
      <div className="addon-banner surface-card">
        <div className="icon-bubble"><Blocks size={22} /></div>
        <div><strong>Separate application architecture</strong><p>Add-on bukan menu transaksi biasa. Ia diperlakukan sebagai aplikasi terpisah dengan lifecycle deployment sendiri.</p></div>
        <span><PlugZap size={16}/> Connected to Core ERP</span>
      </div>
      <div className="addon-grid">
        {addons.map((addon, index) => (
          <article key={addon.key} className="surface-card addon-card">
            <div className="addon-card__top">
              <span className="addon-index">{String(index + 1).padStart(2, '0')}</span>
              <span className="status-pill success">Integrated</span>
            </div>
            <h3>{addon.name}</h3>
            <span className="addon-audience">{addon.audience}</span>
            <p>{addon.description}</p>
            <div className="addon-features">
              {addon.features.map((feature) => <span key={feature}><Check size={12}/>{feature}</span>)}
            </div>
            <button className="btn btn-ghost addon-open" onClick={() => openAddon(addon.name)}>Open Add-on <ExternalLink size={14}/></button>
          </article>
        ))}
      </div>
    </>
  );
}
