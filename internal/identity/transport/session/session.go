package session

import (
	"net/http"
	"strings"
)

const CookieName = "almeaa_access_token"

func Token(r *http.Request) string {
	if cookie, err := r.Cookie(CookieName); err == nil {
		if value := strings.TrimSpace(cookie.Value); value != "" {
			return value
		}
	}

	authorization := strings.TrimSpace(r.Header.Get("Authorization"))
	if authorization == "" {
		return ""
	}
	parts := strings.Fields(authorization)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}
