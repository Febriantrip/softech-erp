import {
  BarChart3,
  Blocks,
  BookOpenCheck,
  Boxes,
  Building2,
  CheckCircle2,
  ClipboardList,
  Factory,
  FileCog,
  Landmark,
  LayoutDashboard,
  LockKeyhole,
  Network,
  PackageCheck,
  PanelsTopLeft,
  Settings,
  ServerCog,
  ShoppingCart,
  SlidersHorizontal,
  Truck,
  WalletCards,
  Workflow
} from 'lucide-react';

export const navigation = [
  { label: 'Dashboard', path: '/', icon: LayoutDashboard },
  {
    label: 'Transactions', icon: ClipboardList,
    children: [
      { label: 'Sales & Distribution', path: '/transactions/distribution', icon: ShoppingCart },
      { label: 'Financials', path: '/transactions/financials', icon: WalletCards },
      { label: 'Fixed Assets', path: '/transactions/fixed-assets', icon: Building2 },
      { label: 'Manufacturing', path: '/transactions/manufacturing', icon: Factory },
      { label: 'Point of Sale', path: '/transactions/pos', icon: PackageCheck }
    ]
  },
  { label: 'Pending Approval', path: '/approvals', icon: CheckCircle2 },
  { label: 'Processes', path: '/processes', icon: Workflow },
  { label: 'Warehouse', path: '/warehouse', icon: Boxes },
  {
    label: 'Enterprise', icon: Building2,
    children: [
      { label: 'Entity & Site', path: '/enterprise/entities', icon: Building2 },
      { label: 'Intercompany', path: '/enterprise/intercompany', icon: Network },
      { label: 'Consolidation', path: '/enterprise/consolidation', icon: PanelsTopLeft }
    ]
  },
  { label: 'Finance & Accounting', path: '/finance', icon: Landmark },
  { label: 'AR / AP', path: '/ar-ap', icon: WalletCards },
  { label: 'Closing Period', path: '/closing', icon: BookOpenCheck },
  { label: 'Master Data', path: '/master-data', icon: SlidersHorizontal },
  {
    label: 'Setup & Config', icon: FileCog,
    children: [
      { label: 'ERP Configuration', path: '/setup', icon: FileCog },
      { label: 'Production Foundation', path: '/platform/production-foundation', icon: ServerCog }
    ]
  },
  { label: 'Reports', path: '/reports', icon: BarChart3 },
  { label: 'Security', path: '/security', icon: LockKeyhole },
  { label: 'Preliminary Setup', path: '/preliminary', icon: Settings },
  { label: 'Add-on Applications', path: '/addons', icon: Blocks, emphasis: true }
];

export const quickActions = [
  { label: 'Sales Order', icon: ShoppingCart },
  { label: 'Delivery Order', icon: Truck },
  { label: 'Jurnal Umum', icon: WalletCards },
  { label: 'Stock Transfer', icon: Boxes }
];
