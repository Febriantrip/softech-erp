package httpapi

import (
	"bytes"
	"encoding/base64"
	"math"
	"testing"

	"github.com/nexa-distributor/erp-backend/internal/config"
)

func TestFaceEncryptionAndTamper(t *testing.T) {
	s := Server{cfg: config.Config{FaceTemplateKey: base64.RawStdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 32))}}
	vector := make([]float64, 128)
	for i := range vector {
		vector[i] = float64(i) / 128
	}
	blob, err := s.encryptFace(vector)
	if err != nil {
		t.Fatal(err)
	}
	if bytes.Contains(blob, []byte("0.5")) {
		t.Fatal("descriptor appears unencrypted")
	}
	restored, err := s.decryptFace(blob)
	if err != nil {
		t.Fatal(err)
	}
	if math.Abs(cosine(vector, restored)-1) > 1e-8 {
		t.Fatal("incorrect descriptor roundtrip")
	}
	blob[len(blob)-1] ^= 1
	if _, err = s.decryptFace(blob); err == nil {
		t.Fatal("tampered descriptor accepted")
	}
}
func TestFaceCosineInvalid(t *testing.T) {
	if cosine([]float64{1}, []float64{1}) != -1 {
		t.Fatal("invalid vector accepted")
	}
	a := make([]float64, 128)
	b := make([]float64, 128)
	a[0] = 1
	b[0] = -1
	if cosine(a, b) > -0.99 {
		t.Fatal("inverse descriptor accepted")
	}
}
