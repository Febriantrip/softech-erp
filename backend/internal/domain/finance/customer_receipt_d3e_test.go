package finance

import (
	"strings"
	"testing"
)

func TestReceiptAllocationCents(t *testing.T) {
	lines := []ReceiptAllocationInput{{SalesInvoiceID: "b", Amount: 200000.25}, {SalesInvoiceID: "a", Amount: 300000.75}}
	total, values, ids, err := receiptAllocationCents(500001, lines)
	if err != nil {
		t.Fatal(err)
	}
	if total != 50000100 || values["a"] != 30000075 || values["b"] != 20000025 || ids[0] != "a" {
		t.Fatalf("unexpected allocation: total=%d values=%v ids=%v", total, values, ids)
	}
}
func TestReceiptAllocationRejectsOverAndDuplicate(t *testing.T) {
	tests := []struct {
		name     string
		amount   float64
		lines    []ReceiptAllocationInput
		contains string
	}{
		{"unallocated", 500, []ReceiptAllocationInput{{"a", 400}}, "unallocated overpayment"},
		{"negative", 500, []ReceiptAllocationInput{{"a", -500}}, "positive"},
		{"duplicate", 500, []ReceiptAllocationInput{{"a", 250}, {"a", 250}}, "only appear once"},
		{"fractional", 0.001, []ReceiptAllocationInput{{"a", 0.001}}, "decimal places"},
		{"empty", 500, nil, "select 1"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, _, _, err := receiptAllocationCents(tt.amount, tt.lines)
			if err == nil || !strings.Contains(err.Error(), tt.contains) {
				t.Fatalf("expected %s: %v", tt.contains, err)
			}
		})
	}
}
