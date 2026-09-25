package session

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestTokenPrefersSessionCookie(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.AddCookie(&http.Cookie{Name: CookieName, Value: "cookie-token"})
	req.Header.Set("Authorization", "Bearer bearer-token")

	if got := Token(req); got != "cookie-token" {
		t.Fatalf("expected cookie token, got %q", got)
	}
}

func TestTokenFallsBackToBearer(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Bearer bearer-token")

	if got := Token(req); got != "bearer-token" {
		t.Fatalf("expected bearer token, got %q", got)
	}
}

func TestTokenRejectsUnsupportedAuthorizationScheme(t *testing.T) {
	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Authorization", "Basic bearer-token")

	if got := Token(req); got != "" {
		t.Fatalf("expected empty token, got %q", got)
	}
}
