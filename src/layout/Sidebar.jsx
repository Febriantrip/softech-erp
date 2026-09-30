import React, { forwardRef, useMemo, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Boxes, ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react';
import { navigation } from '../data/navigation';

const SECTION_LABELS = {
  0: 'MAIN',
  1: 'TRANSACTIONS',
  2: 'OPERATIONS',
  5: 'MASTER DATA',
  10: 'SYSTEM',
  14: 'APPLICATIONS',
};

const Sidebar = forwardRef(function Sidebar({ open, onClose, collapsed = false, peek = false, onToggleCollapsed, onPointerEnter, onPointerLeave, onFocusCapture, onBlurCapture }, ref) {
  const location = useLocation();
  const initialOpen = useMemo(() => {
    const parent = navigation.find((item) => item.children?.some((child) => location.pathname.startsWith(child.path)));
    return parent?.label || 'Transactions';
  }, []);
  const [expanded, setExpanded] = useState(initialOpen);

  return (
    <>
      <aside ref={ref} className={`sidebar ${open ? 'open' : ''}${collapsed ? ' sidebar--collapsed' : ''}${peek ? ' sidebar--peek' : ''}`} aria-label="Navigasi SOFTECH ERP" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onFocusCapture={onFocusCapture} onBlurCapture={onBlurCapture}>
        <div className="brand">
          <span className="brand__mark"><Boxes size={21} /></span>
          <div className="brand__identity"><strong>SOFTECH ERP</strong><small>Distributor Suite</small></div>
          <button
            type="button"
            className="icon-button sidebar-pin"
            onClick={onToggleCollapsed}
            onPointerUp={(event) => event.currentTarget.blur()}
            title={collapsed ? 'Kunci sidebar tetap terbuka' : 'Minimalkan sidebar (hover untuk buka)'}
            aria-label={collapsed ? 'Kunci sidebar tetap terbuka' : 'Minimalkan sidebar'}
            aria-pressed={!collapsed}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button type="button" className="icon-button sidebar-close" onClick={onClose} aria-label="Tutup navigasi"><X size={18} /></button>
        </div>

        <nav className="sidebar-nav" aria-label="Modul ERP">
          {navigation.map((item, index) => {
            const Icon = item.icon;
            if (item.children) {
              const childActive = item.children.some((child) => location.pathname.startsWith(child.path));
              const isOpen = expanded === item.label || childActive;
              return (
                <React.Fragment key={item.label}>
                {SECTION_LABELS[index] && <div className="sidebar-label sidebar-section-label">{SECTION_LABELS[index]}</div>}
                <div className="nav-group">
                  <button type="button" title={item.label} aria-label={item.label} aria-expanded={isOpen} className={`nav-item nav-parent ${childActive ? 'active-parent' : ''}`} onClick={() => setExpanded(isOpen && !childActive ? '' : item.label)}>
                    <Icon size={18} /><span>{item.label}</span><ChevronDown className={`nav-chevron ${isOpen ? 'open' : ''}`} size={15}/>
                  </button>
                  {isOpen && (
                    <div className="nav-children">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon;
                        return (
                          <NavLink key={child.path} title={child.label} to={child.path} className={({ isActive }) => `nav-child ${isActive ? 'active' : ''}`} onClick={onClose}>
                            <ChildIcon size={14}/><span>{child.label}</span>
                          </NavLink>
                        );
                      })}
                    </div>
                  )}
                </div>
                </React.Fragment>
              );
            }
            return (
              <React.Fragment key={item.path}>
              {SECTION_LABELS[index] && <div className="sidebar-label sidebar-section-label">{SECTION_LABELS[index]}</div>}
              <NavLink title={item.label} to={item.path} end={item.path === '/'} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''} ${item.emphasis ? 'nav-item--addon' : ''}`} onClick={onClose}>
                <Icon size={18}/><span>{item.label}</span>{item.emphasis && <b>APP</b>}
              </NavLink>
              </React.Fragment>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="fiscal-card"><span className="dot success-dot"/><div><strong>FY 2026</strong><small>September · Open</small></div></div>
        </div>
      </aside>
      {open && <button className="sidebar-backdrop" aria-label="Tutup menu" onClick={onClose}/>} 
    </>
  );
});

export default Sidebar;
