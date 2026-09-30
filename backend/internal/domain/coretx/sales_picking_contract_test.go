package coretx

import (
	"os"
	"strings"
	"testing"
)

func TestD3APickingUsesReservedQuantityWithoutInventoryMutation(t *testing.T) {
	raw, err := os.ReadFile("sales_picking.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(raw)
	for _, token := range []string{
		"status IN ('RESERVED','PARTIALLY_SHIPPED')",
		"reserved_qty::float8",
		"WHEN p.status IN ('OPEN','IN_PROGRESS') THEN pl.requested_qty",
		"WHEN p.status='COMPLETED' THEN pl.picked_qty",
		"no reserved quantity remains available for a new picking order",
		"picked quantity exceeds requested quantity",
		"shortage_qty=GREATEST(requested_qty-$2,0)",
	} {
		if !strings.Contains(source, token) {
			t.Fatalf("D3-A picking contract missing %q", token)
		}
	}
	if strings.Contains(source, "UPDATE erp.inventory_balance") {
		t.Fatal("D3-A picking must not mutate On Hand/Reserved inventory balance")
	}
}

func TestD3APickingKeepsScopeAndLocks(t *testing.T) {
	raw, err := os.ReadFile("sales_picking.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(raw)
	for _, token := range []string{"entity_id=$2::uuid", "outside current site scope", "FOR UPDATE"} {
		if !strings.Contains(source, token) {
			t.Fatalf("D3-A scope/lock contract missing %q", token)
		}
	}
}
