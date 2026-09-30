package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestSalesOrderRoutesRequireActionPermissions(t *testing.T) {
	raw, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	source := string(raw)
	required := []string{
		`RequirePermission("sales_order.view"`,
		`RequirePermission("sales_order.create"`,
		`RequirePermission("sales_order.edit"`,
		`RequirePermission("sales_order.delete"`,
		`RequirePermission("sales_order.submit"`,
		`RequirePermission("sales_order.approve"`,
		`RequirePermission("sales_order.cancel"`,
		`RequirePermission("sales_order.reserve"`,
		`RequirePermission("sales_order.dispatch"`,
	}
	for _, token := range required {
		if !strings.Contains(source, token) {
			t.Fatalf("missing Sales Order permission guard %s", token)
		}
	}
}
