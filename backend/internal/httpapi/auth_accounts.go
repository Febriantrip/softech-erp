package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/crypto/bcrypt"
)

// An authenticated principal exists ONLY if the DB row is active and has a
// password/passkey registered. Never derive roles/scopes from browser input.
type account struct {
	ID, Username, Name, PasswordHash, Status string
	MFARequired                              bool
	Roles, Entities, Sites                   []string
}

func lookupAccount(ctx context.Context, db *pgxpool.Pool, username string) (account, error) {
	var u account
	if db == nil {
		return u, errors.New("database not configured")
	}
	err := db.QueryRow(ctx, `
        SELECT u.id::text, u.username, u.display_name,
               COALESCE(u.password_hash,''), u.status, u.mfa_required,
               ARRAY(SELECT r.code::text FROM erp.user_roles ur
                     JOIN erp.roles r ON r.id=ur.role_id WHERE ur.user_id=u.id ORDER BY r.code),
               ARRAY(SELECT e.code::text FROM erp.user_entity_access a
                     JOIN erp.entities e ON e.id=a.entity_id WHERE a.user_id=u.id AND e.status='ACTIVE' ORDER BY e.code),
               ARRAY(SELECT s.code::text FROM erp.user_site_access a
                     JOIN erp.sites s ON s.id=a.site_id WHERE a.user_id=u.id AND s.status='ACTIVE' ORDER BY s.code)
        FROM erp.users u
        WHERE lower(u.username)=lower($1) OR lower(u.email)=lower($1)
        LIMIT 1`, strings.TrimSpace(username)).Scan(
		&u.ID, &u.Username, &u.Name, &u.PasswordHash, &u.Status, &u.MFARequired,
		&u.Roles, &u.Entities, &u.Sites)
	return u, err
}

func (s *Server) issueLogin(w http.ResponseWriter, r *http.Request, u account) {
	if u.Status != "ACTIVE" {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun atau kredensial tidak valid")
		return
	}
	token, claims, err := s.tokens.Issue(u.Username, u.Name, u.Roles, u.Entities, u.Sites)
	if err != nil {
		writeError(w, 500, "TOKEN_ERROR", "Tidak dapat membuat sesi")
		return
	}
	// last_login_at update is best effort; should not silently reveal DB details.
	if _, err := s.db.Exec(r.Context(), "UPDATE erp.users SET last_login_at=now() WHERE id=$1", u.ID); err != nil {
		s.logger.Log(r.Context(), slog.LevelWarn, "last_login_update_failed", "error", err)
	}
	writeJSON(w, 200, map[string]any{"accessToken": token, "tokenType": "Bearer", "expiresIn": s.cfg.TokenTTL.Seconds(), "user": claims})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi database belum tersedia")
		return
	}
	var input struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024))
	dec.DisallowUnknownFields()
	if dec.Decode(&input) != nil || len(input.Username) > 160 || len(input.Password) > 1024 {
		writeError(w, 400, "INVALID_REQUEST", "Input login tidak valid")
		return
	}
	principal := strings.ToLower(strings.TrimSpace(input.Username))
	if principal == "" || input.Password == "" {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun atau kredensial tidak valid")
		return
	}
	var failures int
	// Count failed attempts using a durable DB table; no in-memory bypass after restart.
	if err := s.db.QueryRow(r.Context(), `SELECT count(*) FROM erp.auth_login_attempts
      WHERE principal=$1 AND succeeded=false AND occurred_at>now()-interval '15 minutes'`, principal).Scan(&failures); err != nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi sedang tidak tersedia")
		return
	}
	if failures >= 8 {
		writeError(w, 429, "TOO_MANY_ATTEMPTS", "Terlalu banyak percobaan. Coba lagi 15 menit kemudian.")
		return
	}
	u, err := lookupAccount(r.Context(), s.db, principal)
	valid := err == nil && u.Status == "ACTIVE" && u.PasswordHash != "" &&
		bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(input.Password)) == nil
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi sedang tidak tersedia")
		return
	}
	_, auditErr := s.db.Exec(r.Context(), `INSERT INTO erp.auth_login_attempts(principal,succeeded)
      VALUES ($1,$2)`, principal, valid)
	if auditErr != nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi sedang tidak tersedia")
		return
	}
	if !valid {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun atau kredensial tidak valid")
		return
	}
	// A user explicitly configured for MFA must use enrolled passkey once present;
	// allow password first sign-in to enroll a device (admin seed has no password initially).
	if u.MFARequired {
		var enrolled int
		if err := s.db.QueryRow(r.Context(), `SELECT count(*) FROM erp.user_passkeys WHERE user_id=$1`, u.ID).Scan(&enrolled); err != nil {
			writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi sedang tidak tersedia")
			return
		}
		if enrolled > 0 {
			writeError(w, 403, "PASSKEY_REQUIRED", "Akun ini wajib masuk memakai passkey perangkat")
			return
		}
	}
	s.issueLogin(w, r, u)
}

func sessionUser(r *http.Request) (string, bool) {
	c, ok := ClaimsFromContext(r.Context())
	return c.Subject, ok
}

func validRecentSession(r *http.Request) bool {
	c, ok := ClaimsFromContext(r.Context())
	return ok && time.Since(time.Unix(c.IssuedAt, 0)) <= 10*time.Minute
}
