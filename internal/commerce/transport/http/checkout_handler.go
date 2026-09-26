package commercehttp

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func verifyWebhookHMAC(secret, body []byte, signature string) bool {
	signature = strings.TrimSpace(signature)
	if strings.HasPrefix(signature, "sha256=") {
		signature = strings.TrimPrefix(signature, "sha256=")
	}
	if len(secret) == 0 || len(signature) != sha256.Size*2 {
		return false
	}
	expected, err := hex.DecodeString(signature)
	if err != nil {
		return false
	}
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(body)
	return hmac.Equal(expected, mac.Sum(nil))
}

func (h *Handler) catalogProduct(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, err := h.checkout.CatalogProduct(r.Context(), a.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"product": out})
}

func (h *Handler) previewDiscount(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	var in struct {
		ProductID string `json:"productId"`
		Code      string `json:"code"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.PreviewDiscount(r.Context(), a.User, in.ProductID, in.Code)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"preview": out})
}

func (h *Handler) createCheckout(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.CheckoutCreate
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.CreateCheckout(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"request": out})
}

func (h *Handler) myPaymentRequests(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.checkout.MyRequests(r.Context(), a.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) listDiscounts(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.checkout.ListDiscounts(
		r.Context(), a.User, page, limit,
		commerce.DiscountStatus(r.URL.Query().Get("status")),
		r.URL.Query().Get("search"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) createDiscount(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.DiscountWrite
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.CreateDiscount(r.Context(), a.User, in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"discount": out})
}

func (h *Handler) updateDiscount(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		ExpectedRevision int                    `json:"expectedRevision"`
		Discount         commerce.DiscountWrite `json:"discount"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.UpdateDiscount(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedRevision, in.Discount)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"discount": out})
}

func (h *Handler) adminPaymentRequests(w http.ResponseWriter, r *http.Request) {
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
	out, err := h.checkout.AdminRequests(r.Context(), a.User, page, limit, commerce.PaymentStatus(r.URL.Query().Get("status")))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) reviewPaymentRequest(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.PaymentReview
	if !decode(w, r, &in) {
		return
	}
	out, err := h.checkout.Review(r.Context(), a.User, chi.URLParam(r, "id"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"request": out})
}

func (h *Handler) providerWebhook(w http.ResponseWriter, r *http.Request) {
	if len(h.webhookSecret) == 0 {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Payment webhook is not configured"})
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid provider event"})
		return
	}
	if !verifyWebhookHMAC(h.webhookSecret, raw, r.Header.Get("X-Payment-Signature")) {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid payment signature"})
		return
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	var in commerce.ProviderEvent
	if err = dec.Decode(&in); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid provider event"})
		return
	}
	sum := sha256.Sum256(raw)
	in.PayloadSHA256 = hex.EncodeToString(sum[:])
	out, err := h.checkout.ProviderEvent(r.Context(), chi.URLParam(r, "provider"), in)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"result": out})
}
