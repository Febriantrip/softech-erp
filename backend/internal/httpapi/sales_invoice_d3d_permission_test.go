package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestSalesInvoiceD3DRoutesRequirePermissions(t *testing.T) {
	source, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, permission := range []string{"sales_invoice.view", "sales_invoice.create", "sales_invoice.post", "sales_invoice.delete"} {
		if !strings.Contains(text, `RequirePermission("`+permission+`"`) {
			t.Fatalf("sales invoice permission missing: %s", permission)
		}
	}
}
