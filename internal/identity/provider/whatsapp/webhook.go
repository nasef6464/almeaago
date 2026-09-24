package whatsapp

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"
)

type Webhook struct {
	endpoint string
	token    string
	http     *http.Client
}

func NewWebhook(endpoint, token string) *Webhook {
	return &Webhook{
		endpoint: strings.TrimSpace(endpoint),
		token:    strings.TrimSpace(token),
		http:     &http.Client{Timeout: 8 * time.Second},
	}
}

func (w *Webhook) Available() bool {
	return w.endpoint != "" && w.token != ""
}

func (w *Webhook) SendOTP(ctx context.Context, phone, code string, ttl time.Duration) error {
	if !w.Available() {
		return fmt.Errorf("whatsapp webhook is not configured")
	}

	payload := struct {
		Phone            string `json:"phone"`
		Code             string `json:"code"`
		ExpiresInSeconds int    `json:"expiresInSeconds"`
	}{
		Phone:            phone,
		Code:             code,
		ExpiresInSeconds: int(ttl.Seconds()),
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, w.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+w.token)

	response, err := w.http.Do(request)
	if err != nil {
		return fmt.Errorf("whatsapp webhook request: %w", err)
	}
	defer response.Body.Close()

	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("whatsapp webhook returned %d", response.StatusCode)
	}
	return nil
}
