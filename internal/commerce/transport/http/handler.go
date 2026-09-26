package commercehttp

import (
	"context"
	"encoding/json"
	"io"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	commerceapp "github.com/nasef6464/almeaago/internal/commerce/application"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service *commerceapp.Service
	auth    Authenticator
}

func New(service *commerceapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/products", h.listProducts)
	r.Post("/products", h.createProduct)
	r.Get("/products/{id}", h.getProduct)
	r.Put("/products/{id}", h.updateProduct)
	r.Get("/entitlements", h.listEntitlements)
	r.Post("/entitlements", h.grantEntitlement)
	r.Post("/entitlements/{id}/revoke", h.revokeEntitlement)
	r.Get("/access/courses/{id}", h.courseAccess)
	r.Get("/checkout/quote", h.checkoutQuote)
	r.Get("/payment-requests/mine", h.myPaymentRequests)
	r.Get("/payment-requests", h.listPaymentRequests)
	r.Post("/payment-requests", h.createPaymentRequest)
	r.Patch("/payment-requests/{id}/review", h.reviewPaymentRequest)
	r.Get("/discount-codes", h.listDiscountCodes)
	r.Post("/discount-codes", h.createDiscountCode)
	r.Put("/discount-codes/{id}", h.updateDiscountCode)
	r.Post("/provider-events", h.providerEvent)
	return r
}

func (h *Handler) authn(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, 503, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	a, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, 401, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(a, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, 403, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return a, true
}

func parseInt(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, nil
	}
	return strconv.Atoi(raw)
}
func decode(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}
func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, commerceapp.ErrInvalidInput):
		writeJSON(w, 400, map[string]string{"message": "Invalid commerce request"})
	case errors.Is(err, commerceapp.ErrForbidden):
		writeJSON(w, 403, map[string]string{"message": "Forbidden"})
	case errors.Is(err, commerceapp.ErrProviderUnavailable):
		writeJSON(w, 503, map[string]string{"message": "Payment provider verification unavailable"})
	case errors.Is(err, commerce.ErrNotFound):
		writeJSON(w, 404, map[string]string{"message": "Commerce record not found"})
	case errors.Is(err, commerce.ErrConflict), errors.Is(err, commerce.ErrVersionConflict):
		writeJSON(w, 409, map[string]string{"message": "Commerce state conflict"})
	default:
		writeJSON(w, 500, map[string]string{"message": "Internal server error"})
	}
}

func (h *Handler) listProducts(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, e := parseInt(r.URL.Query().Get("page"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, e := parseInt(r.URL.Query().Get("limit"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, e := h.service.ListProducts(r.Context(), a.User, page, limit, commerce.ProductType(r.URL.Query().Get("productType")), commerce.ProductStatus(r.URL.Query().Get("status")), r.URL.Query().Get("search"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, out)
}
func (h *Handler) getProduct(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, e := h.service.Product(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"product": out})
}
func (h *Handler) createProduct(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.ProductWrite
	if !decode(w, r, &in) {
		return
	}
	out, e := h.service.CreateProduct(r.Context(), a.User, in)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"product": out})
}
func (h *Handler) updateProduct(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in struct {
		ExpectedRevision int                   `json:"expectedRevision"`
		Product          commerce.ProductWrite `json:"product"`
	}
	if !decode(w, r, &in) {
		return
	}
	out, e := h.service.UpdateProduct(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedRevision, in.Product)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"product": out})
}
func (h *Handler) listEntitlements(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	page, e := parseInt(r.URL.Query().Get("page"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	limit, e := parseInt(r.URL.Query().Get("limit"))
	if e != nil {
		writeJSON(w, 400, map[string]string{"message": "Invalid pagination"})
		return
	}
	out, e := h.service.ListEntitlements(r.Context(), a.User, page, limit, commerce.SubjectType(r.URL.Query().Get("subjectType")), r.URL.Query().Get("subjectId"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, out)
}
func (h *Handler) grantEntitlement(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok {
		return
	}
	var in commerce.EntitlementGrant
	if !decode(w, r, &in) {
		return
	}
	out, e := h.service.GrantManual(r.Context(), a.User, in)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 201, map[string]any{"entitlement": out})
}
func (h *Handler) revokeEntitlement(w http.ResponseWriter, r *http.Request) {
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
	out, e := h.service.Revoke(r.Context(), a.User, chi.URLParam(r, "id"), in.ExpectedRevision, in.Reason)
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"entitlement": out})
}
func (h *Handler) courseAccess(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok {
		return
	}
	out, e := h.service.CourseAccess(r.Context(), a.User, chi.URLParam(r, "id"))
	if e != nil {
		writeError(w, e)
		return
	}
	writeJSON(w, 200, map[string]any{"access": out})
}


