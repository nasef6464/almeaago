package google

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAuthorizationURLContainsState(t *testing.T) {
	client := New(Config{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURI:  "https://example.test/callback",
	})
	got := client.AuthorizationURL("state-value")
	if !strings.Contains(got, "state=state-value") {
		t.Fatalf("authorization url missing state: %s", got)
	}
	if !strings.Contains(got, "scope=openid+email+profile") {
		t.Fatalf("authorization url missing scope: %s", got)
	}
}

func TestExchangeUsesVerifiedGoogleProfile(t *testing.T) {
	mux := http.NewServeMux()
	server := httptest.NewServer(mux)
	defer server.Close()

	mux.HandleFunc("/token", func(w http.ResponseWriter, r *http.Request) {
		if err := r.ParseForm(); err != nil {
			t.Fatal(err)
		}
		if r.Form.Get("code") != "oauth-code" {
			t.Fatalf("unexpected code %q", r.Form.Get("code"))
		}
		_ = json.NewEncoder(w).Encode(map[string]string{"access_token": "access-token"})
	})
	mux.HandleFunc("/userinfo", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer access-token" {
			t.Fatalf("unexpected authorization %q", r.Header.Get("Authorization"))
		}
		_ = json.NewEncoder(w).Encode(map[string]any{
			"sub":            "google-subject",
			"email":          "student@example.com",
			"name":           "Student",
			"picture":        "https://example.test/avatar.png",
			"email_verified": true,
		})
	})

	client := New(Config{
		ClientID:     "client-id",
		ClientSecret: "client-secret",
		RedirectURI:  "https://example.test/callback",
		TokenURL:     server.URL + "/token",
		UserInfoURL:  server.URL + "/userinfo",
	})

	profile, err := client.Exchange(context.Background(), "oauth-code")
	if err != nil {
		t.Fatal(err)
	}
	if profile.Subject != "google-subject" || !profile.EmailVerified {
		t.Fatalf("unexpected profile %#v", profile)
	}
}
