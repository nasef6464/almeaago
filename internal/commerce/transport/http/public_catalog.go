package commercehttp

import (
	"net/http"
)

func (h *Handler) publicCatalog(w http.ResponseWriter, r *http.Request) {
	page, e := parseInt(r.URL.Query().Get("page"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, e := parseInt(r.URL.Query().Get("limit"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, e := h.service.PublicCatalog(r.Context(), page, limit, r.URL.Query().Get("pathId"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, out)
}
func (h *Handler) publicPaymentOptions(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, 200, h.checkout.PublicPaymentOptions())
}
