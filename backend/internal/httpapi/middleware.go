package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/nexa-distributor/erp-backend/internal/security"
)

type contextKey string

const claimsKey contextKey = "claims"

type Middleware struct {
	Logger         *slog.Logger
	Tokens         security.TokenService
	AllowedOrigins []string
	DB             *pgxpool.Pool
}

func (m Middleware) Wrap(next http.Handler) http.Handler {
	return m.recoverer(m.requestID(m.securityHeaders(m.cors(m.accessLog(next)))))
}

func (m Middleware) Authenticate(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, err := security.Bearer(r.Header.Get("Authorization"))
		if err != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			return
		}
		claims, err := m.Tokens.Parse(token)
		if err != nil {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", err.Error())
			return
		}
		if m.DB == nil {
			writeError(w, http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "database authentication is not configured")
			return
		}
		account, dbErr := lookupAccount(r.Context(), m.DB, claims.Subject)
		if dbErr != nil || account.Status != "ACTIVE" || account.Username != claims.Subject {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "session is no longer valid")
			return
		}
		// All scopes are rehydrated from the DB on every request, so changing a
		// user's roles/entity/site access takes effect without waiting for token expiry.
		claims.Name = account.Name
		claims.Roles = account.Roles
		claims.Entities = account.Entities
		claims.Sites = account.Sites
		ctx := context.WithValue(r.Context(), claimsKey, claims)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func ClaimsFromContext(ctx context.Context) (security.Claims, bool) {
	claims, ok := ctx.Value(claimsKey).(security.Claims)
	return claims, ok
}

func (m Middleware) requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestID := r.Header.Get("X-Request-ID")
		if strings.TrimSpace(requestID) == "" {
			requestID = randomID()
		}
		w.Header().Set("X-Request-ID", requestID)
		r.Header.Set("X-Request-ID", requestID)
		next.ServeHTTP(w, r)
	})
}

func (m Middleware) securityHeaders(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Cache-Control", "no-store")
		next.ServeHTTP(w, r)
	})
}

func (m Middleware) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && m.originAllowed(origin) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Entity-ID, X-Site-ID, X-Request-ID, Idempotency-Key")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (m Middleware) originAllowed(origin string) bool {
	for _, allowed := range m.AllowedOrigins {
		if allowed == "*" || strings.EqualFold(allowed, origin) {
			return true
		}
	}
	return false
}

func (m Middleware) accessLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		m.Logger.Info("http_request", "method", r.Method, "path", r.URL.Path, "duration_ms", time.Since(started).Milliseconds(), "remote", r.RemoteAddr)
	})
}

func (m Middleware) recoverer(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if recovered := recover(); recovered != nil {
				m.Logger.Error("panic_recovered", "error", recovered, "path", r.URL.Path)
				writeError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "unexpected server error")
			}
		}()
		next.ServeHTTP(w, r)
	})
}

func randomID() string {
	value := make([]byte, 12)
	if _, err := rand.Read(value); err != nil {
		return time.Now().UTC().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(value)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, code, message string) {
	writeJSON(w, status, map[string]any{"error": map[string]any{"code": code, "message": message}})
}

func (m Middleware) RequirePermission(code string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		claims, ok := ClaimsFromContext(r.Context())
		if !ok {
			writeError(w, http.StatusUnauthorized, "UNAUTHORIZED", "authenticated claims missing")
			return
		}
		if m.DB == nil {
			writeError(w, http.StatusServiceUnavailable, "AUTH_UNAVAILABLE", "database authorization is not configured")
			return
		}
		var allowed bool
		err := m.DB.QueryRow(r.Context(), `SELECT EXISTS(
			SELECT 1
			FROM erp.users u
			JOIN erp.user_roles ur ON ur.user_id=u.id
			JOIN erp.role_permissions rp ON rp.role_id=ur.role_id
			JOIN erp.permissions p ON p.id=rp.permission_id
			WHERE u.username=$1 AND u.status='ACTIVE' AND p.code=$2
		)`, claims.Subject, code).Scan(&allowed)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "AUTHORIZATION_ERROR", "permission check failed")
			return
		}
		if !allowed {
			writeError(w, http.StatusForbidden, "FORBIDDEN", "permission "+code+" is required")
			return
		}
		next.ServeHTTP(w, r)
	})
}
