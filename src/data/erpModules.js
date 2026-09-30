export const distributionTransactions = [
  'Purchase Request', 'Sales Quotation', 'Sales Call', 'Queue Log', 'Purchase Order',
  'Blanket Sales Order', 'Sales Order', 'Sales Return Order', 'Purchase Return Order',
  'Replenishment Order', 'Location Transfer Order', 'Delivery Order', 'Service Order',
  'Receiving', 'Shipment', 'Purchase Return', 'Sales Return', 'Location Transfer',
  'Inter Site Transfer', 'Inter Site Receipt', 'Kitting', 'Kitting Order', 'Budget By Project',
  'Inventory Adjustment IN', 'Inventory Adjustment Out', 'Load Sheet', 'Legal Document',
  'Document Transfer', 'Shipping Instruction', 'Insurance Instruction', 'Blanket Purchase Order',
  'Request For Quotation', 'Inventory Cost Addition', 'Inventory Cost Deduction', 'Sales Rejection',
  'Put Away', 'Picking Order', 'Picking'
];

export const posTransactions = ['Point Redemption', 'Point Addition'];

export const manufacturingTransactions = [
  'Cost Pre-Calculation', 'Production Request', 'Production Order', 'Release Production Order',
  'Production Transfer Order', 'Transfer Material to Production', 'Production Return Order',
  'Return Material to Warehouse', 'Machine Usage', 'Issue Material', 'Receive FG/Product',
  'Inspection Receive FG/Product', 'Hours Accounting', 'Inspection Sheet', 'Certificate of Analysis',
  'Tools Transfer Order', 'Tools Transfer to Production', 'Tools Return Order', 'Tools Return to Warehouse',
  'Master Production Schedule', 'Maintenance Order'
];

export const financialTransactions = [
  'Purchase Invoice', 'Cash Advance Request', 'Confirm Purchase Invoice', 'Purchase Return Invoice',
  'Payment Run', 'Sales Invoice', 'Sales Return Invoice', 'Collection Run', 'Confirm Collection Result',
  'AP Debit Note', 'AP Credit Note', 'AR Debit Note', 'AR Credit Note', 'Cash Receipt',
  'Cash Disbursement', 'Bank Receipt', 'Bank Disbursement', 'Receive Checks', 'Deposit Received Checks',
  'Issue Checks', 'Clear/Cancel Issued Checks', 'Cash Advance Settlement', 'Journal', 'Budget Journal',
  'System Generated Journal', 'Refund From Supplier', 'Refund To Customer'
];

export const fixedAssetTransactions = [
  'FA Addition', 'FA Disposal', 'FA Debit Adjustment', 'FA Credit Adjustment', 'FA Transfer'
];

export const pendingApprovals = [
  'Request Pending Approval', 'Sales Quotation Pending Approval', 'Order Pending Approval',
  'Inventory Pending Approval', 'AP Pending Approval', 'AR Pending Approval', 'Cash Pending Approval',
  'GL Pending Approval', 'FA Pending Approval', 'MF Pending Approval'
];

export const processes = [
  'Stock Take', 'Recalculate Inventory', 'Roll Up Standard Cost', 'Inventory Cost Revaluation',
  'Overhead Allocation', 'Cancel Overhead Allocation', 'Open and Close POS Station Shift', 'Write Off',
  'Collection Submission', 'Sales Target', 'Recovery Sales Rep', 'Update Customer Credit Limit',
  'Bank Reconciliation', 'Batch Create Journal and Post', 'Batch Cancel Journal and Post',
  'Transfer Balance', 'Closing Accounting Period', 'Reopen Accounting Period',
  'Calculate Unrealized Forex Gain or Loss', 'Set Closing Rate', 'Reset GL Balance', 'Year End Closing',
  'Upload Data', 'Active Users', 'Active Auto Print Users', 'Supplier Base Item Grouping',
  'View Machine Capacity', 'VAT-In Reconciliation', 'POS Price Tag', 'POS Discount Tag', 'VAT-Out Reconciliation'
];

