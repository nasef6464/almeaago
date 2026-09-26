package commercehttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func (h *Handler) recordPaymentReversal(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.AdminReversalRecord
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.RecordAdminReversal(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": out})
}
