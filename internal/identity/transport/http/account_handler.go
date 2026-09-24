package identityhttp

import (
	"bytes"
	"encoding/json"
	"net/http"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
)

func (h *Handler) updateMyProfile(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.accountAuthenticate(w, r)
	if !ok {
		return
	}

	var payload struct {
		Name   *string `json:"name"`
		Avatar *string `json:"avatar"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	user, err := h.account.UpdateProfile(
		r.Context(),
		auth.User,
		domain.SelfProfileUpdate{
			Name:      payload.Name,
			AvatarURL: payload.Avatar,
		},
	)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": presentUser(user)})
}

func (h *Handler) updateMyIdentity(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.accountAuthenticate(w, r)
	if !ok {
		return
	}

	var payload struct {
		NationalID json.RawMessage `json:"nationalId"`
		Phone      json.RawMessage `json:"phone"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	input := domain.SelfIdentityUpdate{}
	if payload.NationalID != nil {
		input.NationalIDSet = true
		value, valid := nullableJSONString(payload.NationalID)
		if !valid {
			writeApplicationError(w, application.ErrInvalidInput)
			return
		}
		input.NationalID = value
	}
	if payload.Phone != nil {
		input.PhoneSet = true
		value, valid := nullableJSONString(payload.Phone)
		if !valid {
			writeApplicationError(w, application.ErrInvalidInput)
			return
		}
		input.Phone = value
	}

	user, err := h.account.UpdateIdentity(r.Context(), auth.User, input)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": presentUser(user)})
}

func (h *Handler) accountAuthenticate(
	w http.ResponseWriter,
	r *http.Request,
) (application.Authenticated, bool) {
	if h.account == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"message": "Account identity service is unavailable",
		})
		return application.Authenticated{}, false
	}

	auth, ok := h.authenticate(w, r)
	if !ok {
		return application.Authenticated{}, false
	}
	if err := h.service.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
		writeApplicationError(w, err)
		return application.Authenticated{}, false
	}
	return auth, true
}

func nullableJSONString(raw json.RawMessage) (*string, bool) {
	if bytes.Equal(bytes.TrimSpace(raw), []byte("null")) {
		return nil, true
	}
	var value string
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, false
	}
	return &value, true
}
