package coretx

import (
	"errors"
	"math"
)

// QuantityToBase is a pure quantity conversion helper. Financial values and
// unit prices MUST be converted separately; never apply a new factor to old GL.
func QuantityToBase(qty, baseQtyPerUOM float64) (float64, error) {
	if math.IsNaN(qty) || math.IsInf(qty, 0) || qty < 0 {
		return 0, errors.New("invalid transaction qty")
	}
	if math.IsNaN(baseQtyPerUOM) || math.IsInf(baseQtyPerUOM, 0) || baseQtyPerUOM <= 0 {
		return 0, errors.New("invalid UOM conversion factor")
	}
	v := qty * baseQtyPerUOM
	if math.IsNaN(v) || math.IsInf(v, 0) || v > 1e18 {
		return 0, errors.New("inventory qty out of range")
	}
	rounded := math.Round(v*1e6) / 1e6
	if math.Abs(rounded-v) > 1e-8 {
		return 0, errors.New("inventory qty exceeds six decimal places")
	}
	return rounded, nil
}
