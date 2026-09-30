import { erpApi } from './erpApi';
import { ensureApiSession } from './session';

export interface CoreScope { entityCode: string; siteCode?: string }
export interface CoreItem { id:string; sku:string; name:string; uom:string; standardCost:number; salesPrice:number; taxRate:number; reorderPoint:number; maxStock:number }
export interface CoreMaster { id:string; code:string; name:string; [key:string]: unknown }
export interface CoreTaxCode { id:string; code:string; name:string; rate:number; treatment:string; validFrom?:string; validTo?:string }
export interface CoreUomConversion { sku:string; uom:string; factor:number; inventoryUom:string }
export interface CoreUomUnit { code:string; name:string; dimension:string }
export interface CoreBootstrap { customers:CoreMaster[]; suppliers:CoreMaster[]; items:CoreItem[]; warehouses:CoreMaster[]; taxCodes:CoreTaxCode[]; uomUnits:CoreUomUnit[]; uomConversions:CoreUomConversion[] }
export interface CoreSalesOrder { id:string; documentNo:string; orderDate:string; requestedDeliveryDate?:string; status:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; customerCode:string; customerName:string; warehouseCode:string; siteCode:string; qty:number; reservedQty:number; shippedQty:number; pickingAllocatedQty:number; pickingAvailableQty:number; customerPo?:string; paymentTerms?:string; revisionNo:number }
export interface CoreSalesOrderLine { id:string; lineNo:number; sku:string; itemName:string; description?:string; uom:string; qty:number; unitPrice:number; discountPercent:number; discountAmount:number; dpp:number; taxCode:string; taxName:string; taxTreatment:string; taxRate:number; taxAmount:number; lineTotal:number; reservedQty:number; pickedQty:number; shippedQty:number; onHandStock:number; warehouseReservedStock:number; availableStock:number }
export interface CoreSalesOrderTaxSummary { taxCode:string; taxName:string; treatment:string; rate:number; dpp:number; taxAmount:number; total:number; lineCount:number }
export interface CoreSalesOrderHistory { id?:string; occurredAt:string; status?:string; action:string; actor:string; requestId?:string; module?:string; before?:string; after?:string; metadata?:string }
export interface CoreRelatedDocument { documentType:string; id:string; documentNo:string; status:string; documentDate:string; relation?:string }
export interface CoreSalesOrderFulfillment { lineCount:number; orderedQty:number; reservedQty:number; pickedQty:number; pickingAllocatedQty:number; pickingAvailableQty:number; deliveryQty:number; shippedQty:number; remainingToShipQty:number }
export interface CoreSalesOrderDetail { id:string; documentNo:string; orderDate:string; requestedDeliveryDate?:string; status:string; currency:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; customerPo?:string; paymentTerms?:string; billingAddress?:string; shippingAddress?:string; salesperson?:string; notes?:string; internalNotes?:string; cancelReason?:string; cancelledAt?:string; revisionNo:number; createdAt:string; updatedAt:string; createdBy?:string; customer:{code:string;name:string}; warehouse:{code:string;name:string}; company?:{code:string;legalName:string;taxId?:string;currency?:string;timezone?:string}; site?:{code:string;name:string}; siteCode:string; entityCode:string; lines:CoreSalesOrderLine[]; taxSummary:CoreSalesOrderTaxSummary[]; fulfillment:CoreSalesOrderFulfillment; approvalHistory:CoreSalesOrderHistory[]; auditTrail:CoreSalesOrderHistory[]; audit?:CoreSalesOrderHistory[]; relatedDocuments:CoreRelatedDocument[] }
export interface CorePurchaseOrder { id:string; documentNo:string; orderDate:string; etaDate:string; status:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; supplierCode:string; supplierName:string; warehouseCode:string; siteCode:string; qty:number; receivedQty:number; putawayQty:number; revisionNo:number }
export interface CorePurchaseOrderLine { id:string; lineNo:number; sku:string; itemName:string; uom:string; description:string; qty:number; unitPrice:number; effectiveUnitPrice:number; discountPercent:number; discountAmount:number; dpp:number; taxCode:string; taxName:string; taxRate:number; taxAmount:number; lineTotal:number; receivedQty:number; putawayQty:number; remainingQty:number }
export interface CorePurchaseOrderDetail { id:string; documentNo:string; orderDate:string; etaDate:string; status:string; currency:string; subtotal:number; discount:number; dpp:number; tax:number; total:number; supplierReference:string; paymentTerms:string; notes:string; revisionNo:number; cancelReason:string; cancelledAt?:string; createdAt:string; updatedAt:string; createdBy:string; entityCode:string; siteCode:string; company:{code:string;legalName:string;taxId:string}; site:{code:string;name:string}; supplier:{code:string;name:string;paymentTerms:string}; warehouse:{code:string;name:string}; lines:CorePurchaseOrderLine[]; taxSummary:{taxCode:string;dpp:number;taxAmount:number;total:number;lineCount:number}[]; auditTrail:{occurredAt:string;action:string;actor:string;after:string}[]; relatedDocuments:{documentType:string;id:string;documentNo:string;status:string;documentDate:string}[] }
export interface CoreInventory { warehouseCode:string; warehouseName:string; siteCode:string; sku:string; itemName:string; uom:string; onHand:number; reserved:number; inbound:number; available:number; averageCost:number; inventoryValue:number; rowVersion:number }
export interface CoreReceipt { id:string; documentNo:string; receiptDate:string; status:string; purchaseOrderNo:string; warehouseCode:string; siteCode:string; acceptedQty:number; rejectedQty:number }
export interface CoreGoodsReceiptDetail { id:string; documentNo:string; status:string; receiptDate:string; receivedAt?:string; putawayAt?:string; purchaseOrder:{id:string;documentNo:string;status:string}; supplier:{code:string;name:string}; warehouse:{code:string;name:string}; company:{code:string;legalName:string}; siteCode:string; acceptedQty:number; rejectedQty:number; inboundValue:number; lines:{lineNo:number;sku:string;itemName:string;uom:string;expectedQty:number;acceptedQty:number;rejectedQty:number;lotNo:string;putAwayLocation:string;unitCost:number;lineCost:number}[] }
export interface CoreTransfer { id:string; documentNo:string; transferDate:string; status:string; sourceWarehouseCode:string; destinationWarehouseCode:string; siteCode:string; qty:number; shippedQty:number; receivedQty:number }
export interface CoreMovement { id:string; occurredAt:string; type:string; warehouseCode:string; sku:string; qty:number; unitCost:number; value:number; balanceAfter:number; referenceType:string; referenceId:string }
export interface CorePickingOrder { id:string; documentNo:string; status:string; createdAt:string; startedAt?:string; completedAt?:string; salesOrderId:string; salesOrderNo:string; customerCode:string; customerName:string; warehouseCode:string; warehouseName:string; siteCode:string; picker?:string; requestedQty:number; pickedQty:number; shortageQty:number; lineCount:number }
export interface CorePickingLine { id:string; lineNo:number; salesOrderLineId:string; sku:string; itemName:string; uom:string; requestedQty:number; pickedQty:number; shortageQty:number; location?:string; lotNo?:string; salesOrderReservedQty:number; salesOrderShippedQty:number; deliveryAllocatedQty:number; availableForDeliveryQty:number }
export interface CorePickingDetail { id:string; documentNo:string; status:string; createdAt:string; startedAt?:string; completedAt?:string; cancelReason?:string; salesOrder:{id:string;documentNo:string;status:string}; customer:{code:string;name:string}; warehouse:{code:string;name:string}; entityCode:string; siteCode:string; picker?:string; lines:CorePickingLine[] }
export interface CoreDeliveryOrder { id:string; documentNo:string; status:string; deliveryDate:string; createdAt:string; salesOrderId:string; salesOrderNo:string; pickingOrderId:string; pickingOrderNo:string; customerCode:string; customerName:string; warehouseCode:string; warehouseName:string; siteCode:string; carrier?:string; vehicle?:string; driver?:string; qty:number; lineCount:number; shipmentAllocatedQty:number }
export interface CoreDeliveryLine { id:string; lineNo:number; pickingLineId:string; salesOrderLineId:string; sku:string; itemName:string; uom:string; qty:number; location?:string; lotNo?:string; shipmentAllocatedQty:number; availableForShipmentQty:number }
export interface CoreDeliveryDetail { id:string; documentNo:string; status:string; deliveryDate:string; createdAt:string; shippingAddress:string; carrier?:string; vehicle?:string; driver?:string; dock?:string; notes?:string; releasedAt?:string; loadingStartedAt?:string; loadedAt?:string; cancelReason?:string; salesOrder:{id:string;documentNo:string;status:string}; pickingOrder:{id:string;documentNo:string;status:string}; customer:{code:string;name:string}; warehouse:{code:string;name:string}; company:{code:string;legalName:string;taxId?:string}; site:{code:string;name:string}; entityCode:string; siteCode:string; lines:CoreDeliveryLine[] }
export interface CoreShipment { id:string; documentNo:string; status:string; createdAt:string; scheduledAt?:string; dispatchedAt?:string; deliveredAt?:string; salesOrderId:string; salesOrderNo:string; deliveryOrderId?:string; deliveryOrderNo?:string; customerCode:string; customerName:string; warehouseCode:string; warehouseName:string; siteCode:string; carrier?:string; vehicle?:string; driver?:string; route?:string; trackingNo?:string; qty:number; lineCount:number }
export interface CoreShipmentLine { id:string; lineNo:number; deliveryLineId?:string; salesOrderLineId?:string; sku:string; itemName:string; uom:string; qty:number; unitCost:number; cogs:number; location?:string; lotNo?:string }
export interface CoreShipmentDetail { id:string; documentNo:string; status:string; createdAt:string; scheduledAt?:string; dispatchedAt?:string; deliveredAt?:string; carrier?:string; vehicle?:string; driver?:string; route?:string; trackingNo?:string; referenceNo?:string; notes?:string; cancelReason?:string; pod:{recipient?:string;receivedAt?:string;reference?:string;notes?:string}; salesOrder:{id:string;documentNo:string;status:string}; deliveryOrder:{id?:string;documentNo?:string;status?:string}; customer:{code:string;name:string}; warehouse:{code:string;name:string}; company:{code:string;legalName:string;taxId?:string}; site:{code:string;name:string}; entityCode:string; siteCode:string; lines:CoreShipmentLine[]; cogsJournal?:{id:string;documentNo:string;status:string;postingDate:string}|null }

