import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import AppShell from './layout/AppShell';
import DashboardPage from './pages/DashboardPage';
import SalesPage from './pages/SalesPage';
import PurchasePage from './pages/PurchasePage';
import WarehousePage from './pages/WarehousePage';
import FinancePage from './pages/FinancePage';
import ArApPage from './pages/ArApPage';
import ClosingPage from './pages/ClosingPage';
import ReportsPage from './pages/ReportsPage';
import MasterDataPage from './pages/MasterDataPage';
import SetupPage from './pages/SetupPage';
import ApprovalsPage from './pages/ApprovalsPage';
import ProcessesPage from './pages/ProcessesPage';
import SecurityPage from './pages/SecurityPage';
import PreliminarySetupPage from './pages/PreliminarySetupPage';
import AddonsPage from './pages/AddonsPage';
import TransactionHubPage from './pages/TransactionHubPage';
import SalesOrderDetailPage from './pages/SalesOrderDetailPage';
import DeliveryOrderPage from './pages/DeliveryOrderPage';
import PickingOrderPage from './pages/PickingOrderPage';
import ShipmentPage from './pages/ShipmentPage';
import ApiShipmentPage from './pages/ApiShipmentPage';
import SalesInvoicePage from './pages/SalesInvoicePage';
import ReceiptsPage from './pages/ReceiptsPage';
import PurchaseRequestPage from './pages/PurchaseRequestPage';
import RFQPage from './pages/RFQPage';
import PurchaseOrderPage from './pages/PurchaseOrderPage';
import ReceivingPage from './pages/ReceivingPage';
import PurchaseInvoicePage from './pages/PurchaseInvoicePage';
import SupplierPaymentsPage from './pages/SupplierPaymentsPage';
import StockTransferPage from './pages/StockTransferPage';
import StockTakePage from './pages/StockTakePage';
import InventoryValuationPage from './pages/InventoryValuationPage';
import EnterpriseStructurePage from './pages/EnterpriseStructurePage';
import IntercompanyPage from './pages/IntercompanyPage';
import ConsolidationPage from './pages/ConsolidationPage';
import SalesReturnPage from './pages/SalesReturnPage';
import PurchaseReturnPage from './pages/PurchaseReturnPage';
import ReplenishmentPage from './pages/ReplenishmentPage';
import QualityControlPage from './pages/QualityControlPage';
import ProductionFoundationPage from './pages/ProductionFoundationPage';
import ApiSalesOrderPage from './pages/ApiSalesOrderPage';
import ApiPickingOrderPage from './pages/ApiPickingOrderPage';
import ApiDeliveryOrderPage from './pages/ApiDeliveryOrderPage';
import ApiPurchaseOrderPage from './pages/ApiPurchaseOrderPage';
import ApiWarehousePage from './pages/ApiWarehousePage';
import ApiFinancePage from './pages/ApiFinancePage';
import ApiSalesInvoicePage from './pages/ApiSalesInvoicePage';
import ApiReceiptsPage from './pages/ApiReceiptsPage';
import ApiPurchaseInvoicePage from './pages/ApiPurchaseInvoicePage';
import ApiSupplierPaymentsPage from './pages/ApiSupplierPaymentsPage';
import ApiArApPage from './pages/ApiArApPage';
import ApiClosingPage from './pages/ApiClosingPage';
import { runtimeConfig } from './config/runtime';
import { useApiAuth } from './context/ApiAuthContext';
import LoginPage from './pages/LoginPage';
import AccountSecurityPage from './pages/AccountSecurityPage';

