package httpapi

import (
	"os"
	"strings"
	"testing"
)

func TestShipmentRoutesRequireActionPermissions(t *testing.T) {
	source, err := os.ReadFile("server.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, permission := range []string{"shipment.view", "shipment.create", "shipment.update", "shipment.dispatch", "shipment.deliver", "shipment.cancel"} {
		if !strings.Contains(text, `RequirePermission("`+permission+`"`) {
			t.Fatalf("missing permission guard %s", permission)
		}
	}
}
