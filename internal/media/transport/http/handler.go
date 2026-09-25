package mediahttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	mediaapp "github.com/nasef6464/almeaago/internal/media/application"
	media "github.com/nasef6464/almeaago/internal/media/domain"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handler struct {
	service *mediaapp.Service
	auth    Authenticator
}

func New(service *mediaapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Post("/uploads/presign", h.presign)
	r.Post("/uploads/{id}/complete", h.complete)
	r.Get("/assets/{id}", h.getAsset)
	return r
}

func (h *Handler) presign(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input mediaapp.PresignInput
	if !decodeJSON(w, r, &input) {
		return
	}
	result, err := h.service.Presign(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	body := map[string]any{
		"asset":          presentAsset(result.Asset),
		"uploadRequired": result.UploadRequired,
	}
	if result.Target != nil {
		body["upload"] = map[string]any{
			"url":       result.Target.URL,
			"headers":   result.Target.Headers,
			"expiresAt": result.Target.ExpiresAt,
		}
	}
	writeJSON(w, http.StatusOK, body)
}

func (h *Handler) complete(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	asset, err := h.service.Complete(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"asset": presentAsset(asset)})
}

func (h *Handler) getAsset(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	asset, err := h.service.Get(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"asset": presentAsset(asset)})
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func presentAsset(asset media.Asset) map[string]any {
	return map[string]any{
		"id":         asset.ID,
		"publicUrl":  asset.PublicURL,
		"mimeType":   asset.MimeType,
		"sizeBytes":  asset.SizeBytes,
		"sha256":     asset.SHA256,
		"version":    asset.Version,
		"status":     asset.Status,
		"verifiedAt": asset.VerifiedAt,
	}
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

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, mediaapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid media request"})
	case errors.Is(err, mediaapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, media.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Asset not found"})
	case errors.Is(err, media.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Asset metadata or upload verification conflict"})
	case errors.Is(err, media.ErrUnavailable):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Media provider unavailable"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
