package coretx

import "testing"

func TestFilterRelatedDocuments(t *testing.T) {
	rows := []map[string]any{
		{"documentType": "SHIPMENT", "documentNo": "SHP-1"},
		{"documentType": "SALES_INVOICE", "documentNo": "INV-1"},
		{"documentType": "shipment", "documentNo": "SHP-2"},
	}
	got := filterRelatedDocuments(rows, "SHIPMENT")
	if len(got) != 2 {
		t.Fatalf("expected 2 shipment rows, got %d", len(got))
	}
}

func TestMaxZero(t *testing.T) {
	if got := maxZero(-3); got != 0 {
		t.Fatalf("expected zero for negative value, got %v", got)
	}
	if got := maxZero(4.5); got != 4.5 {
		t.Fatalf("expected 4.5, got %v", got)
	}
}
