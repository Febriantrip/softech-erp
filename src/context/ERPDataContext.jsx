import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { coreSeed } from '../data/coreSeed';
import { docSequence, soTotal } from '../utils/erp';

const STORAGE_KEY = 'distributor-erp-v3-core';
const SCOPE_STORAGE_KEY = 'distributor-erp-v7-enterprise-scope';
const DEFAULT_SCOPE = { mode: 'ENTITY', groupId: 'GRP-NUSANTARA', entityId: 'ENT-NDU', siteId: 'ALL' };
const CURRENT_USER_ID = 'USR-FEBRIAN';
const ERPDataContext = createContext(null);

const clone = (value) => JSON.parse(JSON.stringify(value));
const nowIso = () => new Date().toISOString();

function rowKey(row, key) {
  return typeof key === 'function' ? key(row) : row?.[key];
}

function mergeMissing(savedRows, seedRows, key = 'id') {
  if (!Array.isArray(savedRows)) return clone(seedRows || []);
  const existing = new Set(savedRows.map((row) => rowKey(row, key)).filter(Boolean));
  return [...savedRows, ...(seedRows || []).filter((row) => !existing.has(rowKey(row, key)))];
}

function enrichRows(savedRows, seedRows, key = 'id') {
  if (!Array.isArray(savedRows)) return clone(seedRows || []);
  const seedMap = new Map((seedRows || []).map((row) => [rowKey(row, key), row]));
  const result = savedRows.map((row) => ({ ...(seedMap.get(rowKey(row, key)) || {}), ...row }));
  const existing = new Set(result.map((row) => rowKey(row, key)).filter(Boolean));
  return [...result, ...(seedRows || []).filter((row) => !existing.has(rowKey(row, key)))];
}

function warehouseScope(data, warehouseId) {
  const warehouse = data.warehouses?.find((row) => row.id === warehouseId);
  return { entityId: warehouse?.entityId || 'ENT-NDU', siteId: warehouse?.siteId || null };
}

function applyEnterpriseDefaults(input) {
  const data = clone(input);
  const defaultEntityId = data.legalEntities?.[0]?.id || 'ENT-NDU';
  const defaultSiteId = data.sites?.find((row) => row.entityId === defaultEntityId)?.id || null;
  const stamp = (row, entityId, siteId = null) => {
    if (!row.entityId) row.entityId = entityId || defaultEntityId;
    if (!row.siteId && siteId) row.siteId = siteId;
    return row;
  };

  (data.warehouses || []).forEach((row) => {
    const site = data.sites?.find((s) => s.id === row.siteId || s.code === row.site);
    if (!row.entityId) row.entityId = site?.entityId || defaultEntityId;
    if (!row.siteId) row.siteId = site?.id || defaultSiteId;
  });
  (data.customers || []).forEach((row) => stamp(row, row.entityId || defaultEntityId));
  (data.suppliers || []).forEach((row) => stamp(row, row.entityId || defaultEntityId));
  (data.bankAccounts || []).forEach((row) => stamp(row, row.entityId || defaultEntityId, row.siteId || defaultSiteId));

  const warehouseCollections = [
    'inventory', 'salesOrders', 'pickings', 'deliveryOrders', 'shipments', 'stockMovements',
    'warehouseLocations', 'lotBalances', 'stockTakes', 'purchaseRequests', 'purchaseOrders', 'receivings',
    'salesReturns', 'purchaseReturns', 'qualityCases'
  ];
  warehouseCollections.forEach((key) => {
    (data[key] || []).forEach((row) => {
      const whId = row.warehouseId || row.fromWarehouseId || row.sourceWarehouseId;
      const scope = warehouseScope(data, whId);
      stamp(row, scope.entityId, scope.siteId);
    });
  });
  (data.stockTransfers || []).forEach((row) => {
    const from = warehouseScope(data, row.fromWarehouseId);
    const to = warehouseScope(data, row.toWarehouseId);
    row.entityId = row.entityId || from.entityId;
    row.siteId = row.siteId || from.siteId;
    row.toEntityId = row.toEntityId || to.entityId;
    row.toSiteId = row.toSiteId || to.siteId;
  });
  (data.rfqs || []).forEach((row) => {
    const request = data.purchaseRequests?.find((x) => x.id === row.purchaseRequestId);
    const supplier = data.suppliers?.find((x) => x.id === row.supplierId);
    stamp(row, request?.entityId || supplier?.entityId || defaultEntityId, request?.siteId || null);
  });
  (data.salesInvoices || []).forEach((row) => {
    const order = data.salesOrders?.find((x) => x.id === row.salesOrderId);
    const customer = data.customers?.find((x) => x.id === row.customerId);
    stamp(row, order?.entityId || customer?.entityId || defaultEntityId, order?.siteId || null);
  });
  (data.arOpenItems || []).forEach((row) => {
    const invoice = data.salesInvoices?.find((x) => x.id === row.invoiceId);
    const customer = data.customers?.find((x) => x.id === row.customerId);
    stamp(row, invoice?.entityId || customer?.entityId || defaultEntityId, invoice?.siteId || null);
  });
  (data.purchaseInvoices || []).forEach((row) => {
    const po = data.purchaseOrders?.find((x) => x.id === row.purchaseOrderId);
    const supplier = data.suppliers?.find((x) => x.id === row.supplierId);
    stamp(row, po?.entityId || supplier?.entityId || defaultEntityId, po?.siteId || null);
  });
  (data.apOpenItems || []).forEach((row) => {
    const invoice = data.purchaseInvoices?.find((x) => x.id === row.billId);
    const supplier = data.suppliers?.find((x) => x.id === row.supplierId);
    stamp(row, invoice?.entityId || supplier?.entityId || defaultEntityId, invoice?.siteId || null);
  });
  (data.receipts || []).forEach((row) => {
    const invoice = data.salesInvoices?.find((x) => x.id === row.invoiceId);
    stamp(row, invoice?.entityId || defaultEntityId, invoice?.siteId || null);
  });
  (data.supplierPayments || []).forEach((row) => {
    const invoice = data.purchaseInvoices?.find((x) => x.id === row.invoiceId);
    const supplier = data.suppliers?.find((x) => x.id === row.supplierId);
    stamp(row, invoice?.entityId || supplier?.entityId || defaultEntityId, invoice?.siteId || null);
  });
  (data.salesCreditNotes || []).forEach((row) => stamp(row, row.entityId || data.salesReturns?.find((x) => x.id === row.salesReturnId)?.entityId || defaultEntityId, row.siteId || null));
  (data.purchaseDebitNotes || []).forEach((row) => stamp(row, row.entityId || data.purchaseReturns?.find((x) => x.id === row.purchaseReturnId)?.entityId || defaultEntityId, row.siteId || null));
  (data.replenishmentOrders || []).forEach((row) => {
    const destination = warehouseScope(data, row.toWarehouseId);
    stamp(row, row.entityId || destination.entityId, row.siteId || destination.siteId);
  });
  (data.recallCases || []).forEach((row) => stamp(row, row.entityId || defaultEntityId, row.siteId || defaultSiteId));
  (data.journals || []).forEach((row) => stamp(row, row.entityId || defaultEntityId, row.siteId || defaultSiteId));

  const periodMap = new Map();
  (data.accountingPeriods || []).forEach((row) => {
    const legacy = !row.entityId;
    const entityId = row.entityId || defaultEntityId;
    const normalized = {
      ...row,
      id: legacy ? `PER-${entityId.replace('ENT-', '')}-${row.year}-${String(row.month).padStart(2, '0')}` : row.id,
      entityId
    };
    const key = `${entityId}|${row.year}|${row.month}`;
    if (!periodMap.has(key)) periodMap.set(key, normalized);
  });
  data.accountingPeriods = [...periodMap.values()];

  return data;
}

function normalizeData(saved) {
  const seed = clone(coreSeed);
  const source = saved && typeof saved === 'object' ? saved : {};
  const merged = {
    ...seed,
    ...source,
    consolidationGroups: enrichRows(source.consolidationGroups, seed.consolidationGroups),
    legalEntities: enrichRows(source.legalEntities, seed.legalEntities),
    sites: enrichRows(source.sites, seed.sites),
    users: enrichRows(source.users, seed.users),
    permissionCatalog: enrichRows(source.permissionCatalog, seed.permissionCatalog),
    roles: enrichRows(source.roles, seed.roles),
    userRoleAssignments: mergeMissing(source.userRoleAssignments, seed.userRoleAssignments),
    approvalPolicies: enrichRows(source.approvalPolicies, seed.approvalPolicies),
    approvalRequests: mergeMissing(source.approvalRequests, seed.approvalRequests),
    approvalDelegations: mergeMissing(source.approvalDelegations, seed.approvalDelegations),
    documentNumberRules: enrichRows(source.documentNumberRules, seed.documentNumberRules),
    documentControlPolicies: enrichRows(source.documentControlPolicies, seed.documentControlPolicies),
    systemPolicies: enrichRows(source.systemPolicies, seed.systemPolicies),
    auditEvents: mergeMissing(source.auditEvents, seed.auditEvents),
    notifications: mergeMissing(source.notifications, seed.notifications),
    loginSessions: mergeMissing(source.loginSessions, seed.loginSessions),
    entityAccess: mergeMissing(source.entityAccess, seed.entityAccess, (row) => `${row?.userId}|${row?.entityId}`),
    customers: enrichRows(source.customers, seed.customers),
    items: enrichRows(source.items, seed.items),
    warehouses: enrichRows(source.warehouses, seed.warehouses),
    inventory: enrichRows(source.inventory, seed.inventory, (row) => `${row?.warehouseId}|${row?.sku}`),
    salesOrders: enrichRows(source.salesOrders, seed.salesOrders),
    pickings: enrichRows(source.pickings, seed.pickings),
    deliveryOrders: enrichRows(source.deliveryOrders, seed.deliveryOrders),
    shipments: enrichRows(source.shipments, seed.shipments),
    stockMovements: mergeMissing(source.stockMovements, seed.stockMovements),
    warehouseLocations: mergeMissing(source.warehouseLocations, seed.warehouseLocations),
    lotBalances: mergeMissing(source.lotBalances, seed.lotBalances),
    stockTransfers: mergeMissing(source.stockTransfers, seed.stockTransfers),
    stockTakes: mergeMissing(source.stockTakes, seed.stockTakes),
    salesReturns: enrichRows(source.salesReturns, seed.salesReturns),
    purchaseReturns: enrichRows(source.purchaseReturns, seed.purchaseReturns),
    salesCreditNotes: mergeMissing(source.salesCreditNotes, seed.salesCreditNotes),
    purchaseDebitNotes: mergeMissing(source.purchaseDebitNotes, seed.purchaseDebitNotes),
    replenishmentOrders: enrichRows(source.replenishmentOrders, seed.replenishmentOrders),
    qualityCases: enrichRows(source.qualityCases, seed.qualityCases),
    recallCases: enrichRows(source.recallCases, seed.recallCases),
    accountingPeriods: mergeMissing(source.accountingPeriods, seed.accountingPeriods),
    chartOfAccounts: mergeMissing(source.chartOfAccounts, seed.chartOfAccounts, 'code'),
    bankAccounts: enrichRows(source.bankAccounts, seed.bankAccounts),
    salesInvoices: enrichRows(source.salesInvoices, seed.salesInvoices),
    arOpenItems: enrichRows(source.arOpenItems, seed.arOpenItems),
    apOpenItems: enrichRows(source.apOpenItems, seed.apOpenItems),
    receipts: mergeMissing(source.receipts, seed.receipts),
    journals: mergeMissing(source.journals, seed.journals),
    suppliers: enrichRows(source.suppliers, seed.suppliers),
    purchaseRequests: enrichRows(source.purchaseRequests, seed.purchaseRequests),
    rfqs: enrichRows(source.rfqs, seed.rfqs),
    purchaseOrders: enrichRows(source.purchaseOrders, seed.purchaseOrders),
    receivings: enrichRows(source.receivings, seed.receivings),
    purchaseInvoices: enrichRows(source.purchaseInvoices, seed.purchaseInvoices),
    supplierPayments: mergeMissing(source.supplierPayments, seed.supplierPayments),
    paymentRuns: mergeMissing(source.paymentRuns, seed.paymentRuns),
    intercompanyTransactions: enrichRows(source.intercompanyTransactions, seed.intercompanyTransactions),
    consolidationRuns: mergeMissing(source.consolidationRuns, seed.consolidationRuns)
  };
  const normalized = applyEnterpriseDefaults(merged);
  bootstrapPendingApprovalRequests(normalized);
  return normalized;
}

function loadInitial() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeData(JSON.parse(saved));
  } catch (_) {
    // Browser storage can be blocked. Seed data remains usable in-memory.
  }
  return normalizeData(null);
}

function loadScope() {
  try {
    const saved = JSON.parse(localStorage.getItem(SCOPE_STORAGE_KEY) || 'null');
    if (saved?.mode && saved?.entityId) return { ...DEFAULT_SCOPE, ...saved };
  } catch (_) {}
  return { ...DEFAULT_SCOPE };
}

function scopedView(data, scope) {
  if (!data) return data;
  if (scope.mode === 'GROUP') return data;
  const entityId = scope.entityId;
  const siteId = scope.siteId;
  const entityRows = (rows = []) => rows.filter((row) => !row.entityId || row.entityId === entityId);
  const scopedRows = (rows = []) => entityRows(rows).filter((row) => siteId === 'ALL' || !row.siteId || row.siteId === siteId);
  const warehouseIds = new Set((data.warehouses || []).filter((row) => row.entityId === entityId && (siteId === 'ALL' || row.siteId === siteId)).map((row) => row.id));
  const warehouseLinked = (rows = [], key = 'warehouseId') => rows.filter((row) => {
    if (row.entityId && row.entityId !== entityId) return false;
    if (siteId === 'ALL') return !row.entityId || row.entityId === entityId;
    const warehouseId = row[key];
    return !warehouseId ? (!row.siteId || row.siteId === siteId) : warehouseIds.has(warehouseId);
  });
  return {
    ...data,
    consolidationGroups: data.consolidationGroups || [],
    legalEntities: data.legalEntities || [],
    sites: (data.sites || []).filter((row) => row.entityId === entityId),
    users: data.users || [],
    permissionCatalog: data.permissionCatalog || [],
    roles: data.roles || [],
    userRoleAssignments: (data.userRoleAssignments || []).filter((row) => !row.entityId || row.entityId === entityId),
    approvalPolicies: (data.approvalPolicies || []).filter((row) => row.entityId === 'ALL' || row.entityId === entityId),
    approvalRequests: scopedRows(data.approvalRequests),
    approvalDelegations: (data.approvalDelegations || []).filter((row) => row.entityId === 'ALL' || row.entityId === entityId),
    documentNumberRules: (data.documentNumberRules || []).filter((row) => row.entityId === 'ALL' || row.entityId === entityId),
    documentControlPolicies: data.documentControlPolicies || [],
    systemPolicies: data.systemPolicies || [],
    auditEvents: scopedRows(data.auditEvents),
    notifications: scopedRows(data.notifications),
    loginSessions: data.loginSessions || [],
    customers: entityRows(data.customers),
    suppliers: entityRows(data.suppliers),
    items: data.items || [],
    chartOfAccounts: data.chartOfAccounts || [],
    warehouses: warehouseLinked(data.warehouses, 'id'),
    inventory: warehouseLinked(data.inventory),
    salesOrders: warehouseLinked(data.salesOrders),
    pickings: warehouseLinked(data.pickings),
    deliveryOrders: warehouseLinked(data.deliveryOrders),
    shipments: warehouseLinked(data.shipments),
    stockMovements: warehouseLinked(data.stockMovements),
    warehouseLocations: warehouseLinked(data.warehouseLocations),
    lotBalances: warehouseLinked(data.lotBalances),
    stockTransfers: (data.stockTransfers || []).filter((row) => row.entityId === entityId && (siteId === 'ALL' || row.siteId === siteId || row.toSiteId === siteId)),
    stockTakes: warehouseLinked(data.stockTakes),
    salesReturns: warehouseLinked(data.salesReturns),
    purchaseReturns: warehouseLinked(data.purchaseReturns),
    salesCreditNotes: scopedRows(data.salesCreditNotes),
    purchaseDebitNotes: scopedRows(data.purchaseDebitNotes),
    replenishmentOrders: (data.replenishmentOrders || []).filter((row) => row.entityId === entityId && (siteId === 'ALL' || row.siteId === siteId || row.toSiteId === siteId)),
    qualityCases: warehouseLinked(data.qualityCases),
    recallCases: scopedRows(data.recallCases),
    accountingPeriods: entityRows(data.accountingPeriods),
    bankAccounts: scopedRows(data.bankAccounts),
    salesInvoices: scopedRows(data.salesInvoices),
    arOpenItems: scopedRows(data.arOpenItems),
    apOpenItems: scopedRows(data.apOpenItems),
    receipts: scopedRows(data.receipts),
    journals: scopedRows(data.journals),
    purchaseRequests: warehouseLinked(data.purchaseRequests),
    rfqs: scopedRows(data.rfqs),
    purchaseOrders: warehouseLinked(data.purchaseOrders),
    receivings: warehouseLinked(data.receivings),
    purchaseInvoices: scopedRows(data.purchaseInvoices),
    supplierPayments: scopedRows(data.supplierPayments),
    intercompanyTransactions: (data.intercompanyTransactions || []).filter((row) => row.fromEntityId === entityId || row.toEntityId === entityId),
    consolidationRuns: (data.consolidationRuns || []).filter((row) => row.groupId === scope.groupId)
  };
}

function paymentTermDays(term = '') {
  const match = String(term).match(/(\d+)/);
  return match ? Number(match[1]) : 0;
}

function addDays(date, days) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + Number(days || 0));
  return value.toISOString().slice(0, 10);
}

function journalTotals(journal) {
  return (journal.lines || []).reduce((acc, line) => ({ debit: acc.debit + Number(line.debit || 0), credit: acc.credit + Number(line.credit || 0) }), { debit: 0, credit: 0 });
}

function findPeriod(data, date, entityId, requiredStatus = null) {
  return (data.accountingPeriods || []).find((row) => row.entityId === entityId && date >= row.startDate && date <= row.endDate && (!requiredStatus || row.status === requiredStatus));
}

function entitySiteFromWarehouse(data, warehouseId) {
  const warehouse = data.warehouses.find((row) => row.id === warehouseId);
  return { entityId: warehouse?.entityId || 'ENT-NDU', siteId: warehouse?.siteId || null };
}

function inventoryAvailable(stock) {
  return Math.max(0, Number(stock?.onHand || 0) - Number(stock?.reserved || 0) - Number(stock?.qualityHold || 0));
}

function appendAudit(order, action, by = 'Febrian Administrator') {
  order.audit = [...(order.audit || []), { at: nowIso(), by, action }];
}

function pushAuditEvent(data, payload) {
  const date = new Date();
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const prefix = `AUD-${yy}${mm}-`;
  const max = (data.auditEvents || []).reduce((acc, row) => {
    if (!String(row.id || '').startsWith(prefix)) return acc;
    const n = Number(String(row.id).split('-').at(-1));
    return Number.isFinite(n) ? Math.max(acc, n) : acc;
  }, 0);
  const id = `${prefix}${String(max + 1).padStart(4, '0')}`;
  const user = (data.users || []).find((row) => row.id === payload.userId);
  data.auditEvents = data.auditEvents || [];
  data.auditEvents.unshift({
    id,
    at: nowIso(),
    userId: payload.userId || CURRENT_USER_ID,
    userName: payload.userName || user?.name || 'System',
    entityId: payload.entityId || null,
    siteId: payload.siteId || null,
    module: payload.module || 'System',
    documentType: payload.documentType || '',
    documentId: payload.documentId || '',
    action: payload.action || 'UPDATE',
    field: payload.field || '',
    oldValue: payload.oldValue === undefined ? '' : String(payload.oldValue),
    newValue: payload.newValue === undefined ? '' : String(payload.newValue),
    severity: payload.severity || 'Info'
  });
  return id;
}

function pushNotification(data, payload) {
  data.notifications = data.notifications || [];
  const id = `NTF-${String(data.notifications.length + 1).padStart(4, '0')}`;
  data.notifications.unshift({
    id,
    userId: payload.userId || CURRENT_USER_ID,
    entityId: payload.entityId || null,
    siteId: payload.siteId || null,
    type: payload.type || 'System',
    title: payload.title || 'ERP notification',
    message: payload.message || '',
    link: payload.link || '/',
    createdAt: nowIso(),
    readAt: null,
    priority: payload.priority || 'Medium'
  });
  return id;
}

function roleAssignmentsFor(data, userId, entityId, siteId = 'ALL') {
  return (data.userRoleAssignments || []).filter((row) => {
    if (row.userId !== userId || row.status !== 'Active') return false;
    if (entityId && row.entityId && row.entityId !== entityId) return false;
    if (!row.siteIds?.length || row.siteIds.includes('ALL') || siteId === 'ALL' || !siteId) return true;
    return row.siteIds.includes(siteId);
  });
}

function userHasPermission(data, userId, permission, entityId, siteId = 'ALL') {
  const roleIds = new Set(roleAssignmentsFor(data, userId, entityId, siteId).map((row) => row.roleId));
  return (data.roles || []).some((role) => roleIds.has(role.id) && (role.permissions || []).some((value) => value === '*' || value === permission));
}

function userHasRole(data, userId, roleId, entityId, siteId = 'ALL') {
  return roleAssignmentsFor(data, userId, entityId, siteId).some((row) => row.roleId === roleId || (data.roles || []).find((role) => role.id === row.roleId)?.permissions?.includes('*'));
}

function userCanOverrideSod(data, userId, entityId, siteId = 'ALL') {
  return userHasPermission(data, userId, 'approval.override_sod', entityId, siteId) || roleAssignmentsFor(data, userId, entityId, siteId).some((assignment) => (data.roles || []).find((role) => role.id === assignment.roleId)?.sodOverride);
}

