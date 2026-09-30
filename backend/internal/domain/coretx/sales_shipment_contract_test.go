package coretx

import (
	"os"
	"strings"
	"testing"
)

func TestShipmentContract(t *testing.T) {
	source, err := os.ReadFile("sales_shipment.go")
	if err != nil {
		t.Fatal(err)
	}
	text := string(source)
	for _, needle := range []string{
		"d.status='LOADED'", "no loaded Delivery Order quantity remains available for Shipment",
		"status='DISPATCHED'", "SHIPMENT_OUT", "PARTIALLY_SHIPPED", "SHIPPED",
		"vehicle and driver are required before dispatch", "POD recipient is required", "POD reference is required",
		"shipment.dispatched", "shipment.delivered", "only PLANNED Shipment can be cancelled",
	} {
		if !strings.Contains(text, needle) {
			t.Fatalf("shipment contract missing %q", needle)
		}
	}
}
