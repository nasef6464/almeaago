package httpserver

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestSecurityHeadersAreAppliedToEveryResponse(t *testing.T) {
	handler := securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, httptest.NewRequest(http.MethodGet, "/health/live", nil))

	expected := map[string]string{
		"X-Content-Type-Options":       "nosniff",
		"X-Frame-Options":              "DENY",
		"Referrer-Policy":              "no-referrer",
		"Cross-Origin-Resource-Policy": "same-origin",
		"Content-Security-Policy":      "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
	}
	for header, want := range expected {
		if got := recorder.Header().Get(header); got != want {
			t.Fatalf("%s = %q, want %q", header, got, want)
		}
	}
	if got := recorder.Header().Get("Strict-Transport-Security"); got != "" {
		t.Fatalf("HSTS must not be set on plain HTTP, got %q", got)
	}
}

func TestSecurityHeadersSetHSTSBehindTLSProxy(t *testing.T) {
	handler := securityHeaders(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {}))
	request := httptest.NewRequest(http.MethodGet, "/health/live", nil)
	request.Header.Set("X-Forwarded-Proto", "https")

	recorder := httptest.NewRecorder()
	handler.ServeHTTP(recorder, request)

	if got := recorder.Header().Get("Strict-Transport-Security"); got == "" {
		t.Fatal("HSTS must be set for HTTPS requests")
	}
}

func TestCORSOnlyReflectsConfiguredOrigins(t *testing.T) {
	next := http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})
	handler := corsAllowList("https://almeaa.example, https://staging.almeaa.example/")(next)

	allowed := httptest.NewRequest(http.MethodGet, "/api/v1/courses", nil)
	allowed.Header.Set("Origin", "https://almeaa.example")
	allowedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(allowedRecorder, allowed)

	if got := allowedRecorder.Header().Get("Access-Control-Allow-Origin"); got != "https://almeaa.example" {
		t.Fatalf("allowed origin not reflected, got %q", got)
	}
	if got := allowedRecorder.Header().Get("Access-Control-Allow-Credentials"); got != "true" {
		t.Fatalf("credentials header missing, got %q", got)
	}

	blocked := httptest.NewRequest(http.MethodGet, "/api/v1/courses", nil)
	blocked.Header.Set("Origin", "https://evil.example")
	blockedRecorder := httptest.NewRecorder()
	handler.ServeHTTP(blockedRecorder, blocked)

	if got := blockedRecorder.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Fatalf("unexpected CORS grant for foreign origin: %q", got)
	}

	preflight := httptest.NewRequest(http.MethodOptions, "/api/v1/courses", nil)
	preflight.Header.Set("Origin", "https://evil.example")
	preflightRecorder := httptest.NewRecorder()
	handler.ServeHTTP(preflightRecorder, preflight)
	if preflightRecorder.Code != http.StatusForbidden {
		t.Fatalf("foreign preflight status = %d, want 403", preflightRecorder.Code)
	}

	allowedPreflight := httptest.NewRequest(http.MethodOptions, "/api/v1/courses", nil)
	allowedPreflight.Header.Set("Origin", "https://staging.almeaa.example")
	allowedPreflightRecorder := httptest.NewRecorder()
	handler.ServeHTTP(allowedPreflightRecorder, allowedPreflight)
	if allowedPreflightRecorder.Code != http.StatusNoContent {
		t.Fatalf("allowed preflight status = %d, want 204", allowedPreflightRecorder.Code)
	}
}