function activeDelegationForRole(data, userId, roleId, entityId, date = new Date().toISOString().slice(0, 10)) {
  return (data.approvalDelegations || []).find((row) => row.status === 'Active' && row.toUserId === userId && row.roleId === roleId && (row.entityId === 'ALL' || row.entityId === entityId) && date >= row.startDate && date <= row.endDate);
}

function matchingApprovalPolicy(data, documentType, entityId, amount) {
  const numeric = Number(amount || 0);
  return (data.approvalPolicies || []).filter((row) => row.status === 'Active' && row.documentType === documentType && (row.entityId === 'ALL' || row.entityId === entityId) && numeric >= Number(row.minAmount || 0) && (row.maxAmount === null || row.maxAmount === undefined || numeric <= Number(row.maxAmount))).sort((a, b) => Number(b.minAmount || 0) - Number(a.minAmount || 0))[0] || null;
}

function notifyApprovalRole(data, request, step) {
  const directUsers = (data.userRoleAssignments || []).filter((row) => row.status === 'Active' && row.roleId === step.roleId && row.entityId === request.entityId).map((row) => row.userId);
  const delegatedUsers = (data.approvalDelegations || []).filter((row) => row.status === 'Active' && row.roleId === step.roleId && (row.entityId === 'ALL' || row.entityId === request.entityId)).map((row) => row.toUserId);
  [...new Set([...directUsers, ...delegatedUsers])].forEach((userId) => pushNotification(data, {
    userId,
    entityId: request.entityId,
    siteId: request.siteId,
    type: 'Approval',
    title: `${request.documentType.replaceAll('_', ' ')} menunggu approval`,
    message: `${request.documentId} · step ${step.sequence} ${step.label || step.roleId}`,
    link: '/approvals',
    priority: Number(request.amount || 0) >= 100000000 ? 'High' : 'Medium'
  }));
}

function createApprovalRequestInData(data, payload) {
  const existing = (data.approvalRequests || []).find((row) => row.documentType === payload.documentType && row.documentId === payload.documentId && ['Pending', 'Approved'].includes(row.status));
  if (existing) return existing;
  const policy = matchingApprovalPolicy(data, payload.documentType, payload.entityId, payload.amount);
  if (!policy) return null;
  const id = docSequence('APR', data.approvalRequests || []);
  const steps = (policy.steps || []).map((step) => ({ ...step, status: 'Pending', actedByUserId: null, actedAt: null, note: '' }));
  const request = {
    id,
    documentType: payload.documentType,
    documentId: payload.documentId,
    entityId: payload.entityId,
    siteId: payload.siteId || null,
    amount: Number(payload.amount || 0),
    makerUserId: payload.makerUserId || CURRENT_USER_ID,
    policyId: policy.id,
    status: 'Pending',
    currentStep: steps[0]?.sequence || 1,
    submittedAt: nowIso(),
    completedAt: null,
    rejectionReason: '',
    steps
  };
  data.approvalRequests = data.approvalRequests || [];
  data.approvalRequests.unshift(request);
  if (steps[0]) notifyApprovalRole(data, request, steps[0]);
  pushAuditEvent(data, { userId: request.makerUserId, entityId: request.entityId, siteId: request.siteId, module: 'Approval', documentType: request.documentType, documentId: request.documentId, action: 'SUBMIT', oldValue: 'Draft', newValue: 'Pending Approval', severity: 'Info' });
  return request;
}

function bootstrapPendingApprovalRequests(data) {
  (data.salesOrders || []).filter((row) => ['Pending Approval','Credit Hold'].includes(row.status)).forEach((row) => {
    createApprovalRequestInData(data, { documentType: row.status === 'Credit Hold' ? 'CREDIT_OVERRIDE' : 'SALES_ORDER', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: soTotal(row), makerUserId: 'USR-RINA' });
  });
  (data.purchaseRequests || []).filter((row) => row.status === 'Pending Approval').forEach((row) => createApprovalRequestInData(data, { documentType: 'PURCHASE_REQUEST', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: (row.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.estimatedCost || 0), 0), makerUserId: 'USR-ANITA' }));
  (data.purchaseOrders || []).filter((row) => row.status === 'Pending Approval').forEach((row) => createApprovalRequestInData(data, { documentType: 'PURCHASE_ORDER', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: (row.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0), makerUserId: 'USR-ANITA' }));
  (data.stockTakes || []).filter((row) => row.status === 'Pending Approval').forEach((row) => createApprovalRequestInData(data, { documentType: 'STOCK_TAKE', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: (row.lines || []).reduce((sum, line) => sum + Math.abs(Number(line.variance || 0) * Number(line.unitCost || 0)), 0), makerUserId: 'USR-RAKA' }));
  (data.salesReturns || []).filter((row) => row.status === 'Pending Approval').forEach((row) => createApprovalRequestInData(data, { documentType: 'SALES_RETURN', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: (row.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0) * (1 + Number(line.taxRate || 0) / 100), 0), makerUserId: 'USR-RINA' }));
  (data.purchaseReturns || []).filter((row) => row.status === 'Pending Approval').forEach((row) => createApprovalRequestInData(data, { documentType: 'PURCHASE_RETURN', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount: (row.lines || []).reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0) * (1 + Number(line.taxRate || 0) / 100), 0), makerUserId: 'USR-ANITA' }));
  return data;
}

function finalizeApprovedDocument(data, request, actedByName) {
  if (request.documentType === 'SALES_ORDER' || request.documentType === 'CREDIT_OVERRIDE') {
    const row = data.salesOrders.find((item) => item.id === request.documentId);
    if (row) {
      const wasCredit = request.documentType === 'CREDIT_OVERRIDE' || row.status === 'Credit Hold';
      row.status = 'Approved';
      row.approvalStatus = wasCredit ? 'Credit Override Approved' : 'Approved';
      appendAudit(row, 'Governed approval selesai dan order siap stock allocation', actedByName);
    }
  }
  if (request.documentType === 'PURCHASE_REQUEST') {
    const row = data.purchaseRequests.find((item) => item.id === request.documentId);
    if (row) {
      row.status = 'Approved'; row.approvalStatus = 'Approved';
      row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: 'Governed Purchase Request approval selesai' }];
    }
  }
  if (request.documentType === 'PURCHASE_ORDER') {
    const row = data.purchaseOrders.find((item) => item.id === request.documentId);
    if (row) {
      row.status = 'Approved'; row.approvalStatus = 'Approved';
      row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: 'Governed Purchase Order approval selesai dan siap receiving' }];
    }
  }
  if (request.documentType === 'STOCK_TAKE') {
    const row = data.stockTakes.find((item) => item.id === request.documentId);
    if (row) {
      row.status = 'Approved'; row.approvedBy = actedByName;
      row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: 'Governed stock take variance approval selesai' }];
    }
  }
  if (request.documentType === 'SALES_RETURN') {
    const row = data.salesReturns.find((item) => item.id === request.documentId);
    if (row) {
      row.status = 'Approved'; row.approvalStatus = 'Approved';
      row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: 'Governed sales return approval selesai; siap receive ke quarantine' }];
    }
  }
  if (request.documentType === 'PURCHASE_RETURN') {
    const row = data.purchaseReturns.find((item) => item.id === request.documentId);
    if (row) {
      row.status = 'Approved'; row.approvalStatus = 'Approved';
      row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: 'Governed purchase return approval selesai; siap release ke supplier' }];
    }
  }
}

function governedDocumentNumber(data, documentType, entityId, siteId, date, fallbackCode) {
  const rule = (data.documentNumberRules || []).find((row) => row.status === 'Active' && row.documentType === documentType && (row.entityId === 'ALL' || row.entityId === entityId) && (row.siteId === 'ALL' || row.siteId === siteId));
  if (!rule) return null;
  const documentDate = date || new Date().toISOString().slice(0, 10);
  const [year, month] = documentDate.split('-');
  const period = rule.reset === 'YEARLY' ? year : rule.reset === 'NEVER' ? 'ALL' : `${year}-${month}`;
  if (rule.lastPeriod !== period) {
    rule.lastPeriod = period;
    rule.lastNumber = 0;
  }
  rule.lastNumber = Number(rule.lastNumber || 0) + 1;
  const entity = (data.legalEntities || []).find((row) => row.id === entityId);
  const site = (data.sites || []).find((row) => row.id === siteId);
  const seq = String(rule.lastNumber).padStart(6, '0');
  return String(rule.template || '{ENTITY}-{SITE}-{DOC}-{YY}{MM}-{SEQ6}')
    .replaceAll('{ENTITY}', entity?.code || 'ENT')
    .replaceAll('{SITE}', site?.code || 'ALL')
    .replaceAll('{DOC}', rule.code || fallbackCode || documentType)
    .replaceAll('{YYYY}', year)
    .replaceAll('{YY}', year.slice(-2))
    .replaceAll('{MM}', month)
    .replaceAll('{SEQ6}', seq);
}

function documentLockState(data, documentType, document) {
  const policy = (data.documentControlPolicies || []).find((row) => row.status === 'Active' && row.documentType === documentType);
  if (!policy || !document) return { locked: false, reason: '', correctionMode: policy?.correctionMode || null };
  const statusLocked = (policy.lockedStatuses || []).includes(document.status);
  const postingLocked = policy.postingField && (policy.postingValues || []).includes(document[policy.postingField]);
  return { locked: Boolean(statusLocked || postingLocked), reason: statusLocked ? `Status ${document.status}` : postingLocked ? `${policy.postingField} ${document[policy.postingField]}` : '', correctionMode: policy.correctionMode || null };
}

