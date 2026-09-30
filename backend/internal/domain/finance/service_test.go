package finance

import (
	"testing"
	"time"
)

func TestDueDateNetTerms(t *testing.T) {
	date := time.Date(2026, 9, 9, 0, 0, 0, 0, time.UTC)
	if got := dueDate(date, "NET 30"); !got.Equal(date.AddDate(0, 0, 30)) {
		t.Fatalf("NET 30 expected %v, got %v", date.AddDate(0, 0, 30), got)
	}
	if got := dueDate(date, "invalid"); !got.Equal(date.AddDate(0, 0, 30)) {
		t.Fatalf("invalid terms must default to NET 30")
	}
}

func TestRound2(t *testing.T) {
	if got := round2(10.126); got != 10.13 {
		t.Fatalf("expected 10.13, got %.2f", got)
	}
}
