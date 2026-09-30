package httpapi

import (
	"bytes"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/nexa-distributor/erp-backend/internal/config"
)

func testServer() *Server {
	cfg := config.Config{
		AppName: "NEXA TEST", Environment: "test", HTTPAddr: ":0",
		AllowedOrigins: []string{"http://localhost:5173"},
		PostgresHost:   "127.0.0.1", PostgresPort: "1", RedisHost: "127.0.0.1", RedisPort: "1",
		JWTSecret: "0123456789abcdefghijklmnopqrstuvwxyz", JWTIssuer: "nexa-test", TokenTTL: time.Hour,
		BootstrapUser: "admin", BootstrapPassword: "secret", BootstrapName: "Admin",
		BootstrapRoles: []string{"GROUP_ADMIN"}, BootstrapEntities: []string{"NDU"}, BootstrapSites: []string{"JKT-HO"}, ReadyCheckTimeout: 20 * time.Millisecond,
	}
	return NewServer(cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), nil)
}

func TestHealthLive(t *testing.T) {
	r := httptest.NewRequest(http.MethodGet, "/api/v1/health/live", nil)
	w := httptest.NewRecorder()
	testServer().Handler().ServeHTTP(w, r)
	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
}

func TestBootstrapLoginIsNotAcceptedWithoutDatabase(t *testing.T) {
	s := testServer()
	r := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{"username":"admin","password":"secret"}`))
	r.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()
	s.Handler().ServeHTTP(w, r)
	if w.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected no bootstrap login, got %d: %s", w.Code, w.Body.String())
	}
}
