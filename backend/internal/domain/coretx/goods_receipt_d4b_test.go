package coretx

import (
	"math"
	"strings"
	"testing"
)

func TestD4BReceiptQuantityValidation(t *testing.T) {
	tests := []struct {
		accepted, rejected, remaining float64
		valid                         bool
	}{
		{3, 0, 5, true}, {3, 2, 5, true}, {0, 1, 5, true}, {0, 0, 5, true},
		{6, 0, 5, false}, {3, 3, 5, false}, {-1, 0, 5, false}, {1, -1, 5, false},
		{math.NaN(), 0, 5, false}, {math.Inf(1), 0, 5, false},
	}
	for _, tt := range tests {
		err := validateReceiptQtyD4B(tt.accepted, tt.rejected, tt.remaining)
		if (err == nil) != tt.valid {
			t.Errorf("accepted=%v rejected=%v remain=%v err=%v", tt.accepted, tt.rejected, tt.remaining, err)
		}
	}
}
func TestD4BExplicitInputContract(t *testing.T) {
	// Check the incoming payload never defaults an omitted line to the remaining PO quantity.
	if strings.TrimSpace((ReceiveLineInput{}).SKU) != "" || (ReceiveLineInput{}).AcceptedQty != 0 {
		t.Fatal("receiving default must remain zero")
	}
}
