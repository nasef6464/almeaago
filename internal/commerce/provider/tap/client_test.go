package tap

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func TestInitiateBuildsTrustedTapCharge(t *testing.T) {
	var got map[string]any
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer sk_test_demo" {
			t.Fatalf("missing bearer auth: %q", r.Header.Get("Authorization"))
		}
		body, _ := io.ReadAll(r.Body)
		if err := json.Unmarshal(body, &got); err != nil {
			t.Fatal(err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"id":"chg_test_1","status":"INITIATED","transaction":{"url":"https://tap.example/pay/1"}}`))
	}))
	defer server.Close()

	client := New(Config{
		SecretKey:       "sk_test_demo",
		WebhookURL:      "https://api.example.com/api/v1/commerce/webhooks/tap",
		RedirectBaseURL: "https://app.example.com/checkout",
		Endpoint:        server.URL,
		Client:          server.Client(),
	})
	out, err := client.Initiate(context.Background(), commerce.ProviderSessionInit{
		PaymentRequestID: "11111111-1111-1111-1111-111111111111",
		ProductID:        "22222222-2222-2222-2222-222222222222",
		UserID:           "33333333-3333-3333-3333-333333333333",
		UserName:         "طالب تجريبي",
		UserEmail:        "student@example.com",
		ProductName:      "دورة مدفوعة",
		AmountMinor:      10800,
		Currency:         "SAR",
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.SessionID != "chg_test_1" || out.RedirectURL != "https://tap.example/pay/1" {
		t.Fatalf("unexpected session: %#v", out)
	}
	if got["amount"].(float64) != 108 || got["currency"] != "SAR" {
		t.Fatalf("trusted amount/currency mismatch: %#v", got)
	}
	ref := got["reference"].(map[string]any)
	if ref["order"] != "11111111-1111-1111-1111-111111111111" || ref["idempotent"] != ref["order"] {
		t.Fatalf("request correlation/idempotency missing: %#v", ref)
	}
	source := got["source"].(map[string]any)
	if source["id"] != "src_all" {
		t.Fatalf("unexpected source: %#v", source)
	}
	redirect := got["redirect"].(map[string]any)["url"].(string)
	if !strings.Contains(redirect, "productId=22222222-2222-2222-2222-222222222222") ||
		!strings.Contains(redirect, "requestId=11111111-1111-1111-1111-111111111111") {
		t.Fatalf("redirect correlation missing: %s", redirect)
	}
}

func TestVerifyWebhookMapsCapturedWithOfficialHashstringShape(t *testing.T) {
	raw := []byte(`{"id":"chg_1","object":"charge","status":"CAPTURED","amount":108.00,"currency":"SAR","reference":{"gateway":"gw_1","payment":"pay_1","transaction":"11111111-1111-1111-1111-111111111111","order":"11111111-1111-1111-1111-111111111111"},"transaction":{"created":"1700000000000"}}`)
	toHash := "x_idchg_1x_amount108.00x_currencySARx_gateway_referencegw_1x_payment_referencepay_1x_statusCAPTUREDx_created1700000000000"
	mac := hmac.New(sha256.New, []byte("sk_test_demo"))
	_, _ = mac.Write([]byte(toHash))
	hash := hex.EncodeToString(mac.Sum(nil))

	event, err := VerifyWebhook("sk_test_demo", raw, hash)
	if err != nil {
		t.Fatal(err)
	}
	if event.PaymentRequestID != "11111111-1111-1111-1111-111111111111" ||
		event.Status != commerce.ProviderPaid || event.AmountMinor == nil || *event.AmountMinor != 10800 ||
		event.Currency != "SAR" || event.TransactionID != "chg_1" {
		t.Fatalf("unexpected event: %#v", event)
	}
	if _, err = VerifyWebhook("sk_test_demo", raw, strings.Repeat("0", 64)); err == nil {
		t.Fatal("expected invalid hashstring to fail closed")
	}
}
