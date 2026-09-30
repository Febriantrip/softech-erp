package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nexa-distributor/erp-backend/internal/config"
	"github.com/nexa-distributor/erp-backend/internal/domain/coretx"
	financecore "github.com/nexa-distributor/erp-backend/internal/domain/finance"
	"github.com/nexa-distributor/erp-backend/internal/platform"
	"github.com/nexa-distributor/erp-backend/internal/security"
)

type Server struct {
	cfg        config.Config
	logger     *slog.Logger
	tokens     security.TokenService
	middleware Middleware
	startedAt  time.Time
	db         *pgxpool.Pool
	core       coretx.Service
	finance    financecore.Service
}

func NewServer(cfg config.Config, logger *slog.Logger, db *pgxpool.Pool) *Server {
	tokens := security.NewTokenService(cfg.JWTSecret, cfg.JWTIssuer, cfg.TokenTTL)
	return &Server{
		cfg: cfg, logger: logger, tokens: tokens, startedAt: time.Now().UTC(),
		middleware: Middleware{Logger: logger, Tokens: tokens, AllowedOrigins: cfg.AllowedOrigins, DB: db},
		db:         db, core: coretx.Service{DB: db}, finance: financecore.Service{DB: db},
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/health/live", s.live)
	mux.HandleFunc("GET /api/v1/health/ready", s.ready)
	mux.HandleFunc("POST /api/v1/auth/login", s.login)
	mux.HandleFunc("POST /api/v1/auth/passkeys/login/begin", s.passkeyLoginBegin)
	mux.HandleFunc("POST /api/v1/auth/passkeys/login/finish", s.passkeyLoginFinish)
	mux.Handle("GET /api/v1/auth/passkeys", s.middleware.Authenticate(http.HandlerFunc(s.passkeyList)))
	mux.Handle("POST /api/v1/auth/passkeys/register/begin", s.middleware.Authenticate(http.HandlerFunc(s.passkeyRegisterBegin)))
	mux.Handle("POST /api/v1/auth/passkeys/register/finish", s.middleware.Authenticate(http.HandlerFunc(s.passkeyRegisterFinish)))
	mux.Handle("DELETE /api/v1/auth/passkeys/{id}", s.middleware.Authenticate(http.HandlerFunc(s.passkeyDelete)))
	mux.Handle("GET /api/v1/auth/face/status", s.middleware.Authenticate(http.HandlerFunc(s.faceStatus)))
	mux.Handle("POST /api/v1/auth/face/register/begin", s.middleware.Authenticate(http.HandlerFunc(s.faceRegisterBegin)))
	mux.Handle("POST /api/v1/auth/face/register/finish", s.middleware.Authenticate(http.HandlerFunc(s.faceRegisterFinish)))
	mux.Handle("DELETE /api/v1/auth/face", s.middleware.Authenticate(http.HandlerFunc(s.faceDelete)))
	mux.HandleFunc("POST /api/v1/auth/face/login/begin", s.faceLoginBegin)
	mux.HandleFunc("POST /api/v1/auth/face/login/finish", s.faceLoginFinish)
	mux.Handle("GET /api/v1/auth/me", s.middleware.Authenticate(http.HandlerFunc(s.me)))
	mux.Handle("GET /api/v1/context", s.middleware.Authenticate(http.HandlerFunc(s.scopeContext)))
	mux.Handle("GET /api/v1/meta/platform", s.middleware.Authenticate(http.HandlerFunc(s.platformMeta)))
	mux.Handle("GET /api/v1/core/bootstrap", s.middleware.Authenticate(http.HandlerFunc(s.coreBootstrap)))
	mux.Handle("GET /api/v1/core/inventory", s.middleware.Authenticate(http.HandlerFunc(s.coreInventory)))
	mux.Handle("GET /api/v1/core/stock-movements", s.middleware.Authenticate(http.HandlerFunc(s.coreMovements)))
	mux.Handle("GET /api/v1/core/sales-orders", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.view", http.HandlerFunc(s.coreSalesOrders))))
	mux.Handle("GET /api/v1/core/sales-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.view", http.HandlerFunc(s.coreSalesOrderDetail))))
	mux.Handle("POST /api/v1/core/sales-orders", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.create", http.HandlerFunc(s.coreCreateSalesOrder))))
	mux.Handle("PATCH /api/v1/core/sales-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.edit", http.HandlerFunc(s.coreUpdateSalesOrder))))
	mux.Handle("DELETE /api/v1/core/sales-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.delete", http.HandlerFunc(s.coreDeleteSalesOrder))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/cancel", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.cancel", http.HandlerFunc(s.coreCancelSalesOrder))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/submit", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.submit", http.HandlerFunc(s.coreSubmitSalesOrder))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/approve", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.approve", http.HandlerFunc(s.coreApproveSalesOrder))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/reserve", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.reserve", http.HandlerFunc(s.coreReserveSalesOrder))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/dispatch", s.middleware.Authenticate(s.middleware.RequirePermission("sales_order.dispatch", http.HandlerFunc(s.coreDispatchSalesOrder))))
	mux.Handle("GET /api/v1/core/picking-orders", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.view", http.HandlerFunc(s.corePickingOrders))))
	mux.Handle("GET /api/v1/core/picking-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.view", http.HandlerFunc(s.corePickingOrderDetail))))
	mux.Handle("POST /api/v1/core/sales-orders/{id}/picking-orders", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.create", http.HandlerFunc(s.coreCreatePickingOrder))))
	mux.Handle("PATCH /api/v1/core/picking-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.update", http.HandlerFunc(s.coreUpdatePickingOrder))))
	mux.Handle("POST /api/v1/core/picking-orders/{id}/complete", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.complete", http.HandlerFunc(s.coreCompletePickingOrder))))
	mux.Handle("POST /api/v1/core/picking-orders/{id}/cancel", s.middleware.Authenticate(s.middleware.RequirePermission("picking_order.cancel", http.HandlerFunc(s.coreCancelPickingOrder))))
	mux.Handle("GET /api/v1/core/delivery-orders", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.view", http.HandlerFunc(s.coreDeliveryOrders))))
	mux.Handle("GET /api/v1/core/delivery-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.view", http.HandlerFunc(s.coreDeliveryOrderDetail))))
	mux.Handle("POST /api/v1/core/picking-orders/{id}/delivery-orders", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.create", http.HandlerFunc(s.coreCreateDeliveryOrder))))
	mux.Handle("PATCH /api/v1/core/delivery-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.update", http.HandlerFunc(s.coreUpdateDeliveryOrder))))
	mux.Handle("POST /api/v1/core/delivery-orders/{id}/release", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.release", http.HandlerFunc(s.coreReleaseDeliveryOrder))))
	mux.Handle("POST /api/v1/core/delivery-orders/{id}/start-loading", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.load", http.HandlerFunc(s.coreStartLoadingDeliveryOrder))))
	mux.Handle("POST /api/v1/core/delivery-orders/{id}/complete-loading", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.complete", http.HandlerFunc(s.coreCompleteLoadingDeliveryOrder))))
	mux.Handle("POST /api/v1/core/delivery-orders/{id}/cancel", s.middleware.Authenticate(s.middleware.RequirePermission("delivery_order.cancel", http.HandlerFunc(s.coreCancelDeliveryOrder))))
	mux.Handle("GET /api/v1/core/shipments", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.view", http.HandlerFunc(s.coreShipments))))
	mux.Handle("GET /api/v1/core/shipments/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.view", http.HandlerFunc(s.coreShipmentDetail))))
	mux.Handle("POST /api/v1/core/delivery-orders/{id}/shipments", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.create", http.HandlerFunc(s.coreCreateShipment))))
	mux.Handle("PATCH /api/v1/core/shipments/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.update", http.HandlerFunc(s.coreUpdateShipment))))
	mux.Handle("POST /api/v1/core/shipments/{id}/dispatch", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.dispatch", http.HandlerFunc(s.coreDispatchShipment))))
	mux.Handle("POST /api/v1/core/shipments/{id}/deliver", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.deliver", http.HandlerFunc(s.coreDeliverShipment))))
	mux.Handle("POST /api/v1/core/shipments/{id}/cancel", s.middleware.Authenticate(s.middleware.RequirePermission("shipment.cancel", http.HandlerFunc(s.coreCancelShipment))))
	mux.Handle("GET /api/v1/core/purchase-orders", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.view", http.HandlerFunc(s.corePurchaseOrders))))
	mux.Handle("GET /api/v1/core/purchase-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.view", http.HandlerFunc(s.corePurchaseOrderDetailD4A))))
	mux.Handle("POST /api/v1/core/purchase-orders", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.create", http.HandlerFunc(s.coreCreatePurchaseOrder))))
	mux.Handle("PATCH /api/v1/core/purchase-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.edit", http.HandlerFunc(s.coreUpdatePurchaseOrderD4A))))
	mux.Handle("DELETE /api/v1/core/purchase-orders/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.delete", http.HandlerFunc(s.coreDeletePurchaseOrderD4A))))
	mux.Handle("POST /api/v1/core/purchase-orders/{id}/submit", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.submit", http.HandlerFunc(s.coreSubmitPurchaseOrder))))
	mux.Handle("POST /api/v1/core/purchase-orders/{id}/approve", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.approve", http.HandlerFunc(s.coreApprovePurchaseOrder))))
	mux.Handle("POST /api/v1/core/purchase-orders/{id}/cancel", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.cancel", http.HandlerFunc(s.coreCancelPurchaseOrderD4A))))
	mux.Handle("POST /api/v1/core/purchase-orders/{id}/receive", s.middleware.Authenticate(s.middleware.RequirePermission("purchase_order.receive", http.HandlerFunc(s.coreReceivePurchaseOrder))))
	mux.Handle("GET /api/v1/core/goods-receipts", s.middleware.Authenticate(s.middleware.RequirePermission("goods_receipt.view", http.HandlerFunc(s.coreReceipts))))
	mux.Handle("GET /api/v1/core/goods-receipts/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("goods_receipt.view", http.HandlerFunc(s.coreGoodsReceiptDetailD4B))))
	mux.Handle("POST /api/v1/core/goods-receipts/{id}/put-away", s.middleware.Authenticate(s.middleware.RequirePermission("goods_receipt.put_away", http.HandlerFunc(s.corePutAwayReceipt))))
	mux.Handle("GET /api/v1/core/stock-transfers", s.middleware.Authenticate(http.HandlerFunc(s.coreTransfers)))
	mux.Handle("POST /api/v1/core/stock-transfers", s.middleware.Authenticate(http.HandlerFunc(s.coreCreateTransfer)))
	mux.Handle("POST /api/v1/core/stock-transfers/{id}/release", s.middleware.Authenticate(http.HandlerFunc(s.coreReleaseTransfer)))
	mux.Handle("POST /api/v1/core/stock-transfers/{id}/receive", s.middleware.Authenticate(http.HandlerFunc(s.coreReceiveTransfer)))
	mux.Handle("GET /api/v1/finance/bootstrap", s.middleware.Authenticate(http.HandlerFunc(s.financeBootstrap)))
	mux.Handle("GET /api/v1/finance/journals", s.middleware.Authenticate(http.HandlerFunc(s.financeJournals)))
	mux.Handle("POST /api/v1/finance/journals", s.middleware.Authenticate(http.HandlerFunc(s.financeCreateManualJournal)))
	mux.Handle("GET /api/v1/finance/trial-balance", s.middleware.Authenticate(http.HandlerFunc(s.financeTrialBalance)))
	mux.Handle("GET /api/v1/finance/sales-invoices", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.view", http.HandlerFunc(s.financeSalesInvoices))))
	mux.Handle("GET /api/v1/finance/sales-invoices/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.view", http.HandlerFunc(s.financeSalesInvoiceDetail))))
	mux.Handle("GET /api/v1/finance/sales-invoice-sources/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.view", http.HandlerFunc(s.financeSalesInvoiceSource))))
	mux.Handle("POST /api/v1/finance/sales-invoices", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.create", http.HandlerFunc(s.financeCreateSalesInvoice))))
	mux.Handle("POST /api/v1/finance/sales-invoices/{id}/post", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.post", http.HandlerFunc(s.financePostSalesInvoice))))
	mux.Handle("DELETE /api/v1/finance/sales-invoices/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("sales_invoice.delete", http.HandlerFunc(s.financeDeleteSalesInvoice))))
	mux.Handle("GET /api/v1/finance/ar", s.middleware.Authenticate(s.middleware.RequirePermission("receivable.view", http.HandlerFunc(s.financeAR))))
	mux.Handle("GET /api/v1/finance/customer-receipts", s.middleware.Authenticate(s.middleware.RequirePermission("customer_receipt.view", http.HandlerFunc(s.financeReceipts))))
	mux.Handle("GET /api/v1/finance/customer-receipts/{id}", s.middleware.Authenticate(s.middleware.RequirePermission("customer_receipt.view", http.HandlerFunc(s.financeReceiptDetail))))
	mux.Handle("POST /api/v1/finance/customer-receipts", s.middleware.Authenticate(s.middleware.RequirePermission("customer_receipt.post", http.HandlerFunc(s.financeCreateReceipt))))
	mux.Handle("GET /api/v1/finance/purchase-invoices", s.middleware.Authenticate(http.HandlerFunc(s.financePurchaseInvoices)))
	mux.Handle("POST /api/v1/finance/purchase-invoices", s.middleware.Authenticate(http.HandlerFunc(s.financeCreatePurchaseInvoice)))
	mux.Handle("POST /api/v1/finance/purchase-invoices/{id}/post", s.middleware.Authenticate(http.HandlerFunc(s.financePostPurchaseInvoice)))
	mux.Handle("GET /api/v1/finance/ap", s.middleware.Authenticate(http.HandlerFunc(s.financeAP)))
	mux.Handle("GET /api/v1/finance/supplier-payments", s.middleware.Authenticate(http.HandlerFunc(s.financeSupplierPayments)))
	mux.Handle("POST /api/v1/finance/supplier-payments", s.middleware.Authenticate(http.HandlerFunc(s.financeCreateSupplierPayment)))
	mux.Handle("POST /api/v1/finance/periods/{id}/close", s.middleware.Authenticate(http.HandlerFunc(s.financeClosePeriod)))
	mux.Handle("POST /api/v1/finance/periods/{id}/reopen", s.middleware.Authenticate(http.HandlerFunc(s.financeReopenPeriod)))
	mux.HandleFunc("GET /", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]any{"service": s.cfg.AppName, "api": "/api/v1", "status": "running"})
	})
	return s.middleware.Wrap(mux)
}

