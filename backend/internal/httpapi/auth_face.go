package httpapi

// Optional server-verified face-recognition pilot. Existing passkeys untouched.
// Authentication requires a real database password AND a matching face.
import (
	"context"
	"crypto/rand"
	"encoding/json"
	"net/http"
	"strings"

	"golang.org/x/crypto/bcrypt"
)

type faceChallenge struct {
	ID    string   `json:"challengeId"`
	Steps []string `json:"steps"`
}
type faceCapture struct {
	ChallengeID string   `json:"challengeId"`
	Frames      []string `json:"frames"`
	Password    string   `json:"password,omitempty"`
}

func (s *Server) faceEnabled(w http.ResponseWriter) bool {
	if s.faceAvailable() {
		return true
	}
	writeError(w, 503, "FACE_NOT_CONFIGURED", "Pengenalan wajah belum disiapkan di backend. Jalankan installer model dan konfigurasi kunci enkripsi.")
	return false
}
func decodeFaceCapture(w http.ResponseWriter, r *http.Request) (faceCapture, bool) {
	var in faceCapture
	d := json.NewDecoder(http.MaxBytesReader(w, r.Body, 2400*1024))
	d.DisallowUnknownFields()
	if d.Decode(&in) != nil || len(in.ChallengeID) < 30 || len(in.Frames) != 3 || len(in.Password) > 1024 {
		writeError(w, 400, "FACE_BAD_CAPTURE", "Rekaman kamera tidak valid")
		return in, false
	}
	return in, true
}
func (s *Server) newFaceChallenge(ctx context.Context, userID, purpose string) (faceChallenge, error) {
	var c faceChallenge
	id, err := randomChallengeID()
	if err != nil {
		return c, err
	}
	c.ID = id
	c.Steps = []string{"front", "left", "right"}
	b := make([]byte, 1)
	if _, err = rand.Read(b); err != nil {
		return c, err
	}
	if b[0]%2 == 0 {
		c.Steps[1], c.Steps[2] = c.Steps[2], c.Steps[1]
	}
	_, err = s.db.Exec(ctx, `INSERT INTO erp.face_challenges(id,user_id,purpose,steps,expires_at)
 VALUES($1,$2,$3,$4,now()+interval '3 minutes')`, id, userID, purpose, c.Steps)
	return c, err
}
func (s *Server) consumeFaceChallenge(ctx context.Context, id, purpose string) (string, []string, error) {
	var userID string
	var steps []string
	err := s.db.QueryRow(ctx, `DELETE FROM erp.face_challenges WHERE id=$1 AND purpose=$2 AND expires_at>now()
 RETURNING user_id::text,steps`, id, purpose).Scan(&userID, &steps)
	return userID, steps, err
}
func (s *Server) faceStatus(w http.ResponseWriter, r *http.Request) {
	available := s.faceAvailable()
	user, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, user)
	if err != nil {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak tersedia")
		return
	}
	var enrolled bool
	if err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM erp.user_face_profiles WHERE user_id=$1 AND enabled=true)`, u.ID).Scan(&enrolled); err != nil {
		writeError(w, 503, "FACE_STORAGE", "Tabel wajah belum dimigrasikan atau tidak bisa diakses")
		return
	}
	writeJSON(w, 200, map[string]any{"available": available, "enrolled": enrolled, "requiresPassword": true, "pilot": true})
}
func (s *Server) faceRegisterBegin(w http.ResponseWriter, r *http.Request) {
	if !s.faceEnabled(w) {
		return
	}
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Masuk ulang sebelum mendaftarkan wajah")
		return
	}
	username, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, username)
	if err != nil || u.Status != "ACTIVE" {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak aktif")
		return
	}
	c, err := s.newFaceChallenge(r.Context(), u.ID, "register")
	if err != nil {
		writeError(w, 503, "FACE_STORAGE", "Tidak dapat membuat tantangan wajah")
		return
	}
	writeJSON(w, 200, c)
}
func (s *Server) faceRegisterFinish(w http.ResponseWriter, r *http.Request) {
	if !s.faceEnabled(w) {
		return
	}
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Masuk ulang sebelum mendaftarkan wajah")
		return
	}
	in, ok := decodeFaceCapture(w, r)
	if !ok {
		return
	}
	id, steps, err := s.consumeFaceChallenge(r.Context(), in.ChallengeID, "register")
	if err != nil {
		writeError(w, 400, "FACE_EXPIRED", "Tantangan habis atau sudah digunakan")
		return
	}
	username, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, username)
	if err != nil || u.ID != id || u.Status != "ACTIVE" {
		writeError(w, 403, "FACE_FORBIDDEN", "Akun pendaftar tidak cocok")
		return
	}
	result, err := s.calculateFace(r.Context(), in.Frames, steps)
	if err != nil {
		writeError(w, 422, "FACE_CAPTURE_FAILED", "Wajah tidak dikenali. Pastikan hanya satu wajah, pencahayaan cukup, dan gerakkan kepala sesuai petunjuk.")
		return
	}
	encrypted, err := s.encryptFace(result.Embedding)
	if err != nil {
		writeError(w, 503, "FACE_ENCRYPTION", "Enkripsi wajah gagal")
		return
	}
	_, err = s.db.Exec(r.Context(), `INSERT INTO erp.user_face_profiles(user_id,descriptor,model_version,enabled)
 VALUES($1,$2,$3,true) ON CONFLICT(user_id) DO UPDATE SET descriptor=EXCLUDED.descriptor,
 model_version=EXCLUDED.model_version,enabled=true,updated_at=now()`, u.ID, encrypted, faceVersion)
	if err != nil {
		writeError(w, 503, "FACE_STORAGE", "Tidak bisa menyimpan profil wajah")
		return
	}
	writeJSON(w, 201, map[string]any{"status": "registered", "requiresPassword": true})
}
func (s *Server) faceDelete(w http.ResponseWriter, r *http.Request) {
	if !validRecentSession(r) {
		writeError(w, 401, "REAUTH_REQUIRED", "Masuk ulang sebelum menghapus wajah")
		return
	}
	username, _ := sessionUser(r)
	u, err := lookupAccount(r.Context(), s.db, username)
	if err != nil {
		writeError(w, 401, "UNAUTHORIZED", "Akun tidak valid")
		return
	}
	_, err = s.db.Exec(r.Context(), `DELETE FROM erp.user_face_profiles WHERE user_id=$1`, u.ID)
	if err != nil {
		writeError(w, 503, "FACE_STORAGE", "Tidak bisa menghapus profil wajah")
		return
	}
	writeJSON(w, 200, map[string]any{"status": "deleted"})
}
func (s *Server) faceLoginBegin(w http.ResponseWriter, r *http.Request) {
	if !s.faceEnabled(w) {
		return
	}
	var in struct {
		Username string `json:"username"`
	}
	if json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&in) != nil || len(in.Username) > 160 || strings.TrimSpace(in.Username) == "" {
		writeError(w, 400, "INVALID_REQUEST", "Username tidak valid")
		return
	}
	u, err := lookupAccount(r.Context(), s.db, in.Username)
	if err != nil || u.Status != "ACTIVE" {
		writeError(w, 401, "FACE_UNAVAILABLE", "Login wajah tidak tersedia pada akun ini")
		return
	}
	var enrolled bool
	err = s.db.QueryRow(r.Context(), `SELECT EXISTS(SELECT 1 FROM erp.user_face_profiles WHERE user_id=$1 AND enabled=true)`, u.ID).Scan(&enrolled)
	if err != nil || !enrolled {
		writeError(w, 401, "FACE_UNAVAILABLE", "Login wajah tidak tersedia pada akun ini")
		return
	}
	c, err := s.newFaceChallenge(r.Context(), u.ID, "login")
	if err != nil {
		writeError(w, 503, "FACE_STORAGE", "Tidak dapat membuat tantangan wajah")
		return
	}
	writeJSON(w, 200, c)
}
func (s *Server) faceLoginFinish(w http.ResponseWriter, r *http.Request) {
	if !s.faceEnabled(w) {
		return
	}
	in, ok := decodeFaceCapture(w, r)
	if !ok {
		return
	}
	id, steps, err := s.consumeFaceChallenge(r.Context(), in.ChallengeID, "login")
	if err != nil {
		writeError(w, 400, "FACE_EXPIRED", "Tantangan kadaluarsa atau telah dipakai")
		return
	}
	var name string
	if err = s.db.QueryRow(r.Context(), `SELECT username FROM erp.users WHERE id=$1 AND status='ACTIVE'`, id).Scan(&name); err != nil {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun atau kredensial tidak valid")
		return
	}
	principal := strings.ToLower(name)
	var failures int
	if err = s.db.QueryRow(r.Context(), `SELECT count(*) FROM erp.auth_login_attempts WHERE principal=$1 AND succeeded=false AND occurred_at>now()-interval '15 minutes'`, principal).Scan(&failures); err != nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Autentikasi tidak tersedia")
		return
	}
	if failures >= 8 {
		writeError(w, 429, "TOO_MANY_ATTEMPTS", "Terlalu banyak percobaan. Coba lagi setelah 15 menit.")
		return
	}
	u, err := lookupAccount(r.Context(), s.db, name)
	if err != nil {
		writeError(w, 401, "INVALID_CREDENTIALS", "Akun atau kredensial tidak valid")
		return
	}
	passOK := u.PasswordHash != "" && in.Password != "" && bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(in.Password)) == nil
	var encrypted []byte
	var model string
	err = s.db.QueryRow(r.Context(), `SELECT descriptor,model_version FROM erp.user_face_profiles WHERE user_id=$1 AND enabled=true`, u.ID).Scan(&encrypted, &model)
	var matches bool
	if err == nil && model == faceVersion && passOK {
		result, err2 := s.calculateFace(r.Context(), in.Frames, steps)
		if err2 == nil {
			stored, err3 := s.decryptFace(encrypted)
			if err3 == nil && cosine(stored, result.Embedding) >= faceMinimumSimilarity {
				matches = true
			}
		}
	}
	_, auditErr := s.db.Exec(r.Context(), `INSERT INTO erp.auth_login_attempts(principal,succeeded) VALUES($1,$2)`, principal, matches)
	if auditErr != nil {
		writeError(w, 503, "AUTH_UNAVAILABLE", "Tidak dapat mencatat login")
		return
	}
	if !matches {
		writeError(w, 401, "FACE_LOGIN_FAILED", "Password atau verifikasi wajah tidak cocok. Coba lagi dengan cahaya cukup.")
		return
	}
	s.issueLogin(w, r, u)
}
