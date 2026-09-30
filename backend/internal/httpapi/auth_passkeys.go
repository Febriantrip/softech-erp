package httpapi

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/go-webauthn/webauthn/protocol"
	wa "github.com/go-webauthn/webauthn/webauthn"
)

type passkeyUser struct {
	account
	Credentials []wa.Credential
}

func (u passkeyUser) WebAuthnID() []byte                   { return []byte(u.ID) }
func (u passkeyUser) WebAuthnName() string                 { return u.Username }
func (u passkeyUser) WebAuthnDisplayName() string          { return u.Name }
func (u passkeyUser) WebAuthnCredentials() []wa.Credential { return u.Credentials }

func (s *Server) webAuthn() (*wa.WebAuthn, error) {
	return wa.New(&wa.Config{
		RPDisplayName: "SOFTECH ERP",
		RPID:          s.cfg.WebAuthnRPID,
		RPOrigins:     []string{s.cfg.WebAuthnRPOrigin},
		AuthenticatorSelection: protocol.AuthenticatorSelection{
			UserVerification: protocol.VerificationRequired,
		},
	})
}
func (s *Server) loadPasskeyUser(ctx context.Context, name string) (passkeyUser, error) {
	a, err := lookupAccount(ctx, s.db, name)
	if err != nil {
		return passkeyUser{}, err
	}
	u := passkeyUser{account: a}
	rows, err := s.db.Query(ctx, `SELECT credential FROM erp.user_passkeys WHERE user_id=$1 ORDER BY created_at`, a.ID)
	if err != nil {
		return passkeyUser{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var raw []byte
		if err := rows.Scan(&raw); err != nil {
			return passkeyUser{}, err
		}
		var c wa.Credential
		if err := json.Unmarshal(raw, &c); err != nil {
			return passkeyUser{}, err
		}
		u.Credentials = append(u.Credentials, c)
	}
	return u, rows.Err()
}
func randomChallengeID() (string, error) {
	buf := make([]byte, 32)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}
func (s *Server) saveCeremony(ctx context.Context, userID, purpose string, data *wa.SessionData) (string, error) {
	id, err := randomChallengeID()
	if err != nil {
		return "", err
	}
	raw, err := json.Marshal(data)
	if err != nil {
		return "", err
	}
	_, err = s.db.Exec(ctx, `INSERT INTO erp.webauthn_ceremonies(id,user_id,purpose,session_data,expires_at)
        VALUES ($1,$2,$3,$4,now()+interval '5 minutes')`, id, userID, purpose, raw)
	return id, err
}

// Consume before checking a response: one successful or failed attempt per challenge.
func (s *Server) consumeCeremony(ctx context.Context, id, purpose string) (string, wa.SessionData, error) {
	var userID string
	var raw []byte
	var session wa.SessionData
	if len(id) < 30 || len(id) > 80 {
		return "", session, errors.New("invalid ceremony")
	}
	err := s.db.QueryRow(ctx, `DELETE FROM erp.webauthn_ceremonies
        WHERE id=$1 AND purpose=$2 AND expires_at>now()
        RETURNING user_id::text,session_data`, id, purpose).Scan(&userID, &raw)
	if err != nil {
		return "", session, err
	}
	err = json.Unmarshal(raw, &session)
	return userID, session, err
}
func passkeyPayload(w http.ResponseWriter, r *http.Request) (struct {
	CeremonyID string          `json:"ceremonyId"`
	Credential json.RawMessage `json:"credential"`
}, bool) {
	var in struct {
		CeremonyID string          `json:"ceremonyId"`
		Credential json.RawMessage `json:"credential"`
	}
	decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, 128*1024))
	if decoder.Decode(&in) != nil || len(in.Credential) == 0 {
		writeError(w, 400, "INVALID_REQUEST", "Respon perangkat tidak valid")
		return in, false
	}
	return in, true
}
func credentialRequest(r *http.Request, body json.RawMessage) *http.Request {
	copy := r.Clone(r.Context())
	copy.Body = io.NopCloser(bytes.NewReader(body))
	return copy
}
func (s *Server) passkeyRegisterBegin(w http.ResponseWriter, r *http.Request) {
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Login ulang sebelum mendaftarkan perangkat")
		return
	}
	username, _ := sessionUser(r)
	user, err := s.loadPasskeyUser(r.Context(), username)
	if err != nil || user.Status != "ACTIVE" {
		writeError(w, 401, "UNAUTHORIZED", "Sesi tidak valid")
		return
	}
	device, err := s.webAuthn()
	if err != nil {
		writeError(w, 500, "PASSKEY_CONFIG", "Pengaturan passkey belum tersedia")
		return
	}
	opts, session, err := device.BeginRegistration(user)
	if err != nil {
		writeError(w, 400, "PASSKEY_REGISTRATION_FAILED", "Tidak dapat memulai pendaftaran passkey")
		return
	}
	id, err := s.saveCeremony(r.Context(), user.ID, "register", session)
	if err != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Tidak dapat menyimpan tantangan passkey")
		return
	}
	writeJSON(w, 200, map[string]any{"ceremonyId": id, "options": opts})
}
func (s *Server) passkeyRegisterFinish(w http.ResponseWriter, r *http.Request) {
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Login ulang sebelum mendaftarkan perangkat")
		return
	}
	username, _ := sessionUser(r)
	in, ok := passkeyPayload(w, r)
	if !ok {
		return
	}
	userID, session, err := s.consumeCeremony(r.Context(), in.CeremonyID, "register")
	if err != nil {
		writeError(w, 400, "PASSKEY_EXPIRED", "Tantangan passkey tidak berlaku atau sudah digunakan")
		return
	}
	user, err := s.loadPasskeyUser(r.Context(), username)
	if err != nil || user.ID != userID || user.Status != "ACTIVE" {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak sesuai dengan pendaftaran")
		return
	}
	device, err := s.webAuthn()
	if err != nil {
		writeError(w, 500, "PASSKEY_CONFIG", "Pengaturan passkey tidak tersedia")
		return
	}
	credential, err := device.FinishRegistration(user, session, credentialRequest(r, in.Credential))
	if err != nil {
		writeError(w, 400, "PASSKEY_VERIFICATION_FAILED", "Verifikasi perangkat gagal")
		return
	}
	raw, err := json.Marshal(credential)
	if err != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Tidak dapat menyimpan passkey")
		return
	}
	// No biometric templates/images are stored on the server. Only the verified public-key record.
	_, err = s.db.Exec(r.Context(), `INSERT INTO erp.user_passkeys(user_id,credential_id,credential,label)
        VALUES($1,$2,$3,'Perangkat pribadi')`, user.ID, credential.ID, raw)
	if err != nil {
		writeError(w, 409, "PASSKEY_STORAGE", "Perangkat sudah didaftarkan atau tidak dapat disimpan")
		return
	}
	writeJSON(w, 201, map[string]any{"status": "registered"})
}
func (s *Server) passkeyLoginBegin(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Username string `json:"username"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 8*1024)).Decode(&in) != nil || len(in.Username) > 160 {
		writeError(w, 400, "INVALID_REQUEST", "Nama akun tidak valid")
		return
	}
	if s.db == nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi database tidak tersedia")
		return
	}
	u, err := s.loadPasskeyUser(r.Context(), strings.TrimSpace(in.Username))
	if err != nil || u.Status != "ACTIVE" || len(u.Credentials) == 0 {
		writeError(w, 401, "PASSKEY_UNAVAILABLE", "Akun tidak memiliki passkey aktif")
		return
	}
	device, err := s.webAuthn()
	if err != nil {
		writeError(w, 500, "PASSKEY_CONFIG", "Pengaturan passkey tidak tersedia")
		return
	}
	opts, session, err := device.BeginLogin(u, wa.WithUserVerification(protocol.VerificationRequired))
	if err != nil {
		writeError(w, 400, "PASSKEY_LOGIN_FAILED", "Tidak dapat memulai login perangkat")
		return
	}
	id, err := s.saveCeremony(r.Context(), u.ID, "login", session)
	if err != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Tidak dapat menyimpan tantangan passkey")
		return
	}
	writeJSON(w, 200, map[string]any{"ceremonyId": id, "options": opts})
}
func (s *Server) passkeyLoginFinish(w http.ResponseWriter, r *http.Request) {
	if s.db == nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi database tidak tersedia")
		return
	}
	in, ok := passkeyPayload(w, r)
	if !ok {
		return
	}
	userID, session, err := s.consumeCeremony(r.Context(), in.CeremonyID, "login")
	if err != nil {
		writeError(w, 400, "PASSKEY_EXPIRED", "Tantangan passkey tidak berlaku atau sudah digunakan")
		return
	}
	var name string
	err = s.db.QueryRow(r.Context(), `SELECT username FROM erp.users WHERE id=$1 AND status='ACTIVE'`, userID).Scan(&name)
	if err != nil {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun tidak aktif")
		return
	}
	u, err := s.loadPasskeyUser(r.Context(), name)
	if err != nil || u.ID != userID || len(u.Credentials) == 0 {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun tidak valid")
		return
	}
	device, err := s.webAuthn()
	if err != nil {
		writeError(w, 500, "PASSKEY_CONFIG", "Pengaturan passkey tidak tersedia")
		return
	}
	credential, err := device.FinishLogin(u, session, credentialRequest(r, in.Credential))
	if err != nil {
		writeError(w, 401, "PASSKEY_VERIFICATION_FAILED", "Verifikasi perangkat gagal")
		return
	}
	raw, err := json.Marshal(credential)
	if err != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Gagal menyimpan state passkey")
		return
	}
	tag, err := s.db.Exec(r.Context(), `UPDATE erp.user_passkeys SET credential=$3,last_used_at=now()
        WHERE user_id=$1 AND credential_id=$2`, u.ID, credential.ID, raw)
	if err != nil || tag.RowsAffected() != 1 {
		writeError(w, 401, "PASSKEY_STORAGE", "Passkey sudah tidak terdaftar")
		return
	}
	s.issueLogin(w, r, u.account)
}
func (s *Server) passkeyList(w http.ResponseWriter, r *http.Request) {
	name, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, name)
	if err != nil {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak ditemukan")
		return
	}
	rows, err := s.db.Query(r.Context(), `SELECT id::text,label,created_at,last_used_at
        FROM erp.user_passkeys WHERE user_id=$1 ORDER BY created_at DESC`, u.ID)
	if err != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Gagal memuat passkey")
		return
	}
	defer rows.Close()
	keys := make([]map[string]any, 0)
	for rows.Next() {
		var id, label string
		var created time.Time
		var used *time.Time
		if err := rows.Scan(&id, &label, &created, &used); err != nil {
			writeError(w, 500, "PASSKEY_STORAGE", "Gagal memuat passkey")
			return
		}
		keys = append(keys, map[string]any{"id": id, "label": label, "createdAt": created, "lastUsedAt": used})
	}
	if rows.Err() != nil {
		writeError(w, 500, "PASSKEY_STORAGE", "Gagal memuat passkey")
		return
	}
	writeJSON(w, 200, map[string]any{"passkeys": keys, "mfaRequired": u.MFARequired})
}
func (s *Server) passkeyDelete(w http.ResponseWriter, r *http.Request) {
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Login ulang sebelum menghapus perangkat")
		return
	}
	name, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, name)
	if err != nil {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak ditemukan")
		return
	}
	if u.MFARequired {
		var count int
		if err := s.db.QueryRow(r.Context(), `SELECT count(*) FROM erp.user_passkeys WHERE user_id=$1`, u.ID).Scan(&count); err != nil || count <= 1 {
			writeError(w, 409, "LAST_PASSKEY", "Akun wajib MFA tidak dapat menghapus satu-satunya passkey")
			return
		}
	}
	tag, err := s.db.Exec(r.Context(), `DELETE FROM erp.user_passkeys WHERE id::text=$1 AND user_id=$2`, r.PathValue("id"), u.ID)
	if err != nil || tag.RowsAffected() != 1 {
		writeError(w, 404, "PASSKEY_NOT_FOUND", "Passkey tidak ditemukan")
		return
	}
	writeJSON(w, 200, map[string]any{"status": "removed"})
}

// Force pgx dependency awareness for the error family used in ceremony storage.