func (s *Server) live(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"status": "ok", "service": s.cfg.AppName, "environment": s.cfg.Environment,
		"uptimeSeconds": int64(time.Since(s.startedAt).Seconds()), "time": time.Now().UTC(),
	})
}

func (s *Server) ready(w http.ResponseWriter, r *http.Request) {
	postgres := platform.TCPCheck(r.Context(), "postgresql", fmt.Sprintf("%s:%s", s.cfg.PostgresHost, s.cfg.PostgresPort), s.cfg.ReadyCheckTimeout)
	redis := platform.TCPCheck(r.Context(), "redis", fmt.Sprintf("%s:%s", s.cfg.RedisHost, s.cfg.RedisPort), s.cfg.ReadyCheckTimeout)
	ready := postgres.Reachable && redis.Reachable
	status := http.StatusOK
	if !ready {
		status = http.StatusServiceUnavailable
	}
	writeJSON(w, status, map[string]any{"status": map[bool]string{true: "ready", false: "degraded"}[ready], "dependencies": []platform.DependencyStatus{postgres, redis}, "time": time.Now().UTC()})
}

func (s *Server) me(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	writeJSON(w, http.StatusOK, map[string]any{"user": claims, "tokenTTLSeconds": security.TokenTTLSeconds(claims)})
}

