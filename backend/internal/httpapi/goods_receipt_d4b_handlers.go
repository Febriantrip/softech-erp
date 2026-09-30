package httpapi

import (
	"net/http"
)

func (s *Server) coreGoodsReceiptDetailD4B(w http.ResponseWriter, r *http.Request) {
	scope, err := s.coreScope(r)
	if err != nil {
		writeError(w, http.StatusForbidden, "SCOPE_FORBIDDEN", err.Error())
		return
	}
	result, err := s.core.GoodsReceiptDetailD4B(r.Context(), scope.EntityCode, scope.SiteCode, r.PathValue("id"))
	if err != nil {
		writeError(w, http.StatusNotFound, "GOODS_RECEIPT_NOT_FOUND", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": result})
}
