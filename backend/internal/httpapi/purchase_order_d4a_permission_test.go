package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestPurchaseOrderD4APermissionRoutes(t *testing.T) {
	body, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	routes := string(body)
	for _, permission := range []string{
		"purchase_order.view", "purchase_order.create", "purchase_order.edit", "purchase_order.delete",
		"purchase_order.submit", "purchase_order.approve", "purchase_order.cancel", "purchase_order.receive",
	} {
		if !strings.Contains(routes, `RequirePermission("`+permission+`"`) {
			t.Errorf("missing backend guard %s", permission)
		}
	}
	for _, path := range []string{"PATCH /api/v1/core/purchase-orders/{id}", "DELETE /api/v1/core/purchase-orders/{id}", "POST /api/v1/core/purchase-orders/{id}/cancel"} {
		if !strings.Contains(routes, path) {
			t.Errorf("missing purchase order route: %s", path)
		}
	}
}
