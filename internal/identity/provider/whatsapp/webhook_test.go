package whatsapp

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestWebhookDelivery(t *testing.T) {
	var got struct {
		Phone            string `json:"phone"`
		Code             string `json:"code"`
		ExpiresInSeconds int    `json:"expiresInSeconds"`
	}

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer secret-token" {
			t.Fatalf("unexpected authorization header")
		}
		if err := json.NewDecoder(r.Body).Decode(&got); err != nil {
			t.Fatal(err)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer server.Close()

	delivery := NewWebhook(server.URL, "secret-token")
	if err := delivery.SendOTP(context.Background(), "966501234567", "123456", 10*time.Minute); err != nil {
		t.Fatal(err)
	}
	if got.Phone != "966501234567" || got.Code != "123456" || got.ExpiresInSeconds != 600 {
		t.Fatalf("unexpected payload %#v", got)
	}
}
