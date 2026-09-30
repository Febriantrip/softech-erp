package security

import (
	"testing"
	"time"
)

func TestTokenRoundTrip(t *testing.T) {
	service := NewTokenService("0123456789abcdefghijklmnopqrstuvwxyz", "nexa-test", time.Hour)
	token, issued, err := service.Issue("USR-1", "Test User", []string{"ADMIN"}, []string{"NDU"}, []string{"JKT-HO"})
	if err != nil {
		t.Fatalf("issue token: %v", err)
	}
	parsed, err := service.Parse(token)
	if err != nil {
		t.Fatalf("parse token: %v", err)
	}
	if parsed.Subject != issued.Subject || parsed.Issuer != "nexa-test" {
		t.Fatalf("unexpected claims: %#v", parsed)
	}
	if !Has(parsed.Entities, "NDU") || !Has(parsed.Sites, "JKT-HO") {
		t.Fatal("scope claims missing")
	}
}

func TestTamperedTokenRejected(t *testing.T) {
	service := NewTokenService("0123456789abcdefghijklmnopqrstuvwxyz", "nexa-test", time.Hour)
	token, _, _ := service.Issue("USR-1", "Test User", nil, nil, nil)
	token = token[:len(token)-1] + "x"
	if _, err := service.Parse(token); err == nil {
		t.Fatal("tampered token must be rejected")
	}
}
