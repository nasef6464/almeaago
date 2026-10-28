package contenthttp

import (
	"encoding/json"
	"errors"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"io"
	"net/http"
)

func (h *Handler) getHomepageSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	settings, err := h.homepage.Get(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, settings)
}
func (h *Handler) patchHomepageSettings(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	if !auth.User.HasRole(identity.RoleAdmin) {
		writeJSON(w, 403, map[string]string{"message": "Forbidden"})
		return
	}
	// Match the original app.ts global JSON limit; keep other content at256KiB.
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	decoder := json.NewDecoder(r.Body)
	var input map[string]any
	if err := decoder.Decode(&input); err != nil {
		writeHomepageDecodeError(w, err)
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		writeHomepageDecodeError(w, err)
		return
	}
	settings, err := h.homepage.Patch(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, 200, settings)
}

func writeHomepageDecodeError(w http.ResponseWriter, err error) {
	var oversized *http.MaxBytesError
	if errors.As(err, &oversized) {
		writeJSON(w, 413, map[string]string{"message": "Homepage settings payload too large"})
		return
	}
	writeJSON(w, 400, map[string]string{"message": "Invalid homepage settings"})
}