export const masterGroups = [
  {
    title: 'Commons Master',
    description: 'Master data umum lintas modul dan lintas entity.',
    items: [
      'Supplier', 'Customer', 'Exchange Rate', 'Exchange Rate Type', 'Currency', 'Adjustment Contra Acc',
      'Cash Contra Acc', 'Term Of Payment', 'Country Code', 'Tax Service Office', 'Customer Area Group',
      'Employee', 'Sales Group', 'Sales Rep', 'Collector', 'Payment Pattern', 'Sales Route Pattern',
      'Sales Route', 'Distribution Calendar', 'Reason', 'Service Package', 'Shipping Instruction Template',
      'Legal Document Type', 'Insurance Instruction Template', 'Legal Document Status', 'Tax Facility Documents',
      'Buyer', 'Equipment', 'Task List'
    ]
  },
  {
    title: 'Distribution Master',
    description: 'Item, warehouse, pricing, promotion, dispatch, dan distribusi.',
    items: [
      'Items', 'Full Goods & Empty Container', 'Empty Container', 'Project Group', 'Project',
      'Warehouse & Group', 'Location', 'Stock Take Calendar', 'Price Master', 'Prepare Update Price',
      'Promo Master', 'Supplier As Customer', 'Promo Group', 'Dispatch Zone', 'Forwarder', 'Delivery Method',
      'Vehicle Type', 'Vehicle Type Group', 'Vehicle', 'Customer Bad Stock Budget', 'Daily News', 'Event Photo',
      'Transaction Type', 'Place of Dispatch', 'Dispatch Group'
    ]
  },
  {
    title: 'Point of Sale Master',
    description: 'Konfigurasi POS, loyalty, cashier, payment, dan station.',
    items: [
      'POS Shift', 'POS Shift Time', 'POS Point & Reward', 'POS Point Redemption Period', 'POS Cash Voucher',
      'POS Discount Coupon', 'Merchandise', 'POS Cashier', 'POS Station', 'POS Station Group', 'POS Member Type',
      'POS Payment Type', 'POS Advertisement', 'POS Point Condition', 'POS Food Stall', 'POS Payment Surcharge'
    ]
  },
  {
    title: 'Manufacturing Master',
    description: 'Opsional untuk distributor yang memiliki repacking atau produksi.',
    items: [
      'Item Specification', 'Item Sampling', 'Item Specification Template', 'Item Specification Type',
      'Tools', 'Toolkit', 'Production Type', 'Calendar', 'Production Shift Time', 'Production Shift',
      'Cost Code', 'Work Center & Machine'
    ]
  },
  {
    title: 'Financials Master',
    description: 'Fondasi akuntansi dan transaksi keuangan.',
    items: [
      'Chart Of Accounts', 'Cash Accounts', 'Check Book', 'Cost Center', 'Bank', 'Accounting Period',
      'Journal Templates', 'Journal Batch', 'Recurring Journal', 'AR/AP Transaction Type',
      'Cash Transaction Type', 'GL Journal Type'
    ]
  },
  {
    title: 'Fixed Assets Master',
    description: 'Master aset tetap dan pengelompokan depresiasi.',
    items: ['FA Items', 'FA Transaction Type', 'FA Category', 'FA Group', 'FA Department', 'FA Location']
  },
  {
    title: 'Grouping & Extra Fields',
    description: 'Pengelompokan dan field tambahan tanpa mengubah core schema.',
    items: [
      'Item Grouping', 'Item Extra Fields', 'Supplier Grouping', 'Customer Grouping',
      'Transaction Extra Fields', 'Project Extra Field', 'FA Item Extra Fields'
    ]
  },
  {
    title: 'Human Resources Master',
    description: 'Master HR minimum untuk workflow dan ownership transaksi.',
    items: ['Human Resource Calendar', 'Leave', 'Department', 'Job Level']
  }
];

export const setupGroups = [
  {
    title: 'Core Setup',
    items: [
      'Set Default', 'Set Tax Invoice No', 'Harmonized System HS Codes', 'On Time Payment Rebate',
      'Set Customer Template', 'Sales Quotation Follow-up Status', 'Shipment to Customer Virtual Location',
      'Automatic Email Alert', 'Group Structure', 'Unit and Unit Set', 'Tax Type and Group',
      'User Defined Alert', 'ABC Class', 'Set Purchase Shipping Cost', 'Set Cost Allocation', 'Form Set',
      'Form Set Production', 'Approval Set', 'Supplier Barcode Format', 'Document Transfer Profile',
      'Attachment Validation', 'GL COA Segments', 'GL Grouping', 'Cash Flow ID', 'Cost Center Group', 'Entity Account'
    ]
  },
  {
    title: 'Automation & Rules',
    items: [
      'Tax Rounding And Numbering', 'Limit Access to User Entity', 'Backdated and Postdated',
      'Check Negative Stock', 'Extra Field as Cost Center', 'Distribution Display Precision',
      'Distribution Quick Insert', 'Financial Quick Insert', 'Barcode as Identification of Items',
      'Use Do In LoadSheet', 'Default Location And Item', 'Recalculate Option', 'Set Lot/Serialization Auto Number',
      'Set Must Allocate AR/AP', 'Filter Invoice Due Date', 'Setting Automatic ID',
      'Automatic Calculate Reorder Point', 'Automatic Location Transfer Order', 'Automatic Kitting',
      'Automatic Collection Run', 'Automatic Cash Deposit', 'Automatic Deposit Checks',
      'Automatic Purchase Order for Empty Container', 'Automatic Discount Voucher',
      'Automatic Sales Call Management', 'Automatic Get Bank Statement', 'Calculate Reorder Point Approval',
      'Consignment Purchase', 'Customer Credit Limit Approval', 'Automatic Shipment From Invoice Schedule',
      'Automatic Customer GPS Update', 'Replenishment Planning'
    ]
  },
  {
    title: 'Utilities',
    items: [
      'Upload Table Name', 'Delete Exception Log', 'Setting Email Server', 'Application Label',
      'Download Application Log', 'Update Patch', 'Run Script', 'Backup Table IN', 'Backup Database',
      'Setting WhatsApp API'
    ]
  }
];

