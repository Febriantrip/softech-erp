package coretx

import (
	"math"
	"os"
	"strings"
	"testing"
)

func TestPurchaseOrderDateAndMoneyD4A(t *testing.T) {
	d, err := poDate("2026-09-23", "orderDate")
	if err != nil || d.Format("2006-01-02") != "2026-09-23" {
		t.Fatal(d, err)
	}
	if _, err = poDate("23/09/2026", "orderDate"); err == nil {
		t.Fatal("invalid date accepted")
	}
	if got := poUnit(335000 * 0.9); math.Abs(got-301500) > 0.000001 {
		t.Fatalf("net price: %f", got)
	}
	if got := poMoney(3 * poUnit(335000*0.9)); got != 904500 {
		t.Fatalf("3 units net: %f", got)
	}
}
func TestPurchaseOrderSourceContractD4A(t *testing.T) {
	// Guards against inadvertently restoring the 42P08 query from legacy PO transitions.
	source, err := os.ReadFile("purchase_order_d4a.go")
	if err != nil {
		t.Fatal(err)
	}
	sql := string(source)
	if !strings.Contains(sql, "status=$2::varchar(30)") || !strings.Contains(sql, "$2::varchar(30)='APPROVED'") {
		t.Fatal("PO status transition must cast bind parameter explicitly")
	}
	if !strings.Contains(sql, "purchase order revision conflict") {
		t.Fatal("PO revision guard missing")
	}
	if !strings.Contains(sql, "purchase order cannot be cancelled after receiving begins") {
		t.Fatal("PO cancellation guard missing")
	}
}
