package coretx

import "testing"

func TestSalesOrderCanCancel(t *testing.T) {
	allowed := []string{"PENDING_APPROVAL", "APPROVED", "RESERVED"}
	for _, status := range allowed {
		if !salesOrderCanCancel(status) {
			t.Fatalf("expected %s to be cancellable", status)
		}
	}
	blocked := []string{"DRAFT", "PARTIALLY_SHIPPED", "SHIPPED", "CANCELLED"}
	for _, status := range blocked {
		if salesOrderCanCancel(status) {
			t.Fatalf("expected %s to be blocked from cancel", status)
		}
	}
}
