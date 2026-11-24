package identityhttp

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type stubGoogleOAuth struct {
	available bool
}

func (s stubGoogleOAuth) Available() bool { return s.available }
func (s stubGoogleOAuth) AuthorizationURL(state string) string {
	return "https://accounts.google.com/o/oauth2/v2/auth?state=" + state
}
func (s stubGoogleOAuth) Exchange(context.Context, string) (domain.GoogleProfile, error) {
	return domain.GoogleProfile{}, nil
}

func TestNormalizeReturnToAllowsInternalPath(t *testing.T) {
	if got := normalizeReturnTo("/dashboard?tab=skills"); got != "/dashboard?tab=skills" {
		t.Fatalf("unexpected normalized path %q", got)
	}
}

func TestNormalizeReturnToRejectsExternalOrMalformedPaths(t *testing.T) {
	cases := []string{
		"https://evil.example",
		"//evil.example/path",
		"/\\evil",
		"/ok\r\nLocation:https://evil.example",
	}

	for _, value := range cases {
		if got := normalizeReturnTo(value); got != "/" {
			t.Fatalf("normalizeReturnTo(%q) = %q, want /", value, got)
		}
	}
}

func TestConstantTimeEqualRequiresExactState(t *testing.T) {
	if !constantTimeEqual("same-state", "same-state") {
		t.Fatal("expected identical OAuth state to match")
	}
	if constantTimeEqual("same-state", "other-state") {
		t.Fatal("different OAuth state must not match")
	}
}

func TestParseAllowedWebOriginsFiltersInvalidAndPreservesOrder(t *testing.T) {
	got := parseAllowedWebOrigins(" https://almeaa.com/ , *, javascript:alert(1), https://user@evil.example, https://www.almeaa.com/path?x=1 , https://almeaa.com ")
	if len(got) != 2 || got[0] != "https://almeaa.com" || got[1] != "https://www.almeaa.com" {
		t.Fatalf("unexpected parsed origins: %#v", got)
	}
}

func TestMultiOriginWebOriginOAuthRedirectsUseSingleAllowlistedOrigin(t *testing.T) {
	h := New(nil, true, Options{
		Google:    stubGoogleOAuth{available: true},
		WebOrigin: "https://almeaa.com, https://www.almeaa.com",
	})

	// 1. Start from the second allowed origin -> captures origin cookie
	startReq := httptest.NewRequest(http.MethodGet, "/google/start?returnTo=/dashboard", nil)
	startReq.Header.Set("Referer", "https://www.almeaa.com/login")
	startRec := httptest.NewRecorder()
	h.ServeHTTP(startRec, startReq)
	if startRec.Code != http.StatusFound {
		t.Fatalf("google/start status = %d, want 302", startRec.Code)
	}
	var originCookie *http.Cookie
	for _, c := range startRec.Result().Cookies() {
		if c.Name == googleOriginCookieName {
			originCookie = c
			break
		}
	}
	if originCookie == nil || originCookie.Value != "https://www.almeaa.com" {
		t.Fatalf("expected %s=https://www.almeaa.com, got %+v", googleOriginCookieName, originCookie)
	}

	// 2. Callback error redirects to the captured second origin (never comma-joined)
	cbReq := httptest.NewRequest(http.MethodGet, "/google/callback?error=access_denied", nil)
	cbReq.AddCookie(originCookie)
	cbRec := httptest.NewRecorder()
	h.ServeHTTP(cbRec, cbReq)
	if cbRec.Code != http.StatusFound {
		t.Fatalf("google/callback status = %d, want 302", cbRec.Code)
	}
	loc := cbRec.Header().Get("Location")
	if loc != "https://www.almeaa.com/login?oauth_error=google&step=provider" {
		t.Fatalf("unexpected redirect location: %q", loc)
	}

	// 3. Forged origin cookie outside allowlist falls back to primary single origin
	forgedReq := httptest.NewRequest(http.MethodGet, "/google/callback?error=access_denied", nil)
	forgedReq.AddCookie(&http.Cookie{Name: googleOriginCookieName, Value: "https://evil.example"})
	forgedRec := httptest.NewRecorder()
	h.ServeHTTP(forgedRec, forgedReq)
	forgedLoc := forgedRec.Header().Get("Location")
	if strings.Contains(forgedLoc, ",") || forgedLoc != "https://almeaa.com/login?oauth_error=google&step=provider" {
		t.Fatalf("forged origin must fall back to primary single origin, got %q", forgedLoc)
	}
}
