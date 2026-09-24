package identityhttp

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

const (
	sessionCookieName      = "almeaa_access_token"
	googleStateCookieName  = "almeaa_google_oauth_state"
	googleReturnCookieName = "almeaa_google_oauth_return"
	googleStateTTL         = 10 * time.Minute
)

type GoogleOAuth interface {
	Available() bool
	AuthorizationURL(state string) string
	Exchange(ctx context.Context, code string) (domain.GoogleProfile, error)
}

type Options struct {
	Google    GoogleOAuth
	Admin     *application.AdminService
	WebOrigin string
}

type Handler struct {
	service    *application.Service
	production bool
	google     GoogleOAuth
	admin      *application.AdminService
	webOrigin  string
}

type userResponse struct {
	ID            string        `json:"id"`
	Email         string        `json:"email"`
	Name          string        `json:"name"`
	Status        string        `json:"status"`
	AvatarURL     string        `json:"avatarUrl"`
	NationalID    string        `json:"nationalId,omitempty"`
	Phone         string        `json:"phone,omitempty"`
	EmailVerified bool          `json:"emailVerified"`
	Role          domain.Role   `json:"role"`
	Roles         []domain.Role `json:"roles"`
}

func New(service *application.Service, production bool, options ...Options) http.Handler {
	handler := &Handler{
		service:    service,
		production: production,
		webOrigin:  "http://localhost:5173",
	}
	if len(options) > 0 {
		handler.google = options[0].Google
		handler.admin = options[0].Admin
		if strings.TrimSpace(options[0].WebOrigin) != "" {
			handler.webOrigin = strings.TrimRight(options[0].WebOrigin, "/")
		}
	}

	router := chi.NewRouter()

	router.Post("/register", handler.register)
	router.Post("/login", handler.login)
	router.Post("/login/national-id", handler.loginNationalID)
	router.Post("/login/phone-password", handler.loginPhonePassword)
	router.Post("/whatsapp/start", handler.startWhatsAppOTP)
	router.Post("/whatsapp/verify", handler.verifyWhatsAppOTP)
	router.Get("/google/start", handler.googleStart)
	router.Get("/google/callback", handler.googleCallback)
	router.Get("/me", handler.me)
	router.Get("/csrf", handler.csrf)
	router.Post("/logout", handler.logout)
	router.Post("/forgot-password", handler.forgotPassword)
	router.Post("/reset-password", handler.resetPassword)
	router.Post("/email/verify", handler.verifyEmail)
	router.Post("/email/resend", handler.resendEmailVerification)

	router.Get("/admin/users", handler.adminListUsers)
	router.Get("/admin/users/summary", handler.adminUsersSummary)
	router.Post("/admin/users", handler.adminUpsertUser)
	router.Patch("/admin/users/bulk-status", handler.adminBulkStatus)
	router.Patch("/admin/users/{id}", handler.adminUpdateUser)
	router.Delete("/admin/users/{id}", handler.adminDeleteUser)

	return router
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Name     string `json:"name"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.Register(r.Context(), payload.Name, payload.Email, payload.Password)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	h.writeAuthResult(w, http.StatusCreated, result)
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.Login(r.Context(), payload.Email, payload.Password)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	h.writeAuthResult(w, http.StatusOK, result)
}

func (h *Handler) loginNationalID(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		NationalID string `json:"nationalId"`
		Password   string `json:"password"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.LoginNationalID(r.Context(), payload.NationalID, payload.Password)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	h.writeAuthResult(w, http.StatusOK, result)
}

func (h *Handler) loginPhonePassword(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Phone    string `json:"phone"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.LoginPhonePassword(r.Context(), payload.Phone, payload.Password)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	h.writeAuthResult(w, http.StatusOK, result)
}

func (h *Handler) startWhatsAppOTP(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Phone string `json:"phone"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.StartWhatsAppOTP(r.Context(), payload.Phone)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"message":          "OTP sent to WhatsApp.",
		"expiresInSeconds": result.ExpiresInSeconds,
	})
}

