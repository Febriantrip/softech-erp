import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, LogOut, Menu, Search } from 'lucide-react';
import { useApiAuth } from '../context/ApiAuthContext';
import { runtimeConfig } from '../config/runtime';
import { useOrg } from '../context/OrgContext';
import ThemeSwitch from '../components/ThemeSwitch';

export default function Topbar({ onMenu }) {
  const { entities, entity, site, setEntityId, setSiteId } = useOrg();
  const { session, logout } = useApiAuth();
  const navigate = useNavigate();
  const username = session?.user?.name || "ERP Administrator";
  const initials = username.trim().split(/\s+/).slice(0, 2).map(p => p[0]).join("").toUpperCase();
  return (
    <header className="topbar">
      <button className="icon-button mobile-menu" onClick={onMenu}><Menu size={20} /></button>

      <div className="org-selectors">
        <label className="selector">
          <span>Entity</span>
          <div className="select-wrap">
            <select value={entity.id} onChange={(event) => setEntityId(event.target.value)}>
              {entities.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
        <label className="selector hide-small">
          <span>Site</span>
          <div className="select-wrap">
            <select value={site.id} onChange={(event) => setSiteId(event.target.value)}>
              {entity.sites.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
            </select>
            <ChevronDown size={14} />
          </div>
        </label>
      </div>

      <div className="topbar-actions">
        <label className="global-search hide-medium">
          <Search size={16} />
          <input placeholder="Cari SO, PO, invoice, item..." />
          <kbd>⌘K</kbd>
        </label>
        <ThemeSwitch />
        <button className="icon-button notification-button">
          <Bell size={18} />
          <span className="notification-dot" />
        </button>
        <button type="button" className="profile-chip softech-profile-action" onClick={() => navigate('/account/security')} title="Keamanan akun">
          <div className="avatar">{runtimeConfig.isApiMode ? initials : 'FA'}</div>
          <div className="hide-small">
            <strong>{runtimeConfig.isApiMode ? username : 'ERP Administrator'}</strong>
            <small>{runtimeConfig.isApiMode ? (session?.user?.roles?.[0] || 'ERP User') : 'Prototype'}</small>
          </div>
        </button>
        {runtimeConfig.isApiMode && <button type="button" className="icon-button softech-logout" onClick={logout} title="Keluar akun"><LogOut size={18}/></button>}
      </div>
    </header>
  );
}
