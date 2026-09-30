package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestDeliveryOrderRoutesRequireActionPermissions(t *testing.T) {
	source, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, permission := range []string{"delivery_order.view", "delivery_order.create", "delivery_order.update", "delivery_order.release", "delivery_order.load", "delivery_order.complete", "delivery_order.cancel"} {
		if !strings.Contains(text, `RequirePermission("`+permission+`"`) {
			t.Fatalf("missing permission guard %s", permission)
		}
	}
}
