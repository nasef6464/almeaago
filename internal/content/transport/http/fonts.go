package contenthttp

import (
	"encoding/json"
	"io"
	"net/http"
)

func (h *Handler) getFontSettings(w http.ResponseWriter, r *http.Request) {
	settings, err := h.fonts.Get(r.Context())
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}
func (h *Handler) patchFontSettings(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	// Two source uploads may each contain up to 700000 characters. Other
	// content routes retain their existing, smaller request limits.
	r.Body = http.MaxBytesReader(w, r.Body, 1500000)
	decoder := json.NewDecoder(r.Body)
	var input map[string]any
	if err := decoder.Decode(&input); err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid font settings"})
		return
	}
	if err := decoder.Decode(new(any)); err != io.EOF {
		writeJSON(w, 400, map[string]string{"message": "Invalid font settings"})
		return
	}
	settings, err := h.fonts.Patch(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, settings)
}
