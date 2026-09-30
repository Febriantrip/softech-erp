package coretx

import (
	"os"
	"strings"
	"testing"
)

func TestSalesOrderD1DReadContract(t *testing.T) {
	body, err := os.ReadFile("sales_order_read.go")
	if err != nil {
		t.Fatalf("read sales_order_read.go: %v", err)
	}
	source := string(body)
	for _, needle := range []string{
		`"company"`,
		`"site"`,
		`"before"`,
		`"after"`,
		`"metadata"`,
		`'CUSTOMER_RECEIPT'::text`,
		`'JOURNAL_ENTRY'::text`,
		`'ACCOUNTING'::text`,
		`ae.entity_id=(SELECT entity_id FROM erp.sales_orders WHERE id=$1::uuid)`,
	} {
		if !strings.Contains(source, needle) {
			t.Fatalf("D1-D read contract missing %q", needle)
		}
	}
}
