package finance

import (
	"math"
	"testing"
)

func TestInvoiceAmountsWithDiscountAndTax(t *testing.T) {
	gross, discount, dpp, tax, total := invoiceAmounts(3, 335000, 10, 11)
	if gross != 1005000 || discount != 100500 || dpp != 904500 || tax != 99495 || total != 1003995 {
		t.Fatalf("unexpected financial allocation: gross=%f discount=%f dpp=%f tax=%f total=%f", gross, discount, dpp, tax, total)
	}
}
func TestInvoiceQtyGuard(t *testing.T) {
	for _, v := range []float64{0, -1, math.NaN(), math.Inf(1)} {
		if validInvoiceQty(v) {
			t.Fatalf("invalid qty accepted: %v", v)
		}
	}
	if !validInvoiceQty(0.5) {
		t.Fatal("partial qty rejected")
	}
}
