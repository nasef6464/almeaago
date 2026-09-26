package commercehttp

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func TestVerifyWebhookHMAC(t *testing.T) {
	secret := []byte("test-secret")
	body := []byte(`{"eventId":"evt-1"}`)
	mac := hmac.New(sha256.New, secret)
	_, _ = mac.Write(body)
	signature := "sha256=" + hex.EncodeToString(mac.Sum(nil))
	if !verifyWebhookHMAC(secret, body, signature) {
		t.Fatal("expected valid webhook signature")
	}
	if verifyWebhookHMAC(secret, []byte("tampered"), signature) {
		t.Fatal("tampered payload must fail")
	}
	if verifyWebhookHMAC(nil, body, signature) {
		t.Fatal("missing secret must fail closed")
	}
}
