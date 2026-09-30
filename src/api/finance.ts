import { erpApi } from './erpApi';
import { ensureApiSession } from './session';
import type { CoreScope } from './core';

export interface FinancePeriod { id:string; periodCode:string; label:string; startDate:string; endDate:string; status:string; closedAt?:string }
export interface FinanceAccount { id:string; code:string; name:string; type:string; normalBalance:string; allowManualPosting:boolean }
export interface FinanceBankAccount { id:string; code:string; name:string; type:string; currency:string; balance:number; siteCode:string }
export interface FinanceSource { id:string; documentNo:string; date:string; partyCode:string; partyName:string; siteCode:string; total:number; purchaseOrderNo?:string; salesOrderNo?:string; availableQty?:number; status?:string }
export interface SalesInvoiceSourceLine { shipmentLineId:string; salesOrderLineId:string; sku:string; itemName:string; uom:string; shippedQty:number; invoicedQty:number; availableQty:number; unitPrice:number; discountPercent:number; taxRate:number; taxCode:string; gross:number; discount:number; dpp:number; tax:number; total:number }
export interface SalesInvoiceSource { id:string; documentNo:string; salesOrderNo:string; customerName:string; status:string; siteCode:string; podDate:string; lines:SalesInvoiceSourceLine[] }
export interface SalesInvoiceLine { id:string; lineNo:number; sku:string; itemName:string; uom:string; qty:number; unitPrice:number; discountPercent:number; gross:number; discount:number; dpp:number; taxRate:number; tax:number; total:number; taxCode:string; shipmentLineId:string; salesOrderLineId:string }
export interface SalesInvoiceDetail { id:string; documentNo:string; status:string; invoiceDate:string; dueDate:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; paidAmount:number; paymentTerms:string; customerPo:string; billingAddress:string; shippingAddress:string; salesOrderNo:string; shipmentNo:string; journalNo:string; customer:{code:string;name:string}; company:{code:string;legalName:string;taxId:string}; site:{code:string;name:string}; lines:SalesInvoiceLine[] }
export interface FinanceBootstrap { periods:FinancePeriod[]; accounts:FinanceAccount[]; bankAccounts:FinanceBankAccount[]; salesInvoiceSources:FinanceSource[]; purchaseInvoiceSources:FinanceSource[] }
export interface FinanceInvoice { id:string; documentNo:string; invoiceDate:string; dueDate:string; status:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; paidAmount:number; siteCode:string; journalNo:string; shipmentNo?:string; customerCode?:string; customerName?:string; supplierCode?:string; supplierName?:string; salesOrderNo?:string; purchaseOrderNo?:string; goodsReceiptNo?:string; supplierInvoiceNo?:string; matchStatus?:string }
export interface OpenItem { id:string; documentNo:string; invoiceDate:string; dueDate:string; originalAmount:number; outstanding:number; status:string; partyCode:string; partyName:string; siteCode:string; invoiceId:string; daysPastDue?:number; agingBucket?:string; asOfDate?:string }
export interface ReceiptAllocation { invoiceId:string; invoiceNo:string; amount:number; invoiceTotal:number; currentOutstanding:number }
export interface ReceiptDetail extends CashTransaction { allocations:ReceiptAllocation[] }
export interface ReceiptInput { amount:number; receiptDate:string; bankAccountCode:string; method:string; reference:string; customerCode?:string; allocations:{salesInvoiceId:string;amount:number}[] }
export interface CashTransaction { id:string; documentNo:string; date:string; method:string; reference:string; amount:number; status:string; partyCode:string; partyName:string; bankAccountCode:string; siteCode:string; journalNo:string }
export interface JournalRow { id:string; documentNo:string; postingDate:string; sourceType:string; referenceType:string; referenceId:string; status:string; description:string; siteCode:string; debit:number; credit:number }
export interface TrialBalanceRow { code:string; name:string; type:string; debit:number; credit:number; balance:number }

