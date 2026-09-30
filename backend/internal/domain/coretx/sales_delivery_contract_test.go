package coretx

import (
	"os"
	"strings"
	"testing"
)

func TestDeliveryOrderContract(t *testing.T) {
	source, err := os.ReadFile("sales_delivery.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, needle := range []string{
		"p.status='COMPLETED'", "available picked qty", "d.status<>'CANCELLED'",
		"READY_TO_LOAD", "LOADING", "LOADED", "shipping address is required",
		"delivery_order.created", "delivery_order.cancelled",
	} {
		if !strings.Contains(text, needle) {
			t.Fatalf("delivery contract missing %q", needle)
		}
	}
}
