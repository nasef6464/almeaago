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
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := parseInt(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, err := h.access.ListAccessCodes(r.Context(), a.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (h *Handler) createAccessCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.AccessCodeCreate
	if !decode(w, r, &in) {
		return
	}
	out, err := h.access.CreateAccessCode(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 201, map[string]any{"accessCode": out})
}

func (h *Handler) updateAccessCodeStatus(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		ExpectedRevision int                       `json:"expectedRevision"`
		Status           commerce.AccessCodeStatus `json:"status"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.access.SetAccessCodeStatus(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedRevision, in.Status)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"accessCode": out})
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
	out, err := h.access.Redeem(r.Context(), a.User, in.Code)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (h *Handler) listSchoolSeats(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, err := parseInt(r.URL.Query().Get("page"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, err := parseInt(r.URL.Query().Get("limit"))
	if err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, err := h.access.ListSchoolSeats(r.Context(), a.User, chi.URLParam(r, "id"), page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, out)
}

func (h *Handler) assignSchoolSeat(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		UserID string `json:"userId"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.access.AssignSchoolSeat(r.Context(), a.User, chi.URLParam(r, "id"), in.UserID)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 201, map[string]any{"seat": out})
}

func (h *Handler) revokeSchoolSeat(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		ExpectedRevision int    `json:"expectedRevision"`
		Reason           string `json:"reason"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.access.RevokeSchoolSeat(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedRevision, in.Reason)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, map[string]any{"seat": out})
}
