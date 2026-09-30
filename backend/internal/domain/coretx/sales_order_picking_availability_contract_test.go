package coretx

import (
	"os"
	"strings"
	"testing"
)

func TestSalesOrderPickingAvailabilityMatchesCreatePickingAllocation(t *testing.T) {
	for _, file := range []string{"service.go", "sales_order_read.go"} {
		raw, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		source := string(raw)
		for _, token := range []string{
			"pickingAvailableQty",
			"pickingAllocatedQty",
			"WHEN p.status IN ('OPEN','IN_PROGRESS') THEN pl.requested_qty",
			"WHEN p.status='COMPLETED' THEN pl.picked_qty",
			"GREATEST(sol.reserved_qty-COALESCE(pa.allocated_qty,0),0)",
		} {
			if !strings.Contains(source, token) {
				t.Fatalf("%s missing picking availability contract %q", file, token)
			}
		}
	}
}