func (h *Handler) verifyWhatsAppOTP(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Phone string `json:"phone"`
		Code  string `json:"code"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	result, err := h.service.VerifyWhatsAppOTP(r.Context(), payload.Phone, payload.Code)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	h.writeAuthResult(w, http.StatusOK, result)
}

func (h *Handler) googleStart(w http.ResponseWriter, r *http.Request) {
	if h.google == nil || !h.google.Available() {
		writeApplicationError(w, application.ErrProviderUnavailable)
		return
	}

	state, err := security.NewOpaqueToken(32)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Unable to start Google login"})
		return
	}
	returnTo := normalizeReturnTo(r.URL.Query().Get("returnTo"))

	h.setOAuthCookie(w, googleStateCookieName, state)
	h.setOAuthCookie(w, googleReturnCookieName, returnTo)
	http.Redirect(w, r, h.google.AuthorizationURL(state), http.StatusFound)
}

func (h *Handler) googleCallback(w http.ResponseWriter, r *http.Request) {
	if h.google == nil || !h.google.Available() {
		h.redirectOAuthError(w, r, "unavailable")
		return
	}

	code := strings.TrimSpace(r.URL.Query().Get("code"))
	state := strings.TrimSpace(r.URL.Query().Get("state"))
	if code == "" || state == "" || r.URL.Query().Get("error") != "" {
		h.clearOAuthCookies(w)
		h.redirectOAuthError(w, r, "provider")
		return
	}

	stateCookie, err := r.Cookie(googleStateCookieName)
	if err != nil || !constantTimeEqual(strings.TrimSpace(stateCookie.Value), state) {
		h.clearOAuthCookies(w)
		h.redirectOAuthError(w, r, "state")
		return
	}

	returnTo := "/"
	if returnCookie, err := r.Cookie(googleReturnCookieName); err == nil {
		returnTo = normalizeReturnTo(returnCookie.Value)
	}
	h.clearOAuthCookies(w)

	profile, err := h.google.Exchange(r.Context(), code)
	if err != nil {
		h.redirectOAuthError(w, r, "exchange")
		return
	}
	result, err := h.service.LoginGoogle(r.Context(), profile)
	if err != nil {
		h.redirectOAuthError(w, r, "account")
		return
	}

	h.setSessionCookie(w, result)
	target := h.webOrigin + "/login?oauth_provider=google&oauth_return=" + url.QueryEscape(returnTo)
	http.Redirect(w, r, target, http.StatusFound)
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"user": presentUser(auth.User)})
}

func (h *Handler) csrf(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	token, err := h.service.RotateCSRF(r.Context(), auth)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Unable to issue CSRF token"})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"csrfToken": token})
}

func (h *Handler) logout(w http.ResponseWriter, r *http.Request) {
	rawToken := sessionToken(r)
	if rawToken == "" {
		h.clearSessionCookie(w)
		w.WriteHeader(http.StatusNoContent)
		return
	}

	auth, err := h.service.Authenticate(r.Context(), rawToken)
	if errors.Is(err, application.ErrUnauthenticated) {
		h.clearSessionCookie(w)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if err != nil {
		writeApplicationError(w, err)
		return
	}

	if err := h.service.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
		writeApplicationError(w, err)
		return
	}
	if err := h.service.Logout(r.Context(), rawToken); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Unable to logout"})
		return
	}

	h.clearSessionCookie(w)
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) forgotPassword(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Email string `json:"email"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	_ = h.service.ForgotPassword(r.Context(), payload.Email)
	writeJSON(w, http.StatusOK, map[string]string{
		"message": "If this email exists, password reset instructions will be sent.",
	})
}

func (h *Handler) resetPassword(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Token    string `json:"token"`
		Password string `json:"password"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	if err := h.service.ResetPassword(r.Context(), payload.Token, payload.Password); err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Password has been reset."})
}

func (h *Handler) verifyEmail(w http.ResponseWriter, r *http.Request) {
	var payload struct {
		Token string `json:"token"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}

	user, err := h.service.VerifyEmail(r.Context(), payload.Token)
	if err != nil {
		writeApplicationError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"user":    presentUser(user),
		"message": "Email has been verified.",
	})
}

func (h *Handler) resendEmailVerification(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r)
	if !ok {
		return
	}
	if err := h.service.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
		writeApplicationError(w, err)
		return
	}
	if err := h.service.ResendEmailVerification(r.Context(), auth); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Unable to resend verification right now",
		})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Verification email has been queued.",
	})
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request) (application.Authenticated, bool) {
	auth, err := h.service.Authenticate(r.Context(), sessionToken(r))
	if err != nil {
		writeApplicationError(w, err)
		return application.Authenticated{}, false
	}
	return auth, true
}

func (h *Handler) writeAuthResult(w http.ResponseWriter, status int, result application.AuthResult) {
	h.setSessionCookie(w, result)
	writeJSON(w, status, map[string]any{
		"user":      presentUser(result.User),
		"csrfToken": result.CSRFToken,
	})
}