export const reportGroups = [
  {
    title: 'Report Center',
    items: [
      'Standard Report', 'User Defined Report', 'File Download', 'Print Barcode', 'POS Sales Dashboard',
      'View AP Payment', 'View AR Payment', 'Cash Bank Book', 'Cash Report', 'Check Status', 'Inventory Valuation', 'Stock Movement Ledger', 'Inventory Aging', 'Replenishment Recommendation', 'Lot Serial Status',
      'Service History', 'Journal Summary', 'Summary Balance', 'Cost Center Summary',
      'Financial Report Formatter', 'Exception Log', 'Manufacturing Reports'
    ]
  }
];

export const securityItems = ['User Login', 'User Group', 'Custom Menu', 'Setting Privilege', 'Role Based Access Control', 'Entity & Site Access', 'Approval Matrix', 'Maker Checker Control', 'Approval Delegation', 'Document Numbering', 'Document Locking', 'Session Security', 'Audit Explorer', 'Notification Center', 'System Policy'];

export const preliminaryGroups = [
  {
    title: 'Initial Setup',
    items: [
      'Entities', 'Sites', 'Entity Set', 'Basic Option', 'Set COA Format', 'Year Setup', 'Print Settings',
      'Transaction Extra Fields', 'FA Transaction Extra Fields', 'Item Extra Fields', 'FA Item Extra Fields',
      'Customer Extra Fields', 'Serialized/Lot Item Extra Fields', 'Project Extra Fields', 'Price List Extra Fields',
      'Shipping and Insurance Extra Fields', 'Supplier Extra Fields', 'Entity ID Structure',
      'Inventory Planning Extra Fields', 'POS Payment Type Extra Fields', 'Supplier Base Grouping',
      'CA Transaction Extra Fields', 'Item Custom Info Setting', 'PPOB Connection Setup', 'FG/Product Labelling Extra Field'
    ]
  }
];

export const addons = [
  {
    key: 'sales-mate',
    name: 'Sales Mate',
    audience: 'Sales Team',
    description: 'Mobile companion untuk sales call, quotation, visit, order capture, GPS check-in, target, dan collection follow-up.',
    features: ['Sales visit', 'Order capture', 'Customer 360', 'GPS check-in', 'Target & activity', 'Offline queue']
  },
  {
    key: 'driver-mate',
    name: 'Driver Mate',
    audience: 'Driver & Delivery',
    description: 'Aplikasi pengiriman untuk load sheet, route, proof of delivery, foto, geolocation, retur, dan collection.',
    features: ['Route plan', 'Load sheet', 'Proof of delivery', 'Customer signature', 'Photo evidence', 'Return handling']
  },
  {
    key: 'point-of-sale',
    name: 'Point of Sale',
    audience: 'Retail / Counter',
    description: 'POS terintegrasi inventory, loyalty, shift cashier, voucher, discount, payment, dan closing station.',
    features: ['Cashier shift', 'Barcode', 'Loyalty point', 'Voucher', 'Multi payment', 'Station closing']
  },
  {
    key: 'utility-billing',
    name: 'Utility Billing',
    audience: 'Recurring Billing',
    description: 'Billing terjadwal untuk layanan, utilitas, sewa, subscription, atau tagihan berkala.',
    features: ['Meter/billing cycle', 'Recurring invoice', 'Penalty', 'Statement', 'Payment allocation', 'Aging']
  },
  {
    key: 'numbering',
    name: 'Numbering',
    audience: 'Administration',
    description: 'Advanced document numbering lintas entity, site, tahun fiskal, prefix, dan document type.',
    features: ['Entity sequence', 'Site sequence', 'Fiscal reset', 'Prefix rule', 'Gap control', 'Audit trail']
  },
  {
    key: 'api',
    name: 'Orlansoft API',
    audience: 'Integration',
    description: 'Integration gateway untuk marketplace, banking, tax, third-party logistics, BI, dan aplikasi eksternal.',
    features: ['REST API', 'Webhook', 'API key', 'Rate limit', 'Integration log', 'Retry queue']
  },
  {
    key: 'sales-dashboard',
    name: 'Sales Dashboard',
    audience: 'Management',
    description: 'Dashboard khusus sales dengan target, achievement, order pipeline, margin, collection, dan territory.',
    features: ['Target vs actual', 'Pipeline', 'Margin', 'Collection', 'Territory', 'Leaderboard']
  },
  {
    key: 'supplier-portal',
    name: 'Supplier Portal',
    audience: 'Supplier',
    description: 'Portal supplier untuk RFQ, PO acknowledgement, delivery schedule, invoice submission, dan status payment.',
    features: ['RFQ response', 'PO acknowledgement', 'ASN', 'Invoice upload', 'Payment status', 'Supplier scorecard']
  }
];
