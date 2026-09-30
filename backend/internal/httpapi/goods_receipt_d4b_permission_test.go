package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestD4BReceiptPermissionRoutes(t *testing.T) {
	body, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	s := string(body)
	for _, p := range []string{"goods_receipt.view", "goods_receipt.put_away", "purchase_order.receive"} {
		if !strings.Contains(s, `RequirePermission("`+p+`"`) {
			t.Errorf("missing backend permission %s", p)
		}
	}
}