export function ERPDataProvider({ children }) {
  const [data, setData] = useState(loadInitial);
  const [scope, setScopeState] = useState(loadScope);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
  }, [data]);

  useEffect(() => {
    try { localStorage.setItem(SCOPE_STORAGE_KEY, JSON.stringify(scope)); } catch (_) {}
  }, [scope]);

  const currentUser = data.users.find((row) => row.id === CURRENT_USER_ID) || { id: CURRENT_USER_ID, name: 'Febrian Administrator', status: 'Active' };
  const accessRows = data.entityAccess.filter((row) => row.userId === CURRENT_USER_ID);
  const accessibleEntityIds = new Set(accessRows.length ? accessRows.map((row) => row.entityId) : data.legalEntities.map((row) => row.id));
  const accessibleEntities = data.legalEntities.filter((row) => accessibleEntityIds.has(row.id));
  const currentEntity = accessibleEntities.find((row) => row.id === scope.entityId) || accessibleEntities[0] || data.legalEntities[0];
  const entityAccess = accessRows.find((row) => row.entityId === currentEntity?.id);
  const currentSites = data.sites.filter((row) => row.entityId === currentEntity?.id && (!entityAccess?.siteIds?.length || entityAccess.siteIds.includes(row.id)));
  const currentSite = scope.siteId === 'ALL' ? null : currentSites.find((row) => row.id === scope.siteId) || null;
  const effectiveScope = scope.mode === 'ENTITY' && currentEntity?.id && scope.entityId !== currentEntity.id ? { ...scope, entityId: currentEntity.id, siteId: 'ALL' } : scope;
  const scopedData = useMemo(() => scopedView(data, effectiveScope), [data, effectiveScope]);

  useEffect(() => {
    if (scope.mode === 'ENTITY' && currentEntity?.id && scope.entityId !== currentEntity.id) {
      setScopeState((prev) => ({ ...prev, entityId: currentEntity.id, siteId: 'ALL' }));
    }
  }, [scope.mode, scope.entityId, currentEntity?.id]);

  const setEntityScope = (entityId) => {
    const entity = data.legalEntities.find((row) => row.id === entityId);
    if (!entity || !accessibleEntityIds.has(entityId)) return false;
    setScopeState((prev) => ({ ...prev, mode: 'ENTITY', groupId: entity.groupId || prev.groupId, entityId, siteId: 'ALL' }));
    return true;
  };
  const setSiteScope = (siteId) => {
    if (siteId !== 'ALL' && !currentSites.some((row) => row.id === siteId)) return false;
    setScopeState((prev) => ({ ...prev, mode: 'ENTITY', entityId: currentEntity?.id || prev.entityId, siteId }));
    return true;
  };
  const setGroupScope = (groupId = scope.groupId) => {
    if (!data.consolidationGroups.some((row) => row.id === groupId)) return false;
    setScopeState((prev) => ({ ...prev, mode: 'GROUP', groupId, siteId: 'ALL' }));
    return true;
  };

  const currentRoleAssignments = data.userRoleAssignments.filter((row) => row.userId === CURRENT_USER_ID && row.status === 'Active');
  const currentRoles = data.roles.filter((role) => currentRoleAssignments.some((row) => row.roleId === role.id));
  const hasPermission = (permission, entityId = currentEntity?.id || scope.entityId, siteId = currentSite?.id || scope.siteId) => userHasPermission(data, CURRENT_USER_ID, permission, entityId, siteId || 'ALL');
  const getDocumentLockState = (documentType, document) => documentLockState(data, documentType, document);

  const resetDemo = () => setData(normalizeData(null));

  const addCustomer = (payload) => {
    const next = clone(data);
    const id = `CUS-${String(next.customers.length + 1).padStart(3, '0')}`;
    const code = payload.code || `CUST-${String(next.customers.length + 1).padStart(3, '0')}`;
    next.customers.unshift({ id, code, entityId: payload.entityId || currentEntity?.id || scope.entityId, status: 'Active', creditUsed: 0, ...payload });
    setData(next);
    return id;
  };


  const addSupplier = (payload) => {
    const next = clone(data);
    const id = `SUP-${String(next.suppliers.length + 1).padStart(3, '0')}`;
    const code = payload.code || id;
    next.suppliers.unshift({ id, code, entityId: payload.entityId || currentEntity?.id || scope.entityId, status: 'Active', rating: 'B', leadTimeDays: 5, ...payload });
    setData(next);
    return id;
  };

  const addWarehouse = (payload) => {
    const next = clone(data);
    const entityId = payload.entityId || currentEntity?.id || scope.entityId;
    const siteId = payload.siteId || (scope.mode === 'ENTITY' && scope.siteId !== 'ALL' ? scope.siteId : next.sites.find((row) => row.entityId === entityId)?.id);
    const site = next.sites.find((row) => row.id === siteId);
    if (!entityId || !siteId || site?.entityId !== entityId) return null;
    const id = `WH-${String(next.warehouses.length + 1).padStart(3, '0')}`;
    next.warehouses.unshift({ id, entityId, siteId, site: site.code, defaultLocation: 'GENERAL', ...payload });
    next.items.forEach((item) => next.inventory.push({ warehouseId: id, entityId, siteId, sku: item.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: Number(item.standardCost || 0) }));
    const locationId = `LOC-${String(next.warehouseLocations.length + 1).padStart(4, '0')}`;
    next.warehouseLocations.unshift({ id: locationId, warehouseId: id, entityId, siteId, code: 'GENERAL', type: 'Storage', zone: 'General', pickPriority: 1, status: 'Active' });
    setData(next);
    return id;
  };

  const addWarehouseLocation = (payload) => {
    const next = clone(data);
    if (!payload?.warehouseId || !payload?.code) return null;
    const exists = next.warehouseLocations.some((row) => row.warehouseId === payload.warehouseId && String(row.code).toLowerCase() === String(payload.code).toLowerCase());
    if (exists) return null;
    const warehouse = next.warehouses.find((row) => row.id === payload.warehouseId);
    if (!warehouse) return null;
    const id = `LOC-${String(next.warehouseLocations.length + 1).padStart(4, '0')}`;
    next.warehouseLocations.unshift({ id, entityId: warehouse.entityId, siteId: warehouse.siteId, type: 'Storage', zone: 'General', status: 'Active', ...payload, pickPriority: Number(payload.pickPriority || 999) });
    setData(next);
    return id;
  };

  const addItem = (payload) => {
    const next = clone(data);
    const id = `ITM-${String(next.items.length + 1).padStart(3, '0')}`;
    next.items.unshift({ id, status: 'Active', taxRate: 11, reorderPoint: 0, maxStock: 0, ...payload });
    next.warehouses.forEach((wh) => {
      next.inventory.push({ warehouseId: wh.id, entityId: wh.entityId, siteId: wh.siteId, sku: payload.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: Number(payload.standardCost || 0) });
    });
    setData(next);
    return id;
  };

  const adjustStock = ({ warehouseId, sku, qty, reason = 'Manual adjustment' }) => {
    const next = clone(data);
    const delta = Number(qty || 0);
    if (!warehouseId || !sku || !delta) return null;
    const date = new Date().toISOString().slice(0, 10);
    const warehouseScope = entitySiteFromWarehouse(next, warehouseId);
    if (scope.mode === 'ENTITY' && warehouseScope.entityId !== scope.entityId) return null;
    const period = findPeriod(next, date, warehouseScope.entityId, 'Open');
    if (!period) return null;
    const item = next.items.find((row) => row.sku === sku);
    let row = next.inventory.find((itemRow) => itemRow.warehouseId === warehouseId && itemRow.sku === sku);
    if (!row) {
      row = { warehouseId, entityId: warehouseScope.entityId, siteId: warehouseScope.siteId, sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: Number(item?.standardCost || 0) };
      next.inventory.push(row);
    }
    const before = Number(row.onHand || 0);
    const removable = Math.max(0, before - Number(row.reserved || 0) - Number(row.qualityHold || 0));
    const applied = delta < 0 ? -Math.min(removable, Math.abs(delta)) : delta;
    if (!applied) return null;
    row.onHand = Math.max(0, before + applied);
    const unitCost = Number(row.avgCost || item?.standardCost || 0);
    const amount = Math.round(Math.abs(applied) * unitCost);
    const id = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
    next.stockMovements.unshift({ id, entityId: warehouseScope.entityId, siteId: warehouseScope.siteId, at: nowIso(), type: applied >= 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT', warehouseId, sku, qty: applied, unitCost, value: applied * unitCost, balanceAfter: row.onHand, ref: reason });
    if (amount > 0) {
      const journalId = docSequence('JV', next.journals);
      const lines = applied > 0
        ? [
            { account: '120100', accountName: 'Merchandise Inventory', debit: amount, credit: 0 },
            { account: '419900', accountName: 'Inventory Adjustment Gain', debit: 0, credit: amount }
          ]
        : [
            { account: '519900', accountName: 'Inventory Adjustment Loss', debit: amount, credit: 0 },
            { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: amount }
          ];
      next.journals.unshift({ id: journalId, entityId: warehouseScope.entityId, siteId: warehouseScope.siteId, date, source: 'Inventory Adjustment', reference: id, status: 'Posted', description: `${reason} · ${sku}`, lines });
    }
    setData(next);
    return id;
  };

  const createSalesOrder = (payload) => {
    const next = clone(data);
    const customer = next.customers.find((row) => row.id === payload.customerId);
    const warehouse = next.warehouses.find((row) => row.id === payload.warehouseId);
    if (!customer || !warehouse || customer.entityId !== warehouse.entityId) return null;
    if (scope.mode === 'ENTITY' && warehouse.entityId !== scope.entityId) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'sales.create', warehouse.entityId, warehouse.siteId)) return null;
    const id = docSequence('SO', next.salesOrders);
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'SALES_ORDER', warehouse.entityId, warehouse.siteId, date, 'SO');
    const order = {
      id,
      documentNo,
      entityId: warehouse.entityId,
      siteId: warehouse.siteId,
      customerId: payload.customerId,
      warehouseId: payload.warehouseId,
      date,
      requestedDate: payload.requestedDate,
      owner: payload.owner || 'Febrian Administrator',
      notes: payload.notes || '',
      discount: Number(payload.discount || 0),
      status: 'Draft',
      approvalStatus: 'Not Submitted',
      lines: payload.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), price: Number(line.price), allocated: 0, picked: 0, shipped: 0 })),
      related: {},
      audit: [{ at: nowIso(), by: payload.owner || 'Febrian Administrator', action: 'Sales order dibuat sebagai Draft' }]
    };
    next.salesOrders.unshift(order);
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: order.entityId, siteId: order.siteId, module: 'Sales', documentType: 'SALES_ORDER', documentId: order.id, action: 'CREATE', oldValue: '', newValue: documentNo || order.id });
    setData(next);
    return id;
  };

  const submitSalesOrder = (id) => {
    const next = clone(data);
    const order = next.salesOrders.find((item) => item.id === id);
    if (!order || order.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'sales.edit', order.entityId, order.siteId)) return false;
    const customer = next.customers.find((item) => item.id === order.customerId);
    const availableCredit = Math.max(0, Number(customer?.creditLimit || 0) - Number(customer?.creditUsed || 0));
    const total = soTotal(order);
    const creditHold = customer?.paymentTerm !== 'COD' && total > availableCredit;
    order.status = creditHold ? 'Credit Hold' : 'Pending Approval';
    order.approvalStatus = creditHold ? 'Pending Credit Override' : 'Pending';
    const approval = createApprovalRequestInData(next, { documentType: creditHold ? 'CREDIT_OVERRIDE' : 'SALES_ORDER', documentId: order.id, entityId: order.entityId, siteId: order.siteId, amount: total, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    order.related = { ...(order.related || {}), approvalRequest: approval.id, ...(creditHold ? { creditApproval: approval.id } : {}) };
    appendAudit(order, creditHold ? `Credit hold otomatis dan ${approval.id} dibuat` : `Order disubmit melalui ${approval.id}`);
    setData(next);
    return true;
  };

  const approveSalesOrder = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && ['SALES_ORDER','CREDIT_OVERRIDE'].includes(row.documentType) && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const reserveSalesOrder = (id) => {
    const next = clone(data);
    const order = next.salesOrders.find((item) => item.id === id);
    if (!order || !['Approved', 'Partially Allocated', 'Allocated'].includes(order.status)) return false;
    let allAllocated = true;
    let changed = false;
    order.lines.forEach((line) => {
      const stock = next.inventory.find((row) => row.warehouseId === order.warehouseId && row.sku === line.sku);
      const available = inventoryAvailable(stock);
      const remaining = Math.max(0, Number(line.qty) - Number(line.allocated || 0));
      const reserve = Math.min(remaining, available);
      if (reserve > 0 && stock) {
        stock.reserved += reserve;
        line.allocated = Number(line.allocated || 0) + reserve;
        changed = true;
      }
      if (Number(line.allocated || 0) < Number(line.qty)) allAllocated = false;
    });
    order.status = allAllocated ? 'Allocated' : 'Partially Allocated';
    appendAudit(order, changed ? `Stock reservation dijalankan: ${allAllocated ? 'full allocation' : 'partial allocation'}` : 'Stock reservation dijalankan tetapi tidak ada stock tersedia');
    setData(next);
    return true;
  };

  const createPickingFromSalesOrder = (salesOrderId) => {
    const next = clone(data);
    const order = next.salesOrders.find((item) => item.id === salesOrderId);
    if (!order) return null;
    const existing = next.pickings.find((item) => item.salesOrderId === salesOrderId && item.status !== 'Cancelled');
    if (existing) return existing.id;
    if (!order.lines.some((line) => Number(line.allocated) > 0)) return null;
    const id = docSequence('PKO', next.pickings);
    const picking = {
      id,
      entityId: order.entityId,
      siteId: order.siteId,
      salesOrderId,
      warehouseId: order.warehouseId,
      status: 'Released',
      createdAt: nowIso(),
      completedAt: null,
      picker: 'Warehouse Team',
      lines: order.lines.filter((line) => Number(line.allocated) > 0).map((line, index) => ({
        sku: line.sku,
        allocatedQty: Number(line.allocated),
        pickedQty: Number(line.picked || 0),
        location: `${String.fromCharCode(65 + index)}-${String(index + 1).padStart(2, '0')}-01`,
        lot: `LOT-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}`
      }))
    };
    next.pickings.unshift(picking);
    order.status = 'Picking';
    order.related.pickingOrder = id;
    appendAudit(order, `Picking Order ${id} dibuat dan direlease`);
    setData(next);
    return id;
  };

  const completePicking = (pickingId) => {
    const next = clone(data);
    const picking = next.pickings.find((item) => item.id === pickingId);
    if (!picking || picking.status === 'Completed') return false;
    picking.lines.forEach((line) => { line.pickedQty = Number(line.allocatedQty); });
    picking.status = 'Completed';
    picking.completedAt = nowIso();
    const order = next.salesOrders.find((item) => item.id === picking.salesOrderId);
    if (order) {
      picking.lines.forEach((pickLine) => {
        const orderLine = order.lines.find((line) => line.sku === pickLine.sku);
        if (orderLine) orderLine.picked = Number(pickLine.pickedQty);
      });
      order.status = order.lines.every((line) => Number(line.picked) >= Number(line.qty)) ? 'Picked' : 'Partially Picked';
      appendAudit(order, `Picking ${picking.id} selesai`,'Warehouse Team');
    }
    setData(next);
    return true;
  };

  const createDeliveryFromPicking = (pickingId) => {
    const next = clone(data);
    const picking = next.pickings.find((item) => item.id === pickingId);
    if (!picking || picking.status !== 'Completed') return null;
    const existing = next.deliveryOrders.find((item) => item.pickingId === pickingId && item.status !== 'Cancelled');
    if (existing) return existing.id;
    const order = next.salesOrders.find((item) => item.id === picking.salesOrderId);
    if (!order) return null;
    const id = docSequence('DO', next.deliveryOrders);
    const delivery = {
      id,
      entityId: order.entityId,
      siteId: order.siteId,
      salesOrderId: order.id,
      pickingId,
      warehouseId: picking.warehouseId,
      customerId: order.customerId,
      status: 'Draft',
      createdAt: nowIso(),
      deliveryDate: order.requestedDate,
      dock: 'Dock 01',
      vehicle: '',
      driver: '',
      lines: picking.lines.map((line) => ({ sku: line.sku, qty: Number(line.pickedQty), lot: line.lot, location: line.location }))
    };
    next.deliveryOrders.unshift(delivery);
    order.related.deliveryOrder = id;
    order.status = 'Delivery Draft';
    appendAudit(order, `Delivery Order ${id} dibuat dari ${pickingId}`,'Warehouse Team');
    setData(next);
    return id;
  };

  const updateDelivery = (id, patch) => {
    const next = clone(data);
    const delivery = next.deliveryOrders.find((item) => item.id === id);
    if (!delivery) return false;
    Object.assign(delivery, patch);
    setData(next);
    return true;
  };

  const setDeliveryStatus = (id, status) => {
    const next = clone(data);
    const delivery = next.deliveryOrders.find((item) => item.id === id);
    if (!delivery) return false;
    delivery.status = status;
    const order = next.salesOrders.find((item) => item.id === delivery.salesOrderId);
    if (order) {
      order.status = status === 'Loaded' ? 'Ready to Ship' : status === 'Delivered' ? 'Delivered' : order.status;
      appendAudit(order, `Delivery Order ${delivery.id}: ${status}`, 'Outbound Team');
    }
    setData(next);
    return true;
  };

  const createShipmentFromDelivery = (deliveryId) => {
    const next = clone(data);
    const delivery = next.deliveryOrders.find((item) => item.id === deliveryId);
    if (!delivery || !['Ready to Load', 'Loading', 'Loaded'].includes(delivery.status)) return null;
    const existing = next.shipments.find((item) => item.deliveryOrderId === deliveryId && item.status !== 'Cancelled');
    if (existing) return existing.id;
    const id = docSequence('SHP', next.shipments);
    const shipment = {
      id,
      entityId: delivery.entityId,
      siteId: delivery.siteId,
      deliveryOrderId: delivery.id,
      salesOrderId: delivery.salesOrderId,
      customerId: delivery.customerId,
      warehouseId: delivery.warehouseId,
      status: 'Planning',
      createdAt: nowIso(),
      dispatchedAt: null,
      deliveredAt: null,
      vehicle: delivery.vehicle || 'Unassigned',
      driver: delivery.driver || 'Unassigned',
      route: 'Route pending',
      pod: null,
      lines: delivery.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), lot: line.lot }))
    };
    next.shipments.unshift(shipment);
    delivery.shipmentId = id;
    delivery.status = 'Shipment Planned';
    const order = next.salesOrders.find((item) => item.id === delivery.salesOrderId);
    if (order) {
      order.related.shipment = id;
      order.status = 'Shipment Planned';
      appendAudit(order, `Shipment ${id} dibuat dari ${delivery.id}`, 'Logistics Team');
    }
    setData(next);
    return id;
  };

  const updateShipment = (id, patch) => {
    const next = clone(data);
    const shipment = next.shipments.find((item) => item.id === id);
    if (!shipment) return false;
    Object.assign(shipment, patch);
    setData(next);
    return true;
  };

  const dispatchShipment = (id) => {
    const next = clone(data);
    const shipment = next.shipments.find((item) => item.id === id);
    if (!shipment || !['Planning', 'Scheduled'].includes(shipment.status)) return false;
    const postingDate = new Date().toISOString().slice(0, 10);
    const shipmentScope = entitySiteFromWarehouse(next, shipment.warehouseId);
    const entityId = shipment.entityId || shipmentScope.entityId;
    const siteId = shipment.siteId || shipmentScope.siteId;
    const period = findPeriod(next, postingDate, entityId, 'Open');
    if (!period) return false;
    const order = next.salesOrders.find((item) => item.id === shipment.salesOrderId);
    let cogsTotal = 0;
    shipment.lines.forEach((line) => {
      const stock = next.inventory.find((row) => row.warehouseId === shipment.warehouseId && row.sku === line.sku);
      const item = next.items.find((row) => row.sku === line.sku);
      const unitCost = Number(stock?.avgCost || item?.standardCost || 0);
      if (stock) {
        stock.onHand = Math.max(0, Number(stock.onHand) - Number(line.qty));
        stock.reserved = Math.max(0, Number(stock.reserved) - Number(line.qty));
      }
      if (line.lot) {
        const lotBalance = next.lotBalances.find((row) => row.warehouseId === shipment.warehouseId && row.sku === line.sku && row.lot === line.lot);
        if (lotBalance) {
          lotBalance.onHand = Math.max(0, Number(lotBalance.onHand || 0) - Number(line.qty));
          lotBalance.reserved = Math.max(0, Number(lotBalance.reserved || 0) - Number(line.qty));
        }
      }
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      const movementValue = -Number(line.qty) * unitCost;
      next.stockMovements.unshift({ id: movementId, entityId, siteId, at: nowIso(), type: 'SHIPMENT_OUT', warehouseId: shipment.warehouseId, sku: line.sku, qty: -Number(line.qty), unitCost, value: movementValue, balanceAfter: Number(stock?.onHand || 0), ref: shipment.id });
      line.unitCost = unitCost;
      line.cogs = Math.round(Number(line.qty) * unitCost);
      cogsTotal += line.cogs;
      const orderLine = order?.lines.find((row) => row.sku === line.sku);
      if (orderLine) orderLine.shipped = Math.min(Number(orderLine.qty), Number(orderLine.shipped || 0) + Number(line.qty));
    });
    if (cogsTotal > 0) {
      const journalId = docSequence('JV', next.journals);
      next.journals.unshift({
        id: journalId,
        entityId,
        siteId,
        date: postingDate,
        source: 'Inventory Issue',
        reference: shipment.id,
        status: 'Posted',
        description: `COGS posting untuk ${shipment.id}`,
        lines: [
          { account: '510100', accountName: 'Cost of Goods Sold', debit: cogsTotal, credit: 0 },
          { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: cogsTotal }
        ]
      });
      shipment.cogsJournalId = journalId;
      shipment.cogsAmount = cogsTotal;
    }
    shipment.status = 'In Transit';
    shipment.dispatchedAt = nowIso();
    const delivery = next.deliveryOrders.find((item) => item.id === shipment.deliveryOrderId);
    if (delivery) delivery.status = 'Dispatched';
    if (order) {
      order.status = order.lines.every((line) => Number(line.shipped) >= Number(line.qty)) ? 'Shipped' : 'Partially Shipped';
      appendAudit(order, `Shipment ${shipment.id} dispatched. Stock ledger dan COGS posted.`, 'Logistics Team');
    }
    setData(next);
    return true;
  };

  const deliverShipment = (id) => {
    const next = clone(data);
    const shipment = next.shipments.find((item) => item.id === id);
    if (!shipment || shipment.status !== 'In Transit') return false;
    shipment.status = 'Delivered';
    shipment.deliveredAt = nowIso();
    shipment.pod = `POD-${shipment.id.replace('SHP-', '')}`;
    const delivery = next.deliveryOrders.find((item) => item.id === shipment.deliveryOrderId);
    if (delivery) delivery.status = 'Delivered';
    const order = next.salesOrders.find((item) => item.id === shipment.salesOrderId);
    if (order) {
      order.status = order.lines.every((line) => Number(line.shipped) >= Number(line.qty)) ? 'Delivered' : 'Partially Delivered';
      appendAudit(order, `${shipment.id} delivered dan POD ${shipment.pod} diterima`, 'Driver / POD');
    }
    setData(next);
    return true;
  };

  const createSalesInvoiceFromOrder = (salesOrderId) => {
    const next = clone(data);
    const order = next.salesOrders.find((item) => item.id === salesOrderId);
    if (!order || !['Delivered', 'Partially Delivered', 'Shipped', 'Partially Shipped'].includes(order.status)) return null;
    const existing = next.salesInvoices.find((item) => item.salesOrderId === salesOrderId && item.status !== 'Cancelled');
    if (existing) return existing.id;
    const customer = next.customers.find((item) => item.id === order.customerId);
    const shipment = next.shipments.find((item) => item.salesOrderId === salesOrderId && item.status === 'Delivered') || next.shipments.find((item) => item.salesOrderId === salesOrderId);
    const lines = order.lines.filter((line) => Number(line.shipped || 0) > 0).map((line) => {
      const item = next.items.find((row) => row.sku === line.sku);
      const qty = Number(line.shipped || 0);
      return { sku: line.sku, description: item?.name || line.sku, qty, price: Number(line.price || item?.price || 0), taxRate: Number(item?.taxRate || 0) };
    });
    if (!lines.length) return null;
    const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const tax = lines.reduce((sum, line) => sum + Math.round(line.qty * line.price * line.taxRate / 100), 0);
    const date = new Date().toISOString().slice(0, 10);
    const id = docSequence('INV', next.salesInvoices);
    const documentNo = governedDocumentNumber(next, 'SALES_INVOICE', order.entityId, order.siteId, date, 'SINV');
    const invoice = {
      id, documentNo, entityId: order.entityId, siteId: order.siteId, salesOrderId, shipmentId: shipment?.id || order.related?.shipment || null, customerId: order.customerId, date,
      dueDate: addDays(date, paymentTermDays(customer?.paymentTerm)), status: 'Draft', postingStatus: 'Unposted', currency: 'IDR',
      subtotal, tax, total: subtotal + tax, paidAmount: 0, journalId: null, arItemId: null, notes: order.notes || '', lines,
      related: { salesOrder: order.id, deliveryOrder: order.related?.deliveryOrder || null, shipment: shipment?.id || order.related?.shipment || null, pod: shipment?.pod || null },
      audit: [{ at: nowIso(), by: 'Billing Team', action: `Sales invoice dibuat dari ${order.id}` }]
    };
    next.salesInvoices.unshift(invoice);
    order.related = { ...(order.related || {}), invoice: id };
    order.financialStatus = 'Invoice Draft';
    appendAudit(order, `Sales Invoice ${id} dibuat`, 'Billing Team');
    setData(next);
    return id;
  };

  const postSalesInvoice = (invoiceId) => {
    const next = clone(data);
    const invoice = next.salesInvoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.postingStatus === 'Posted' || invoice.status === 'Cancelled') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'finance.post', invoice.entityId, invoice.siteId)) return false;
    const period = findPeriod(next, invoice.date, invoice.entityId || next.customers.find((row) => row.id === invoice.customerId)?.entityId || scope.entityId, 'Open');
    if (!period) return false;
    const customer = next.customers.find((row) => row.id === invoice.customerId);
    const journalId = docSequence('JV', next.journals);
    const journal = {
      id: journalId, entityId: invoice.entityId, siteId: invoice.siteId, date: invoice.date, source: 'Sales Invoice', reference: invoice.id, status: 'Posted',
      description: `Sales invoice ${invoice.id} · ${customer?.name || invoice.customerId}`,
      lines: [
        { account: '113100', accountName: 'Accounts Receivable', debit: invoice.total, credit: 0 },
        { account: '410100', accountName: 'Sales Revenue', debit: 0, credit: invoice.subtotal },
        { account: '214100', accountName: 'VAT Output / PPN Keluaran', debit: 0, credit: invoice.tax }
      ]
    };
    const totals = journalTotals(journal);
    if (totals.debit !== totals.credit) return false;
    const arId = `AR-${String(next.arOpenItems.length + 1).padStart(4, '0')}`;
    next.journals.unshift(journal);
    next.arOpenItems.unshift({ id: arId, entityId: invoice.entityId, siteId: invoice.siteId, invoiceId: invoice.id, customerId: invoice.customerId, documentDate: invoice.date, dueDate: invoice.dueDate, originalAmount: invoice.total, outstanding: invoice.total, status: 'Open' });
    invoice.journalId = journalId;
    invoice.arItemId = arId;
    invoice.postingStatus = 'Posted';
    invoice.status = 'Open';
    invoice.audit = [...(invoice.audit || []), { at: nowIso(), by: 'AR Accountant', action: `Invoice diposting ke GL dan AR Open Item ${arId}` }];
    if (customer) customer.creditUsed = Number(customer.creditUsed || 0) + Number(invoice.total || 0);
    const order = next.salesOrders.find((row) => row.id === invoice.salesOrderId);
    if (order) {
      order.financialStatus = 'Invoiced';
      appendAudit(order, `${invoice.id} posted ke AR/GL`, 'AR Accountant');
    }
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: invoice.entityId, siteId: invoice.siteId, module: 'Finance', documentType: 'SALES_INVOICE', documentId: invoice.id, action: 'POST', oldValue: 'Unposted', newValue: journalId, severity: 'Warning' });
    setData(next);
    return true;
  };

  const createReceipt = ({ invoiceId, amount, accountId, method = 'Bank Transfer', reference = '', date }) => {
    const next = clone(data);
    const invoice = next.salesInvoices.find((item) => item.id === invoiceId);
    if (!invoice || invoice.postingStatus !== 'Posted' || ['Paid', 'Cancelled'].includes(invoice.status)) return null;
    const ar = next.arOpenItems.find((item) => item.invoiceId === invoiceId && item.status !== 'Closed');
    if (!ar) return null;
    const account = next.bankAccounts.find((item) => item.id === accountId);
    const received = Math.min(Math.max(0, Number(amount || 0)), Number(ar.outstanding || 0));
    if (!account || received <= 0 || account.entityId !== invoice.entityId) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'ar_ap.pay', invoice.entityId, invoice.siteId || account.siteId)) return null;
    const receiptDate = date || new Date().toISOString().slice(0, 10);
    const period = findPeriod(next, receiptDate, invoice.entityId, 'Open');
    if (!period) return null;
    const prefix = account.type === 'Cash' ? 'CR' : 'BR';
    const id = docSequence(prefix, next.receipts);
    const journalId = docSequence('JV', next.journals);
    const customer = next.customers.find((row) => row.id === invoice.customerId);
    const journal = {
      id: journalId, entityId: invoice.entityId, siteId: invoice.siteId || account.siteId, date: receiptDate, source: account.type === 'Cash' ? 'Cash Receipt' : 'Bank Receipt', reference: id, status: 'Posted',
      description: `Receipt ${id} · ${customer?.name || invoice.customerId}`,
      lines: [
        { account: account.coa, accountName: account.name, debit: received, credit: 0 },
        { account: '113100', accountName: 'Accounts Receivable', debit: 0, credit: received }
      ]
    };
    const totals = journalTotals(journal);
    if (totals.debit !== totals.credit) return null;
    next.receipts.unshift({ id, entityId: invoice.entityId, siteId: invoice.siteId || account.siteId, customerId: invoice.customerId, invoiceId, date: receiptDate, amount: received, method, accountId, reference, status: 'Posted', journalId });
    next.journals.unshift(journal);
    ar.outstanding = Math.max(0, Number(ar.outstanding) - received);
    ar.status = ar.outstanding <= 0 ? 'Closed' : 'Open';
    invoice.paidAmount = Number(invoice.paidAmount || 0) + received;
    invoice.status = invoice.paidAmount >= invoice.total ? 'Paid' : 'Partially Paid';
    invoice.audit = [...(invoice.audit || []), { at: nowIso(), by: 'Cashier / AR', action: `${id} diterima sebesar ${received}` }];
    account.balance = Number(account.balance || 0) + received;
    if (customer) customer.creditUsed = Math.max(0, Number(customer.creditUsed || 0) - received);
    const order = next.salesOrders.find((row) => row.id === invoice.salesOrderId);
    if (order) {
      order.financialStatus = invoice.status;
      appendAudit(order, `${id} allocated ke ${invoice.id}; status ${invoice.status}`, 'Cashier / AR');
    }
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: invoice.entityId, siteId: invoice.siteId || account.siteId, module: 'AR/AP', documentType: 'CUSTOMER_RECEIPT', documentId: id, action: 'POST', newValue: received, severity: 'Info' });
    setData(next);
    return id;
  };


  const createPurchaseRequest = (payload) => {
    const next = clone(data);
    const warehouse = next.warehouses.find((row) => row.id === payload.warehouseId);
    if (!warehouse || (scope.mode === 'ENTITY' && warehouse.entityId !== scope.entityId)) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'purchase.create', warehouse.entityId, warehouse.siteId)) return null;
    const id = docSequence('PR', next.purchaseRequests);
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'PURCHASE_REQUEST', warehouse.entityId, warehouse.siteId, date, 'PR');
    const request = {
      id,
      documentNo,
      entityId: warehouse.entityId,
      siteId: warehouse.siteId,
      date,
      neededDate: payload.neededDate,
      warehouseId: payload.warehouseId,
      requester: payload.requester || 'Procurement Requester',
      status: 'Draft',
      approvalStatus: 'Not Submitted',
      notes: payload.notes || '',
      lines: payload.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), estimatedCost: Number(line.estimatedCost || 0) })),
      related: {},
      audit: [{ at: nowIso(), by: payload.requester || 'Procurement Requester', action: 'Purchase Request dibuat sebagai Draft' }]
    };
    next.purchaseRequests.unshift(request);
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: request.entityId, siteId: request.siteId, module: 'Purchase', documentType: 'PURCHASE_REQUEST', documentId: request.id, action: 'CREATE', newValue: documentNo || request.id });
    setData(next);
    return id;
  };

  const submitPurchaseRequest = (id) => {
    const next = clone(data);
    const request = next.purchaseRequests.find((row) => row.id === id);
    if (!request || request.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'purchase.edit', request.entityId, request.siteId)) return false;
    const amount = request.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.estimatedCost || 0), 0);
    const approval = createApprovalRequestInData(next, { documentType: 'PURCHASE_REQUEST', documentId: request.id, entityId: request.entityId, siteId: request.siteId, amount, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    request.status = 'Pending Approval';
    request.approvalStatus = 'Pending';
    request.related = { ...(request.related || {}), approvalRequest: approval.id };
    request.audit = [...(request.audit || []), { at: nowIso(), by: request.requester || 'Requester', action: `Purchase Request disubmit melalui ${approval.id}` }];
    setData(next);
    return true;
  };

  const approvePurchaseRequest = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && row.documentType === 'PURCHASE_REQUEST' && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const createRFQFromPurchaseRequest = ({ purchaseRequestId, supplierId, validUntil }) => {
    const next = clone(data);
    const request = next.purchaseRequests.find((row) => row.id === purchaseRequestId);
    const supplier = next.suppliers.find((row) => row.id === supplierId);
    if (!request || request.status !== 'Approved' || !supplier || supplier.entityId !== request.entityId) return null;
    const existing = next.rfqs.find((row) => row.purchaseRequestId === purchaseRequestId && row.supplierId === supplierId && row.status !== 'Cancelled');
    if (existing) return existing.id;
    const id = docSequence('RFQ', next.rfqs);
    const date = new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'RFQ', request.entityId, request.siteId, date, 'RFQ');
    const rfq = {
      id,
      documentNo,
      entityId: request.entityId,
      siteId: request.siteId,
      purchaseRequestId,
      supplierId,
      date,
      validUntil: validUntil || addDays(date, 7),
      status: 'Quoted',
      buyer: 'Procurement Buyer',
      lines: request.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), quotedPrice: Number(line.estimatedCost || next.items.find((item) => item.sku === line.sku)?.standardCost || 0) })),
      related: {},
      audit: [{ at: nowIso(), by: 'Procurement Buyer', action: `RFQ dibuat untuk ${supplier.name}; quoted price dicatat sebagai demo` }]
    };
    next.rfqs.unshift(rfq);
    request.related = { ...(request.related || {}), rfq: id };
    request.status = 'RFQ Created';
    request.audit = [...(request.audit || []), { at: nowIso(), by: 'Procurement Buyer', action: `RFQ ${id} dibuat` }];
    setData(next);
    return id;
  };

  const updateRFQPrice = (rfqId, sku, price) => {
    const next = clone(data);
    const rfq = next.rfqs.find((row) => row.id === rfqId);
    if (!rfq || !['Quoted', 'Open'].includes(rfq.status)) return false;
    const line = rfq.lines.find((row) => row.sku === sku);
    if (!line) return false;
    line.quotedPrice = Math.max(0, Number(price || 0));
    rfq.audit = [...(rfq.audit || []), { at: nowIso(), by: 'Procurement Buyer', action: `Quoted price ${sku} diperbarui` }];
    setData(next);
    return true;
  };

  const createPurchaseOrder = (payload) => {
    const next = clone(data);
    const supplier = next.suppliers.find((row) => row.id === payload.supplierId);
    const warehouse = next.warehouses.find((row) => row.id === payload.warehouseId);
    if (!supplier || !warehouse || supplier.entityId !== warehouse.entityId) return null;
    if (scope.mode === 'ENTITY' && warehouse.entityId !== scope.entityId) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'purchase.create', warehouse.entityId, warehouse.siteId)) return null;
    const id = docSequence('PO', next.purchaseOrders);
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'PURCHASE_ORDER', warehouse.entityId, warehouse.siteId, date, 'PO');
    const po = {
      id,
      documentNo,
      entityId: warehouse.entityId,
      siteId: warehouse.siteId,
      supplierId: payload.supplierId,
      warehouseId: payload.warehouseId,
      date,
      eta: payload.eta,
      status: 'Draft',
      approvalStatus: 'Not Submitted',
      buyer: payload.buyer || 'Procurement Buyer',
      notes: payload.notes || '',
      lines: payload.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), price: Number(line.price), receivedQty: 0, putAwayQty: 0, invoicedQty: 0 })),
      related: payload.related || {},
      audit: [{ at: nowIso(), by: payload.buyer || 'Procurement Buyer', action: 'Purchase Order dibuat sebagai Draft' }]
    };
    next.purchaseOrders.unshift(po);
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: po.entityId, siteId: po.siteId, module: 'Purchase', documentType: 'PURCHASE_ORDER', documentId: po.id, action: 'CREATE', newValue: documentNo || po.id });
    setData(next);
    return id;
  };

  const convertRFQToPurchaseOrder = (rfqId) => {
    const next = clone(data);
    const rfq = next.rfqs.find((row) => row.id === rfqId);
    if (!rfq || !['Quoted', 'Open'].includes(rfq.status)) return null;
    const existing = next.purchaseOrders.find((row) => row.related?.rfq === rfqId && row.status !== 'Cancelled');
    if (existing) return existing.id;
    const supplier = next.suppliers.find((row) => row.id === rfq.supplierId);
    const request = next.purchaseRequests.find((row) => row.id === rfq.purchaseRequestId);
    const id = docSequence('PO', next.purchaseOrders);
    const date = new Date().toISOString().slice(0, 10);
    const poWarehouseId = request?.warehouseId || supplier?.defaultWarehouseId || next.warehouses.find((row) => row.entityId === rfq.entityId)?.id;
    const poWarehouse = next.warehouses.find((row) => row.id === poWarehouseId);
    if (!poWarehouse || poWarehouse.entityId !== rfq.entityId) return null;
    const documentNo = governedDocumentNumber(next, 'PURCHASE_ORDER', rfq.entityId, poWarehouse.siteId, date, 'PO');
    const po = {
      id,
      documentNo,
      entityId: rfq.entityId,
      siteId: poWarehouse.siteId,
      supplierId: rfq.supplierId,
      warehouseId: poWarehouseId,
      date,
      eta: addDays(date, supplier?.leadTimeDays || 5),
      status: 'Draft',
      approvalStatus: 'Not Submitted',
      buyer: rfq.buyer || 'Procurement Buyer',
      notes: `Created from ${rfq.id}`,
      lines: rfq.lines.map((line) => ({ sku: line.sku, qty: Number(line.qty), price: Number(line.quotedPrice), receivedQty: 0, putAwayQty: 0, invoicedQty: 0 })),
      related: { purchaseRequest: rfq.purchaseRequestId, rfq: rfq.id },
      audit: [{ at: nowIso(), by: rfq.buyer || 'Procurement Buyer', action: `Purchase Order dibuat dari ${rfq.id}` }]
    };
    next.purchaseOrders.unshift(po);
    rfq.status = 'Converted';
    rfq.related = { ...(rfq.related || {}), purchaseOrder: id };
    rfq.audit = [...(rfq.audit || []), { at: nowIso(), by: rfq.buyer || 'Procurement Buyer', action: `RFQ dikonversi menjadi ${id}` }];
    if (request) request.related = { ...(request.related || {}), purchaseOrder: id };
    setData(next);
    return id;
  };

  const submitPurchaseOrder = (id) => {
    const next = clone(data);
    const po = next.purchaseOrders.find((row) => row.id === id);
    if (!po || po.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'purchase.edit', po.entityId, po.siteId)) return false;
    const amount = po.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.price || 0), 0);
    const approval = createApprovalRequestInData(next, { documentType: 'PURCHASE_ORDER', documentId: po.id, entityId: po.entityId, siteId: po.siteId, amount, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    po.status = 'Pending Approval';
    po.approvalStatus = 'Pending';
    po.related = { ...(po.related || {}), approvalRequest: approval.id };
    po.audit = [...(po.audit || []), { at: nowIso(), by: po.buyer || 'Buyer', action: `Purchase Order disubmit melalui ${approval.id}` }];
    setData(next);
    return true;
  };

  const approvePurchaseOrder = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && row.documentType === 'PURCHASE_ORDER' && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const createReceivingFromPO = (purchaseOrderId) => {
    const next = clone(data);
    const po = next.purchaseOrders.find((row) => row.id === purchaseOrderId);
    if (!po || !['Approved', 'Partially Received'].includes(po.status)) return null;
    const remainingLines = po.lines.map((line) => ({ ...line, remaining: Math.max(0, Number(line.qty) - Number(line.receivedQty || 0)) })).filter((line) => line.remaining > 0);
    if (!remainingLines.length) return null;
    const existing = next.receivings.find((row) => row.purchaseOrderId === purchaseOrderId && row.status === 'Draft');
    if (existing) return existing.id;
    const id = docSequence('GRN', next.receivings);
    const date = new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'GOODS_RECEIPT', po.entityId, po.siteId, date, 'GRN');
    const receiving = {
      id,
      documentNo,
      entityId: po.entityId,
      siteId: po.siteId,
      purchaseOrderId,
      supplierId: po.supplierId,
      warehouseId: po.warehouseId,
      date,
      status: 'Draft',
      receivedBy: 'Inbound Team',
      putAwayAt: null,
      lines: remainingLines.map((line, index) => ({
        sku: line.sku,
        orderedQty: Number(line.qty),
        receiveQty: Number(line.remaining),
        acceptedQty: Number(line.remaining),
        rejectedQty: 0,
        location: 'INBOUND-01',
        putAwayLocation: `${String.fromCharCode(65 + (index % 4))}-${String(index + 1).padStart(2, '0')}-01`,
        lot: `LOT-${new Date().toISOString().slice(2, 10).replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}`
      })),
      audit: [{ at: nowIso(), by: 'Inbound Team', action: `Receiving draft dibuat dari ${po.id}` }]
    };
    next.receivings.unshift(receiving);
    po.related = { ...(po.related || {}), receiving: [...(Array.isArray(po.related?.receiving) ? po.related.receiving : po.related?.receiving ? [po.related.receiving] : []), id] };
    po.audit = [...(po.audit || []), { at: nowIso(), by: 'Inbound Team', action: `Receiving ${id} dibuat` }];
    setData(next);
    return id;
  };

  const updateReceivingLine = (receivingId, sku, patch) => {
    const next = clone(data);
    const receiving = next.receivings.find((row) => row.id === receivingId);
    if (!receiving || receiving.status !== 'Draft') return false;
    const line = receiving.lines.find((row) => row.sku === sku);
    if (!line) return false;
    const maxQty = Number(line.receiveQty || 0);
    const accepted = patch.acceptedQty !== undefined ? Math.min(maxQty, Math.max(0, Number(patch.acceptedQty))) : Number(line.acceptedQty || 0);
    line.acceptedQty = accepted;
    line.rejectedQty = Math.max(0, maxQty - accepted);
    if (patch.putAwayLocation !== undefined) line.putAwayLocation = patch.putAwayLocation;
    if (patch.lot !== undefined) line.lot = patch.lot;
    setData(next);
    return true;
  };

  const postReceiving = (receivingId) => {
    const next = clone(data);
    const receiving = next.receivings.find((row) => row.id === receivingId);
    if (!receiving || receiving.status !== 'Draft') return false;
    const po = next.purchaseOrders.find((row) => row.id === receiving.purchaseOrderId);
    if (!po) return false;
    receiving.lines.forEach((line) => {
      const accepted = Number(line.acceptedQty || 0);
      if (accepted <= 0) return;
      let stock = next.inventory.find((row) => row.warehouseId === receiving.warehouseId && row.sku === line.sku);
      if (!stock) {
        stock = { warehouseId: receiving.warehouseId, entityId: receiving.entityId, siteId: receiving.siteId, sku: line.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0 };
        next.inventory.push(stock);
      }
      stock.inbound = Number(stock.inbound || 0) + accepted;
      const poLine = po.lines.find((row) => row.sku === line.sku);
      if (poLine) poLine.receivedQty = Math.min(Number(poLine.qty), Number(poLine.receivedQty || 0) + accepted);
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: receiving.entityId, siteId: receiving.siteId, at: nowIso(), type: 'GOODS_RECEIPT_INBOUND', warehouseId: receiving.warehouseId, sku: line.sku, qty: accepted, ref: receiving.id });
    });
    receiving.status = 'Received';
    receiving.audit = [...(receiving.audit || []), { at: nowIso(), by: receiving.receivedBy || 'Inbound Team', action: 'Goods receipt dikonfirmasi ke inbound staging' }];
    const allReceived = po.lines.every((line) => Number(line.receivedQty || 0) >= Number(line.qty));
    po.status = allReceived ? 'Received' : 'Partially Received';
    po.audit = [...(po.audit || []), { at: nowIso(), by: 'Inbound Team', action: `${receiving.id} posted; ${allReceived ? 'full receipt' : 'partial receipt'}` }];
    setData(next);
    return true;
  };

  const putAwayReceiving = (receivingId) => {
    const next = clone(data);
    const receiving = next.receivings.find((row) => row.id === receivingId);
    if (!receiving || receiving.status !== 'Received') return false;
    const po = next.purchaseOrders.find((row) => row.id === receiving.purchaseOrderId);
    receiving.lines.forEach((line) => {
      const accepted = Number(line.acceptedQty || 0);
      if (accepted <= 0) return;
      let stock = next.inventory.find((row) => row.warehouseId === receiving.warehouseId && row.sku === line.sku);
      if (!stock) {
        stock = { warehouseId: receiving.warehouseId, entityId: receiving.entityId, siteId: receiving.siteId, sku: line.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0 };
        next.inventory.push(stock);
      }
      stock.inbound = Math.max(0, Number(stock.inbound || 0) - accepted);
      const poLine = po?.lines.find((row) => row.sku === line.sku);
      const item = next.items.find((row) => row.sku === line.sku);
      const receiptCost = Number(poLine?.price || item?.standardCost || 0);
      const oldQty = Number(stock.onHand || 0);
      const oldCost = Number(stock.avgCost || item?.standardCost || receiptCost || 0);
      stock.avgCost = oldQty + accepted > 0 ? Math.round(((oldQty * oldCost) + (accepted * receiptCost)) / (oldQty + accepted)) : receiptCost;
      stock.onHand = oldQty + accepted;
      if (line.lot) {
        let lotBalance = next.lotBalances.find((row) => row.warehouseId === receiving.warehouseId && row.sku === line.sku && row.lot === line.lot && row.location === line.putAwayLocation);
        if (!lotBalance) {
          lotBalance = { id: `LOTBAL-${String(next.lotBalances.length + 1).padStart(4, '0')}`, entityId: receiving.entityId, siteId: receiving.siteId, warehouseId: receiving.warehouseId, location: line.putAwayLocation || 'GENERAL', sku: line.sku, lot: line.lot, expiryDate: null, onHand: 0, reserved: 0 };
          next.lotBalances.push(lotBalance);
        }
        lotBalance.onHand = Number(lotBalance.onHand || 0) + accepted;
      }
      if (poLine) poLine.putAwayQty = Math.min(Number(poLine.qty), Number(poLine.putAwayQty || 0) + accepted);
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: receiving.entityId, siteId: receiving.siteId, at: nowIso(), type: 'PUTAWAY_TRANSFER', warehouseId: receiving.warehouseId, sku: line.sku, qty: 0, unitCost: receiptCost, value: accepted * receiptCost, balanceAfter: stock.onHand, ref: `${receiving.id} → ${line.putAwayLocation}` });
    });
    receiving.status = 'Put Away';
    receiving.putAwayAt = nowIso();
    receiving.audit = [...(receiving.audit || []), { at: nowIso(), by: 'Warehouse Team', action: 'Put away selesai; inbound stock menjadi available on-hand' }];
    if (po) po.audit = [...(po.audit || []), { at: nowIso(), by: 'Warehouse Team', action: `Put away ${receiving.id} selesai` }];
    setData(next);
    return true;
  };

  const createPurchaseInvoiceFromReceiving = (receivingId) => {
    const next = clone(data);
    const receiving = next.receivings.find((row) => row.id === receivingId);
    if (!receiving || receiving.status !== 'Put Away') return null;
    const po = next.purchaseOrders.find((row) => row.id === receiving.purchaseOrderId);
    if (!po) return null;
    const existing = next.purchaseInvoices.find((row) => row.receivingId === receivingId && row.status !== 'Cancelled');
    if (existing) return existing.id;
    const supplier = next.suppliers.find((row) => row.id === po.supplierId);
    const lines = receiving.lines.filter((line) => Number(line.acceptedQty || 0) > 0).map((line) => {
      const poLine = po.lines.find((row) => row.sku === line.sku);
      const item = next.items.find((row) => row.sku === line.sku);
      return { sku: line.sku, description: item?.name || line.sku, qty: Number(line.acceptedQty), price: Number(poLine?.price || item?.standardCost || 0), taxRate: Number(item?.taxRate || 0) };
    });
    if (!lines.length) return null;
    const subtotal = lines.reduce((sum, line) => sum + line.qty * line.price, 0);
    const tax = lines.reduce((sum, line) => sum + Math.round(line.qty * line.price * line.taxRate / 100), 0);
    const date = new Date().toISOString().slice(0, 10);
    const id = docSequence('PINV', next.purchaseInvoices);
    const documentNo = governedDocumentNumber(next, 'PURCHASE_INVOICE', po.entityId, po.siteId, date, 'PINV');
    const invoice = {
      id,
      documentNo,
      entityId: po.entityId,
      siteId: po.siteId,
      purchaseOrderId: po.id,
      receivingId: receiving.id,
      supplierId: po.supplierId,
      date,
      dueDate: addDays(date, paymentTermDays(supplier?.paymentTerm)),
      status: 'Draft',
      postingStatus: 'Unposted',
      currency: 'IDR',
      matchStatus: 'Matched',
      subtotal,
      tax,
      total: subtotal + tax,
      paidAmount: 0,
      journalId: null,
      apItemId: null,
      notes: '',
      lines,
      related: { purchaseOrder: po.id, receiving: receiving.id },
      audit: [{ at: nowIso(), by: 'AP Accountant', action: `Purchase invoice dibuat dari ${receiving.id}; 3-way match passed` }]
    };
    next.purchaseInvoices.unshift(invoice);
    po.related = { ...(po.related || {}), purchaseInvoice: id };
    po.audit = [...(po.audit || []), { at: nowIso(), by: 'AP Accountant', action: `Purchase Invoice ${id} dibuat` }];
    setData(next);
    return id;
  };

  const postPurchaseInvoice = (invoiceId) => {
    const next = clone(data);
    const invoice = next.purchaseInvoices.find((row) => row.id === invoiceId);
    if (!invoice || invoice.postingStatus === 'Posted' || invoice.status === 'Cancelled' || invoice.matchStatus !== 'Matched') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'finance.post', invoice.entityId, invoice.siteId)) return false;
    const period = findPeriod(next, invoice.date, invoice.entityId || next.suppliers.find((row) => row.id === invoice.supplierId)?.entityId || scope.entityId, 'Open');
    if (!period) return false;
    const supplier = next.suppliers.find((row) => row.id === invoice.supplierId);
    const journalId = docSequence('JV', next.journals);
    const journal = {
      id: journalId,
      entityId: invoice.entityId,
      siteId: invoice.siteId,
      date: invoice.date,
      source: 'Purchase Invoice',
      reference: invoice.id,
      status: 'Posted',
      description: `Purchase invoice ${invoice.id} · ${supplier?.name || invoice.supplierId}`,
      lines: [
        { account: '120100', accountName: 'Merchandise Inventory', debit: invoice.subtotal, credit: 0 },
        { account: '118100', accountName: 'VAT Input / PPN Masukan', debit: invoice.tax, credit: 0 },
        { account: '211100', accountName: 'Accounts Payable', debit: 0, credit: invoice.total }
      ]
    };
    const totals = journalTotals(journal);
    if (totals.debit !== totals.credit) return false;
    const apId = `AP-${String(next.apOpenItems.length + 1).padStart(4, '0')}`;
    next.journals.unshift(journal);
    next.apOpenItems.unshift({ id: apId, entityId: invoice.entityId, siteId: invoice.siteId, billId: invoice.id, supplierId: invoice.supplierId, supplier: supplier?.name || invoice.supplierId, documentDate: invoice.date, dueDate: invoice.dueDate, originalAmount: invoice.total, outstanding: invoice.total, status: 'Open' });
    invoice.journalId = journalId;
    invoice.apItemId = apId;
    invoice.postingStatus = 'Posted';
    invoice.status = 'Open';
    invoice.audit = [...(invoice.audit || []), { at: nowIso(), by: 'AP Accountant', action: `Invoice diposting ke GL dan AP Open Item ${apId}` }];
    const po = next.purchaseOrders.find((row) => row.id === invoice.purchaseOrderId);
    if (po) {
      invoice.lines.forEach((line) => {
        const poLine = po.lines.find((row) => row.sku === line.sku);
        if (poLine) poLine.invoicedQty = Math.min(Number(poLine.qty), Number(poLine.invoicedQty || 0) + Number(line.qty));
      });
      po.status = po.lines.every((line) => Number(line.invoicedQty || 0) >= Number(line.putAwayQty || 0) && Number(line.putAwayQty || 0) >= Number(line.qty)) ? 'Invoiced' : po.status;
      po.audit = [...(po.audit || []), { at: nowIso(), by: 'AP Accountant', action: `${invoice.id} posted ke AP/GL` }];
    }
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: invoice.entityId, siteId: invoice.siteId, module: 'Finance', documentType: 'PURCHASE_INVOICE', documentId: invoice.id, action: 'POST', oldValue: 'Unposted', newValue: journalId, severity: 'Warning' });
    setData(next);
    return true;
  };

  const createSupplierPayment = ({ invoiceId, amount, accountId, method = 'Bank Transfer', reference = '', date }) => {
    const next = clone(data);
    const ap = next.apOpenItems.find((row) => row.billId === invoiceId && row.status !== 'Closed');
    if (!ap) return null;
    const invoice = next.purchaseInvoices.find((row) => row.id === invoiceId);
    if (invoice && (invoice.postingStatus !== 'Posted' || ['Paid', 'Cancelled'].includes(invoice.status))) return null;
    const supplierId = invoice?.supplierId || ap.supplierId;
    const account = next.bankAccounts.find((row) => row.id === accountId);
    const entityId = invoice?.entityId || ap.entityId || next.suppliers.find((row) => row.id === supplierId)?.entityId;
    const siteId = invoice?.siteId || ap.siteId || account?.siteId;
    const paid = Math.min(Math.max(0, Number(amount || 0)), Number(ap.outstanding || 0));
    if (!supplierId || !account || !entityId || account.entityId !== entityId || paid <= 0 || Number(account.balance || 0) < paid) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'ar_ap.pay', entityId, siteId || account.siteId)) return null;
    const paymentDate = date || new Date().toISOString().slice(0, 10);
    const period = findPeriod(next, paymentDate, entityId, 'Open');
    if (!period) return null;
    const prefix = account.type === 'Cash' ? 'CD' : 'BD';
    const id = docSequence(prefix, next.supplierPayments);
    const journalId = docSequence('JV', next.journals);
    const supplier = next.suppliers.find((row) => row.id === supplierId);
    const journal = {
      id: journalId,
      entityId,
      siteId,
      date: paymentDate,
      source: account.type === 'Cash' ? 'Cash Disbursement' : 'Bank Disbursement',
      reference: id,
      status: 'Posted',
      description: `Supplier payment ${id} · ${supplier?.name || ap.supplier || supplierId}`,
      lines: [
        { account: '211100', accountName: 'Accounts Payable', debit: paid, credit: 0 },
        { account: account.coa, accountName: account.name, debit: 0, credit: paid }
      ]
    };
    const totals = journalTotals(journal);
    if (totals.debit !== totals.credit) return null;
    next.supplierPayments.unshift({ id, entityId, siteId, supplierId, invoiceId, date: paymentDate, amount: paid, method, accountId, reference, status: 'Posted', journalId });
    next.journals.unshift(journal);
    ap.outstanding = Math.max(0, Number(ap.outstanding || 0) - paid);
    ap.status = ap.outstanding <= 0 ? 'Closed' : 'Open';
    if (invoice) {
      invoice.paidAmount = Number(invoice.paidAmount || 0) + paid;
      invoice.status = invoice.paidAmount >= invoice.total ? 'Paid' : 'Partially Paid';
      invoice.audit = [...(invoice.audit || []), { at: nowIso(), by: 'AP Cashier', action: `${id} dibayarkan sebesar ${paid}` }];
    }
    account.balance = Number(account.balance || 0) - paid;
    const po = invoice ? next.purchaseOrders.find((row) => row.id === invoice.purchaseOrderId) : null;
    if (po && invoice.status === 'Paid') {
      po.status = 'Closed';
      po.audit = [...(po.audit || []), { at: nowIso(), by: 'AP Cashier', action: `${invoice.id} lunas; Purchase Order closed` }];
    }
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId, siteId, module: 'AR/AP', documentType: 'SUPPLIER_PAYMENT', documentId: id, action: 'POST', oldValue: Number(ap.outstanding || 0) + paid, newValue: Number(ap.outstanding || 0), severity: 'Warning' });
    setData(next);
    return id;
  };

  const createSalesReturn = (payload) => {
    const next = clone(data);
    const order = next.salesOrders.find((row) => row.id === payload?.salesOrderId);
    if (!order || !['Shipped', 'Partially Shipped', 'Delivered', 'Invoiced', 'Closed'].includes(order.status)) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'sales.create', order.entityId, order.siteId)) return null;
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const lines = (payload.lines || []).map((input) => {
      const source = order.lines.find((row) => row.sku === input.sku);
      if (!source) return null;
      const alreadyReturned = (next.salesReturns || []).filter((ret) => ret.salesOrderId === order.id && ret.status !== 'Cancelled').reduce((sum, ret) => sum + (ret.lines || []).filter((line) => line.sku === input.sku).reduce((a, line) => a + Number(line.qty || 0), 0), 0);
      const maxQty = Math.max(0, Number(source.shipped || 0) - alreadyReturned);
      const qty = Math.min(maxQty, Math.max(0, Number(input.qty || 0)));
      if (!qty) return null;
      const shipmentLine = next.shipments.filter((row) => row.salesOrderId === order.id).flatMap((row) => row.lines || []).find((row) => row.sku === input.sku);
      const stock = next.inventory.find((row) => row.warehouseId === order.warehouseId && row.sku === input.sku);
      const item = next.items.find((row) => row.sku === input.sku);
      return { sku: input.sku, qty, receivedQty: 0, disposition: input.disposition || 'Restock', unitPrice: Number(source.price || 0), unitCost: Number(shipmentLine?.unitCost || stock?.avgCost || item?.standardCost || 0), taxRate: Number(item?.taxRate || 0), lot: input.lot || shipmentLine?.lot || '' };
    }).filter(Boolean);
    if (!lines.length) return null;
    const id = docSequence('SRET', next.salesReturns);
    const invoice = next.salesInvoices.find((row) => row.salesOrderId === order.id && row.postingStatus === 'Posted');
    const documentNo = governedDocumentNumber(next, 'SALES_RETURN', order.entityId, order.siteId, date, 'SRET') || id;
    next.salesReturns.unshift({ id, documentNo, entityId: order.entityId, siteId: order.siteId, salesOrderId: order.id, salesInvoiceId: invoice?.id || null, customerId: order.customerId, warehouseId: order.warehouseId, date, status: 'Draft', approvalStatus: 'Not Submitted', reason: payload.reason || '', receivedAt: null, postedAt: null, creditNoteId: null, lines, audit: [{ at: nowIso(), by: currentUser.name, action: `Sales return dibuat dari ${order.id}` }] });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: order.entityId, siteId: order.siteId, module: 'Sales', documentType: 'SALES_RETURN', documentId: id, action: 'CREATE', newValue: documentNo });
    setData(next);
    return id;
  };

  const submitSalesReturn = (id) => {
    const next = clone(data);
    const row = next.salesReturns.find((item) => item.id === id);
    if (!row || row.status !== 'Draft' || !userHasPermission(next, CURRENT_USER_ID, 'sales.edit', row.entityId, row.siteId)) return false;
    const amount = row.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0) * (1 + Number(line.taxRate || 0) / 100), 0);
    const approval = createApprovalRequestInData(next, { documentType: 'SALES_RETURN', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    row.status = 'Pending Approval'; row.approvalStatus = 'Pending'; row.approvalRequestId = approval.id;
    row.audit = [...(row.audit || []), { at: nowIso(), by: currentUser.name, action: `Sales return disubmit melalui ${approval.id}` }];
    setData(next);
    return true;
  };

  const approveSalesReturn = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && row.documentType === 'SALES_RETURN' && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const receiveSalesReturn = (id) => {
    const next = clone(data);
    const row = next.salesReturns.find((item) => item.id === id);
    if (!row || row.status !== 'Approved' || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', row.entityId, row.siteId)) return false;
    row.lines.forEach((line) => {
      const qty = Number(line.qty || 0);
      let stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku);
      const item = next.items.find((x) => x.sku === line.sku);
      if (!stock) {
        stock = { warehouseId: row.warehouseId, entityId: row.entityId, siteId: row.siteId, sku: line.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: Number(line.unitCost || item?.standardCost || 0) };
        next.inventory.push(stock);
      }
      stock.quarantine = Number(stock.quarantine || 0) + qty;
      line.receivedQty = qty;
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'SALES_RETURN_QUARANTINE_IN', warehouseId: row.warehouseId, sku: line.sku, qty, bucket: 'Quarantine', unitCost: Number(line.unitCost || 0), value: qty * Number(line.unitCost || 0), balanceAfter: Number(stock.onHand || 0), ref: row.id });
    });
    row.status = 'Quarantine Received'; row.receivedAt = nowIso();
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'Warehouse Returns', action: 'Return diterima ke quarantine; belum menjadi available stock' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: row.entityId, siteId: row.siteId, module: 'Warehouse', documentType: 'SALES_RETURN', documentId: row.id, action: 'RECEIVE_QUARANTINE', oldValue: 'Approved', newValue: 'Quarantine Received' });
    setData(next);
    return true;
  };

  const updateSalesReturnDisposition = (returnId, sku, disposition) => {
    const next = clone(data);
    const row = next.salesReturns.find((item) => item.id === returnId);
    if (!row || row.status !== 'Quarantine Received' || !['Restock', 'Damaged'].includes(disposition)) return false;
    const line = row.lines.find((item) => item.sku === sku);
    if (!line) return false;
    line.disposition = disposition;
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'Quality Control', action: `${sku} disposition → ${disposition}` }];
    setData(next);
    return true;
  };

  const postSalesReturn = (id) => {
    const next = clone(data);
    const row = next.salesReturns.find((item) => item.id === id);
    if (!row || row.status !== 'Quarantine Received' || !userHasPermission(next, CURRENT_USER_ID, 'finance.post', row.entityId, row.siteId)) return false;
    const period = findPeriod(next, row.date, row.entityId, 'Open');
    if (!period || row.lines.some((line) => !['Restock', 'Damaged'].includes(line.disposition) || Number(line.receivedQty || 0) <= 0)) return false;
    const quarantineReady = row.lines.every((line) => {
      const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku);
      return stock && Number(stock.quarantine || 0) >= Number(line.receivedQty || 0);
    });
    if (!quarantineReady) return false;
    let subtotal = 0; let tax = 0; let restockCost = 0;
    row.lines.forEach((line) => {
      const qty = Number(line.receivedQty || 0);
      const lineSubtotal = qty * Number(line.unitPrice || 0);
      subtotal += lineSubtotal;
      tax += lineSubtotal * Number(line.taxRate || 0) / 100;
      const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku);
      stock.quarantine = Math.max(0, Number(stock.quarantine || 0) - qty);
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      if (line.disposition === 'Restock') {
        stock.onHand = Number(stock.onHand || 0) + qty;
        restockCost += qty * Number(line.unitCost || stock.avgCost || 0);
        if (line.lot) {
          let lot = next.lotBalances.find((lotRow) => lotRow.warehouseId === row.warehouseId && lotRow.sku === line.sku && lotRow.lot === line.lot);
          if (!lot) { lot = { id: `LOTBAL-${String(next.lotBalances.length + 1).padStart(4, '0')}`, entityId: row.entityId, siteId: row.siteId, warehouseId: row.warehouseId, location: 'RETURN-QUARANTINE', sku: line.sku, lot: line.lot, expiryDate: null, onHand: 0, reserved: 0, holdQty: 0 }; next.lotBalances.push(lot); }
          lot.onHand = Number(lot.onHand || 0) + qty;
        }
        next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'SALES_RETURN_RESTOCK_IN', warehouseId: row.warehouseId, sku: line.sku, qty, unitCost: Number(line.unitCost || 0), value: qty * Number(line.unitCost || 0), balanceAfter: stock.onHand, ref: row.id });
      } else {
        next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'SALES_RETURN_DISPOSAL', warehouseId: row.warehouseId, sku: line.sku, qty: -qty, bucket: 'Quarantine', unitCost: Number(line.unitCost || 0), value: 0, balanceAfter: stock.onHand, ref: row.id });
      }
    });
    subtotal = Math.round(subtotal); tax = Math.round(tax); restockCost = Math.round(restockCost);
    const total = subtotal + tax;
    const invoice = next.salesInvoices.find((item) => item.id === row.salesInvoiceId) || next.salesInvoices.find((item) => item.salesOrderId === row.salesOrderId && item.postingStatus === 'Posted');
    const arItem = invoice ? next.arOpenItems.find((item) => item.invoiceId === invoice.id) : null;
    const arApplied = Math.min(total, Math.max(0, Number(arItem?.outstanding || 0)));
    const unappliedCredit = Math.max(0, total - arApplied);
    const journalId = docSequence('JV', next.journals);
    const journalLines = [
      { account: '411100', accountName: 'Sales Returns & Allowances', debit: subtotal, credit: 0 },
      { account: '214100', accountName: 'VAT Output / PPN Keluaran', debit: tax, credit: 0 }
    ];
    if (arApplied > 0) journalLines.push({ account: '113100', accountName: 'Accounts Receivable', debit: 0, credit: arApplied });
    if (unappliedCredit > 0) journalLines.push({ account: '213100', accountName: 'Customer Credits / Refund Payable', debit: 0, credit: unappliedCredit });
    if (restockCost > 0) {
      journalLines.push({ account: '120100', accountName: 'Merchandise Inventory', debit: restockCost, credit: 0 });
      journalLines.push({ account: '510100', accountName: 'Cost of Goods Sold', debit: 0, credit: restockCost });
    }
    next.journals.unshift({ id: journalId, entityId: row.entityId, siteId: row.siteId, date: row.date, source: 'Sales Return', reference: row.id, status: 'Posted', description: `Sales return credit ${row.documentNo || row.id}`, lines: journalLines });
    const noteId = docSequence('SCN', next.salesCreditNotes);
    next.salesCreditNotes.unshift({ id: noteId, entityId: row.entityId, siteId: row.siteId, salesReturnId: row.id, salesInvoiceId: invoice?.id || null, customerId: row.customerId, date: row.date, subtotal, tax, total, appliedToAr: arApplied, unappliedCredit, status: arApplied >= total ? 'Applied' : arApplied > 0 ? 'Partially Applied' : 'Unapplied Credit', journalId });
    if (arItem && arApplied > 0) { arItem.outstanding = Math.max(0, Number(arItem.outstanding || 0) - arApplied); arItem.status = arItem.outstanding <= 0 ? 'Closed' : 'Open'; }
    row.status = 'Posted'; row.postedAt = nowIso(); row.creditNoteId = noteId;
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'Finance Returns', action: `${noteId} posted; revenue/tax reversed dan restock COGS diproses` }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: row.entityId, siteId: row.siteId, module: 'Finance', documentType: 'SALES_RETURN', documentId: row.id, action: 'POST', oldValue: 'Quarantine Received', newValue: `Posted · ${noteId}`, severity: 'Warning' });
    setData(next);
    return true;
  };

  const createPurchaseReturn = (payload) => {
    const next = clone(data);
    const invoice = next.purchaseInvoices.find((row) => row.id === payload?.purchaseInvoiceId && row.postingStatus === 'Posted');
    if (!invoice) return null;
    const po = next.purchaseOrders.find((row) => row.id === invoice.purchaseOrderId);
    if (!po || !userHasPermission(next, CURRENT_USER_ID, 'purchase.create', invoice.entityId, invoice.siteId)) return null;
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const lines = (payload.lines || []).map((input) => {
      const source = invoice.lines.find((row) => row.sku === input.sku);
      if (!source) return null;
      const alreadyReturned = (next.purchaseReturns || []).filter((ret) => ret.purchaseInvoiceId === invoice.id && ret.status !== 'Cancelled').reduce((sum, ret) => sum + (ret.lines || []).filter((line) => line.sku === input.sku).reduce((a, line) => a + Number(line.qty || 0), 0), 0);
      const maxQty = Math.max(0, Number(source.qty || 0) - alreadyReturned);
      const qty = Math.min(maxQty, Math.max(0, Number(input.qty || 0)));
      if (!qty) return null;
      const stock = next.inventory.find((row) => row.warehouseId === po.warehouseId && row.sku === input.sku);
      return { sku: input.sku, qty, unitPrice: Number(source.price || 0), unitCost: Number(stock?.avgCost || next.items.find((x) => x.sku === input.sku)?.standardCost || 0), taxRate: Number(source.taxRate || 0), lot: input.lot || '' };
    }).filter(Boolean);
    if (!lines.length) return null;
    const id = docSequence('PRET', next.purchaseReturns);
    const documentNo = governedDocumentNumber(next, 'PURCHASE_RETURN', invoice.entityId, invoice.siteId, date, 'PRET') || id;
    next.purchaseReturns.unshift({ id, documentNo, entityId: invoice.entityId, siteId: invoice.siteId, purchaseOrderId: po.id, purchaseInvoiceId: invoice.id, supplierId: invoice.supplierId, warehouseId: po.warehouseId, date, status: 'Draft', approvalStatus: 'Not Submitted', reason: payload.reason || '', postedAt: null, debitNoteId: null, lines, audit: [{ at: nowIso(), by: currentUser.name, action: `Purchase return dibuat dari ${invoice.id}` }] });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: invoice.entityId, siteId: invoice.siteId, module: 'Purchase', documentType: 'PURCHASE_RETURN', documentId: id, action: 'CREATE', newValue: documentNo });
    setData(next);
    return id;
  };

  const submitPurchaseReturn = (id) => {
    const next = clone(data);
    const row = next.purchaseReturns.find((item) => item.id === id);
    if (!row || row.status !== 'Draft' || !userHasPermission(next, CURRENT_USER_ID, 'purchase.edit', row.entityId, row.siteId)) return false;
    const amount = row.lines.reduce((sum, line) => sum + Number(line.qty || 0) * Number(line.unitPrice || 0) * (1 + Number(line.taxRate || 0) / 100), 0);
    const approval = createApprovalRequestInData(next, { documentType: 'PURCHASE_RETURN', documentId: row.id, entityId: row.entityId, siteId: row.siteId, amount, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    row.status = 'Pending Approval'; row.approvalStatus = 'Pending'; row.approvalRequestId = approval.id;
    row.audit = [...(row.audit || []), { at: nowIso(), by: currentUser.name, action: `Purchase return disubmit melalui ${approval.id}` }];
    setData(next);
    return true;
  };

  const approvePurchaseReturn = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && row.documentType === 'PURCHASE_RETURN' && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const postPurchaseReturn = (id) => {
    const next = clone(data);
    const row = next.purchaseReturns.find((item) => item.id === id);
    if (!row || row.status !== 'Approved' || !userHasPermission(next, CURRENT_USER_ID, 'finance.post', row.entityId, row.siteId)) return false;
    const period = findPeriod(next, row.date, row.entityId, 'Open');
    if (!period) return false;
    const stockCheck = row.lines.every((line) => {
      const qty = Number(line.qty || 0);
      const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku);
      if (inventoryAvailable(stock) < qty) return false;
      if (!line.lot) return true;
      const lot = next.lotBalances.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku && item.lot === line.lot);
      const lotAvailable = Math.max(0, Number(lot?.onHand || 0) - Number(lot?.reserved || 0) - Number(lot?.holdQty || 0));
      return Boolean(lot) && lotAvailable >= qty;
    });
    if (!stockCheck) return false;
    let subtotal = 0; let tax = 0; let carryingValue = 0;
    row.lines.forEach((line) => {
      const qty = Number(line.qty || 0);
      const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === line.sku);
      const lineSubtotal = qty * Number(line.unitPrice || 0);
      const carry = qty * Number(stock?.avgCost || line.unitCost || 0);
      subtotal += lineSubtotal; tax += lineSubtotal * Number(line.taxRate || 0) / 100; carryingValue += carry;
      stock.onHand = Math.max(0, Number(stock.onHand || 0) - qty);
      if (line.lot) { const lot = next.lotBalances.find((lotRow) => lotRow.warehouseId === row.warehouseId && lotRow.sku === line.sku && lotRow.lot === line.lot); if (lot) lot.onHand = Math.max(0, Number(lot.onHand || 0) - qty); }
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'PURCHASE_RETURN_OUT', warehouseId: row.warehouseId, sku: line.sku, qty: -qty, unitCost: Number(stock.avgCost || line.unitCost || 0), value: -carry, balanceAfter: stock.onHand, ref: row.id });
    });
    subtotal = Math.round(subtotal); tax = Math.round(tax); carryingValue = Math.round(carryingValue);
    const total = subtotal + tax;
    const variance = subtotal - carryingValue;
    const apItem = next.apOpenItems.find((item) => item.billId === row.purchaseInvoiceId);
    const apApplied = Math.min(total, Math.max(0, Number(apItem?.outstanding || 0)));
    const vendorReceivable = Math.max(0, total - apApplied);
    const journalLines = [
      ...(apApplied > 0 ? [{ account: '211100', accountName: 'Accounts Payable', debit: apApplied, credit: 0 }] : []),
      ...(vendorReceivable > 0 ? [{ account: '119100', accountName: 'Supplier Debit Balance / Vendor Receivable', debit: vendorReceivable, credit: 0 }] : []),
      { account: '118100', accountName: 'VAT Input / PPN Masukan', debit: 0, credit: tax },
      { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: carryingValue }
    ];
    if (variance > 0) journalLines.push({ account: '519500', accountName: 'Purchase Return Cost Variance', debit: 0, credit: variance });
    if (variance < 0) journalLines.push({ account: '519500', accountName: 'Purchase Return Cost Variance', debit: Math.abs(variance), credit: 0 });
    const journalId = docSequence('JV', next.journals);
    next.journals.unshift({ id: journalId, entityId: row.entityId, siteId: row.siteId, date: row.date, source: 'Purchase Return', reference: row.id, status: 'Posted', description: `Purchase return debit note ${row.documentNo || row.id}`, lines: journalLines });
    const noteId = docSequence('PDN', next.purchaseDebitNotes);
    next.purchaseDebitNotes.unshift({ id: noteId, entityId: row.entityId, siteId: row.siteId, purchaseReturnId: row.id, purchaseInvoiceId: row.purchaseInvoiceId, supplierId: row.supplierId, date: row.date, subtotal, tax, total, carryingValue, variance, appliedToAp: apApplied, vendorReceivable, status: apApplied >= total ? 'Applied' : apApplied > 0 ? 'Partially Applied' : 'Unapplied', journalId });
    if (apItem && apApplied > 0) { apItem.outstanding = Math.max(0, Number(apItem.outstanding || 0) - apApplied); apItem.status = apItem.outstanding <= 0 ? 'Closed' : 'Open'; }
    row.status = 'Posted'; row.postedAt = nowIso(); row.debitNoteId = noteId;
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'AP / Warehouse', action: `${noteId} posted; stock keluar dan AP dikurangi` }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: row.entityId, siteId: row.siteId, module: 'Purchase', documentType: 'PURCHASE_RETURN', documentId: row.id, action: 'POST', oldValue: 'Approved', newValue: `Posted · ${noteId}`, severity: 'Warning' });
    setData(next);
    return true;
  };

  const generateReplenishmentOrder = ({ toWarehouseId, fromWarehouseId = null, date = new Date().toISOString().slice(0, 10) }) => {
    const next = clone(data);
    const destination = next.warehouses.find((row) => row.id === toWarehouseId);
    if (!destination || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', destination.entityId, destination.siteId)) return null;
    const candidateSources = next.warehouses.filter((row) => row.entityId === destination.entityId && row.id !== destination.id && (!fromWarehouseId || row.id === fromWarehouseId));
    const lines = [];
    for (const item of next.items) {
      const destStock = next.inventory.find((row) => row.warehouseId === destination.id && row.sku === item.sku);
      const inboundTransfer = next.stockTransfers.filter((row) => row.toWarehouseId === destination.id && row.status === 'In Transit').reduce((sum, transfer) => sum + (transfer.lines || []).filter((line) => line.sku === item.sku).reduce((a, line) => a + Number(line.shippedQty || 0), 0), 0);
      const projected = inventoryAvailable(destStock) + Number(destStock?.inbound || 0) + inboundTransfer;
      const reorderPoint = Number(item.reorderPoint || 0); const maxStock = Number(item.maxStock || 0);
      if (projected > reorderPoint || maxStock <= 0) continue;
      const suggested = Math.max(0, maxStock - projected);
      const ranked = candidateSources.map((warehouse) => {
        const stock = next.inventory.find((row) => row.warehouseId === warehouse.id && row.sku === item.sku);
        const sourceAvailable = inventoryAvailable(stock);
        const protectedQty = Number(item.reorderPoint || 0);
        return { warehouse, sourceAvailable, transferable: Math.max(0, sourceAvailable - protectedQty) };
      }).sort((a, b) => b.transferable - a.transferable);
      const source = ranked[0];
      if (!source || source.transferable <= 0) continue;
      lines.push({ sku: item.sku, projectedQty: projected, reorderPoint, maxStock, suggestedQty: suggested, sourceAvailable: source.sourceAvailable, transferableQty: source.transferable, approvedQty: Math.min(suggested, source.transferable), sourceWarehouseId: source.warehouse.id });
    }
    if (!lines.length) return null;
    const dominantSource = fromWarehouseId || lines[0].sourceWarehouseId;
    const filtered = lines.filter((line) => line.sourceWarehouseId === dominantSource);
    if (!filtered.length) return null;
    const id = docSequence('RPL', next.replenishmentOrders);
    const documentNo = governedDocumentNumber(next, 'REPLENISHMENT', destination.entityId, destination.siteId, date, 'RPL') || id;
    next.replenishmentOrders.unshift({ id, documentNo, entityId: destination.entityId, siteId: destination.siteId, fromWarehouseId: dominantSource, toWarehouseId: destination.id, date, status: 'Planned', planner: currentUser.name, transferId: null, notes: 'Generated from reorder point / max stock planning.', lines: filtered, audit: [{ at: nowIso(), by: currentUser.name, action: `Auto replenishment generated untuk ${destination.code}` }] });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: destination.entityId, siteId: destination.siteId, module: 'Warehouse', documentType: 'REPLENISHMENT', documentId: id, action: 'GENERATE', newValue: documentNo });
    setData(next);
    return id;
  };

  const updateReplenishmentQty = (id, sku, approvedQty) => {
    const next = clone(data);
    const row = next.replenishmentOrders.find((item) => item.id === id);
    if (!row || row.status !== 'Planned') return false;
    const line = row.lines.find((item) => item.sku === sku);
    if (!line) return false;
    line.approvedQty = Math.max(0, Math.min(Number(approvedQty || 0), Number(line.transferableQty ?? line.sourceAvailable ?? 0), Number(line.suggestedQty || 0)));
    setData(next);
    return true;
  };

  const convertReplenishmentToTransfer = (id) => {
    const next = clone(data);
    const row = next.replenishmentOrders.find((item) => item.id === id);
    if (!row || row.status !== 'Planned' || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', row.entityId, row.siteId)) return null;
    const lines = row.lines.filter((line) => Number(line.approvedQty || 0) > 0).map((line) => {
      const stock = next.inventory.find((item) => item.warehouseId === row.fromWarehouseId && item.sku === line.sku);
      const item = next.items.find((x) => x.sku === line.sku);
      return { sku: line.sku, qty: Number(line.approvedQty), shippedQty: 0, receivedQty: 0, unitCost: Number(stock?.avgCost || item?.standardCost || 0) };
    });
    if (!lines.length || lines.some((line) => inventoryAvailable(next.inventory.find((stock) => stock.warehouseId === row.fromWarehouseId && stock.sku === line.sku)) < line.qty)) return null;
    const transferId = docSequence('TRF', next.stockTransfers);
    next.stockTransfers.unshift({ id: transferId, entityId: row.entityId, siteId: entitySiteFromWarehouse(next, row.fromWarehouseId).siteId, toEntityId: row.entityId, toSiteId: row.siteId, date: row.date, fromWarehouseId: row.fromWarehouseId, toWarehouseId: row.toWarehouseId, status: 'Draft', requestedBy: row.planner, releasedAt: null, receivedAt: null, notes: `Generated from ${row.id}`, replenishmentOrderId: row.id, lines, audit: [{ at: nowIso(), by: row.planner, action: `Stock transfer dibuat dari replenishment ${row.id}` }] });
    row.status = 'Transfer Created'; row.transferId = transferId;
    row.audit = [...(row.audit || []), { at: nowIso(), by: currentUser.name, action: `${transferId} dibuat untuk execution` }];
    setData(next);
    return transferId;
  };

  const createQualityCase = (payload) => {
    const next = clone(data);
    const warehouse = next.warehouses.find((row) => row.id === payload?.warehouseId);
    const stock = next.inventory.find((row) => row.warehouseId === payload?.warehouseId && row.sku === payload?.sku);
    if (!warehouse || !stock || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', warehouse.entityId, warehouse.siteId)) return null;
    const qty = Math.max(0, Number(payload.affectedQty || 0));
    if (!qty || inventoryAvailable(stock) < qty) return null;
    if (payload.lot) {
      const lot = next.lotBalances.find((item) => item.warehouseId === warehouse.id && item.sku === payload.sku && item.lot === payload.lot);
      const lotAvailable = Math.max(0, Number(lot?.onHand || 0) - Number(lot?.reserved || 0) - Number(lot?.holdQty || 0));
      if (!lot || lotAvailable < qty) return null;
    }
    const id = docSequence('QC', next.qualityCases);
    next.qualityCases.unshift({ id, entityId: warehouse.entityId, siteId: warehouse.siteId, warehouseId: warehouse.id, sku: payload.sku, lot: payload.lot || '', openedAt: nowIso(), status: 'Monitoring', affectedQty: qty, reason: payload.reason || '', disposition: 'Pending', source: payload.source || 'Internal Inspection', holdApplied: false, recallId: null, audit: [{ at: nowIso(), by: currentUser.name, action: 'Quality case dibuka untuk investigation' }] });
    setData(next);
    return id;
  };

  const applyQualityHold = (id) => {
    const next = clone(data);
    const row = next.qualityCases.find((item) => item.id === id);
    if (!row || row.holdApplied || !['Monitoring', 'Open'].includes(row.status) || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', row.entityId, row.siteId)) return false;
    const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === row.sku);
    const qty = Number(row.affectedQty || 0);
    if (!stock || inventoryAvailable(stock) < qty) return false;
    const lot = row.lot ? next.lotBalances.find((item) => item.warehouseId === row.warehouseId && item.sku === row.sku && item.lot === row.lot) : null;
    if (row.lot) {
      const lotAvailable = Math.max(0, Number(lot?.onHand || 0) - Number(lot?.reserved || 0) - Number(lot?.holdQty || 0));
      if (!lot || lotAvailable < qty) return false;
    }
    stock.qualityHold = Number(stock.qualityHold || 0) + qty;
    if (lot) lot.holdQty = Number(lot.holdQty || 0) + qty;
    const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
    next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'QUALITY_HOLD', warehouseId: row.warehouseId, sku: row.sku, qty: 0, bucketQty: qty, bucket: 'Quality Hold', unitCost: Number(stock.avgCost || 0), value: qty * Number(stock.avgCost || 0), balanceAfter: stock.onHand, ref: row.id });
    row.holdApplied = true; row.status = 'Hold';
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'Quality Control', action: `${qty} qty dipindahkan ke quality hold dan dikeluarkan dari available stock` }];
    setData(next);
    return true;
  };

  const resolveQualityCase = (id, disposition) => {
    const next = clone(data);
    const row = next.qualityCases.find((item) => item.id === id);
    if (!row || !row.holdApplied || !['Release', 'Scrap'].includes(disposition) || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', row.entityId, row.siteId)) return false;
    const stock = next.inventory.find((item) => item.warehouseId === row.warehouseId && item.sku === row.sku);
    const qty = Number(row.affectedQty || 0);
    if (!stock || Number(stock.qualityHold || 0) < qty) return false;
    stock.qualityHold = Math.max(0, Number(stock.qualityHold || 0) - qty);
    const lot = row.lot ? next.lotBalances.find((item) => item.warehouseId === row.warehouseId && item.sku === row.sku && item.lot === row.lot) : null;
    if (lot) lot.holdQty = Math.max(0, Number(lot.holdQty || 0) - qty);
    if (disposition === 'Scrap') {
      const date = new Date().toISOString().slice(0, 10);
      if (!findPeriod(next, date, row.entityId, 'Open')) return false;
      stock.onHand = Math.max(0, Number(stock.onHand || 0) - qty);
      if (lot) lot.onHand = Math.max(0, Number(lot.onHand || 0) - qty);
      const unitCost = Number(stock.avgCost || next.items.find((item) => item.sku === row.sku)?.standardCost || 0);
      const amount = Math.round(qty * unitCost);
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: row.entityId, siteId: row.siteId, at: nowIso(), type: 'QUALITY_SCRAP_OUT', warehouseId: row.warehouseId, sku: row.sku, qty: -qty, unitCost, value: -amount, balanceAfter: stock.onHand, ref: row.id });
      if (amount > 0) {
        const journalId = docSequence('JV', next.journals);
        next.journals.unshift({ id: journalId, entityId: row.entityId, siteId: row.siteId, date, source: 'Quality Disposal', reference: row.id, status: 'Posted', description: `Quality disposal ${row.id}`, lines: [{ account: '619100', accountName: 'Quality & Disposal Loss', debit: amount, credit: 0 }, { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: amount }] });
        row.journalId = journalId;
      }
      row.status = 'Scrapped'; row.disposition = 'Scrap';
    } else {
      row.status = 'Released'; row.disposition = 'Release';
    }
    row.resolvedAt = nowIso();
    row.audit = [...(row.audit || []), { at: nowIso(), by: 'Quality Control', action: `Quality disposition → ${disposition}` }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: row.entityId, siteId: row.siteId, module: 'Quality', documentType: 'QUALITY_CASE', documentId: row.id, action: 'DISPOSITION', oldValue: 'Hold', newValue: disposition, severity: disposition === 'Scrap' ? 'Warning' : 'Info' });
    setData(next);
    return true;
  };

  const startLotRecall = (qualityCaseId) => {
    const next = clone(data);
    const qc = next.qualityCases.find((row) => row.id === qualityCaseId);
    if (!qc || !userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', qc.entityId, qc.siteId)) return null;
    if (qc.recallId) return qc.recallId;
    const affectedShipments = next.shipments.filter((shipment) => shipment.entityId === qc.entityId && (shipment.lines || []).some((line) => line.sku === qc.sku && (!qc.lot || line.lot === qc.lot))).map((shipment) => ({ shipmentId: shipment.id, salesOrderId: shipment.salesOrderId, deliveryOrderId: shipment.deliveryOrderId, status: shipment.status, customerId: next.salesOrders.find((order) => order.id === shipment.salesOrderId)?.customerId || null, qty: (shipment.lines || []).filter((line) => line.sku === qc.sku && (!qc.lot || line.lot === qc.lot)).reduce((sum, line) => sum + Number(line.qty || 0), 0) }));
    const id = docSequence('RCL', next.recallCases);
    next.recallCases.unshift({ id, entityId: qc.entityId, siteId: qc.siteId, qualityCaseId: qc.id, sku: qc.sku, lot: qc.lot, createdAt: nowIso(), status: 'Active', reason: qc.reason, affectedShipments, audit: [{ at: nowIso(), by: 'Quality Control', action: `${affectedShipments.length} downstream shipment ditrace` }] });
    qc.recallId = id;
    qc.audit = [...(qc.audit || []), { at: nowIso(), by: 'Quality Control', action: `Lot recall ${id} diaktifkan` }];
    setData(next);
    return id;
  };

  const closeRecall = (id) => {
    const next = clone(data);
    const row = next.recallCases.find((item) => item.id === id);
    if (!row || !['Active', 'Monitoring'].includes(row.status)) return false;
    row.status = 'Closed'; row.closedAt = nowIso(); row.audit = [...(row.audit || []), { at: nowIso(), by: 'Quality Control', action: 'Recall trace ditutup setelah review downstream exposure' }];
    setData(next);
    return true;
  };

  const createStockTransfer = (payload) => {
    const next = clone(data);
    if (!payload?.fromWarehouseId || !payload?.toWarehouseId || payload.fromWarehouseId === payload.toWarehouseId) return null;
    const fromWarehouse = next.warehouses.find((row) => row.id === payload.fromWarehouseId);
    const toWarehouse = next.warehouses.find((row) => row.id === payload.toWarehouseId);
    if (!fromWarehouse || !toWarehouse || fromWarehouse.entityId !== toWarehouse.entityId) return null;
    if (scope.mode === 'ENTITY' && fromWarehouse.entityId !== scope.entityId) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', fromWarehouse.entityId, fromWarehouse.siteId)) return null;
    const grouped = (payload.lines || []).filter((line) => line.sku && Number(line.qty) > 0).reduce((map, line) => {
      map.set(line.sku, Number(map.get(line.sku) || 0) + Number(line.qty));
      return map;
    }, new Map());
    const lines = [...grouped.entries()].map(([sku, qty]) => {
      const stock = next.inventory.find((row) => row.warehouseId === payload.fromWarehouseId && row.sku === sku);
      const item = next.items.find((row) => row.sku === sku);
      return { sku, qty, shippedQty: 0, receivedQty: 0, unitCost: Number(stock?.avgCost || item?.standardCost || 0) };
    });
    if (!lines.length) return null;
    const id = docSequence('TRF', next.stockTransfers);
    next.stockTransfers.unshift({
      id,
      entityId: fromWarehouse.entityId,
      siteId: fromWarehouse.siteId,
      toEntityId: toWarehouse.entityId,
      toSiteId: toWarehouse.siteId,
      date: payload.date || new Date().toISOString().slice(0, 10),
      fromWarehouseId: payload.fromWarehouseId,
      toWarehouseId: payload.toWarehouseId,
      status: 'Draft',
      requestedBy: payload.requestedBy || 'Inventory Planning',
      releasedAt: null,
      receivedAt: null,
      notes: payload.notes || '',
      lines,
      audit: [{ at: nowIso(), by: payload.requestedBy || 'Inventory Planning', action: 'Inter-site transfer dibuat sebagai Draft' }]
    });
    setData(next);
    return id;
  };

  const releaseStockTransfer = (id) => {
    const next = clone(data);
    const transfer = next.stockTransfers.find((row) => row.id === id);
    if (!transfer || transfer.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', transfer.entityId, transfer.siteId)) return false;
    const period = findPeriod(next, transfer.date, transfer.entityId || entitySiteFromWarehouse(next, transfer.fromWarehouseId).entityId, 'Open');
    if (!period) return false;
    const canRelease = transfer.lines.every((line) => {
      const stock = next.inventory.find((row) => row.warehouseId === transfer.fromWarehouseId && row.sku === line.sku);
      const available = inventoryAvailable(stock);
      return available >= Number(line.qty || 0);
    });
    if (!canRelease) return false;
    transfer.lines.forEach((line) => {
      const stock = next.inventory.find((row) => row.warehouseId === transfer.fromWarehouseId && row.sku === line.sku);
      if (!stock) return;
      const qty = Number(line.qty || 0);
      const unitCost = Number(stock.avgCost || line.unitCost || 0);
      stock.onHand = Math.max(0, Number(stock.onHand || 0) - qty);
      line.shippedQty = qty;
      line.unitCost = unitCost;
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: transfer.entityId, siteId: transfer.siteId, at: nowIso(), type: 'TRANSFER_OUT', warehouseId: transfer.fromWarehouseId, sku: line.sku, qty: -qty, unitCost, value: -qty * unitCost, balanceAfter: stock.onHand, ref: transfer.id });
    });
    transfer.status = 'In Transit';
    transfer.releasedAt = nowIso();
    transfer.audit = [...(transfer.audit || []), { at: nowIso(), by: 'Warehouse Dispatch', action: 'Transfer direlease; stock source keluar dan menjadi in-transit' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: transfer.entityId, siteId: transfer.siteId, module: 'Warehouse', documentType: 'STOCK_TRANSFER', documentId: transfer.id, action: 'RELEASE', oldValue: 'Draft', newValue: 'In Transit' });
    setData(next);
    return true;
  };

  const receiveStockTransfer = (id) => {
    const next = clone(data);
    const transfer = next.stockTransfers.find((row) => row.id === id);
    if (!transfer || transfer.status !== 'In Transit') return false;
    const receiptDate = new Date().toISOString().slice(0, 10);
    const period = findPeriod(next, receiptDate, transfer.toEntityId || transfer.entityId, 'Open');
    if (!period) return false;
    transfer.lines.forEach((line) => {
      const qty = Number(line.shippedQty || line.qty || 0);
      const unitCost = Number(line.unitCost || 0);
      if (qty <= 0) return;
      let stock = next.inventory.find((row) => row.warehouseId === transfer.toWarehouseId && row.sku === line.sku);
      const item = next.items.find((row) => row.sku === line.sku);
      if (!stock) {
        stock = { warehouseId: transfer.toWarehouseId, entityId: transfer.toEntityId || transfer.entityId, siteId: transfer.toSiteId, sku: line.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: unitCost || Number(item?.standardCost || 0) };
        next.inventory.push(stock);
      }
      const oldQty = Number(stock.onHand || 0);
      const oldCost = Number(stock.avgCost || item?.standardCost || unitCost || 0);
      stock.avgCost = oldQty + qty > 0 ? Math.round(((oldQty * oldCost) + (qty * unitCost)) / (oldQty + qty)) : unitCost;
      stock.onHand = oldQty + qty;
      line.receivedQty = qty;
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: transfer.toEntityId || transfer.entityId, siteId: transfer.toSiteId, at: nowIso(), type: 'TRANSFER_IN', warehouseId: transfer.toWarehouseId, sku: line.sku, qty, unitCost, value: qty * unitCost, balanceAfter: stock.onHand, ref: transfer.id });
    });
    transfer.status = 'Received';
    transfer.receivedAt = nowIso();
    transfer.audit = [...(transfer.audit || []), { at: nowIso(), by: 'Warehouse Receiving', action: 'Inter-site transfer diterima penuh di destination warehouse' }];
    if (transfer.replenishmentOrderId) {
      const replenishment = next.replenishmentOrders.find((row) => row.id === transfer.replenishmentOrderId);
      if (replenishment) {
        replenishment.status = 'Closed';
        replenishment.audit = [...(replenishment.audit || []), { at: nowIso(), by: 'Warehouse Receiving', action: `${transfer.id} diterima; replenishment closed` }];
      }
    }
    setData(next);
    return true;
  };

  const createStockTake = ({ warehouseId, scope: countScope = 'Cycle Count', skus = [] }) => {
    const next = clone(data);
    if (!warehouseId) return null;
    const warehouse = next.warehouses.find((row) => row.id === warehouseId);
    if (!warehouse || (scope.mode === 'ENTITY' && warehouse.entityId !== scope.entityId)) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', warehouse.entityId, warehouse.siteId)) return null;
    const selected = skus.length ? skus : next.inventory.filter((row) => row.warehouseId === warehouseId).map((row) => row.sku);
    const lines = selected.map((sku) => {
      const stock = next.inventory.find((row) => row.warehouseId === warehouseId && row.sku === sku);
      const item = next.items.find((row) => row.sku === sku);
      return { sku, systemQty: Number(stock?.onHand || 0), countQty: null, variance: 0, unitCost: Number(stock?.avgCost || item?.standardCost || 0) };
    });
    if (!lines.length) return null;
    const id = docSequence('STK', next.stockTakes);
    const date = new Date().toISOString().slice(0, 10);
    const documentNo = governedDocumentNumber(next, 'STOCK_TAKE', warehouse.entityId, warehouse.siteId, date, 'STK');
    next.stockTakes.unshift({
      id,
      documentNo,
      entityId: warehouse.entityId,
      siteId: warehouse.siteId,
      date,
      warehouseId,
      scope: countScope,
      status: 'Counting',
      requestedBy: 'Warehouse Control',
      approvedBy: null,
      postedAt: null,
      journalId: null,
      lines,
      audit: [{ at: nowIso(), by: 'Warehouse Control', action: `Stock take dibuka untuk ${lines.length} SKU` }]
    });
    setData(next);
    return id;
  };

  const updateStockTakeLine = (stockTakeId, sku, countQty) => {
    const next = clone(data);
    const stockTake = next.stockTakes.find((row) => row.id === stockTakeId);
    if (!stockTake || stockTake.status !== 'Counting') return false;
    const line = stockTake.lines.find((row) => row.sku === sku);
    if (!line) return false;
    const count = countQty === '' || countQty === null || countQty === undefined ? null : Math.max(0, Number(countQty));
    line.countQty = count;
    line.variance = count === null ? 0 : count - Number(line.systemQty || 0);
    setData(next);
    return true;
  };

  const submitStockTake = (id) => {
    const next = clone(data);
    const stockTake = next.stockTakes.find((row) => row.id === id);
    if (!stockTake || stockTake.status !== 'Counting' || stockTake.lines.some((line) => line.countQty === null || line.countQty === undefined)) return false;
    const amount = stockTake.lines.reduce((sum, line) => sum + Math.abs(Number(line.variance || 0) * Number(line.unitCost || 0)), 0);
    const approval = createApprovalRequestInData(next, { documentType: 'STOCK_TAKE', documentId: stockTake.id, entityId: stockTake.entityId, siteId: stockTake.siteId, amount, makerUserId: CURRENT_USER_ID });
    if (!approval) return false;
    stockTake.status = 'Pending Approval';
    stockTake.approvalRequestId = approval.id;
    stockTake.audit = [...(stockTake.audit || []), { at: nowIso(), by: 'Warehouse Control', action: `Count sheet selesai dan dikirim melalui ${approval.id}` }];
    setData(next);
    return true;
  };

  const approveStockTake = (id) => {
    const request = data.approvalRequests.find((row) => row.documentId === id && row.documentType === 'STOCK_TAKE' && row.status === 'Pending');
    return request ? actOnApprovalRequest(request.id, 'APPROVE') : false;
  };

  const postStockTake = (id) => {
    const next = clone(data);
    const stockTake = next.stockTakes.find((row) => row.id === id);
    if (!stockTake || stockTake.status !== 'Approved') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'warehouse.transact', stockTake.entityId, stockTake.siteId)) return false;
    const period = findPeriod(next, stockTake.date, stockTake.entityId || entitySiteFromWarehouse(next, stockTake.warehouseId).entityId, 'Open');
    if (!period) return false;
    const snapshotStillValid = stockTake.lines.every((line) => {
      const stock = next.inventory.find((row) => row.warehouseId === stockTake.warehouseId && row.sku === line.sku);
      return Number(stock?.onHand || 0) === Number(line.systemQty || 0);
    });
    if (!snapshotStillValid) return false;
    let gain = 0;
    let loss = 0;
    stockTake.lines.forEach((line) => {
      const variance = Number(line.variance || 0);
      if (!variance) return;
      let stock = next.inventory.find((row) => row.warehouseId === stockTake.warehouseId && row.sku === line.sku);
      if (!stock) {
        stock = { warehouseId: stockTake.warehouseId, entityId: stockTake.entityId, siteId: stockTake.siteId, sku: line.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: Number(line.unitCost || 0) };
        next.inventory.push(stock);
      }
      stock.onHand = Math.max(0, Number(stock.onHand || 0) + variance);
      const amount = Math.round(Math.abs(variance) * Number(line.unitCost || stock.avgCost || 0));
      if (variance > 0) gain += amount;
      else loss += amount;
      const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
      next.stockMovements.unshift({ id: movementId, entityId: stockTake.entityId, siteId: stockTake.siteId, at: nowIso(), type: variance > 0 ? 'STOCKTAKE_GAIN' : 'STOCKTAKE_LOSS', warehouseId: stockTake.warehouseId, sku: line.sku, qty: variance, unitCost: Number(line.unitCost || 0), value: variance * Number(line.unitCost || 0), balanceAfter: stock.onHand, ref: stockTake.id });
    });
    const total = gain + loss;
    if (total > 0) {
      const journalId = docSequence('JV', next.journals);
      const lines = [];
      if (gain > 0) {
        lines.push({ account: '120100', accountName: 'Merchandise Inventory', debit: gain, credit: 0 });
        lines.push({ account: '419900', accountName: 'Inventory Adjustment Gain', debit: 0, credit: gain });
      }
      if (loss > 0) {
        lines.push({ account: '519900', accountName: 'Inventory Adjustment Loss', debit: loss, credit: 0 });
        lines.push({ account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: loss });
      }
      next.journals.unshift({ id: journalId, entityId: stockTake.entityId, siteId: stockTake.siteId, date: stockTake.date, source: 'Stock Take', reference: stockTake.id, status: 'Posted', description: `Stock take variance ${stockTake.id}`, lines });
      stockTake.journalId = journalId;
    }
    stockTake.status = 'Posted';
    stockTake.postedAt = nowIso();
    stockTake.audit = [...(stockTake.audit || []), { at: nowIso(), by: 'Inventory Accounting', action: 'Stock take diposting ke inventory ledger dan GL' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: stockTake.entityId, siteId: stockTake.siteId, module: 'Warehouse', documentType: 'STOCK_TAKE', documentId: stockTake.id, action: 'POST', oldValue: 'Approved', newValue: 'Posted', severity: 'Warning' });
    setData(next);
    return true;
  };

  const addLegalEntity = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, 'ALL')) return null;
    const code = String(payload?.code || '').trim().toUpperCase();
    const name = String(payload?.name || '').trim();
    if (!code || !name || next.legalEntities.some((row) => row.code === code)) return null;
    const id = `ENT-${code}`;
    next.legalEntities.push({
      id,
      code,
      name,
      groupId: payload.groupId || scope.groupId || next.consolidationGroups[0]?.id,
      baseCurrency: payload.baseCurrency || 'IDR',
      country: payload.country || 'ID',
      taxId: payload.taxId || '',
      status: 'Active',
      colorToken: payload.colorToken || 'violet'
    });
    next.entityAccess.push({ userId: CURRENT_USER_ID, entityId: id, siteIds: [], role: 'Group Administrator' });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: id, module: 'Enterprise', documentType: 'LEGAL_ENTITY', documentId: id, action: 'CREATE', newValue: name, severity: 'Warning' });
    setData(next);
    return id;
  };

  const addSite = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', payload?.entityId || currentEntity?.id || scope.entityId, 'ALL')) return null;
    const entity = next.legalEntities.find((row) => row.id === payload?.entityId);
    const code = String(payload?.code || '').trim().toUpperCase();
    const name = String(payload?.name || '').trim();
    if (!entity || !code || !name || next.sites.some((row) => row.entityId === entity.id && row.code === code)) return null;
    const id = `SITE-${code}`;
    next.sites.push({ id, entityId: entity.id, code, name, type: payload.type || 'Branch', city: payload.city || '', status: 'Active' });
    const access = next.entityAccess.find((row) => row.userId === CURRENT_USER_ID && row.entityId === entity.id);
    if (access) access.siteIds = [...new Set([...(access.siteIds || []), id])];
    else next.entityAccess.push({ userId: CURRENT_USER_ID, entityId: entity.id, siteIds: [id], role: 'Group Administrator' });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: entity.id, siteId: id, module: 'Enterprise', documentType: 'SITE', documentId: id, action: 'CREATE', newValue: name, severity: 'Info' });
    setData(next);
    return id;
  };

  const createIntercompanyTransaction = (payload) => {
    const next = clone(data);
    const fromEntity = next.legalEntities.find((row) => row.id === payload?.fromEntityId);
    const toEntity = next.legalEntities.find((row) => row.id === payload?.toEntityId);
    if (!fromEntity || !toEntity || fromEntity.id === toEntity.id || fromEntity.groupId !== toEntity.groupId) return null;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', fromEntity.id, 'ALL')) return null;
    const type = payload.type === 'INVENTORY' ? 'INVENTORY' : 'SERVICE';
    const date = payload.date || new Date().toISOString().slice(0, 10);
    const id = docSequence('IC', next.intercompanyTransactions);
    let amount = Math.max(0, Number(payload.amount || 0));
    let costAmount = 0;
    let unitCost = 0;
    let transferPrice = 0;
    let qty = 0;
    if (type === 'INVENTORY') {
      const fromWarehouse = next.warehouses.find((row) => row.id === payload.fromWarehouseId && row.entityId === fromEntity.id);
      const toWarehouse = next.warehouses.find((row) => row.id === payload.toWarehouseId && row.entityId === toEntity.id);
      const item = next.items.find((row) => row.sku === payload.sku);
      const stock = next.inventory.find((row) => row.warehouseId === payload.fromWarehouseId && row.sku === payload.sku);
      qty = Math.max(0, Number(payload.qty || 0));
      unitCost = Number(stock?.avgCost || item?.standardCost || 0);
      transferPrice = Math.max(0, Number(payload.transferPrice || 0));
      amount = Math.round(qty * transferPrice);
      costAmount = Math.round(qty * unitCost);
      const available = inventoryAvailable(stock);
      if (!fromWarehouse || !toWarehouse || !item || qty <= 0 || transferPrice <= 0 || available < qty) return null;
    } else if (amount <= 0) return null;
    const tx = {
      id,
      groupId: fromEntity.groupId,
      type,
      date,
      fromEntityId: fromEntity.id,
      toEntityId: toEntity.id,
      fromWarehouseId: type === 'INVENTORY' ? payload.fromWarehouseId : null,
      toWarehouseId: type === 'INVENTORY' ? payload.toWarehouseId : null,
      sku: type === 'INVENTORY' ? payload.sku : null,
      qty,
      unitCost,
      transferPrice,
      amount,
      costAmount,
      endingInventoryRatio: type === 'INVENTORY' ? Math.min(1, Math.max(0, Number(payload.endingInventoryRatio ?? 1))) : 0,
      unrealizedProfit: type === 'INVENTORY' ? Math.round(Math.max(0, amount - costAmount) * Math.min(1, Math.max(0, Number(payload.endingInventoryRatio ?? 1)))) : 0,
      outstandingAmount: amount,
      description: payload.description || (type === 'SERVICE' ? 'Intercompany shared service' : 'Intercompany inventory transfer'),
      status: 'Draft',
      eliminationStatus: 'Pending',
      sourceJournalId: null,
      destinationJournalId: null,
      settlementJournalIds: [],
      audit: [{ at: nowIso(), by: 'Group Finance', action: `Intercompany ${type.toLowerCase()} dibuat sebagai Draft` }]
    };
    next.intercompanyTransactions.unshift(tx);
    setData(next);
    return id;
  };

  const postIntercompanyTransaction = (id) => {
    const next = clone(data);
    const tx = next.intercompanyTransactions.find((row) => row.id === id);
    if (!tx || tx.type !== 'SERVICE' || tx.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', tx.fromEntityId, 'ALL')) return false;
    const sourcePeriod = findPeriod(next, tx.date, tx.fromEntityId, 'Open');
    const destinationPeriod = findPeriod(next, tx.date, tx.toEntityId, 'Open');
    if (!sourcePeriod || !destinationPeriod) return false;
    const fromSiteId = next.sites.find((row) => row.entityId === tx.fromEntityId)?.id || null;
    const toSiteId = next.sites.find((row) => row.entityId === tx.toEntityId)?.id || null;
    const sourceJournalId = docSequence('JV', next.journals);
    next.journals.unshift({
      id: sourceJournalId,
      entityId: tx.fromEntityId,
      siteId: fromSiteId,
      date: tx.date,
      source: 'Intercompany Service',
      reference: tx.id,
      status: 'Posted',
      description: `${tx.description} · receivable`,
      lines: [
        { account: '114100', accountName: 'Due From Related Parties', debit: tx.amount, credit: 0, counterpartyEntityId: tx.toEntityId },
        { account: '420100', accountName: 'Intercompany Revenue', debit: 0, credit: tx.amount, counterpartyEntityId: tx.toEntityId }
      ]
    });
    const destinationJournalId = docSequence('JV', next.journals);
    next.journals.unshift({
      id: destinationJournalId,
      entityId: tx.toEntityId,
      siteId: toSiteId,
      date: tx.date,
      source: 'Intercompany Service',
      reference: tx.id,
      status: 'Posted',
      description: `${tx.description} · payable`,
      lines: [
        { account: '520100', accountName: 'Intercompany Expense', debit: tx.amount, credit: 0, counterpartyEntityId: tx.fromEntityId },
        { account: '212100', accountName: 'Due To Related Parties', debit: 0, credit: tx.amount, counterpartyEntityId: tx.fromEntityId }
      ]
    });
    tx.sourceJournalId = sourceJournalId;
    tx.destinationJournalId = destinationJournalId;
    tx.status = 'Posted';
    tx.audit = [...(tx.audit || []), { at: nowIso(), by: 'Group Finance', action: 'Dual-entry intercompany service journals posted' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: tx.fromEntityId, module: 'Enterprise', documentType: 'INTERCOMPANY_SERVICE', documentId: tx.id, action: 'POST', oldValue: 'Draft', newValue: 'Posted', severity: 'Warning' });
    setData(next);
    return true;
  };

  const releaseIntercompanyInventory = (id) => {
    const next = clone(data);
    const tx = next.intercompanyTransactions.find((row) => row.id === id);
    if (!tx || tx.type !== 'INVENTORY' || tx.status !== 'Draft') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', tx.fromEntityId, 'ALL')) return false;
    const sourcePeriod = findPeriod(next, tx.date, tx.fromEntityId, 'Open');
    if (!sourcePeriod) return false;
    const fromWarehouse = next.warehouses.find((row) => row.id === tx.fromWarehouseId && row.entityId === tx.fromEntityId);
    const stock = next.inventory.find((row) => row.warehouseId === tx.fromWarehouseId && row.sku === tx.sku);
    const available = inventoryAvailable(stock);
    if (!fromWarehouse || !stock || available < Number(tx.qty || 0)) return false;
    stock.onHand = Number(stock.onHand || 0) - Number(tx.qty);
    const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
    next.stockMovements.unshift({ id: movementId, entityId: tx.fromEntityId, siteId: fromWarehouse.siteId, at: nowIso(), type: 'INTERCOMPANY_OUT', warehouseId: tx.fromWarehouseId, sku: tx.sku, qty: -Number(tx.qty), unitCost: tx.unitCost, value: -Number(tx.costAmount), balanceAfter: stock.onHand, ref: tx.id });
    const journalId = docSequence('JV', next.journals);
    next.journals.unshift({
      id: journalId,
      entityId: tx.fromEntityId,
      siteId: fromWarehouse.siteId,
      date: tx.date,
      source: 'Intercompany Inventory',
      reference: tx.id,
      status: 'Posted',
      description: `${tx.description} · seller`,
      lines: [
        { account: '114100', accountName: 'Due From Related Parties', debit: tx.amount, credit: 0, counterpartyEntityId: tx.toEntityId },
        { account: '420100', accountName: 'Intercompany Revenue', debit: 0, credit: tx.amount, counterpartyEntityId: tx.toEntityId },
        { account: '510100', accountName: 'Cost of Goods Sold', debit: tx.costAmount, credit: 0, counterpartyEntityId: tx.toEntityId },
        { account: '120100', accountName: 'Merchandise Inventory', debit: 0, credit: tx.costAmount, counterpartyEntityId: tx.toEntityId }
      ]
    });
    tx.sourceJournalId = journalId;
    tx.status = 'In Transit';
    tx.releasedAt = nowIso();
    tx.audit = [...(tx.audit || []), { at: nowIso(), by: 'Intercompany Logistics', action: 'Intercompany inventory released; seller stock and journal posted' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: tx.fromEntityId, siteId: fromWarehouse.siteId, module: 'Enterprise', documentType: 'INTERCOMPANY_INVENTORY', documentId: tx.id, action: 'RELEASE', oldValue: 'Draft', newValue: 'In Transit', severity: 'Warning' });
    setData(next);
    return true;
  };

  const receiveIntercompanyInventory = (id) => {
    const next = clone(data);
    const tx = next.intercompanyTransactions.find((row) => row.id === id);
    if (!tx || tx.type !== 'INVENTORY' || tx.status !== 'In Transit') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', tx.toEntityId, 'ALL')) return false;
    const receiptDate = new Date().toISOString().slice(0, 10);
    const destinationPeriod = findPeriod(next, receiptDate, tx.toEntityId, 'Open');
    if (!destinationPeriod) return false;
    const toWarehouse = next.warehouses.find((row) => row.id === tx.toWarehouseId && row.entityId === tx.toEntityId);
    if (!toWarehouse) return false;
    let stock = next.inventory.find((row) => row.warehouseId === tx.toWarehouseId && row.sku === tx.sku);
    if (!stock) {
      stock = { warehouseId: tx.toWarehouseId, entityId: tx.toEntityId, siteId: toWarehouse.siteId, sku: tx.sku, onHand: 0, reserved: 0, inbound: 0, quarantine: 0, qualityHold: 0, avgCost: tx.transferPrice };
      next.inventory.push(stock);
    }
    const oldQty = Number(stock.onHand || 0);
    const oldCost = Number(stock.avgCost || tx.transferPrice || 0);
    stock.avgCost = oldQty + Number(tx.qty) > 0 ? Math.round(((oldQty * oldCost) + (Number(tx.qty) * Number(tx.transferPrice))) / (oldQty + Number(tx.qty))) : Number(tx.transferPrice);
    stock.onHand = oldQty + Number(tx.qty);
    const movementId = `MOV-${String(next.stockMovements.length + 1).padStart(4, '0')}`;
    next.stockMovements.unshift({ id: movementId, entityId: tx.toEntityId, siteId: toWarehouse.siteId, at: nowIso(), type: 'INTERCOMPANY_IN', warehouseId: tx.toWarehouseId, sku: tx.sku, qty: Number(tx.qty), unitCost: tx.transferPrice, value: Number(tx.amount), balanceAfter: stock.onHand, ref: tx.id });
    const journalId = docSequence('JV', next.journals);
    next.journals.unshift({
      id: journalId,
      entityId: tx.toEntityId,
      siteId: toWarehouse.siteId,
      date: receiptDate,
      source: 'Intercompany Inventory',
      reference: tx.id,
      status: 'Posted',
      description: `${tx.description} · buyer`,
      lines: [
        { account: '120100', accountName: 'Merchandise Inventory', debit: tx.amount, credit: 0, counterpartyEntityId: tx.fromEntityId },
        { account: '212100', accountName: 'Due To Related Parties', debit: 0, credit: tx.amount, counterpartyEntityId: tx.fromEntityId }
      ]
    });
    tx.destinationJournalId = journalId;
    tx.status = 'Posted';
    tx.receivedAt = nowIso();
    tx.audit = [...(tx.audit || []), { at: nowIso(), by: 'Intercompany Logistics', action: 'Destination received inventory and buyer journal posted' }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: tx.toEntityId, siteId: toWarehouse.siteId, module: 'Enterprise', documentType: 'INTERCOMPANY_INVENTORY', documentId: tx.id, action: 'RECEIVE', oldValue: 'In Transit', newValue: 'Posted', severity: 'Warning' });
    setData(next);
    return true;
  };

  const settleIntercompany = (id, { payerBankAccountId, receiverBankAccountId, date } = {}) => {
    const next = clone(data);
    const tx = next.intercompanyTransactions.find((row) => row.id === id);
    if (!tx || tx.status !== 'Posted' || Number(tx.outstandingAmount || 0) <= 0) return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', tx.fromEntityId, 'ALL')) return false;
    const payer = next.bankAccounts.find((row) => row.id === payerBankAccountId && row.entityId === tx.toEntityId);
    const receiver = next.bankAccounts.find((row) => row.id === receiverBankAccountId && row.entityId === tx.fromEntityId);
    const settlementDate = date || new Date().toISOString().slice(0, 10);
    if (!payer || !receiver || Number(payer.balance || 0) < Number(tx.outstandingAmount)) return false;
    if (!findPeriod(next, settlementDate, tx.fromEntityId, 'Open') || !findPeriod(next, settlementDate, tx.toEntityId, 'Open')) return false;
    const amount = Number(tx.outstandingAmount);
    const payerJournalId = docSequence('JV', next.journals);
    next.journals.unshift({ id: payerJournalId, entityId: tx.toEntityId, siteId: payer.siteId, date: settlementDate, source: 'Intercompany Settlement', reference: tx.id, status: 'Posted', description: `Settle ${tx.id} · payer`, lines: [
      { account: '212100', accountName: 'Due To Related Parties', debit: amount, credit: 0, counterpartyEntityId: tx.fromEntityId },
      { account: payer.coa, accountName: payer.name, debit: 0, credit: amount, counterpartyEntityId: tx.fromEntityId }
    ] });
    const receiverJournalId = docSequence('JV', next.journals);
    next.journals.unshift({ id: receiverJournalId, entityId: tx.fromEntityId, siteId: receiver.siteId, date: settlementDate, source: 'Intercompany Settlement', reference: tx.id, status: 'Posted', description: `Settle ${tx.id} · receiver`, lines: [
      { account: receiver.coa, accountName: receiver.name, debit: amount, credit: 0, counterpartyEntityId: tx.toEntityId },
      { account: '114100', accountName: 'Due From Related Parties', debit: 0, credit: amount, counterpartyEntityId: tx.toEntityId }
    ] });
    payer.balance = Number(payer.balance || 0) - amount;
    receiver.balance = Number(receiver.balance || 0) + amount;
    tx.outstandingAmount = 0;
    tx.status = 'Settled';
    tx.settlementJournalIds = [payerJournalId, receiverJournalId];
    tx.settledAt = nowIso();
    tx.audit = [...(tx.audit || []), { at: nowIso(), by: 'Group Treasury', action: `Intercompany outstanding ${amount} settled via bank` }];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: tx.fromEntityId, module: 'Enterprise', documentType: 'INTERCOMPANY', documentId: tx.id, action: 'SETTLE', oldValue: amount, newValue: 0, severity: 'Warning' });
    setData(next);
    return true;
  };

  const getConsolidationPreview = ({ year = 2026, month = 9, groupId = scope.groupId } = {}) => {
    const entities = data.legalEntities.filter((row) => row.groupId === groupId);
    const coa = new Map(data.chartOfAccounts.map((row) => [row.code, row]));
    const entityResults = entities.map((entity) => {
      const journals = data.journals.filter((row) => row.entityId === entity.id && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && row.status === 'Posted');
      let revenue = 0;
      let expense = 0;
      let assets = 0;
      let liabilities = 0;
      journals.forEach((journal) => (journal.lines || []).forEach((line) => {
        const meta = coa.get(line.account);
        const debit = Number(line.debit || 0);
        const credit = Number(line.credit || 0);
        if (meta?.type === 'Revenue') revenue += credit - debit;
        if (meta?.type === 'Expense') expense += debit - credit;
        if (meta?.type === 'Asset') assets += debit - credit;
        if (meta?.type === 'Liability') liabilities += credit - debit;
      }));
      const period = data.accountingPeriods.find((row) => row.entityId === entity.id && Number(row.year) === Number(year) && Number(row.month) === Number(month));
      const unpostedSales = data.salesInvoices.filter((row) => row.entityId === entity.id && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && row.postingStatus !== 'Posted').length;
      const unpostedPurchase = data.purchaseInvoices.filter((row) => row.entityId === entity.id && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && row.postingStatus !== 'Posted').length;
      const openStockTakes = data.stockTakes.filter((row) => row.entityId === entity.id && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && row.status !== 'Posted').length;
      const openTransfers = data.stockTransfers.filter((row) => row.entityId === entity.id && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && row.status === 'In Transit').length;
      const openIntercompany = data.intercompanyTransactions.filter((row) => (row.fromEntityId === entity.id || row.toEntityId === entity.id) && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && ['Draft', 'In Transit'].includes(row.status)).length;
      const journalImbalance = journals.filter((journal) => {
        const totals = journalTotals(journal);
        return Math.abs(totals.debit - totals.credit) > 0.5;
      }).length;
      return {
        entityId: entity.id,
        code: entity.code,
        name: entity.name,
        revenue,
        expense,
        netIncome: revenue - expense,
        assets,
        liabilities,
        periodStatus: period?.status || 'Missing',
        closeReady: Boolean(period && unpostedSales === 0 && unpostedPurchase === 0 && openStockTakes === 0 && openTransfers === 0 && openIntercompany === 0 && journalImbalance === 0),
        blockers: { unpostedSales, unpostedPurchase, openStockTakes, openTransfers, openIntercompany, journalImbalance }
      };
    });
    const intercompany = data.intercompanyTransactions.filter((row) => row.groupId === groupId && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && ['Posted', 'Settled'].includes(row.status));
    const eliminationRevenue = intercompany.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const unrealizedProfit = intercompany.filter((row) => row.type === 'INVENTORY').reduce((sum, row) => sum + Number(row.unrealizedProfit || 0), 0);
    // Service expense is eliminated in full. For inventory transfers, seller COGS plus the
    // realized portion of markup is eliminated; only ending-inventory markup remains as a
    // group P&L reduction. This keeps group earnings from overstating unrealized IC profit.
    const eliminationExpense = intercompany.reduce((sum, row) => {
      if (row.type === 'SERVICE') return sum + Number(row.amount || 0);
      return sum + Math.max(0, Number(row.amount || 0) - Number(row.unrealizedProfit || 0));
    }, 0);
    const dueFrom = intercompany.reduce((sum, row) => sum + Number(row.outstandingAmount || 0), 0);
    const dueTo = dueFrom;
    const totalRevenue = entityResults.reduce((sum, row) => sum + row.revenue, 0);
    const totalExpense = entityResults.reduce((sum, row) => sum + row.expense, 0);
    const consolidatedRevenue = totalRevenue - eliminationRevenue;
    const consolidatedExpense = totalExpense - eliminationExpense;
    const consolidatedNetIncome = consolidatedRevenue - consolidatedExpense;
    return {
      groupId,
      year,
      month,
      entityResults,
      totalRevenue,
      totalExpense,
      preEliminationNetIncome: totalRevenue - totalExpense,
      eliminations: { revenue: eliminationRevenue, expense: eliminationExpense, dueFrom, dueTo, unrealizedProfit },
      consolidatedRevenue,
      consolidatedExpense,
      consolidatedNetIncome,
      allEntitiesClosed: entityResults.every((row) => row.periodStatus === 'Closed'),
      allEntitiesReady: entityResults.every((row) => row.closeReady)
    };
  };

  const prepareConsolidation = ({ year = 2026, month = 9, groupId = scope.groupId } = {}) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', currentEntity?.id || scope.entityId, 'ALL')) return null;
    const existing = next.consolidationRuns.find((row) => row.groupId === groupId && Number(row.year) === Number(year) && Number(row.month) === Number(month) && row.status !== 'Cancelled');
    if (existing) return existing.id;
    const snapshot = getConsolidationPreview({ year, month, groupId });
    const id = docSequence('CONS', next.consolidationRuns);
    next.consolidationRuns.unshift({ id, groupId, year, month, status: 'Prepared', preparedAt: nowIso(), postedAt: null, snapshot, audit: [{ at: nowIso(), by: 'Group Consolidation', action: 'Consolidation preview prepared' }] });
    next.intercompanyTransactions.forEach((row) => {
      if (row.groupId === groupId && Number(row.date?.slice(0, 4)) === Number(year) && Number(row.date?.slice(5, 7)) === Number(month) && ['Posted', 'Settled'].includes(row.status)) row.eliminationStatus = 'Prepared';
    });
    setData(next);
    return id;
  };

  const postConsolidation = (id) => {
    const next = clone(data);
    const run = next.consolidationRuns.find((row) => row.id === id);
    if (!run || run.status !== 'Prepared') return false;
    if (!userHasPermission(next, CURRENT_USER_ID, 'enterprise.post', currentEntity?.id || scope.entityId, 'ALL')) return false;
    const preview = getConsolidationPreview({ year: run.year, month: run.month, groupId: run.groupId });
    if (!preview.allEntitiesClosed) return false;
    run.status = 'Posted';
    run.postedAt = nowIso();
    run.snapshot = preview;
    run.audit = [...(run.audit || []), { at: nowIso(), by: 'Group Consolidation', action: 'Consolidation posted after all legal entities closed' }];
    next.intercompanyTransactions.forEach((row) => {
      if (row.groupId === run.groupId && Number(row.date?.slice(0, 4)) === Number(run.year) && Number(row.date?.slice(5, 7)) === Number(run.month) && ['Posted', 'Settled'].includes(row.status)) row.eliminationStatus = 'Eliminated';
    });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, module: 'Enterprise', documentType: 'CONSOLIDATION', documentId: run.id, action: 'POST', oldValue: 'Prepared', newValue: 'Posted', severity: 'Warning' });
    setData(next);
    return true;
  };

  const actOnApprovalRequest = (requestId, action = 'APPROVE', note = '') => {
    const next = clone(data);
    const request = next.approvalRequests.find((row) => row.id === requestId);
    if (!request || request.status !== 'Pending') return false;
    const policy = next.approvalPolicies.find((row) => row.id === request.policyId);
    const step = request.steps.find((row) => Number(row.sequence) === Number(request.currentStep) && row.status === 'Pending');
    if (!step) return false;
    const delegated = activeDelegationForRole(next, CURRENT_USER_ID, step.roleId, request.entityId);
    const directRole = userHasRole(next, CURRENT_USER_ID, step.roleId, request.entityId, request.siteId || 'ALL');
    const override = userCanOverrideSod(next, CURRENT_USER_ID, request.entityId, request.siteId || 'ALL');
    if (!directRole && !delegated && !override) return false;
    const selfApproval = request.makerUserId === CURRENT_USER_ID;
    if (selfApproval && policy?.allowSelfApproval === false && !override) return false;
    const actor = next.users.find((row) => row.id === CURRENT_USER_ID);
    const actedByName = actor?.name || 'Current User';
    if (action === 'REJECT') {
      step.status = 'Rejected';
      step.actedByUserId = CURRENT_USER_ID;
      step.actedAt = nowIso();
      step.note = note || 'Rejected from governed approval inbox';
      request.status = 'Rejected';
      request.completedAt = nowIso();
      request.rejectionReason = step.note;
      if (['SALES_ORDER','CREDIT_OVERRIDE'].includes(request.documentType)) {
        const row = next.salesOrders.find((item) => item.id === request.documentId);
        if (row) { row.status = 'Rejected'; row.approvalStatus = 'Rejected'; appendAudit(row, `Approval ${request.id} rejected: ${step.note}`, actedByName); }
      }
      if (request.documentType === 'PURCHASE_REQUEST') {
        const row = next.purchaseRequests.find((item) => item.id === request.documentId);
        if (row) { row.status = 'Rejected'; row.approvalStatus = 'Rejected'; row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: `Approval ${request.id} rejected: ${step.note}` }]; }
      }
      if (request.documentType === 'PURCHASE_ORDER') {
        const row = next.purchaseOrders.find((item) => item.id === request.documentId);
        if (row) { row.status = 'Rejected'; row.approvalStatus = 'Rejected'; row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: `Approval ${request.id} rejected: ${step.note}` }]; }
      }
      if (request.documentType === 'STOCK_TAKE') {
        const row = next.stockTakes.find((item) => item.id === request.documentId);
        if (row) { row.status = 'Counting'; row.audit = [...(row.audit || []), { at: nowIso(), by: actedByName, action: `Variance approval rejected; count sheet reopened: ${step.note}` }]; }
      }
      pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: request.entityId, siteId: request.siteId, module: 'Approval', documentType: request.documentType, documentId: request.documentId, action: 'REJECT', oldValue: 'Pending', newValue: 'Rejected', severity: 'Warning' });
      pushNotification(next, { userId: request.makerUserId, entityId: request.entityId, siteId: request.siteId, type: 'Approval', title: `${request.documentId} ditolak`, message: step.note, link: '/approvals', priority: 'High' });
      setData(next);
      return true;
    }
    step.status = 'Approved';
    step.actedByUserId = CURRENT_USER_ID;
    step.actedAt = nowIso();
    step.note = note || (delegated ? `Approved under delegation ${delegated.id}` : override && !directRole ? 'Approved with SoD override' : 'Approved');
    const remaining = request.steps.filter((row) => row.status === 'Pending').sort((a, b) => Number(a.sequence) - Number(b.sequence));
    const approvalMode = delegated ? 'Delegated Approval' : override && (!directRole || selfApproval) ? 'SoD Override' : 'Role Approval';
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: request.entityId, siteId: request.siteId, module: 'Approval', documentType: request.documentType, documentId: request.documentId, action: 'APPROVE', field: `step_${step.sequence}`, oldValue: 'Pending', newValue: `${approvalMode} · ${step.label}`, severity: approvalMode === 'SoD Override' ? 'Warning' : 'Info' });
    if (remaining.length) {
      request.currentStep = remaining[0].sequence;
      notifyApprovalRole(next, request, remaining[0]);
    } else {
      request.status = 'Approved';
      request.completedAt = nowIso();
      finalizeApprovedDocument(next, request, actedByName);
      pushNotification(next, { userId: request.makerUserId, entityId: request.entityId, siteId: request.siteId, type: 'Approval', title: `${request.documentId} approved`, message: `Approval workflow ${request.id} selesai.`, link: '/approvals', priority: 'Medium' });
    }
    setData(next);
    return true;
  };

  const rejectApprovalRequest = (requestId, reason = 'Rejected by approver') => actOnApprovalRequest(requestId, 'REJECT', reason);

  const createUser = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return null;
    if (!payload?.name || !payload?.username || next.users.some((row) => row.username.toLowerCase() === payload.username.toLowerCase())) return null;
    const id = `USR-${String(next.users.length + 1).padStart(4, '0')}`;
    next.users.unshift({ id, username: payload.username, name: payload.name, email: payload.email || '', status: 'Active', mfaEnabled: Boolean(payload.mfaEnabled), lastLoginAt: null, sessionStatus: 'Never' });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, siteId: currentSite?.id, module: 'Security', documentType: 'USER', documentId: id, action: 'CREATE', newValue: payload.username });
    setData(next);
    return id;
  };

  const updateUserSecurity = (userId, patch) => {
    const next = clone(data);
    const user = next.users.find((row) => row.id === userId);
    if (!user || !userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id, currentSite?.id || 'ALL')) return false;
    const before = JSON.stringify({ status: user.status, mfaEnabled: user.mfaEnabled });
    Object.assign(user, patch);
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, siteId: currentSite?.id, module: 'Security', documentType: 'USER', documentId: userId, action: 'UPDATE', field: 'security', oldValue: before, newValue: JSON.stringify({ status: user.status, mfaEnabled: user.mfaEnabled }), severity: 'Warning' });
    setData(next);
    return true;
  };

  const createRole = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return null;
    if (!payload?.name || !payload?.code || next.roles.some((row) => row.code.toLowerCase() === payload.code.toLowerCase())) return null;
    const id = `ROLE-${String(next.roles.length + 1).padStart(3, '0')}`;
    next.roles.unshift({ id, code: payload.code.toUpperCase(), name: payload.name, privileged: Boolean(payload.privileged), sodOverride: Boolean(payload.sodOverride), permissions: payload.permissions || [], description: payload.description || '' });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, module: 'Security', documentType: 'ROLE', documentId: id, action: 'CREATE', newValue: payload.name });
    setData(next);
    return id;
  };

  const updateRolePermissions = (roleId, permissions) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return false;
    const role = next.roles.find((row) => row.id === roleId);
    if (!role || role.permissions?.includes('*')) return false;
    const oldValue = (role.permissions || []).join(',');
    role.permissions = [...new Set(permissions || [])];
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, module: 'Security', documentType: 'ROLE', documentId: roleId, action: 'UPDATE_PERMISSION', oldValue, newValue: role.permissions.join(','), severity: 'Warning' });
    setData(next);
    return true;
  };

  const assignUserRole = ({ userId, roleId, entityId, siteIds = ['ALL'] }) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return null;
    const user = next.users.find((row) => row.id === userId);
    const role = next.roles.find((row) => row.id === roleId);
    const entity = next.legalEntities.find((row) => row.id === entityId);
    if (!user || !role || !entity) return null;
    const mfaRequired = next.systemPolicies.find((row) => row.key === 'privileged_mfa_required')?.value === true;
    if (role.privileged && mfaRequired && !user.mfaEnabled) return null;
    const duplicate = next.userRoleAssignments.find((row) => row.userId === userId && row.roleId === roleId && row.entityId === entityId && row.status === 'Active');
    if (duplicate) return duplicate.id;
    const id = `URA-${String(next.userRoleAssignments.length + 1).padStart(4, '0')}`;
    next.userRoleAssignments.unshift({ id, userId, roleId, entityId, siteIds: siteIds.length ? siteIds : ['ALL'], status: 'Active' });
    if (!next.entityAccess.some((row) => row.userId === userId && row.entityId === entityId)) next.entityAccess.push({ userId, entityId, siteIds, role: role.name });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId, module: 'Security', documentType: 'ROLE_ASSIGNMENT', documentId: id, action: 'ASSIGN', newValue: `${user.name} → ${role.name}`, severity: role.privileged ? 'Warning' : 'Info' });
    setData(next);
    return id;
  };

  const createApprovalPolicy = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return null;
    if (!payload?.name || !payload?.documentType || !payload?.roleId) return null;
    const id = `APR-RULE-${String(next.approvalPolicies.length + 1).padStart(3, '0')}`;
    next.approvalPolicies.unshift({ id, name: payload.name, documentType: payload.documentType, entityId: payload.entityId || 'ALL', minAmount: Number(payload.minAmount || 0), maxAmount: payload.maxAmount === '' || payload.maxAmount === null || payload.maxAmount === undefined ? null : Number(payload.maxAmount), mode: 'SEQUENTIAL', allowSelfApproval: Boolean(payload.allowSelfApproval), status: 'Active', steps: [{ sequence: 1, roleId: payload.roleId, label: next.roles.find((row) => row.id === payload.roleId)?.name || payload.roleId }] });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: payload.entityId === 'ALL' ? currentEntity?.id : payload.entityId, module: 'Approval', documentType: 'POLICY', documentId: id, action: 'CREATE', newValue: payload.name, severity: 'Warning' });
    setData(next);
    return id;
  };

  const createDelegation = (payload) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return null;
    if (!payload?.fromUserId || !payload?.toUserId || payload.fromUserId === payload.toUserId || !payload.roleId || !payload.startDate || !payload.endDate || payload.endDate < payload.startDate) return null;
    const id = `DEL-${String(next.approvalDelegations.length + 1).padStart(4, '0')}`;
    next.approvalDelegations.unshift({ id, fromUserId: payload.fromUserId, toUserId: payload.toUserId, roleId: payload.roleId, entityId: payload.entityId || 'ALL', startDate: payload.startDate, endDate: payload.endDate, reason: payload.reason || '', status: 'Active' });
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: payload.entityId === 'ALL' ? currentEntity?.id : payload.entityId, module: 'Approval', documentType: 'DELEGATION', documentId: id, action: 'CREATE', newValue: `${payload.fromUserId} → ${payload.toUserId}`, severity: 'Warning' });
    setData(next);
    return id;
  };

  const setDelegationStatus = (delegationId, status) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return false;
    const row = next.approvalDelegations.find((item) => item.id === delegationId);
    if (!row || !['Active','Revoked'].includes(status)) return false;
    const oldValue = row.status;
    row.status = status;
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: row.entityId === 'ALL' ? currentEntity?.id : row.entityId, module: 'Approval', documentType: 'DELEGATION', documentId: row.id, action: 'STATUS', oldValue, newValue: status, severity: 'Warning' });
    setData(next);
    return true;
  };

  const updateDocumentNumberRule = (ruleId, patch) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return false;
    const row = next.documentNumberRules.find((item) => item.id === ruleId);
    if (!row) return false;
    const oldValue = JSON.stringify({ template: row.template, reset: row.reset, status: row.status });
    Object.assign(row, patch);
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, module: 'Setup', documentType: 'NUMBERING_RULE', documentId: row.id, action: 'UPDATE', oldValue, newValue: JSON.stringify({ template: row.template, reset: row.reset, status: row.status }), severity: 'Warning' });
    setData(next);
    return true;
  };

  const previewDocumentNumber = (documentType, entityId = currentEntity?.id, siteId = currentSite?.id || currentSites[0]?.id, date = new Date().toISOString().slice(0, 10)) => {
    const next = clone(data);
    return governedDocumentNumber(next, documentType, entityId, siteId, date, documentType) || 'No active numbering rule';
  };

  const updateSystemPolicy = (policyId, value) => {
    const next = clone(data);
    if (!userHasPermission(next, CURRENT_USER_ID, 'security.manage', currentEntity?.id || scope.entityId, currentSite?.id || 'ALL')) return false;
    const row = next.systemPolicies.find((item) => item.id === policyId);
    if (!row) return false;
    const oldValue = row.value;
    row.value = value;
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: currentEntity?.id, module: 'Setup', documentType: 'SYSTEM_POLICY', documentId: row.id, action: 'UPDATE', field: row.key, oldValue, newValue: value, severity: 'Warning' });
    setData(next);
    return true;
  };

  const markNotificationRead = (notificationId) => {
    const next = clone(data);
    const row = next.notifications.find((item) => item.id === notificationId && item.userId === CURRENT_USER_ID);
    if (!row) return false;
    row.readAt = row.readAt || nowIso();
    setData(next);
    return true;
  };

  const markAllNotificationsRead = () => {
    const next = clone(data);
    next.notifications.filter((row) => row.userId === CURRENT_USER_ID && !row.readAt).forEach((row) => { row.readAt = nowIso(); });
    setData(next);
    return true;
  };

  const setAccountingPeriodStatus = (periodId, status) => {
    const next = clone(data);
    const period = next.accountingPeriods.find((row) => row.id === periodId);
    if (!period || !['Open', 'Closed'].includes(status) || !userHasPermission(next, CURRENT_USER_ID, 'finance.close', period.entityId, 'ALL')) return false;
    const oldValue = period.status;
    period.status = status;
    pushAuditEvent(next, { userId: CURRENT_USER_ID, entityId: period.entityId, module: 'Finance', documentType: 'ACCOUNTING_PERIOD', documentId: period.id, action: status === 'Closed' ? 'CLOSE' : 'REOPEN', field: 'status', oldValue, newValue: status, severity: 'Warning' });
    setData(next);
    return true;
  };

  const value = useMemo(() => ({
    data: scopedData,
    rawData: data,
    scope,
    currentUserId: CURRENT_USER_ID,
    currentUser,
    currentRoles,
    hasPermission,
    getDocumentLockState,
    accessibleEntities,
    currentEntity,
    currentSite,
    currentSites,
    setEntityScope,
    setSiteScope,
    setGroupScope,
    resetDemo,
    addCustomer,
    addSupplier,
    addWarehouse,
    addWarehouseLocation,
    addItem,
    adjustStock,
    createSalesOrder,
    submitSalesOrder,
    approveSalesOrder,
    reserveSalesOrder,
    createPickingFromSalesOrder,
    completePicking,
    createDeliveryFromPicking,
    updateDelivery,
    setDeliveryStatus,
    createShipmentFromDelivery,
    updateShipment,
    dispatchShipment,
    deliverShipment,
    createSalesInvoiceFromOrder,
    postSalesInvoice,
    createReceipt,
    createPurchaseRequest,
    submitPurchaseRequest,
    approvePurchaseRequest,
    createRFQFromPurchaseRequest,
    updateRFQPrice,
    createPurchaseOrder,
    convertRFQToPurchaseOrder,
    submitPurchaseOrder,
    approvePurchaseOrder,
    createReceivingFromPO,
    updateReceivingLine,
    postReceiving,
    putAwayReceiving,
    createPurchaseInvoiceFromReceiving,
    postPurchaseInvoice,
    createSupplierPayment,
    createSalesReturn,
    submitSalesReturn,
    approveSalesReturn,
    receiveSalesReturn,
    updateSalesReturnDisposition,
    postSalesReturn,
    createPurchaseReturn,
    submitPurchaseReturn,
    approvePurchaseReturn,
    postPurchaseReturn,
    generateReplenishmentOrder,
    updateReplenishmentQty,
    convertReplenishmentToTransfer,
    createQualityCase,
    applyQualityHold,
    resolveQualityCase,
    startLotRecall,
    closeRecall,
    createStockTransfer,
    releaseStockTransfer,
    receiveStockTransfer,
    createStockTake,
    updateStockTakeLine,
    submitStockTake,
    approveStockTake,
    postStockTake,
    addLegalEntity,
    addSite,
    createIntercompanyTransaction,
    postIntercompanyTransaction,
    releaseIntercompanyInventory,
    receiveIntercompanyInventory,
    settleIntercompany,
    getConsolidationPreview,
    prepareConsolidation,
    postConsolidation,
    actOnApprovalRequest,
    rejectApprovalRequest,
    createUser,
    updateUserSecurity,
    createRole,
    updateRolePermissions,
    assignUserRole,
    createApprovalPolicy,
    createDelegation,
    setDelegationStatus,
    updateDocumentNumberRule,
    previewDocumentNumber,
    updateSystemPolicy,
    markNotificationRead,
    markAllNotificationsRead,
    setAccountingPeriodStatus
  }), [data, scope, scopedData]);

  return <ERPDataContext.Provider value={value}>{children}</ERPDataContext.Provider>;
}

export function useERPData() {
  const context = useContext(ERPDataContext);
  if (!context) throw new Error('useERPData must be used inside ERPDataProvider');
  return context;
}