func (h *Handler) setSessionCookie(w http.ResponseWriter, result application.AuthResult) {
	maxAge := int(time.Until(result.ExpiresAt).Seconds())
	if maxAge < 1 {
		maxAge = 1
	}
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    result.SessionToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   h.production,
		SameSite: sameSite(h.production),
		Expires:  result.ExpiresAt,
		MaxAge:   maxAge,
	})
}

func (h *Handler) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     sessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   h.production,
		SameSite: sameSite(h.production),
		MaxAge:   -1,
		Expires:  time.Unix(1, 0),
	})
}

func (h *Handler) setOAuthCookie(w http.ResponseWriter, name, value string) {
	http.SetCookie(w, &http.Cookie{
		Name:     name,
		Value:    value,
		Path:     "/api/v1/auth/google",
		HttpOnly: true,
		Secure:   h.production,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   int(googleStateTTL.Seconds()),
		Expires:  time.Now().Add(googleStateTTL),
	})
}

func (h *Handler) clearOAuthCookies(w http.ResponseWriter) {
	for _, name := range []string{googleStateCookieName, googleReturnCookieName} {
		http.SetCookie(w, &http.Cookie{
			Name:     name,
			Value:    "",
			Path:     "/api/v1/auth/google",
			HttpOnly: true,
			Secure:   h.production,
			SameSite: http.SameSiteLaxMode,
			MaxAge:   -1,
			Expires:  time.Unix(1, 0),
		})
	}
}

func (h *Handler) redirectOAuthError(w http.ResponseWriter, r *http.Request, step string) {
	target := h.webOrigin + "/login?oauth_error=google&step=" + url.QueryEscape(step)
	http.Redirect(w, r, target, http.StatusFound)
}

func presentUser(user domain.User) userResponse {
	role := domain.RoleStudent
	if len(user.Roles) > 0 {
		role = user.Roles[0]
	}
	return userResponse{
		ID:            user.ID,
		Email:         user.Email,
		Name:          user.Name,
		Status:        user.Status,
		AvatarURL:     user.AvatarURL,
		NationalID:    user.NationalID,
		Phone:         user.Phone,
		EmailVerified: user.EmailVerified,
		Role:          role,
		Roles:         user.Roles,
	}
}

func sessionToken(r *http.Request) string {
	cookie, err := r.Cookie(sessionCookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie.Value)
}

func sameSite(production bool) http.SameSite {
	if production {
		return http.SameSiteNoneMode
	}
	return http.SameSiteLaxMode
}

func normalizeReturnTo(value string) string {
	candidate := strings.TrimSpace(value)
	if candidate == "" {
		return "/"
	}
	if !strings.HasPrefix(candidate, "/") ||
		strings.HasPrefix(candidate, "//") ||
		strings.Contains(candidate, "\\") ||
		strings.ContainsAny(candidate, "\r\n") {
		return "/"
	}
	return candidate
}

func constantTimeEqual(left, right string) bool {
	if len(left) != len(right) {
		return false
	}
	return subtle.ConstantTimeCompare([]byte(left), []byte(right)) == 1
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

func writeApplicationError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, application.ErrInvalidCredentials):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid credentials"})
	case errors.Is(err, application.ErrAccountDisabled):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Account is disabled"})
	case errors.Is(err, application.ErrLoginLocked):
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"message": "Too many login attempts. Try again later."})
	case errors.Is(err, application.ErrEmailExists):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Email already exists"})
	case errors.Is(err, application.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
	case errors.Is(err, application.ErrUnauthenticated):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
	case errors.Is(err, application.ErrCSRF):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
	case errors.Is(err, application.ErrInvalidToken):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid or expired token"})
	case errors.Is(err, application.ErrPasswordUnavailable):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "لا توجد كلمة مرور مضبوطة لهذا الحساب — استخدم رمز واتساب بدلاً"})
	case errors.Is(err, application.ErrProviderUnavailable):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication provider is not configured"})
	case errors.Is(err, application.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, application.ErrOrganizationScopePending):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Organization-scoped user directory is not enabled yet"})
	case errors.Is(err, application.ErrUnsupportedAdminScope):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Organization scope fields are handled by the Organizations domain"})
	case errors.Is(err, domain.ErrLastAdmin):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Cannot remove or disable the last active admin account"})
	case errors.Is(err, domain.ErrSelfDelete):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "You cannot delete your current account"})
	case errors.Is(err, domain.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "User not found"})
	case errors.Is(err, application.ErrRateLimited), errors.Is(err, application.ErrTooManyAttempts):
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"message": "Too many attempts. Try again later."})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
