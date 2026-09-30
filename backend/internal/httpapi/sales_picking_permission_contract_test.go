package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestD3APickingRoutesRequireActionPermissions(t *testing.T) {
	raw, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(raw)
	for _, permission := range []string{
		"picking_order.view", "picking_order.create", "picking_order.update", "picking_order.complete", "picking_order.cancel",
	} {
		if !strings.Contains(source, `RequirePermission("`+permission+`"`) {
			t.Fatalf("route permission missing: %s", permission)
		}
	}
}
