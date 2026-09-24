package identityhttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/nasef6464/almeaago/internal/identity/application"
	"github.com/nasef6464/almeaago/internal/identity/domain"
)

const sessionCookieName = "almeaa_access_token"

type Handler struct {
	service    *application.Service
	production bool
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

func New(service *application.Service, production bool) http.Handler {
	handler := &Handler{service: service, production: production}
	router := chi.NewRouter()

	router.Post("/register", handler.register)
	router.Post("/login", handler.login)
	router.Post("/login/national-id", handler.loginNationalID)
	router.Get("/me", handler.me)
	router.Get("/csrf", handler.csrf)
	router.Post("/logout", handler.logout)
	router.Post("/forgot-password", handler.forgotPassword)
	router.Post("/reset-password", handler.resetPassword)
	router.Post("/email/verify", handler.verifyEmail)
	router.Post("/email/resend", handler.resendEmailVerification)

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

	if err := h.service.ForgotPassword(r.Context(), payload.Email); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"message": "Unable to process password recovery right now",
		})
		return
	}

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

	writeJSON(w, http.StatusOK, map[string]string{
		"message": "Password has been reset.",
	})
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
	writeJSON(w, status, map[string]any{
		"user":      presentUser(result.User),
		"csrfToken": result.CSRFToken,
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
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Invalid email or password"})
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
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
