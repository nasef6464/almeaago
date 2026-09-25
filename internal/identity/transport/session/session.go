package session

import (
	"net/http"
	"strings"
)

const CookieName = "almeaa_access_token"

func Token(r *http.Request) string {
	cookie, err := r.Cookie(CookieName)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(cookie.Value)
}