export default function App() {
  const { session } = useApiAuth();
  if (runtimeConfig.isApiMode && !session) return <LoginPage />;
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/sales" element={<SalesPage />} />
        <Route path="/purchase" element={<PurchasePage />} />
        <Route path="/warehouse" element={runtimeConfig.isApiMode ? <ApiWarehousePage /> : <WarehousePage />} />
        <Route path="/warehouse/stock-transfer" element={<StockTransferPage />} />
        <Route path="/warehouse/stock-take" element={<StockTakePage />} />
        <Route path="/warehouse/valuation" element={<InventoryValuationPage />} />
        <Route path="/warehouse/replenishment" element={<ReplenishmentPage />} />
        <Route path="/warehouse/quality-control" element={<QualityControlPage />} />
        <Route path="/finance" element={runtimeConfig.isApiMode ? <ApiFinancePage /> : <FinancePage />} />
        <Route path="/ar-ap" element={runtimeConfig.isApiMode ? <ApiArApPage /> : <ArApPage />} />
        <Route path="/closing" element={runtimeConfig.isApiMode ? <ApiClosingPage /> : <ClosingPage />} />
        <Route path="/enterprise/entities" element={<EnterpriseStructurePage />} />
        <Route path="/enterprise/intercompany" element={<IntercompanyPage />} />
        <Route path="/enterprise/consolidation" element={<ConsolidationPage />} />

        <Route path="/transactions/distribution" element={<TransactionHubPage type="distribution" />} />
        <Route path="/transactions/distribution/sales-order" element={runtimeConfig.isApiMode ? <ApiSalesOrderPage /> : <SalesOrderDetailPage />} />
        <Route path="/transactions/distribution/picking-order" element={runtimeConfig.isApiMode ? <ApiPickingOrderPage /> : <PickingOrderPage />} />
        <Route path="/transactions/distribution/delivery-order" element={runtimeConfig.isApiMode ? <ApiDeliveryOrderPage /> : <DeliveryOrderPage />} />
        <Route path="/transactions/distribution/shipment" element={runtimeConfig.isApiMode ? <ApiShipmentPage /> : <ShipmentPage />} />
        <Route path="/transactions/distribution/purchase-request" element={<PurchaseRequestPage />} />
        <Route path="/transactions/distribution/rfq" element={<RFQPage />} />
        <Route path="/transactions/distribution/purchase-order" element={runtimeConfig.isApiMode ? <ApiPurchaseOrderPage /> : <PurchaseOrderPage />} />
        <Route path="/transactions/distribution/receiving" element={<ReceivingPage />} />
        <Route path="/transactions/distribution/sales-return" element={<SalesReturnPage />} />
        <Route path="/transactions/distribution/purchase-return" element={<PurchaseReturnPage />} />
        <Route path="/transactions/financials" element={<TransactionHubPage type="financials" />} />
        <Route path="/transactions/financials/sales-invoice" element={runtimeConfig.isApiMode ? <ApiSalesInvoicePage /> : <SalesInvoicePage />} />
        <Route path="/transactions/financials/receipts" element={runtimeConfig.isApiMode ? <ApiReceiptsPage /> : <ReceiptsPage />} />
        <Route path="/transactions/financials/purchase-invoice" element={runtimeConfig.isApiMode ? <ApiPurchaseInvoicePage /> : <PurchaseInvoicePage />} />
        <Route path="/transactions/financials/supplier-payments" element={runtimeConfig.isApiMode ? <ApiSupplierPaymentsPage /> : <SupplierPaymentsPage />} />
        <Route path="/transactions/fixed-assets" element={<TransactionHubPage type="fixed-assets" />} />
        <Route path="/transactions/manufacturing" element={<TransactionHubPage type="manufacturing" />} />
        <Route path="/transactions/pos" element={<TransactionHubPage type="pos" />} />

        <Route path="/approvals" element={<ApprovalsPage />} />
        <Route path="/processes" element={<ProcessesPage />} />
        <Route path="/master-data" element={<MasterDataPage />} />
        <Route path="/setup" element={<SetupPage />} />
        <Route path="/platform/production-foundation" element={<ProductionFoundationPage />} />
        <Route path="/settings" element={<Navigate to="/setup" replace />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/account/security" element={<AccountSecurityPage />} />
        <Route path="/preliminary" element={<PreliminarySetupPage />} />
        <Route path="/addons" element={<AddonsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
