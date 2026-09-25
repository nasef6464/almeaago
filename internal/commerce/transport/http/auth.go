package commercehttp

import (
	"encoding/json"
	"errors"
	"net/http"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

func (h *Handler) authenticate(
	w http.ResponseWriter,
	r *http.Request,
	requireCSRF bool,
) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeIdentityError(w, err)
		return identityapp.Authenticated{}, false
	}
	if requireCSRF {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeIdentityError(w, err)
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func writeIdentityError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, identityapp.ErrUnauthenticated):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
	case errors.Is(err, identityapp.ErrCSRF):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
	case errors.Is(err, identityapp.ErrAccountDisabled):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Account is disabled"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, commerceapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
	case errors.Is(err, commerceapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, commerce.ErrSchoolContractNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "School contract target not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}