type Envelope<T> = { data:T };
async function options(scope:CoreScope, command=false) {
  const session = await ensureApiSession();
  return { token:session.accessToken, entityId:scope.entityCode, siteId:scope.siteCode || undefined, idempotencyKey:command ? crypto.randomUUID() : undefined };
}

export const financeApi = {
  bootstrap: async (scope:CoreScope) => (await erpApi.get<Envelope<FinanceBootstrap>>('/finance/bootstrap', await options(scope))).data,
  journals: async (scope:CoreScope) => (await erpApi.get<Envelope<JournalRow[]>>('/finance/journals', await options(scope))).data,
  trialBalance: async (scope:CoreScope) => (await erpApi.get<Envelope<TrialBalanceRow[]>>('/finance/trial-balance', await options(scope))).data,
  salesInvoices: async (scope:CoreScope) => (await erpApi.get<Envelope<FinanceInvoice[]>>('/finance/sales-invoices', await options(scope))).data,
  purchaseInvoices: async (scope:CoreScope) => (await erpApi.get<Envelope<FinanceInvoice[]>>('/finance/purchase-invoices', await options(scope))).data,
  ar: async (scope:CoreScope) => (await erpApi.get<Envelope<OpenItem[]>>('/finance/ar', await options(scope))).data,
  ap: async (scope:CoreScope) => (await erpApi.get<Envelope<OpenItem[]>>('/finance/ap', await options(scope))).data,
  receipts: async (scope:CoreScope) => (await erpApi.get<Envelope<CashTransaction[]>>('/finance/customer-receipts', await options(scope))).data,
  receiptDetail: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<ReceiptDetail>>(`/finance/customer-receipts/${id}`,await options(scope))).data,
  supplierPayments: async (scope:CoreScope) => (await erpApi.get<Envelope<CashTransaction[]>>('/finance/supplier-payments', await options(scope))).data,

  salesInvoiceSource: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<SalesInvoiceSource>>(`/finance/sales-invoice-sources/${id}`, await options(scope))).data,
  salesInvoiceDetail: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<SalesInvoiceDetail>>(`/finance/sales-invoices/${id}`, await options(scope))).data,
  createSalesInvoice: async (scope:CoreScope,payload:{sourceId:string;date:string;lines:{shipmentLineId:string;qty:number}[]}) => erpApi.post('/finance/sales-invoices',payload,await options(scope,true)),
  deleteSalesInvoice: async (scope:CoreScope,id:string) => erpApi.delete(`/finance/sales-invoices/${id}`,await options(scope,true)),
  postSalesInvoice: async (scope:CoreScope,id:string) => erpApi.post(`/finance/sales-invoices/${id}/post`,{},await options(scope,true)),
  createReceipt: async (scope:CoreScope,payload:ReceiptInput) => erpApi.post<ReceiptInput,{documentNo:string;amount:number;journalNo:string}>('/finance/customer-receipts',payload,await options(scope,true)),
  createPurchaseInvoice: async (scope:CoreScope,sourceId:string,date:string,externalReference:string) => erpApi.post('/finance/purchase-invoices',{sourceId,date,externalReference},await options(scope,true)),
  postPurchaseInvoice: async (scope:CoreScope,id:string) => erpApi.post(`/finance/purchase-invoices/${id}/post`,{},await options(scope,true)),
  createSupplierPayment: async (scope:CoreScope,payload:unknown) => erpApi.post('/finance/supplier-payments',payload,await options(scope,true)),
  postManualJournal: async (scope:CoreScope,payload:unknown) => erpApi.post('/finance/journals',payload,await options(scope,true)),
  closePeriod: async (scope:CoreScope,id:string) => erpApi.post(`/finance/periods/${id}/close`,{},await options(scope,true)),
  reopenPeriod: async (scope:CoreScope,id:string) => erpApi.post(`/finance/periods/${id}/reopen`,{},await options(scope,true)),
};
