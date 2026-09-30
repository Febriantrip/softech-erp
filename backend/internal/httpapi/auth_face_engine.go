package httpapi

// Server-side face analysis, descriptor encryption and similarity primitives.
// OpenCV is executed on the trusted backend, not in the browser.
import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

const faceVersion = "opencv-yunet2023-sface2021-v1"
const faceMinimumSimilarity = 0.55 // pilot threshold: MUST be calibrated for actual users before production.

type faceEngineResult struct {
	Embedding      []float64 `json:"embedding"`
	MovementPassed bool      `json:"movementPassed"`
	Error          string    `json:"error"`
}

func decodeFaceKey(value string) ([]byte, error) {
	key, err := base64.RawStdEncoding.DecodeString(value)
	if err != nil {
		return base64.StdEncoding.DecodeString(value)
	}
	return key, nil
}
func (s *Server) faceAvailable() bool {
	if s.db == nil || len(s.cfg.FaceTemplateKey) == 0 || s.cfg.FacePython == "" || s.cfg.FaceModelsDir == "" {
		return false
	}
	key, err := decodeFaceKey(s.cfg.FaceTemplateKey)
	if err != nil || len(key) != 32 {
		return false
	}
	if _, err := os.Stat(s.cfg.FacePython); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(s.cfg.FaceModelsDir, "face_detection_yunet_2023mar.onnx")); err != nil {
		return false
	}
	if _, err := os.Stat(filepath.Join(s.cfg.FaceModelsDir, "face_recognition_sface_2021dec.onnx")); err != nil {
		return false
	}
	return true
}
func (s *Server) faceKey() ([]byte, error) {
	key, err := decodeFaceKey(s.cfg.FaceTemplateKey)
	if err != nil || len(key) != 32 {
		return nil, errors.New("invalid 32-byte face key")
	}
	return key, nil
}
func (s *Server) encryptFace(embedding []float64) ([]byte, error) {
	key, err := s.faceKey()
	if err != nil {
		return nil, err
	}
	raw, err := json.Marshal(embedding)
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err = rand.Read(nonce); err != nil {
		return nil, err
	}
	return gcm.Seal(nonce, nonce, raw, []byte(faceVersion)), nil
}
func (s *Server) decryptFace(blob []byte) ([]float64, error) {
	key, err := s.faceKey()
	if err != nil {
		return nil, err
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	if len(blob) < gcm.NonceSize() {
		return nil, errors.New("short encrypted descriptor")
	}
	raw, err := gcm.Open(nil, blob[:gcm.NonceSize()], blob[gcm.NonceSize():], []byte(faceVersion))
	if err != nil {
		return nil, err
	}
	var vector []float64
	if err = json.Unmarshal(raw, &vector); err != nil {
		return nil, err
	}
	if len(vector) != 128 {
		return nil, errors.New("invalid descriptor dimensions")
	}
	return vector, nil
}
func cosine(a, b []float64) float64 {
	if len(a) != 128 || len(b) != 128 {
		return -1
	}
	var dot, ma, mb float64
	for i := range a {
		if math.IsNaN(a[i]) || math.IsNaN(b[i]) || math.IsInf(a[i], 0) || math.IsInf(b[i], 0) {
			return -1
		}
		dot += a[i] * b[i]
		ma += a[i] * a[i]
		mb += b[i] * b[i]
	}
	if ma == 0 || mb == 0 {
		return -1
	}
	return dot / math.Sqrt(ma*mb)
}
func (s *Server) calculateFace(ctx context.Context, frames []string, steps []string) (faceEngineResult, error) {
	var out faceEngineResult
	if len(frames) != 3 || len(steps) != 3 {
		return out, errors.New("capture must contain three frames")
	}
	seen := make(map[[32]byte]bool)
	for _, frame := range frames {
		if len(frame) < 1000 || len(frame) > 700000 || strings.Contains(frame, ",") {
			return out, errors.New("invalid image size")
		}
		checksum := sha256.Sum256([]byte(frame))
		if seen[checksum] {
			return out, errors.New("duplicate capture")
		}
		seen[checksum] = true
	}
	input, _ := json.Marshal(map[string]any{"frames": frames, "steps": steps, "modelsDir": s.cfg.FaceModelsDir})
	ctx, cancel := context.WithTimeout(ctx, 22*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, s.cfg.FacePython, "face/engine.py")
	cmd.Stdin = bytes.NewReader(input)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		return out, fmt.Errorf("face engine unavailable: %w (%s)", err, strings.TrimSpace(stderr.String()))
	}
	if err := json.Unmarshal(stdout.Bytes(), &out); err != nil {
		return out, errors.New("face engine returned invalid output")
	}
	if out.Error != "" {
		return out, errors.New(out.Error)
	}
	if len(out.Embedding) != 128 || !out.MovementPassed {
		return out, errors.New("face quality or movement challenge failed")
	}
	return out, nil
}
