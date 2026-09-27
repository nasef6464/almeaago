package provider

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
)

func TestHTTPEmailProviderUsesConfiguredWebhookAndToken(t *testing.T) {
	var gotAuthorization string
	var gotRecipient string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAuthorization = r.Header.Get("Authorization")
		var payload map[string]any
		if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
			t.Fatal(err)
		}
		gotRecipient, _ = payload["recipientEmail"].(string)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"messageId":"provider-123"}`))
	}))
	defer server.Close()

	sender := New(Config{
		EmailProvider:     "http",
		EmailWebhookURL:   server.URL,
		EmailWebhookToken: "secret-token",
	})
	result, ok := sender.Send(context.Background(), communication.Delivery{
		ID: "delivery-1", Channel: communication.ChannelEmail,
		RecipientEmail: "student@example.com", Title: "تنبيه", Body: "رسالة",
	})
	if !ok {
		t.Fatalf("expected provider success %#v", result)
	}
	if result.Provider != "email_http" || result.ProviderMessageID != "provider-123" {
		t.Fatalf("unexpected provider result %#v", result)
	}
	if gotAuthorization != "Bearer secret-token" || gotRecipient != "student@example.com" {
		t.Fatalf("provider request mismatch auth=%q recipient=%q", gotAuthorization, gotRecipient)
	}
}

func TestMissingProviderDoesNotPretendDeliverySucceeded(t *testing.T) {
	sender := New(Config{})
	result, ok := sender.Send(context.Background(), communication.Delivery{
		ID: "delivery-1", Channel: communication.ChannelWhatsApp,
		RecipientPhone: "966500000001", Title: "تنبيه", Body: "رسالة",
	})
	if ok {
		t.Fatalf("unconfigured provider was marked successful: %#v", result)
	}
	if result.Provider != "none" || result.FailureReason != "whatsapp_provider_not_configured" {
		t.Fatalf("unexpected failure %#v", result)
	}
}

func TestMissingRecipientFailsBeforeProviderCall(t *testing.T) {
	sender := New(Config{EmailProvider: "console"})
	result, ok := sender.Send(context.Background(), communication.Delivery{
		ID: "delivery-1", Channel: communication.ChannelEmail, Title: "تنبيه", Body: "رسالة",
	})
	if ok || result.FailureReason != "missing_recipient_email" {
		t.Fatalf("missing recipient should fail closed %#v", result)
	}
}
