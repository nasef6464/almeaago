package commercehttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func (h *Handler) listRevenueEntries(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, err := parseInt(r.URL.Query().Get("page"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := parseInt(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, err := h.checkout.RevenueEntries(
		r.Context(),
		a.User,
		page,
		limit,
		commerce.RevenueAllocationStatus(r.URL.Query().Get("allocationStatus")),
		commerce.PayoutStatus(r.URL.Query().Get("payoutStatus")),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) allocateRevenue(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.RevenueAllocation
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.AllocateRevenue(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": out})
}

func (h *Handler) markPayoutPaid(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.PayoutMarkPaid
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.MarkPayoutPaid(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"entry": out})
}
