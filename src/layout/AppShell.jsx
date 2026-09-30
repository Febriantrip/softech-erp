import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';

const SIDEBAR_KEY = 'softech-erp-sidebar-collapsed';

function savedSidebarState() {
  try {
    return window.localStorage.getItem(SIDEBAR_KEY) === 'true';
  } catch {
    return false;
  }
}

export default function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(savedSidebarState);
  const [sidebarHovered, setSidebarHovered] = useState(false);

  useEffect(() => {
    try { window.localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed)); }
    catch { /* Local storage may be disabled. */ }
  }, [sidebarCollapsed]);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => !current);
  }

  // Expand only while the pointer is inside (or keyboard focus is in the rail).
  // Never latch open after a navigation click.
  const sidebarExpanded = sidebarCollapsed && sidebarHovered;

  return (
    <div className={`app-shell${sidebarCollapsed ? ' app-shell--sidebar-collapsed' : ''}${sidebarExpanded ? ' app-shell--sidebar-peek' : ''}`}>
      <Sidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed}
        peek={sidebarExpanded}
        onToggleCollapsed={toggleSidebarCollapsed}
        onPointerEnter={() => setSidebarHovered(true)}
        onPointerLeave={() => setSidebarHovered(false)}
        onFocusCapture={() => setSidebarHovered(true)}
        onBlurCapture={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) setSidebarHovered(false);
        }}
      />
      <div className="app-main">
        <Topbar onMenu={() => setSidebarOpen(true)} />
        <main className="page-container">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
