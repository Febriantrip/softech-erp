package coretx

import "testing"

func TestQuantityToBase(t *testing.T) {
	for _, c := range []struct{ qty, factor, want float64 }{
		{1, 120, 120}, {3, 10, 30}, {0, 120, 0}, {0.5, 120, 60}, {12, 1, 12},
	} {
		got, err := QuantityToBase(c.qty, c.factor)
		if err != nil || got != c.want {
			t.Fatalf("%v*%v = %v, %v; want %v", c.qty, c.factor, got, err, c.want)
		}
	}
	for _, c := range []struct{ qty, factor float64 }{{-1, 120}, {1, 0}, {1, -2}, {0.0000001, 1}} {
		if _, err := QuantityToBase(c.qty, c.factor); err == nil {
			t.Fatalf("expected invalid conversion %v*%v", c.qty, c.factor)
		}
	}
}
