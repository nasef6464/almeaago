package commercehttp

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

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
	var envelope struct {
		Object string `json:"object"`
	}
	if json.Unmarshal(raw, &envelope) != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid Tap event"})
		return
	}
	switch strings.ToLower(strings.TrimSpace(envelope.Object)) {
	case "charge":
		event, verifyErr := tapprovider.VerifyWebhook(h.tapSecretKey, raw, r.Header.Get("hashstring"))
		if verifyErr != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid Tap hashstring"})
			return
		}
		out, applyErr := h.checkout.ProviderEvent(r.Context(), "tap", event)
		if applyErr != nil {
			writeError(w, applyErr)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"result": out})
	case "refund":
		verified, verifyErr := tapprovider.VerifyRefundWebhook(h.tapSecretKey, raw, r.Header.Get("hashstring"))
		if verifyErr != nil {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid Tap refund"})
			return
		}
		var out any
		if verified.Event.PaymentRequestID != "" {
			out, err = h.checkout.ProviderEvent(r.Context(), "tap", verified.Event)
		} else {
			out, err = h.checkout.ProviderEventBySession(r.Context(), "tap", verified.ProviderSessionID, verified.Event)
		}
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"result": out})
	default:
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Unsupported Tap event"})
	}
}
