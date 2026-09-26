package commercehttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func (h *Handler) listAccessCodes(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.ListAccessCodes(
		r.Context(), a.User, page, limit,
		r.URL.Query().Get("schoolId"), r.URL.Query().Get("productId"),
		commerce.AccessCodeStatus(r.URL.Query().Get("status")),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) createAccessCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.AccessCodeWrite
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.CreateAccessCode(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"accessCode": out})
}

func (h *Handler) updateAccessCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.AccessCodeUpdate
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.UpdateAccessCode(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"accessCode": out})
}

func (h *Handler) redeemAccessCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		Code string `json:"code"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.service.RedeemAccessCode(r.Context(), a.User, in.Code)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"redemption": out})
}

func (h *Handler) listSchoolSeats(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.service.ListSchoolSeats(
		r.Context(), a.User, page, limit,
		r.URL.Query().Get("schoolId"), r.URL.Query().Get("productId"), r.URL.Query().Get("userId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) assignSchoolSeat(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.SchoolSeatAssign
	if !decode(w, r, &in) {
		return
	}
	seat, entitlement, err := h.service.AssignSchoolSeat(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"schoolSeat": seat, "entitlement": entitlement})
}