type Envelope<T> = { data:T };

async function options(scope:CoreScope, command=false) {
  const session = await ensureApiSession();
  return {
    token: session.accessToken,
    entityId: scope.entityCode,
    siteId: scope.siteCode || undefined,
    idempotencyKey: command ? crypto.randomUUID() : undefined,
  };
}

export const coreApi = {
  bootstrap: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreBootstrap>>('/core/bootstrap', await options(scope))).data,
  salesOrders: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreSalesOrder[]>>('/core/sales-orders', await options(scope))).data,
  salesOrder: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CoreSalesOrderDetail>>(`/core/sales-orders/${id}`, await options(scope))).data,
  purchaseOrders: async (scope:CoreScope) => (await erpApi.get<Envelope<CorePurchaseOrder[]>>('/core/purchase-orders', await options(scope))).data,
  inventory: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreInventory[]>>('/core/inventory', await options(scope))).data,
  receipts: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreReceipt[]>>('/core/goods-receipts', await options(scope))).data,
  goodsReceiptDetail: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CoreGoodsReceiptDetail>>(`/core/goods-receipts/${id}`,await options(scope))).data,
  transfers: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreTransfer[]>>('/core/stock-transfers', await options(scope))).data,
  movements: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreMovement[]>>('/core/stock-movements', await options(scope))).data,
  pickingOrders: async (scope:CoreScope) => (await erpApi.get<Envelope<CorePickingOrder[]>>('/core/picking-orders', await options(scope))).data,
  pickingOrder: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CorePickingDetail>>(`/core/picking-orders/${id}`, await options(scope))).data,
  deliveryOrders: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreDeliveryOrder[]>>('/core/delivery-orders', await options(scope))).data,
  deliveryOrder: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CoreDeliveryDetail>>(`/core/delivery-orders/${id}`, await options(scope))).data,
  shipments: async (scope:CoreScope) => (await erpApi.get<Envelope<CoreShipment[]>>('/core/shipments', await options(scope))).data,
  shipment: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CoreShipmentDetail>>(`/core/shipments/${id}`, await options(scope))).data,

  createSalesOrder: async (scope:CoreScope,payload:unknown) => erpApi.post('/core/sales-orders',payload,await options(scope,true)),
  updateSalesOrder: async (scope:CoreScope,id:string,payload:unknown) => erpApi.patch(`/core/sales-orders/${id}`,payload,await options(scope,true)),
  deleteSalesOrder: async (scope:CoreScope,id:string) => erpApi.delete(`/core/sales-orders/${id}`,await options(scope,true)),
  cancelSalesOrder: async (scope:CoreScope,id:string,reason:string) => erpApi.post(`/core/sales-orders/${id}/cancel`,{reason},await options(scope,true)),
  salesAction: async (scope:CoreScope,id:string,action:'submit'|'approve'|'reserve'|'dispatch') => erpApi.post(`/core/sales-orders/${id}/${action}`,{},await options(scope,true)),
  createPickingOrder: async (scope:CoreScope,salesOrderId:string) => erpApi.post(`/core/sales-orders/${salesOrderId}/picking-orders`,{},await options(scope,true)),
  updatePickingOrder: async (scope:CoreScope,id:string,payload:unknown) => erpApi.patch(`/core/picking-orders/${id}`,payload,await options(scope,true)),
  completePickingOrder: async (scope:CoreScope,id:string,payload:unknown={}) => erpApi.post(`/core/picking-orders/${id}/complete`,payload,await options(scope,true)),
  cancelPickingOrder: async (scope:CoreScope,id:string,reason:string) => erpApi.post(`/core/picking-orders/${id}/cancel`,{reason},await options(scope,true)),
  createDeliveryOrder: async (scope:CoreScope,pickingId:string,payload:unknown) => erpApi.post(`/core/picking-orders/${pickingId}/delivery-orders`,payload,await options(scope,true)),
  updateDeliveryOrder: async (scope:CoreScope,id:string,payload:unknown) => erpApi.patch(`/core/delivery-orders/${id}`,payload,await options(scope,true)),
  deliveryAction: async (scope:CoreScope,id:string,action:'release'|'start-loading'|'complete-loading') => erpApi.post(`/core/delivery-orders/${id}/${action}`,{},await options(scope,true)),
  cancelDeliveryOrder: async (scope:CoreScope,id:string,reason:string) => erpApi.post(`/core/delivery-orders/${id}/cancel`,{reason},await options(scope,true)),
  createShipment: async (scope:CoreScope,deliveryOrderId:string,payload:unknown) => erpApi.post(`/core/delivery-orders/${deliveryOrderId}/shipments`,payload,await options(scope,true)),
  updateShipment: async (scope:CoreScope,id:string,payload:unknown) => erpApi.patch(`/core/shipments/${id}`,payload,await options(scope,true)),
  dispatchShipment: async (scope:CoreScope,id:string) => erpApi.post(`/core/shipments/${id}/dispatch`,{},await options(scope,true)),
  deliverShipment: async (scope:CoreScope,id:string,payload:unknown) => erpApi.post(`/core/shipments/${id}/deliver`,payload,await options(scope,true)),
  cancelShipment: async (scope:CoreScope,id:string,reason:string) => erpApi.post(`/core/shipments/${id}/cancel`,{reason},await options(scope,true)),
  purchaseOrderDetail: async (scope:CoreScope,id:string) => (await erpApi.get<Envelope<CorePurchaseOrderDetail>>(`/core/purchase-orders/${id}`,await options(scope))).data,
  updatePurchaseOrder: async (scope:CoreScope,id:string,payload:unknown) => erpApi.patch(`/core/purchase-orders/${id}`,payload,await options(scope,true)),
  deletePurchaseOrder: async (scope:CoreScope,id:string) => erpApi.delete(`/core/purchase-orders/${id}`,await options(scope,true)),
  cancelPurchaseOrder: async (scope:CoreScope,id:string,reason:string) => erpApi.post(`/core/purchase-orders/${id}/cancel`,{reason},await options(scope,true)),
  createPurchaseOrder: async (scope:CoreScope,payload:unknown) => erpApi.post('/core/purchase-orders',payload,await options(scope,true)),
  purchaseAction: async (scope:CoreScope,id:string,action:'submit'|'approve') => erpApi.post(`/core/purchase-orders/${id}/${action}`,{},await options(scope,true)),
  receivePurchaseOrder: async (scope:CoreScope,id:string,payload:unknown) => erpApi.post(`/core/purchase-orders/${id}/receive`,payload,await options(scope,true)),
  putAwayReceipt: async (scope:CoreScope,id:string) => erpApi.post(`/core/goods-receipts/${id}/put-away`,{},await options(scope,true)),
  createTransfer: async (scope:CoreScope,payload:unknown) => erpApi.post('/core/stock-transfers',payload,await options(scope,true)),
  transferAction: async (scope:CoreScope,id:string,action:'release'|'receive') => erpApi.post(`/core/stock-transfers/${id}/${action}`,{},await options(scope,true)),
};