func (s *Server) scopeContext(w http.ResponseWriter, r *http.Request) {
	claims, _ := ClaimsFromContext(r.Context())
	entityID := strings.TrimSpace(r.Header.Get("X-Entity-ID"))
	siteID := strings.TrimSpace(r.Header.Get("X-Site-ID"))
	if entityID == "" {
		writeError(w, http.StatusBadRequest, "ENTITY_CONTEXT_REQUIRED", "X-Entity-ID header is required")
		return
	}
	if !security.Has(claims.Entities, entityID) {
		writeError(w, http.StatusForbidden, "ENTITY_FORBIDDEN", security.ScopeError("entity", entityID).Error())
		return
	}
	if siteID != "" && !security.Has(claims.Sites, siteID) {
		writeError(w, http.StatusForbidden, "SITE_FORBIDDEN", security.ScopeError("site", siteID).Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entityId": entityID, "siteId": siteID, "subject": claims.Subject, "authorized": true})
}

func (s *Server) platformMeta(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"version":          "v12-financial-engine",
		"architecture":     "modular-monolith",
		"frontend":         "React + Vite + TypeScript transition",
		"backend":          "Go",
		"database":         "PostgreSQL 18",
		"cacheQueue":       "Redis",
		"api":              "REST JSON /api/v1",
		"persistenceStage": "core transactions plus GL, AR, AP, cash/bank and accounting periods are PostgreSQL-backed",
	})
}
