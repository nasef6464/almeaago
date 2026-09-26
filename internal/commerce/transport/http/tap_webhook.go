package commercehttp

import (
	"io"
	"net/http"

	tapprovider "github.com/nasef6464/almeaago/internal/commerce/provider/tap"
)

func (h *Handler) tapWebhook(w http.ResponseWriter, r *http.Request) {
	if h.tapSecretKey == "" {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Tap webhook is not configured"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid Tap event"})
		return
	}
	event, err := tapprovider.VerifyWebhook(h.tapSecretKey, raw, r.Header.Get("hashstring"))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid Tap hashstring"})
		return
	}
	out, err := h.checkout.ProviderEvent(r.Context(), "tap", event)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": out})
}