func (h *Handler) checkoutQuote(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok { return }
	out, err := h.service.CheckoutQuote(r.Context(), a.User, r.URL.Query().Get("productId"), r.URL.Query().Get("discountCode"))
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, map[string]any{"quote": out})
}

func (h *Handler) myPaymentRequests(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok { return }
	page, err := parseInt(r.URL.Query().Get("page")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	limit, err := parseInt(r.URL.Query().Get("limit")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	out, err := h.service.MyPaymentRequests(r.Context(), a.User, page, limit)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, out)
}

func (h *Handler) listPaymentRequests(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok { return }
	page, err := parseInt(r.URL.Query().Get("page")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	limit, err := parseInt(r.URL.Query().Get("limit")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	out, err := h.service.ListPaymentRequests(r.Context(), a.User, page, limit, commerce.PaymentStatus(r.URL.Query().Get("status")))
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, out)
}

func (h *Handler) createPaymentRequest(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok { return }
	var in commerce.PaymentRequestCreate
	if !decode(w, r, &in) { return }
	out, err := h.service.CreatePaymentRequest(r.Context(), a.User, in)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 201, map[string]any{"request": out})
}

func (h *Handler) reviewPaymentRequest(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok { return }
	var in commerce.PaymentReview
	if !decode(w, r, &in) { return }
	out, err := h.service.ReviewPaymentRequest(r.Context(), a.User, chi.URLParam(r,"id"), in)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, map[string]any{"request": out})
}

func (h *Handler) listDiscountCodes(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, false)
	if !ok { return }
	page, err := parseInt(r.URL.Query().Get("page")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	limit, err := parseInt(r.URL.Query().Get("limit")); if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid pagination"}); return }
	out, err := h.service.ListDiscountCodes(r.Context(), a.User, page, limit, commerce.DiscountStatus(r.URL.Query().Get("status")), r.URL.Query().Get("search"))
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, out)
}

func (h *Handler) createDiscountCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok { return }
	var in commerce.DiscountWrite
	if !decode(w, r, &in) { return }
	out, err := h.service.CreateDiscountCode(r.Context(), a.User, in)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 201, map[string]any{"discount": out})
}

func (h *Handler) updateDiscountCode(w http.ResponseWriter, r *http.Request) {
	a, ok := h.authn(w, r, true)
	if !ok { return }
	var in struct {
		ExpectedRevision int `json:"expectedRevision"`
		Discount commerce.DiscountWrite `json:"discount"`
	}
	if !decode(w, r, &in) { return }
	out, err := h.service.UpdateDiscountCode(r.Context(), a.User, chi.URLParam(r,"id"), in.ExpectedRevision, in.Discount)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, map[string]any{"discount": out})
}

func (h *Handler) providerEvent(w http.ResponseWriter, r *http.Request) {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	raw, err := io.ReadAll(r.Body)
	if err != nil { writeJSON(w,400,map[string]string{"message":"Invalid request"}); return }
	var in commerce.ProviderEventInput
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.DisallowUnknownFields()
	if err = dec.Decode(&in); err != nil { writeJSON(w,400,map[string]string{"message":"Invalid request"}); return }
	out, err := h.service.ApplyProviderEvent(r.Context(), raw, r.Header.Get("X-Commerce-Signature"), in)
	if err != nil { writeError(w, err); return }
	writeJSON(w, 200, out)
}
