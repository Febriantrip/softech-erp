export const coreSeed = {
  customers: [
    { id: 'CUS-001', code: 'CUST-001', name: 'PT Sinar Retail Indonesia', paymentTerm: 'NET 30', creditLimit: 350000000, creditUsed: 115000000, status: 'Active', shipTo: 'Bekasi Timur, Jawa Barat' },
    { id: 'CUS-002', code: 'CUST-002', name: 'CV Prima Niaga', paymentTerm: 'NET 21', creditLimit: 180000000, creditUsed: 42000000, status: 'Active', shipTo: 'Depok, Jawa Barat' },
    { id: 'CUS-003', code: 'CUST-003', name: 'PT Arunika Mart', paymentTerm: 'NET 30', creditLimit: 125000000, creditUsed: 93000000, status: 'Active', shipTo: 'Bandung, Jawa Barat' },
    { id: 'CUS-004', code: 'CUST-004', name: 'UD Sejahtera Abadi', paymentTerm: 'COD', creditLimit: 60000000, creditUsed: 0, status: 'Active', shipTo: 'Tangerang, Banten' },
    { id: 'CUS-101', code: 'NDT-CUST-001', name: 'PT Surya Retail Timur', entityId: 'ENT-NDT', paymentTerm: 'NET 30', creditLimit: 280000000, creditUsed: 86000000, status: 'Active', shipTo: 'Surabaya, Jawa Timur' },
    { id: 'CUS-102', code: 'NDT-CUST-002', name: 'CV Makmur Jaya Timur', entityId: 'ENT-NDT', paymentTerm: 'NET 21', creditLimit: 160000000, creditUsed: 42000000, status: 'Active', shipTo: 'Sidoarjo, Jawa Timur' }
  ],
  items: [
    { id: 'ITM-001', sku: 'SKU-10018', name: 'Detergent Liquid 1L', uom: 'CTN', price: 385000, standardCost: 278000, reorderPoint: 180, maxStock: 650, taxRate: 11, status: 'Active' },
    { id: 'ITM-002', sku: 'SKU-10077', name: 'Fabric Softener 900ml', uom: 'CTN', price: 418000, standardCost: 302000, reorderPoint: 140, maxStock: 500, taxRate: 11, status: 'Active' },
    { id: 'ITM-003', sku: 'SKU-10221', name: 'Dishwash Refill 750ml', uom: 'CTN', price: 420400, standardCost: 306000, reorderPoint: 120, maxStock: 460, taxRate: 11, status: 'Active' },
    { id: 'ITM-004', sku: 'SKU-10009', name: 'Cooking Oil 2L', uom: 'CTN', price: 455000, standardCost: 336000, reorderPoint: 110, maxStock: 400, taxRate: 11, status: 'Active' },
    { id: 'ITM-005', sku: 'SKU-10301', name: 'Mineral Water 600ml', uom: 'CTN', price: 246000, standardCost: 174000, reorderPoint: 170, maxStock: 620, taxRate: 11, status: 'Active' },
    { id: 'ITM-006', sku: 'SKU-10521', name: 'Household Cleaner 800ml', uom: 'CTN', price: 399000, standardCost: 289000, reorderPoint: 100, maxStock: 380, taxRate: 11, status: 'Active' }
  ],
  warehouses: [
    { id: 'WH-JKT', code: 'JKT-DC', name: 'Jakarta Distribution Center', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', site: 'JKT-HO', defaultLocation: 'GENERAL' },
    { id: 'WH-CKR', code: 'CKR-DC', name: 'Cikarang Distribution Center', entityId: 'ENT-NDU', siteId: 'SITE-CKR-DC', site: 'CKR-DC', defaultLocation: 'FAST-MOVING' },
    { id: 'WH-TGR', code: 'TGR-WH', name: 'Tangerang Warehouse', entityId: 'ENT-NDU', siteId: 'SITE-TGR-WH', site: 'TGR-WH', defaultLocation: 'GENERAL' },
    { id: 'WH-SBY', code: 'SBY-DC', name: 'Surabaya Distribution Center', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', site: 'SBY-BR', defaultLocation: 'GENERAL' },
    { id: 'WH-GRK', code: 'GRK-WH', name: 'Gresik Warehouse', entityId: 'ENT-NDT', siteId: 'SITE-GRK-WH', site: 'GRK-WH', defaultLocation: 'GENERAL' }
  ],
  inventory: [
    { warehouseId: 'WH-JKT', sku: 'SKU-10018', onHand: 380, reserved: 80, avgCost: 278000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-JKT', sku: 'SKU-10077', onHand: 260, reserved: 70, avgCost: 302000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-JKT', sku: 'SKU-10221', onHand: 310, reserved: 20, avgCost: 306000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-JKT', sku: 'SKU-10009', onHand: 185, reserved: 100, avgCost: 336000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-JKT', sku: 'SKU-10301', onHand: 350, reserved: 125, avgCost: 174000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-JKT', sku: 'SKU-10521', onHand: 140, reserved: 0, avgCost: 289000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10018', onHand: 240, reserved: 0, avgCost: 278000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10077', onHand: 175, reserved: 15, avgCost: 302000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10221', onHand: 120, reserved: 0, avgCost: 306000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10009', onHand: 95, reserved: 0, avgCost: 336000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10301', onHand: 210, reserved: 20, avgCost: 174000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-CKR', sku: 'SKU-10521', onHand: 80, reserved: 0, avgCost: 289000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10018', onHand: 210, reserved: 35, avgCost: 281000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10077', onHand: 160, reserved: 20, avgCost: 304500, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10221', onHand: 185, reserved: 25, avgCost: 309000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10009', onHand: 145, reserved: 30, avgCost: 339000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10301', onHand: 280, reserved: 50, avgCost: 176500, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-SBY', sku: 'SKU-10521', onHand: 120, reserved: 15, avgCost: 292000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10018', onHand: 95, reserved: 10, avgCost: 281000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10077', onHand: 88, reserved: 8, avgCost: 304500, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10221', onHand: 70, reserved: 5, avgCost: 309000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10009', onHand: 60, reserved: 0, avgCost: 339000, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10301', onHand: 125, reserved: 15, avgCost: 176500, quarantine: 0, qualityHold: 0 },
    { warehouseId: 'WH-GRK', sku: 'SKU-10521', onHand: 65, reserved: 0, avgCost: 292000, quarantine: 0, qualityHold: 0 }
  ],
  salesOrders: [
    {
      id: 'SO-2609-0108', customerId: 'CUS-001', date: '2026-09-05', requestedDate: '2026-09-07', warehouseId: 'WH-JKT', status: 'Approved', approvalStatus: 'Approved', owner: 'Dimas Pratama', notes: 'Prioritas delivery pagi.', discount: 0,
      lines: [
        { sku: 'SKU-10018', qty: 120, allocated: 0, picked: 0, shipped: 0, price: 385000 },
        { sku: 'SKU-10077', qty: 180, allocated: 0, picked: 0, shipped: 0, price: 418000 },
        { sku: 'SKU-10221', qty: 150, allocated: 0, picked: 0, shipped: 0, price: 420400 }
      ],
      related: { quotation: 'SQ-2609-0042' },
      audit: [
        { at: '2026-09-05T09:15:00', by: 'Dimas Pratama', action: 'Sales order dibuat' },
        { at: '2026-09-05T10:02:00', by: 'Finance Approver', action: 'Credit & order approval disetujui' }
      ]
    },
    {
      id: 'SO-2609-0107', customerId: 'CUS-002', date: '2026-09-05', requestedDate: '2026-09-06', warehouseId: 'WH-JKT', status: 'Picked', approvalStatus: 'Approved', owner: 'Nadia Putri', notes: '', discount: 0,
      lines: [
        { sku: 'SKU-10009', qty: 100, allocated: 100, picked: 100, shipped: 0, price: 455000 },
        { sku: 'SKU-10301', qty: 125, allocated: 125, picked: 125, shipped: 0, price: 246000 }
      ],
      related: { quotation: 'SQ-2609-0039', pickingOrder: 'PKO-2609-0188' },
      audit: [
        { at: '2026-09-05T08:40:00', by: 'Nadia Putri', action: 'Sales order dibuat' },
        { at: '2026-09-05T11:10:00', by: 'Warehouse Team A', action: 'Picking selesai' }
      ]
    },
    {
      id: 'SO-2609-0106', customerId: 'CUS-003', date: '2026-09-04', requestedDate: '2026-09-08', warehouseId: 'WH-CKR', status: 'Credit Hold', approvalStatus: 'Pending Credit', owner: 'Fajar Maulana', notes: 'Menunggu approval limit customer.', discount: 0,
      lines: [
        { sku: 'SKU-10018', qty: 80, allocated: 0, picked: 0, shipped: 0, price: 385000 },
        { sku: 'SKU-10077', qty: 120, allocated: 0, picked: 0, shipped: 0, price: 418000 }
      ],
      related: { creditApproval: 'APR-2609-0091' },
      audit: [{ at: '2026-09-04T15:30:00', by: 'Fajar Maulana', action: 'Order terkena credit hold otomatis' }]
    },
    {
      id: 'SO-2609-0105', customerId: 'CUS-004', date: '2026-09-04', requestedDate: '2026-09-05', warehouseId: 'WH-JKT', status: 'Delivered', approvalStatus: 'Approved', owner: 'Rina Sales', notes: 'Historical completed order untuk contoh traceability.', discount: 0,
      lines: [{ sku: 'SKU-10521', qty: 110, allocated: 110, picked: 110, shipped: 110, price: 399000 }],
      related: { pickingOrder: 'PKO-2609-0184', deliveryOrder: 'DO-2609-0067', shipment: 'SHP-2609-0049' },
      audit: [
        { at: '2026-09-04T10:00:00', by: 'Rina Sales', action: 'Sales order dibuat dan disetujui' },
        { at: '2026-09-05T17:55:00', by: 'Warehouse Team B', action: 'Delivery loading selesai' },
        { at: '2026-09-05T18:42:00', by: 'Logistics Team', action: 'Shipment SHP-2609-0049 dispatched. Stock ledger posted.' },
        { at: '2026-09-05T20:05:00', by: 'Driver / POD', action: 'Shipment delivered dan POD diterima' }
      ]
    },
    {
      id: 'SO-NDT-2609-0008', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', customerId: 'CUS-101', date: '2026-09-05', requestedDate: '2026-09-07', warehouseId: 'WH-SBY', status: 'Delivered', approvalStatus: 'Approved', owner: 'Sari Timur', notes: 'Seed transaksi NDT untuk entity scoping dan consolidation.', discount: 0,
      lines: [
        { sku: 'SKU-10018', qty: 180, allocated: 180, picked: 180, shipped: 180, price: 390000 },
        { sku: 'SKU-10301', qty: 240, allocated: 240, picked: 240, shipped: 240, price: 250000 }
      ],
      related: { salesInvoice: 'INV-NDT-2609-0004' },
      audit: [{ at: '2026-09-05T16:30:00', by: 'Sari Timur', action: 'Order NDT delivered dan siap financial posting' }]
    }
  ],
  pickings: [
    {
      id: 'PKO-2609-0188', salesOrderId: 'SO-2609-0107', warehouseId: 'WH-JKT', status: 'Completed', createdAt: '2026-09-05T10:20:00', completedAt: '2026-09-05T11:10:00', picker: 'Warehouse Team A',
      lines: [
        { sku: 'SKU-10009', allocatedQty: 100, pickedQty: 100, location: 'A-01-03', lot: 'LOT-260829-A' },
        { sku: 'SKU-10301', allocatedQty: 125, pickedQty: 125, location: 'B-04-01', lot: 'LOT-260901-B' }
      ]
    },
    {
      id: 'PKO-2609-0184', salesOrderId: 'SO-2609-0105', warehouseId: 'WH-JKT', status: 'Completed', createdAt: '2026-09-05T16:40:00', completedAt: '2026-09-05T17:15:00', picker: 'Warehouse Team B',
      lines: [{ sku: 'SKU-10521', allocatedQty: 110, pickedQty: 110, location: 'C-02-01', lot: 'LOT-260902-C' }]
    }
  ],
  deliveryOrders: [
    {
      id: 'DO-2609-0067', salesOrderId: 'SO-2609-0105', pickingId: 'PKO-2609-0184', warehouseId: 'WH-JKT', customerId: 'CUS-004', status: 'Delivered', createdAt: '2026-09-05T17:20:00', deliveryDate: '2026-09-05', dock: 'Dock 01', vehicle: 'B 8841 KRN - Blind Van', driver: 'Agus Setiawan', shipmentId: 'SHP-2609-0049',
      lines: [{ sku: 'SKU-10521', qty: 110, lot: 'LOT-260902-C', location: 'C-02-01' }]
    }
  ],
  shipments: [
    {
      id: 'SHP-2609-0049', deliveryOrderId: 'DO-2609-0067', salesOrderId: 'SO-2609-0105', customerId: 'CUS-004', warehouseId: 'WH-JKT', status: 'Delivered', createdAt: '2026-09-05T18:00:00', dispatchedAt: '2026-09-05T18:42:00', deliveredAt: '2026-09-05T20:05:00', vehicle: 'B 8841 KRN - Blind Van', driver: 'Agus Setiawan', route: 'JKT-TGR-03', pod: 'POD-2609-0049', cogsJournalId: 'JV-2609-0186', cogsAmount: 31790000,
      lines: [{ sku: 'SKU-10521', qty: 110, lot: 'LOT-260902-C', unitCost: 289000, cogs: 31790000 }]
    }
  ],
  stockMovements: [
    { id: 'MOV-0001', at: '2026-09-05T08:00:00', type: 'OPENING', warehouseId: 'WH-JKT', sku: 'SKU-10009', qty: 185, ref: 'OPENING-SEP' },
    { id: 'MOV-0002', at: '2026-09-05T08:00:00', type: 'OPENING', warehouseId: 'WH-JKT', sku: 'SKU-10301', qty: 350, ref: 'OPENING-SEP' },
    { id: 'MOV-IC-0002-A', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', at: '2026-09-05T14:20:00', type: 'INTERCOMPANY_OUT', warehouseId: 'WH-JKT', sku: 'SKU-10018', qty: -50, unitCost: 278000, value: -13900000, ref: 'IC-2609-0002' },
    { id: 'MOV-IC-0002-B', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', at: '2026-09-05T15:00:00', type: 'INTERCOMPANY_IN', warehouseId: 'WH-SBY', sku: 'SKU-10018', qty: 50, unitCost: 320000, value: 16000000, ref: 'IC-2609-0002' },
    { id: 'MOV-0003', at: '2026-09-05T18:42:00', type: 'SHIPMENT_OUT', warehouseId: 'WH-JKT', sku: 'SKU-10521', qty: -110, unitCost: 289000, value: -31790000, ref: 'SHP-2609-0049' }
  ],
  warehouseLocations: [
    { id: 'LOC-JKT-IN', warehouseId: 'WH-JKT', code: 'INBOUND-01', type: 'Inbound', zone: 'Receiving', pickPriority: 99, status: 'Active' },
    { id: 'LOC-JKT-A01', warehouseId: 'WH-JKT', code: 'A-01-01', type: 'Storage', zone: 'Fast Moving', pickPriority: 1, status: 'Active' },
    { id: 'LOC-JKT-A02', warehouseId: 'WH-JKT', code: 'A-02-01', type: 'Storage', zone: 'Fast Moving', pickPriority: 2, status: 'Active' },
    { id: 'LOC-JKT-B04', warehouseId: 'WH-JKT', code: 'B-04-01', type: 'Storage', zone: 'General', pickPriority: 10, status: 'Active' },
    { id: 'LOC-JKT-C02', warehouseId: 'WH-JKT', code: 'C-02-01', type: 'Storage', zone: 'General', pickPriority: 11, status: 'Active' },
    { id: 'LOC-CKR-IN', warehouseId: 'WH-CKR', code: 'INBOUND-01', type: 'Inbound', zone: 'Receiving', pickPriority: 99, status: 'Active' },
    { id: 'LOC-CKR-A01', warehouseId: 'WH-CKR', code: 'A-01-01', type: 'Storage', zone: 'Fast Moving', pickPriority: 1, status: 'Active' },
    { id: 'LOC-CKR-B01', warehouseId: 'WH-CKR', code: 'B-01-01', type: 'Storage', zone: 'General', pickPriority: 5, status: 'Active' },
    { id: 'LOC-TGR-GEN', warehouseId: 'WH-TGR', code: 'GENERAL', type: 'Storage', zone: 'General', pickPriority: 1, status: 'Active' },
    { id: 'LOC-SBY-IN', warehouseId: 'WH-SBY', code: 'INBOUND-01', type: 'Inbound', zone: 'Receiving', pickPriority: 99, status: 'Active' },
    { id: 'LOC-SBY-A01', warehouseId: 'WH-SBY', code: 'A-01-01', type: 'Storage', zone: 'Fast Moving', pickPriority: 1, status: 'Active' },
    { id: 'LOC-SBY-B01', warehouseId: 'WH-SBY', code: 'B-01-01', type: 'Storage', zone: 'General', pickPriority: 5, status: 'Active' },
    { id: 'LOC-GRK-GEN', warehouseId: 'WH-GRK', code: 'GENERAL', type: 'Storage', zone: 'General', pickPriority: 1, status: 'Active' }
  ],
  lotBalances: [
    { id: 'LOTBAL-001', warehouseId: 'WH-JKT', location: 'A-01-01', sku: 'SKU-10018', lot: 'LOT-260905-01', expiryDate: '2027-09-05', onHand: 120, reserved: 40 },
    { id: 'LOTBAL-002', warehouseId: 'WH-JKT', location: 'A-02-01', sku: 'SKU-10077', lot: 'LOT-260905-02', expiryDate: '2027-09-05', onHand: 80, reserved: 30 },
    { id: 'LOTBAL-003', warehouseId: 'WH-JKT', location: 'C-02-01', sku: 'SKU-10521', lot: 'LOT-260904-05', expiryDate: '2027-03-04', onHand: 70, reserved: 0 },
    { id: 'LOTBAL-004', warehouseId: 'WH-JKT', location: 'B-04-01', sku: 'SKU-10301', lot: 'LOT-260901-B', expiryDate: '2027-02-28', onHand: 125, reserved: 40 },
    { id: 'LOTBAL-005', warehouseId: 'WH-CKR', location: 'A-01-01', sku: 'SKU-10018', lot: 'LOT-260827-C', expiryDate: '2027-08-27', onHand: 140, reserved: 0 },
    { id: 'LOTBAL-006', warehouseId: 'WH-JKT', location: 'C-02-01', sku: 'SKU-10521', lot: 'LOT-260902-C', expiryDate: '2027-03-02', onHand: 50, reserved: 0, holdQty: 0 }
  ],
  stockTransfers: [
    {
      id: 'TRF-2609-0003', date: '2026-09-05', fromWarehouseId: 'WH-JKT', toWarehouseId: 'WH-CKR', status: 'Draft', requestedBy: 'Inventory Planning', releasedAt: null, receivedAt: null, notes: 'Redistribution fast moving SKU untuk Cikarang.',
      lines: [
        { sku: 'SKU-10018', qty: 40, shippedQty: 0, receivedQty: 0, unitCost: 278000 },
        { sku: 'SKU-10301', qty: 60, shippedQty: 0, receivedQty: 0, unitCost: 174000 }
      ],
      audit: [
        { at: '2026-09-05T14:25:00', by: 'Inventory Planning', action: 'Inter-site transfer dibuat sebagai Draft' }
      ]
    }
  ],
  stockTakes: [
    {
      id: 'STK-2609-0002', date: '2026-09-05', warehouseId: 'WH-JKT', scope: 'Cycle Count · Fast Moving', status: 'Counting', requestedBy: 'Warehouse Control', approvedBy: null, postedAt: null,
      lines: [
        { sku: 'SKU-10018', systemQty: 380, countQty: 378, variance: -2, unitCost: 278000 },
        { sku: 'SKU-10077', systemQty: 260, countQty: null, variance: 0, unitCost: 302000 },
        { sku: 'SKU-10301', systemQty: 350, countQty: 351, variance: 1, unitCost: 174000 }
      ],
      audit: [{ at: '2026-09-05T17:00:00', by: 'Warehouse Control', action: 'Cycle count sheet dibuka' }]
    }
  ],
  salesReturns: [
    {
      id: 'SRET-2609-0004', documentNo: 'NDU-JKT-HO-SRET-2609-000004', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', salesOrderId: 'SO-2609-0105', salesInvoiceId: null, customerId: 'CUS-004', warehouseId: 'WH-JKT', date: '2026-09-06', status: 'Approved', approvalStatus: 'Approved', reason: 'Customer reported damaged outer cartons after delivery.', receivedAt: null, postedAt: null, creditNoteId: null,
      lines: [{ sku: 'SKU-10521', qty: 12, receivedQty: 0, disposition: 'Restock', unitPrice: 399000, unitCost: 289000, taxRate: 11, lot: 'LOT-260902-C' }],
      audit: [{ at: '2026-09-06T09:10:00', by: 'Rina Sales', action: 'Sales return request dibuat dari SO-2609-0105' }, { at: '2026-09-06T10:00:00', by: 'Sales Supervisor', action: 'Sales return disetujui untuk receiving ke quarantine' }]
    }
  ],
  purchaseReturns: [
    {
      id: 'PRET-2609-0002', documentNo: 'NDU-JKT-HO-PRET-2609-000002', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', purchaseOrderId: 'PO-2609-0039', purchaseInvoiceId: 'PINV-2609-0021', supplierId: 'SUP-004', warehouseId: 'WH-JKT', date: '2026-09-06', status: 'Approved', approvalStatus: 'Approved', reason: 'Supplier return for packaging defect discovered after put-away.', postedAt: null, debitNoteId: null,
      lines: [{ sku: 'SKU-10521', qty: 10, unitPrice: 286000, unitCost: 289000, taxRate: 11, lot: 'LOT-260904-05' }],
      audit: [{ at: '2026-09-06T13:25:00', by: 'Warehouse Control', action: 'Purchase return dibuat dari PINV-2609-0021' }, { at: '2026-09-06T14:15:00', by: 'Procurement Manager', action: 'Purchase return disetujui' }]
    }
  ],
  salesCreditNotes: [],
  purchaseDebitNotes: [],
  replenishmentOrders: [
    {
      id: 'RPL-2609-0005', documentNo: 'NDU-CKR-DC-RPL-2609-000005', entityId: 'ENT-NDU', siteId: 'SITE-CKR-DC', fromWarehouseId: 'WH-JKT', toWarehouseId: 'WH-CKR', date: '2026-09-06', status: 'Planned', planner: 'Inventory Planning', transferId: null, notes: 'Auto planning berdasarkan reorder point dan max stock.',
      lines: [
        { sku: 'SKU-10521', projectedQty: 80, reorderPoint: 100, maxStock: 380, suggestedQty: 300, sourceAvailable: 140, transferableQty: 40, approvedQty: 40, sourceWarehouseId: 'WH-JKT' }
      ],
      audit: [{ at: '2026-09-06T06:30:00', by: 'Inventory Planning', action: 'Replenishment plan dibuat otomatis untuk Cikarang DC' }]
    }
  ],
  qualityCases: [
    {
      id: 'QC-2609-0012', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', warehouseId: 'WH-JKT', sku: 'SKU-10521', lot: 'LOT-260902-C', openedAt: '2026-09-06T08:40:00', status: 'Monitoring', affectedQty: 20, reason: 'Leakage complaint from retail channel; trace remaining lot pending physical hold.', disposition: 'Pending', source: 'Customer Complaint', holdApplied: false, recallId: 'RCL-2609-0001',
      audit: [{ at: '2026-09-06T08:40:00', by: 'Quality Control', action: 'Quality case dibuka untuk 20 CTN' }]
    }
  ],
  recallCases: [
    {
      id: 'RCL-2609-0001', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', qualityCaseId: 'QC-2609-0012', sku: 'SKU-10521', lot: 'LOT-260902-C', createdAt: '2026-09-06T11:30:00', status: 'Monitoring', reason: 'Trace downstream exposure for suspected leakage lot.', affectedShipments: [{ shipmentId: 'SHP-2609-0049', salesOrderId: 'SO-2609-0105', deliveryOrderId: 'DO-2609-0067', status: 'Delivered', customerId: 'CUS-004', qty: 110 }], audit: [{ at: '2026-09-06T11:30:00', by: 'Quality Control', action: 'Trace-only recall case dibuat untuk downstream review' }]
    }
  ],
  accountingPeriods: [
    { id: 'PER-NDU-2026-09', entityId: 'ENT-NDU', year: 2026, month: 9, label: 'September 2026', status: 'Open', startDate: '2026-09-01', endDate: '2026-09-30' },
    { id: 'PER-NDU-2026-08', entityId: 'ENT-NDU', year: 2026, month: 8, label: 'August 2026', status: 'Closed', startDate: '2026-08-01', endDate: '2026-08-31' },
    { id: 'PER-NDT-2026-09', entityId: 'ENT-NDT', year: 2026, month: 9, label: 'September 2026', status: 'Open', startDate: '2026-09-01', endDate: '2026-09-30' },
    { id: 'PER-NDT-2026-08', entityId: 'ENT-NDT', year: 2026, month: 8, label: 'August 2026', status: 'Closed', startDate: '2026-08-01', endDate: '2026-08-31' }
  ],
  chartOfAccounts: [
    { code: '110101', name: 'Bank BCA Operasional', type: 'Asset' },
    { code: '110102', name: 'Cash on Hand', type: 'Asset' },
    { code: '113100', name: 'Accounts Receivable', type: 'Asset' },
    { code: '114100', name: 'Due From Related Parties', type: 'Asset' },
    { code: '120100', name: 'Merchandise Inventory', type: 'Asset' },
    { code: '118100', name: 'VAT Input / PPN Masukan', type: 'Asset' },
    { code: '119100', name: 'Supplier Debit Balance / Vendor Receivable', type: 'Asset' },
    { code: '214100', name: 'VAT Output / PPN Keluaran', type: 'Liability' },
    { code: '211100', name: 'Accounts Payable', type: 'Liability' },
    { code: '212100', name: 'Due To Related Parties', type: 'Liability' },
    { code: '213100', name: 'Customer Credits / Refund Payable', type: 'Liability' },
    { code: '410100', name: 'Sales Revenue', type: 'Revenue' },
    { code: '411100', name: 'Sales Returns & Allowances', type: 'Contra Revenue' },
    { code: '420100', name: 'Intercompany Revenue', type: 'Revenue' },
    { code: '419900', name: 'Inventory Adjustment Gain', type: 'Revenue' },
    { code: '510100', name: 'Cost of Goods Sold', type: 'Expense' },
    { code: '520100', name: 'Intercompany Expense', type: 'Expense' },
    { code: '610100', name: 'Operating Expense', type: 'Expense' },
    { code: '619100', name: 'Quality & Disposal Loss', type: 'Expense' },
    { code: '519500', name: 'Purchase Return Cost Variance', type: 'Expense' },
    { code: '519900', name: 'Inventory Adjustment Loss', type: 'Expense' }
  ],
  bankAccounts: [
    { id: 'BANK-BCA', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', code: 'BCA-001', name: 'BCA Operasional NDU', coa: '110101', type: 'Bank', balance: 4280000000 },
    { id: 'CASH-HO', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', code: 'CASH-HO', name: 'Kas Kantor Pusat NDU', coa: '110102', type: 'Cash', balance: 18500000 },
    { id: 'BANK-NDT-BCA', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', code: 'NDT-BCA-001', name: 'BCA Operasional NDT', coa: '110101', type: 'Bank', balance: 1680000000 },
    { id: 'CASH-NDT', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', code: 'NDT-CASH', name: 'Kas Surabaya', coa: '110102', type: 'Cash', balance: 12500000 }
  ],
  salesInvoices: [
    {
      id: 'INV-2608-0812', salesOrderId: null, shipmentId: null, customerId: 'CUS-001', date: '2026-08-02', dueDate: '2026-09-01', status: 'Open', postingStatus: 'Posted', currency: 'IDR', subtotal: 166216216, tax: 18283784, total: 184500000, paidAmount: 0, journalId: 'JV-2608-0812', arItemId: 'AR-0001', notes: 'Opening AR from previous period',
      lines: [{ sku: 'SKU-10018', description: 'Opening receivable detail', qty: 432, price: 384760, taxRate: 11 }], related: {}, audit: []
    },
    {
      id: 'INV-2608-0733', salesOrderId: null, shipmentId: null, customerId: 'CUS-003', date: '2026-07-26', dueDate: '2026-08-25', status: 'Partially Paid', postingStatus: 'Posted', currency: 'IDR', subtotal: 116936936, tax: 12863064, total: 129800000, paidAmount: 30000000, journalId: 'JV-2608-0733', arItemId: 'AR-0002', notes: 'Opening AR with partial collection',
      lines: [{ sku: 'SKU-10077', description: 'Opening receivable detail', qty: 280, price: 417632, taxRate: 11 }], related: {}, audit: []
    },
    {
      id: 'INV-NDT-2609-0004', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', salesOrderId: 'SO-NDT-2609-0008', shipmentId: null, customerId: 'CUS-101', date: '2026-09-05', dueDate: '2026-10-05', status: 'Open', postingStatus: 'Posted', currency: 'IDR', subtotal: 130000000, tax: 14300000, total: 144300000, paidAmount: 0, journalId: 'JV-NDT-2609-0001', arItemId: 'AR-NDT-0001', notes: 'Seed NDT sales invoice for consolidated reporting',
      lines: [{ sku: 'SKU-10018', description: 'East region distribution sales', qty: 180, price: 390000, taxRate: 11 }], related: { salesOrder: 'SO-NDT-2609-0008' }, audit: []
    }
  ],
  arOpenItems: [
    { id: 'AR-0001', invoiceId: 'INV-2608-0812', customerId: 'CUS-001', documentDate: '2026-08-02', dueDate: '2026-09-01', originalAmount: 184500000, outstanding: 184500000, status: 'Open' },
    { id: 'AR-0002', invoiceId: 'INV-2608-0733', customerId: 'CUS-003', documentDate: '2026-07-26', dueDate: '2026-08-25', originalAmount: 129800000, outstanding: 99800000, status: 'Open' },
    { id: 'AR-NDT-0001', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', invoiceId: 'INV-NDT-2609-0004', customerId: 'CUS-101', documentDate: '2026-09-05', dueDate: '2026-10-05', originalAmount: 144300000, outstanding: 144300000, status: 'Open' }
  ],
  apOpenItems: [
    { id: 'AP-0001', billId: 'BILL-2608-0214', supplierId: 'SUP-001', supplier: 'PT Indo Principal Supply', documentDate: '2026-08-10', dueDate: '2026-09-09', originalAmount: 580000000, outstanding: 580000000, status: 'Open' },
    { id: 'AP-0002', billId: 'BILL-2608-0197', supplierId: 'SUP-002', supplier: 'PT Sumber Niaga Makmur', documentDate: '2026-08-04', dueDate: '2026-09-03', originalAmount: 215700000, outstanding: 215700000, status: 'Open' },
    { id: 'AP-0003', billId: 'PINV-2609-0021', supplierId: 'SUP-004', supplier: 'PT Prima Kemasan Nasional', documentDate: '2026-09-05', dueDate: '2026-09-19', originalAmount: 57142800, outstanding: 57142800, status: 'Open' },
    { id: 'AP-NDT-0001', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', billId: 'BILL-NDT-2609-0012', supplierId: 'SUP-101', supplier: 'PT Principal Timur Indonesia', documentDate: '2026-09-03', dueDate: '2026-10-03', originalAmount: 238000000, outstanding: 238000000, status: 'Open' }
  ],
  receipts: [
    { id: 'BR-2609-0041', customerId: 'CUS-003', invoiceId: 'INV-2608-0733', date: '2026-09-05', amount: 30000000, method: 'Bank Transfer', accountId: 'BANK-BCA', reference: 'TRX-BCA-050926-001', status: 'Posted', journalId: 'JV-2609-0187' }
  ],
  journals: [
    { id: 'JV-IC-2609-0001-A', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', date: '2026-09-05', source: 'Intercompany Service', reference: 'IC-2609-0001', status: 'Posted', description: 'Intercompany management service receivable to NDT', lines: [
      { account: '114100', accountName: 'Due From Related Parties', debit: 85000000, credit: 0, counterpartyEntityId: 'ENT-NDT' },
      { account: '420100', accountName: 'Intercompany Revenue', debit: 0, credit: 85000000, counterpartyEntityId: 'ENT-NDT' }
    ] },
    { id: 'JV-IC-2609-0001-B', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', date: '2026-09-05', source: 'Intercompany Service', reference: 'IC-2609-0001', status: 'Posted', description: 'Intercompany management service payable to NDU', lines: [
      { account: '520100', accountName: 'Intercompany Expense', debit: 85000000, credit: 0, counterpartyEntityId: 'ENT-NDU' },
      { account: '212100', accountName: 'Due To Related Parties', debit: 0, credit: 85000000, counterpartyEntityId: 'ENT-NDU' }
    ] },
    { id: 'JV-IC-2609-0002-A', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', date: '2026-09-05', source: 'Intercompany Inventory', reference: 'IC-2609-0002', status: 'Posted', description: 'Intercompany inventory sale to NDT', lines: [
      { account: '114100', accountName: 'Due From Related Parties', debit: 16000000, credit: 0, counterpartyEntityId: 'ENT-NDT' },
      { account: '420100', accountName: 'Intercompany Revenue', debit: 0, credit: 16000000, counterpartyEntityId: 'ENT-NDT' },
      { account: '510100', accountName: 'Cost of Goods Sold', debit: 13900000, credit: 0, counterpartyEntityId: 'ENT-NDT' },
      { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: 13900000, counterpartyEntityId: 'ENT-NDT' }
    ] },
    { id: 'JV-IC-2609-0002-B', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', date: '2026-09-05', source: 'Intercompany Inventory', reference: 'IC-2609-0002', status: 'Posted', description: 'Intercompany inventory purchase from NDU', lines: [
      { account: '120100', accountName: 'Merchandise Inventory', debit: 16000000, credit: 0, counterpartyEntityId: 'ENT-NDU' },
      { account: '212100', accountName: 'Due To Related Parties', debit: 0, credit: 16000000, counterpartyEntityId: 'ENT-NDU' }
    ] },
    { id: 'JV-2609-0186', date: '2026-09-05', source: 'Inventory Issue', reference: 'SHP-2609-0049', status: 'Posted', description: 'COGS posting untuk SHP-2609-0049', lines: [
      { account: '510100', accountName: 'Cost of Goods Sold', debit: 31790000, credit: 0 },
      { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: 31790000 }
    ] },
    { id: 'JV-2609-0188', date: '2026-09-05', source: 'Purchase Invoice', reference: 'PINV-2609-0021', status: 'Posted', description: 'Purchase invoice PT Prima Kemasan Nasional', lines: [
      { account: '120100', accountName: 'Merchandise Inventory', debit: 51480000, credit: 0 },
      { account: '118100', accountName: 'VAT Input / PPN Masukan', debit: 5662800, credit: 0 },
      { account: '211100', accountName: 'Accounts Payable', debit: 0, credit: 57142800 }
    ] },
    { id: 'JV-2609-0187', date: '2026-09-05', source: 'Bank Receipt', reference: 'BR-2609-0041', status: 'Posted', description: 'Collection PT Arunika Mart', lines: [
      { account: '110101', accountName: 'Bank BCA Operasional', debit: 30000000, credit: 0 },
      { account: '113100', accountName: 'Accounts Receivable', debit: 0, credit: 30000000 }
    ] },
    { id: 'JV-2608-0812', date: '2026-08-02', source: 'Sales Invoice', reference: 'INV-2608-0812', status: 'Posted', description: 'Opening invoice PT Sinar Retail Indonesia', lines: [
      { account: '113100', accountName: 'Accounts Receivable', debit: 184500000, credit: 0 },
      { account: '410100', accountName: 'Sales Revenue', debit: 0, credit: 166216216 },
      { account: '214100', accountName: 'VAT Output / PPN Keluaran', debit: 0, credit: 18283784 }
    ] },
    { id: 'JV-2608-0733', date: '2026-07-26', source: 'Sales Invoice', reference: 'INV-2608-0733', status: 'Posted', description: 'Opening invoice PT Arunika Mart', lines: [
      { account: '113100', accountName: 'Accounts Receivable', debit: 129800000, credit: 0 },
      { account: '410100', accountName: 'Sales Revenue', debit: 0, credit: 116936936 },
      { account: '214100', accountName: 'VAT Output / PPN Keluaran', debit: 0, credit: 12863064 }
    ] },
    { id: 'JV-NDT-2609-0001', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', date: '2026-09-05', source: 'Sales Invoice', reference: 'INV-NDT-2609-0004', status: 'Posted', description: 'NDT sales invoice PT Surya Retail Timur', lines: [
      { account: '113100', accountName: 'Accounts Receivable', debit: 144300000, credit: 0 },
      { account: '410100', accountName: 'Sales Revenue', debit: 0, credit: 130000000 },
      { account: '214100', accountName: 'VAT Output / PPN Keluaran', debit: 0, credit: 14300000 }
    ] },
    { id: 'JV-NDT-2609-0002', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', date: '2026-09-05', source: 'Inventory Issue', reference: 'SHP-NDT-2609-0003', status: 'Posted', description: 'NDT COGS posting', lines: [
      { account: '510100', accountName: 'Cost of Goods Sold', debit: 92000000, credit: 0 },
      { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: 92000000 }
    ] },
    { id: 'JV-NDT-2609-0003', entityId: 'ENT-NDT', siteId: 'SITE-SBY-BR', date: '2026-09-05', source: 'Operating Expense', reference: 'OPEX-NDT-0905', status: 'Posted', description: 'NDT operating expense', lines: [
      { account: '610100', accountName: 'Operating Expense', debit: 24500000, credit: 0 },
      { account: '110101', accountName: 'Bank BCA Operasional', debit: 0, credit: 24500000 }
    ] }
  ],
  suppliers: [
    { id: 'SUP-001', code: 'SUP-001', name: 'PT Indo Principal Supply', paymentTerm: 'NET 30', taxId: '01.234.567.8-901.000', leadTimeDays: 5, rating: 'A', status: 'Active', defaultWarehouseId: 'WH-JKT' },
    { id: 'SUP-002', code: 'SUP-002', name: 'PT Sumber Niaga Makmur', paymentTerm: 'NET 30', taxId: '02.345.678.9-012.000', leadTimeDays: 4, rating: 'A', status: 'Active', defaultWarehouseId: 'WH-JKT' },
    { id: 'SUP-003', code: 'SUP-003', name: 'CV Pusat Distribusi', paymentTerm: 'NET 21', taxId: '03.456.789.0-123.000', leadTimeDays: 7, rating: 'B', status: 'Active', defaultWarehouseId: 'WH-CKR' },
    { id: 'SUP-004', code: 'SUP-004', name: 'PT Prima Kemasan Nasional', paymentTerm: 'NET 14', taxId: '04.567.890.1-234.000', leadTimeDays: 3, rating: 'A', status: 'Active', defaultWarehouseId: 'WH-JKT' },
    { id: 'SUP-101', code: 'NDT-SUP-001', name: 'PT Principal Timur Indonesia', entityId: 'ENT-NDT', paymentTerm: 'NET 30', taxId: '05.111.222.3-444.000', leadTimeDays: 4, rating: 'A', status: 'Active', defaultWarehouseId: 'WH-SBY' },
    { id: 'SUP-102', code: 'NDT-SUP-002', name: 'CV Mitra Distribusi Timur', entityId: 'ENT-NDT', paymentTerm: 'NET 21', taxId: '05.222.333.4-555.000', leadTimeDays: 6, rating: 'B', status: 'Active', defaultWarehouseId: 'WH-GRK' }
  ],
  purchaseRequests: [
    {
      id: 'PR-2609-0017', date: '2026-09-04', neededDate: '2026-09-09', warehouseId: 'WH-JKT', requester: 'Inventory Planning', status: 'Approved', approvalStatus: 'Approved', notes: 'Replenishment fast moving item.',
      lines: [
        { sku: 'SKU-10018', qty: 300, estimatedCost: 278000 },
        { sku: 'SKU-10077', qty: 220, estimatedCost: 302000 }
      ],
      related: { rfq: 'RFQ-2609-0009' },
      audit: [
        { at: '2026-09-04T08:30:00', by: 'Inventory Planning', action: 'Purchase Request dibuat' },
        { at: '2026-09-04T09:12:00', by: 'Procurement Manager', action: 'Purchase Request disetujui' }
      ]
    },
    {
      id: 'PR-2609-0018', date: '2026-09-05', neededDate: '2026-09-11', warehouseId: 'WH-CKR', requester: 'Cikarang DC', status: 'Draft', approvalStatus: 'Not Submitted', notes: 'Buffer stock household cleaner.',
      lines: [{ sku: 'SKU-10521', qty: 160, estimatedCost: 289000 }],
      related: {},
      audit: [{ at: '2026-09-05T10:20:00', by: 'Cikarang DC', action: 'Purchase Request dibuat sebagai Draft' }]
    }
  ],
  rfqs: [
    {
      id: 'RFQ-2609-0009', purchaseRequestId: 'PR-2609-0017', supplierId: 'SUP-001', date: '2026-09-04', validUntil: '2026-09-08', status: 'Quoted', buyer: 'Anita Procurement',
      lines: [
        { sku: 'SKU-10018', qty: 300, quotedPrice: 274500 },
        { sku: 'SKU-10077', qty: 220, quotedPrice: 298500 }
      ],
      related: { purchaseOrder: 'PO-2609-0042' },
      audit: [{ at: '2026-09-04T10:15:00', by: 'Anita Procurement', action: 'RFQ dikirim dan quotation supplier dicatat' }]
    }
  ],
  purchaseOrders: [
    {
      id: 'PO-2609-0042', supplierId: 'SUP-001', warehouseId: 'WH-JKT', date: '2026-09-04', eta: '2026-09-07', status: 'Partially Received', approvalStatus: 'Approved', buyer: 'Anita Procurement', notes: 'Partial delivery diperbolehkan.',
      lines: [
        { sku: 'SKU-10018', qty: 300, price: 274500, receivedQty: 120, putAwayQty: 120, invoicedQty: 0 },
        { sku: 'SKU-10077', qty: 220, price: 298500, receivedQty: 80, putAwayQty: 80, invoicedQty: 0 }
      ],
      related: { purchaseRequest: 'PR-2609-0017', rfq: 'RFQ-2609-0009', receiving: ['GRN-2609-0033'] },
      audit: [
        { at: '2026-09-04T11:00:00', by: 'Anita Procurement', action: 'Purchase Order dibuat dari RFQ-2609-0009' },
        { at: '2026-09-04T11:42:00', by: 'Procurement Manager', action: 'Purchase Order disetujui' },
        { at: '2026-09-05T14:10:00', by: 'Inbound Team', action: 'Partial receiving GRN-2609-0033 selesai dan diputar ke put away' }
      ]
    },
    {
      id: 'PO-2609-0041', supplierId: 'SUP-002', warehouseId: 'WH-JKT', date: '2026-09-04', eta: '2026-09-06', status: 'Approved', approvalStatus: 'Approved', buyer: 'Rizky Buyer', notes: 'PO siap inbound.',
      lines: [
        { sku: 'SKU-10221', qty: 260, price: 301000, receivedQty: 0, putAwayQty: 0, invoicedQty: 0 },
        { sku: 'SKU-10301', qty: 300, price: 171500, receivedQty: 0, putAwayQty: 0, invoicedQty: 0 }
      ],
      related: {},
      audit: [
        { at: '2026-09-04T12:30:00', by: 'Rizky Buyer', action: 'Purchase Order dibuat' },
        { at: '2026-09-04T13:05:00', by: 'Procurement Manager', action: 'Purchase Order disetujui' }
      ]
    },
    {
      id: 'PO-2609-0039', supplierId: 'SUP-004', warehouseId: 'WH-JKT', date: '2026-09-02', eta: '2026-09-04', status: 'Invoiced', approvalStatus: 'Approved', buyer: 'Anita Procurement', notes: 'Historical completed inbound example.',
      lines: [{ sku: 'SKU-10521', qty: 180, price: 286000, receivedQty: 180, putAwayQty: 180, invoicedQty: 180 }],
      related: { receiving: ['GRN-2609-0030'], purchaseInvoice: 'PINV-2609-0021' },
      audit: [
        { at: '2026-09-02T09:00:00', by: 'Anita Procurement', action: 'Purchase Order dibuat dan disetujui' },
        { at: '2026-09-04T11:20:00', by: 'Inbound Team', action: 'Goods receipt dan put away selesai' },
        { at: '2026-09-05T09:25:00', by: 'AP Accountant', action: 'Purchase Invoice diposting ke AP/GL' }
      ]
    }
  ],
  receivings: [
    {
      id: 'GRN-2609-0033', purchaseOrderId: 'PO-2609-0042', supplierId: 'SUP-001', warehouseId: 'WH-JKT', date: '2026-09-05', status: 'Put Away', receivedBy: 'Inbound Team A', putAwayAt: '2026-09-05T14:10:00',
      lines: [
        { sku: 'SKU-10018', orderedQty: 300, receiveQty: 120, acceptedQty: 120, rejectedQty: 0, location: 'INBOUND-01', putAwayLocation: 'A-01-01', lot: 'LOT-260905-01' },
        { sku: 'SKU-10077', orderedQty: 220, receiveQty: 80, acceptedQty: 80, rejectedQty: 0, location: 'INBOUND-01', putAwayLocation: 'A-02-01', lot: 'LOT-260905-02' }
      ],
      audit: [
        { at: '2026-09-05T13:42:00', by: 'Inbound Team A', action: 'Goods receipt dikonfirmasi ke inbound staging' },
        { at: '2026-09-05T14:10:00', by: 'Warehouse Team', action: 'Put away selesai ke storage location' }
      ]
    },
    {
      id: 'GRN-2609-0030', purchaseOrderId: 'PO-2609-0039', supplierId: 'SUP-004', warehouseId: 'WH-JKT', date: '2026-09-04', status: 'Put Away', receivedBy: 'Inbound Team B', putAwayAt: '2026-09-04T11:20:00',
      lines: [{ sku: 'SKU-10521', orderedQty: 180, receiveQty: 180, acceptedQty: 180, rejectedQty: 0, location: 'INBOUND-02', putAwayLocation: 'C-02-01', lot: 'LOT-260904-05' }],
      audit: [{ at: '2026-09-04T11:20:00', by: 'Inbound Team B', action: 'Receiving dan put away selesai' }]
    }
  ],
  purchaseInvoices: [
    {
      id: 'PINV-2609-0021', purchaseOrderId: 'PO-2609-0039', receivingId: 'GRN-2609-0030', supplierId: 'SUP-004', date: '2026-09-05', dueDate: '2026-09-19', status: 'Open', postingStatus: 'Posted', currency: 'IDR', matchStatus: 'Matched', subtotal: 51480000, tax: 5662800, total: 57142800, paidAmount: 0, journalId: 'JV-2609-0188', apItemId: 'AP-0003', notes: 'Historical 3-way matched purchase invoice.',
      lines: [{ sku: 'SKU-10521', description: 'Household Cleaner 800ml', qty: 180, price: 286000, taxRate: 11 }],
      related: { purchaseOrder: 'PO-2609-0039', receiving: 'GRN-2609-0030' },
      audit: [{ at: '2026-09-05T09:25:00', by: 'AP Accountant', action: '3-way match passed dan invoice diposting' }]
    }
  ],
  supplierPayments: [],
  paymentRuns: [],
  consolidationGroups: [
    { id: 'GRP-NUSANTARA', code: 'NUSANTARA', name: 'Nusantara Distribution Group', currency: 'IDR', status: 'Active' }
  ],
  legalEntities: [
    { id: 'ENT-NDU', code: 'NDU', name: 'PT Nusantara Distribusi Utama', groupId: 'GRP-NUSANTARA', baseCurrency: 'IDR', country: 'ID', taxId: '01.000.111.2-333.000', status: 'Active', colorToken: 'violet' },
    { id: 'ENT-NDT', code: 'NDT', name: 'PT Nusantara Distribusi Timur', groupId: 'GRP-NUSANTARA', baseCurrency: 'IDR', country: 'ID', taxId: '02.000.111.2-444.000', status: 'Active', colorToken: 'cyan' }
  ],
  sites: [
    { id: 'SITE-JKT-HO', entityId: 'ENT-NDU', code: 'JKT-HO', name: 'Jakarta Head Office', type: 'Head Office', city: 'Jakarta', status: 'Active' },
    { id: 'SITE-CKR-DC', entityId: 'ENT-NDU', code: 'CKR-DC', name: 'Cikarang Distribution Center', type: 'Distribution Center', city: 'Bekasi', status: 'Active' },
    { id: 'SITE-TGR-WH', entityId: 'ENT-NDU', code: 'TGR-WH', name: 'Tangerang Warehouse', type: 'Warehouse', city: 'Tangerang', status: 'Active' },
    { id: 'SITE-SBY-BR', entityId: 'ENT-NDT', code: 'SBY-BR', name: 'Surabaya Branch', type: 'Branch', city: 'Surabaya', status: 'Active' },
    { id: 'SITE-GRK-WH', entityId: 'ENT-NDT', code: 'GRK-WH', name: 'Gresik Warehouse', type: 'Warehouse', city: 'Gresik', status: 'Active' }
  ],
  users: [
    { id: 'USR-FEBRIAN', username: 'febrian.admin', name: 'Febrian Administrator', email: 'febrian.admin@nexa.local', status: 'Active', mfaEnabled: true, lastLoginAt: '2026-09-09T08:12:00', sessionStatus: 'Online' },
    { id: 'USR-ANITA', username: 'anita.proc', name: 'Anita Procurement', email: 'anita.proc@nexa.local', status: 'Active', mfaEnabled: true, lastLoginAt: '2026-09-09T07:48:00', sessionStatus: 'Online' },
    { id: 'USR-BUDI', username: 'budi.finance', name: 'Budi Finance Manager', email: 'budi.finance@nexa.local', status: 'Active', mfaEnabled: true, lastLoginAt: '2026-09-08T18:20:00', sessionStatus: 'Offline' },
    { id: 'USR-RINA', username: 'rina.sales', name: 'Rina Sales Supervisor', email: 'rina.sales@nexa.local', status: 'Active', mfaEnabled: true, lastLoginAt: '2026-09-09T08:04:00', sessionStatus: 'Online' },
    { id: 'USR-RAKA', username: 'raka.inventory', name: 'Raka Inventory Controller', email: 'raka.inventory@nexa.local', status: 'Active', mfaEnabled: false, lastLoginAt: '2026-09-09T06:55:00', sessionStatus: 'Online' },
    { id: 'USR-DIAH', username: 'diah.audit', name: 'Diah Internal Audit', email: 'diah.audit@nexa.local', status: 'Active', mfaEnabled: true, lastLoginAt: '2026-09-08T16:05:00', sessionStatus: 'Offline' }
  ],
  permissionCatalog: [
    { id: 'dashboard.view', module: 'Dashboard', action: 'View' },
    { id: 'sales.view', module: 'Sales', action: 'View' }, { id: 'sales.create', module: 'Sales', action: 'Create' }, { id: 'sales.edit', module: 'Sales', action: 'Edit' }, { id: 'sales.approve', module: 'Sales', action: 'Approve' },
    { id: 'purchase.view', module: 'Purchase', action: 'View' }, { id: 'purchase.create', module: 'Purchase', action: 'Create' }, { id: 'purchase.edit', module: 'Purchase', action: 'Edit' }, { id: 'purchase.approve', module: 'Purchase', action: 'Approve' },
    { id: 'warehouse.view', module: 'Warehouse', action: 'View' }, { id: 'warehouse.transact', module: 'Warehouse', action: 'Transact' }, { id: 'warehouse.approve', module: 'Warehouse', action: 'Approve' },
    { id: 'finance.view', module: 'Finance', action: 'View' }, { id: 'finance.post', module: 'Finance', action: 'Post' }, { id: 'finance.close', module: 'Finance', action: 'Close Period' },
    { id: 'ar_ap.view', module: 'AR/AP', action: 'View' }, { id: 'ar_ap.pay', module: 'AR/AP', action: 'Pay' },
    { id: 'enterprise.view', module: 'Enterprise', action: 'View' }, { id: 'enterprise.post', module: 'Enterprise', action: 'Post' },
    { id: 'security.view', module: 'Security', action: 'View' }, { id: 'security.manage', module: 'Security', action: 'Manage' },
    { id: 'audit.view', module: 'Audit', action: 'View' }, { id: 'approval.override_sod', module: 'Approval', action: 'SoD Override' }
  ],
  roles: [
    { id: 'ROLE-GROUP-ADMIN', code: 'GROUP_ADMIN', name: 'Group Administrator', privileged: true, sodOverride: true, permissions: ['*'], description: 'Full group administration across permitted entities and sites.' },
    { id: 'ROLE-SALES-SUP', code: 'SALES_SUP', name: 'Sales Supervisor', privileged: false, sodOverride: false, permissions: ['dashboard.view','sales.view','sales.create','sales.edit','sales.approve','ar_ap.view'], description: 'Sales operations and Sales Order approval.' },
    { id: 'ROLE-PROC-MGR', code: 'PROC_MGR', name: 'Procurement Manager', privileged: true, sodOverride: false, permissions: ['dashboard.view','purchase.view','purchase.create','purchase.edit','purchase.approve','warehouse.view'], description: 'Procurement approvals and supplier commitments.' },
    { id: 'ROLE-FIN-MGR', code: 'FIN_MGR', name: 'Finance Manager', privileged: true, sodOverride: false, permissions: ['dashboard.view','finance.view','finance.post','finance.close','ar_ap.view','ar_ap.pay','sales.approve','purchase.approve','enterprise.view'], description: 'Finance posting, credit override, close, and payment authorization.' },
    { id: 'ROLE-INV-CTRL', code: 'INV_CTRL', name: 'Inventory Controller', privileged: true, sodOverride: false, permissions: ['dashboard.view','warehouse.view','warehouse.transact','warehouse.approve'], description: 'Inventory variance, stock take, and warehouse control.' },
    { id: 'ROLE-AUDITOR', code: 'AUDITOR', name: 'Internal Auditor', privileged: false, sodOverride: false, permissions: ['dashboard.view','sales.view','purchase.view','warehouse.view','finance.view','ar_ap.view','enterprise.view','security.view','audit.view'], description: 'Read-only audit and control review.' }
  ],
  userRoleAssignments: [
    { id: 'URA-001', userId: 'USR-FEBRIAN', roleId: 'ROLE-GROUP-ADMIN', entityId: 'ENT-NDU', siteIds: ['ALL'], status: 'Active' },
    { id: 'URA-002', userId: 'USR-FEBRIAN', roleId: 'ROLE-GROUP-ADMIN', entityId: 'ENT-NDT', siteIds: ['ALL'], status: 'Active' },
    { id: 'URA-003', userId: 'USR-ANITA', roleId: 'ROLE-PROC-MGR', entityId: 'ENT-NDU', siteIds: ['SITE-JKT-HO','SITE-CKR-DC'], status: 'Active' },
    { id: 'URA-004', userId: 'USR-BUDI', roleId: 'ROLE-FIN-MGR', entityId: 'ENT-NDU', siteIds: ['ALL'], status: 'Active' },
    { id: 'URA-005', userId: 'USR-BUDI', roleId: 'ROLE-FIN-MGR', entityId: 'ENT-NDT', siteIds: ['ALL'], status: 'Active' },
    { id: 'URA-006', userId: 'USR-RINA', roleId: 'ROLE-SALES-SUP', entityId: 'ENT-NDU', siteIds: ['SITE-JKT-HO'], status: 'Active' },
    { id: 'URA-007', userId: 'USR-RAKA', roleId: 'ROLE-INV-CTRL', entityId: 'ENT-NDU', siteIds: ['SITE-JKT-HO','SITE-CKR-DC','SITE-TGR-WH'], status: 'Active' },
    { id: 'URA-008', userId: 'USR-DIAH', roleId: 'ROLE-AUDITOR', entityId: 'ENT-NDU', siteIds: ['ALL'], status: 'Active' },
    { id: 'URA-009', userId: 'USR-DIAH', roleId: 'ROLE-AUDITOR', entityId: 'ENT-NDT', siteIds: ['ALL'], status: 'Active' }
  ],
  approvalPolicies: [
    { id: 'APR-RULE-SO-01', name: 'Sales Order Standard', documentType: 'SALES_ORDER', entityId: 'ALL', minAmount: 0, maxAmount: 50000000, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-SALES-SUP', label: 'Sales Supervisor' }] },
    { id: 'APR-RULE-SO-02', name: 'Sales Order High Value', documentType: 'SALES_ORDER', entityId: 'ALL', minAmount: 50000000.01, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-SALES-SUP', label: 'Sales Supervisor' }, { sequence: 2, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] },
    { id: 'APR-RULE-CREDIT-01', name: 'Customer Credit Override', documentType: 'CREDIT_OVERRIDE', entityId: 'ALL', minAmount: 0, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] },
    { id: 'APR-RULE-PR-01', name: 'Purchase Request', documentType: 'PURCHASE_REQUEST', entityId: 'ALL', minAmount: 0, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-PROC-MGR', label: 'Procurement Manager' }] },
    { id: 'APR-RULE-PO-01', name: 'Purchase Order Standard', documentType: 'PURCHASE_ORDER', entityId: 'ALL', minAmount: 0, maxAmount: 100000000, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-PROC-MGR', label: 'Procurement Manager' }] },
    { id: 'APR-RULE-PO-02', name: 'Purchase Order High Value', documentType: 'PURCHASE_ORDER', entityId: 'ALL', minAmount: 100000000.01, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-PROC-MGR', label: 'Procurement Manager' }, { sequence: 2, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] },
    { id: 'APR-RULE-STK-01', name: 'Stock Take Variance', documentType: 'STOCK_TAKE', entityId: 'ALL', minAmount: 0, maxAmount: 10000000, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-INV-CTRL', label: 'Inventory Controller' }] },
    { id: 'APR-RULE-STK-02', name: 'High Value Stock Variance', documentType: 'STOCK_TAKE', entityId: 'ALL', minAmount: 10000000.01, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-INV-CTRL', label: 'Inventory Controller' }, { sequence: 2, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] },
    { id: 'APR-RULE-SRET-01', name: 'Sales Return Authorization', documentType: 'SALES_RETURN', entityId: 'ALL', minAmount: 0, maxAmount: 50000000, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-SALES-SUP', label: 'Sales Supervisor' }] },
    { id: 'APR-RULE-SRET-02', name: 'High Value Sales Return', documentType: 'SALES_RETURN', entityId: 'ALL', minAmount: 50000000.01, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-SALES-SUP', label: 'Sales Supervisor' }, { sequence: 2, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] },
    { id: 'APR-RULE-PRET-01', name: 'Purchase Return Authorization', documentType: 'PURCHASE_RETURN', entityId: 'ALL', minAmount: 0, maxAmount: 100000000, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-PROC-MGR', label: 'Procurement Manager' }] },
    { id: 'APR-RULE-PRET-02', name: 'High Value Purchase Return', documentType: 'PURCHASE_RETURN', entityId: 'ALL', minAmount: 100000000.01, maxAmount: null, mode: 'SEQUENTIAL', allowSelfApproval: false, status: 'Active', steps: [{ sequence: 1, roleId: 'ROLE-PROC-MGR', label: 'Procurement Manager' }, { sequence: 2, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager' }] }
  ],
  approvalRequests: [
    { id: 'APR-2609-0001', documentType: 'CREDIT_OVERRIDE', documentId: 'SO-2609-0106', entityId: 'ENT-NDU', siteId: 'SITE-CKR-DC', amount: 77850000, makerUserId: 'USR-RINA', policyId: 'APR-RULE-CREDIT-01', status: 'Pending', currentStep: 1, submittedAt: '2026-09-05T11:14:00', completedAt: null, rejectionReason: '', steps: [{ sequence: 1, roleId: 'ROLE-FIN-MGR', label: 'Finance Manager', status: 'Pending', actedByUserId: null, actedAt: null, note: '' }] }
  ],
  approvalDelegations: [
    { id: 'DEL-2609-0001', fromUserId: 'USR-BUDI', toUserId: 'USR-FEBRIAN', roleId: 'ROLE-FIN-MGR', entityId: 'ALL', startDate: '2026-09-09', endDate: '2026-09-15', reason: 'Finance Manager leave coverage', status: 'Active' }
  ],
  documentNumberRules: [
    { id: 'NUM-SO', documentType: 'SALES_ORDER', code: 'SO', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 108, status: 'Active' },
    { id: 'NUM-PR', documentType: 'PURCHASE_REQUEST', code: 'PR', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 18, status: 'Active' },
    { id: 'NUM-RFQ', documentType: 'RFQ', code: 'RFQ', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 9, status: 'Active' },
    { id: 'NUM-PO', documentType: 'PURCHASE_ORDER', code: 'PO', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 42, status: 'Active' },
    { id: 'NUM-GRN', documentType: 'GOODS_RECEIPT', code: 'GRN', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 33, status: 'Active' },
    { id: 'NUM-SINV', documentType: 'SALES_INVOICE', code: 'SINV', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 12, status: 'Active' },
    { id: 'NUM-PINV', documentType: 'PURCHASE_INVOICE', code: 'PINV', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 21, status: 'Active' },
    { id: 'NUM-JV', documentType: 'JOURNAL', code: 'JV', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 188, status: 'Active' },
    { id: 'NUM-STK', documentType: 'STOCK_TAKE', code: 'STK', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 2, status: 'Active' },
    { id: 'NUM-SRET', documentType: 'SALES_RETURN', code: 'SRET', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 4, status: 'Active' },
    { id: 'NUM-PRET', documentType: 'PURCHASE_RETURN', code: 'PRET', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 2, status: 'Active' },
    { id: 'NUM-RPL', documentType: 'REPLENISHMENT', code: 'RPL', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 5, status: 'Active' },
    { id: 'NUM-QC', documentType: 'QUALITY_CASE', code: 'QC', entityId: 'ALL', siteId: 'ALL', template: '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}', reset: 'MONTHLY', lastPeriod: '2026-09', lastNumber: 12, status: 'Active' }
  ],
  documentControlPolicies: [
    { id: 'LOCK-SO', documentType: 'SALES_ORDER', lockedStatuses: ['Shipped','Delivered','Invoiced','Closed','Cancelled'], correctionMode: 'REVERSAL', status: 'Active' },
    { id: 'LOCK-PO', documentType: 'PURCHASE_ORDER', lockedStatuses: ['Invoiced','Closed','Cancelled'], correctionMode: 'REVERSAL', status: 'Active' },
    { id: 'LOCK-SINV', documentType: 'SALES_INVOICE', lockedStatuses: ['Posted','Paid','Closed'], postingField: 'postingStatus', postingValues: ['Posted'], correctionMode: 'CREDIT_NOTE', status: 'Active' },
    { id: 'LOCK-PINV', documentType: 'PURCHASE_INVOICE', lockedStatuses: ['Posted','Paid','Closed'], postingField: 'postingStatus', postingValues: ['Posted'], correctionMode: 'DEBIT_NOTE', status: 'Active' },
    { id: 'LOCK-STK', documentType: 'STOCK_TAKE', lockedStatuses: ['Posted','Cancelled'], correctionMode: 'NEW_COUNT', status: 'Active' },
    { id: 'LOCK-SRET', documentType: 'SALES_RETURN', lockedStatuses: ['Posted','Cancelled'], correctionMode: 'CREDIT_NOTE', status: 'Active' },
    { id: 'LOCK-PRET', documentType: 'PURCHASE_RETURN', lockedStatuses: ['Posted','Cancelled'], correctionMode: 'DEBIT_NOTE', status: 'Active' },
    { id: 'LOCK-RPL', documentType: 'REPLENISHMENT', lockedStatuses: ['Transfer Created','Closed','Cancelled'], correctionMode: 'NEW_PLAN', status: 'Active' }
  ],
  systemPolicies: [
    { id: 'POL-SOD', category: 'Approval', key: 'maker_checker_required', label: 'Maker / Checker Separation', value: true, description: 'Maker tidak boleh menyetujui dokumen sendiri kecuali punya SoD override.' },
    { id: 'POL-MFA', category: 'Security', key: 'privileged_mfa_required', label: 'Privileged Role Requires MFA', value: true, description: 'Role privileged harus menggunakan MFA.' },
    { id: 'POL-SESSION', category: 'Security', key: 'session_timeout_minutes', label: 'Session Timeout', value: 60, description: 'Idle session timeout untuk user ERP.' },
    { id: 'POL-BACKDATE', category: 'Posting', key: 'block_closed_period', label: 'Block Closed Period Posting', value: true, description: 'Posting ke accounting period Closed ditolak.' },
    { id: 'POL-AUDIT', category: 'Audit', key: 'immutable_audit', label: 'Immutable Audit Event', value: true, description: 'Audit event tidak dapat diedit atau dihapus dari aplikasi.' }
  ],
  auditEvents: [
    { id: 'AUD-2609-0001', at: '2026-09-09T08:12:00', userId: 'USR-FEBRIAN', userName: 'Febrian Administrator', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', module: 'Security', documentType: 'SESSION', documentId: 'SES-FEB-0909', action: 'LOGIN', field: '', oldValue: '', newValue: 'Authenticated with MFA', severity: 'Info' },
    { id: 'AUD-2609-0002', at: '2026-09-05T11:14:00', userId: 'USR-RINA', userName: 'Rina Sales Supervisor', entityId: 'ENT-NDU', siteId: 'SITE-CKR-DC', module: 'Approval', documentType: 'CREDIT_OVERRIDE', documentId: 'SO-2609-0106', action: 'SUBMIT', field: 'status', oldValue: 'Draft', newValue: 'Credit Hold', severity: 'Warning' },
    { id: 'AUD-2609-0003', at: '2026-09-05T15:00:00', userId: 'USR-RAKA', userName: 'Raka Inventory Controller', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', module: 'Inventory', documentType: 'INTERCOMPANY_INVENTORY', documentId: 'IC-2609-0002', action: 'POST', field: '', oldValue: 'In Transit', newValue: 'Posted', severity: 'Info' }
  ],
  notifications: [
    { id: 'NTF-2609-0001', userId: 'USR-FEBRIAN', entityId: 'ENT-NDU', siteId: 'SITE-CKR-DC', type: 'Approval', title: 'Credit override menunggu approval', message: 'SO-2609-0106 membutuhkan Finance Manager approval.', link: '/approvals', createdAt: '2026-09-09T08:15:00', readAt: null, priority: 'High' },
    { id: 'NTF-2609-0002', userId: 'USR-FEBRIAN', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', type: 'Security', title: 'MFA coverage belum 100%', message: '1 privileged operational user belum mengaktifkan MFA.', link: '/security', createdAt: '2026-09-09T08:20:00', readAt: null, priority: 'Medium' },
    { id: 'NTF-2609-0003', userId: 'USR-FEBRIAN', entityId: 'ENT-NDU', siteId: 'SITE-JKT-HO', type: 'Inventory', title: 'Replenishment review', message: 'Beberapa SKU berada di bawah projected reorder point.', link: '/warehouse', createdAt: '2026-09-09T07:30:00', readAt: '2026-09-09T08:01:00', priority: 'Low' }
  ],
  loginSessions: [
    { id: 'SES-FEB-0909', userId: 'USR-FEBRIAN', startedAt: '2026-09-09T08:12:00', lastSeenAt: '2026-09-09T08:45:00', device: 'Windows · Chrome', ip: '10.10.20.14', status: 'Active' },
    { id: 'SES-ANITA-0909', userId: 'USR-ANITA', startedAt: '2026-09-09T07:48:00', lastSeenAt: '2026-09-09T08:41:00', device: 'Windows · Edge', ip: '10.10.20.31', status: 'Active' },
    { id: 'SES-RINA-0909', userId: 'USR-RINA', startedAt: '2026-09-09T08:04:00', lastSeenAt: '2026-09-09T08:40:00', device: 'Android · Chrome', ip: '10.10.30.18', status: 'Active' }
  ],
  entityAccess: [
    { userId: 'USR-FEBRIAN', entityId: 'ENT-NDU', siteIds: ['SITE-JKT-HO','SITE-CKR-DC','SITE-TGR-WH'], role: 'Group Administrator' },
    { userId: 'USR-FEBRIAN', entityId: 'ENT-NDT', siteIds: ['SITE-SBY-BR','SITE-GRK-WH'], role: 'Group Administrator' }
  ],
  intercompanyTransactions: [
    {
      id: 'IC-2609-0001', groupId: 'GRP-NUSANTARA', type: 'SERVICE', date: '2026-09-05', fromEntityId: 'ENT-NDU', toEntityId: 'ENT-NDT', status: 'Posted', eliminationStatus: 'Pending', description: 'Shared IT, finance, and management service September', amount: 85000000, outstandingAmount: 85000000,
      sourceJournalId: 'JV-IC-2609-0001-A', destinationJournalId: 'JV-IC-2609-0001-B', settlementJournalIds: [], audit: [{ at: '2026-09-05T12:00:00', by: 'Group Finance', action: 'Intercompany service posted to both entities' }]
    },
    {
      id: 'IC-2609-0002', groupId: 'GRP-NUSANTARA', type: 'INVENTORY', date: '2026-09-05', fromEntityId: 'ENT-NDU', toEntityId: 'ENT-NDT', fromWarehouseId: 'WH-JKT', toWarehouseId: 'WH-SBY', status: 'Posted', eliminationStatus: 'Pending', description: 'Intercompany inventory redistribution to East region', sku: 'SKU-10018', qty: 50, unitCost: 278000, transferPrice: 320000, amount: 16000000, costAmount: 13900000, unrealizedProfit: 2100000, endingInventoryRatio: 1, outstandingAmount: 16000000,
      sourceJournalId: 'JV-IC-2609-0002-A', destinationJournalId: 'JV-IC-2609-0002-B', settlementJournalIds: [], audit: [{ at: '2026-09-05T15:00:00', by: 'Group Inventory', action: 'Intercompany inventory transfer received by NDT' }]
    }
  ],
  consolidationRuns: []

};
