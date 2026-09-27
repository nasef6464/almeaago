package provider

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
)

type Config struct {
	EmailProvider        string
	EmailFrom            string
	ResendAPIKey         string
	EmailWebhookURL      string
	EmailWebhookToken    string
	WhatsAppProvider     string
	WhatsAppAccessToken  string
	WhatsAppPhoneNumberID string
	WhatsAppWebhookURL   string
	WhatsAppWebhookToken string
}

type Sender struct {
	cfg    Config
	client *http.Client
}

func New(cfg Config) *Sender {
	return &Sender{
		cfg: cfg,
		client: &http.Client{Timeout: 15 * time.Second},
	}
}

type providerPayload struct {
	Channel        communication.Channel `json:"channel"`
	ID             string                `json:"id"`
	RecipientEmail string                `json:"recipientEmail,omitempty"`
	RecipientPhone string                `json:"recipientPhone,omitempty"`
	Subject        string                `json:"subject,omitempty"`
	Title          string                `json:"title"`
	Body           string                `json:"body"`
}

func (s *Sender) Send(
	ctx context.Context,
	delivery communication.Delivery,
) (communication.DeliveryAttemptResult, bool) {
	payload := providerPayload{
		Channel: delivery.Channel, ID: delivery.ID, RecipientEmail: delivery.RecipientEmail,
		RecipientPhone: delivery.RecipientPhone, Subject: delivery.Subject,
		Title: delivery.Title, Body: delivery.Body,
	}
	switch delivery.Channel {
	case communication.ChannelEmail:
		return s.sendEmail(ctx, payload)
	case communication.ChannelWhatsApp:
		return s.sendWhatsApp(ctx, payload)
	default:
		return communication.DeliveryAttemptResult{Provider: "internal"}, true
	}
}

func (s *Sender) sendEmail(
	ctx context.Context,
	payload providerPayload,
) (communication.DeliveryAttemptResult, bool) {
	if strings.TrimSpace(payload.RecipientEmail) == "" {
		return failure("none", "missing_recipient_email")
	}
	provider := strings.ToLower(strings.TrimSpace(s.cfg.EmailProvider))
	switch provider {
	case "console":
		slog.Info("notification_delivery", "provider", "console", "channel", "email", "id", payload.ID)
		return communication.DeliveryAttemptResult{Provider: "console", ProviderMessageID: "console:" + payload.ID}, true
	case "resend":
		if strings.TrimSpace(s.cfg.ResendAPIKey) == "" || strings.TrimSpace(s.cfg.EmailFrom) == "" {
			return failure("resend", "resend_not_configured")
		}
		body := map[string]any{
			"from": s.cfg.EmailFrom,
			"to": []string{payload.RecipientEmail},
			"subject": firstNonEmpty(payload.Subject, payload.Title),
			"text": payload.Body,
		}
		data, err := s.postJSON(ctx, "https://api.resend.com/emails", body, map[string]string{
			"Authorization": "Bearer " + s.cfg.ResendAPIKey,
		})
		if err != nil {
			return failure("resend", err.Error())
		}
		return communication.DeliveryAttemptResult{Provider: "resend", ProviderMessageID: responseMessageID(data)}, true
	case "http":
		if strings.TrimSpace(s.cfg.EmailWebhookURL) == "" {
			return failure("email_http", "email_webhook_not_configured")
		}
		headers := map[string]string{}
		if token := strings.TrimSpace(s.cfg.EmailWebhookToken); token != "" {
			headers["Authorization"] = "Bearer " + token
		}
		data, err := s.postJSON(ctx, s.cfg.EmailWebhookURL, payload, headers)
		if err != nil {
			return failure("email_http", err.Error())
		}
		return communication.DeliveryAttemptResult{Provider: "email_http", ProviderMessageID: responseMessageID(data)}, true
	default:
		if provider == "" {
			provider = "none"
		}
		return failure(provider, "email_provider_not_configured")
	}
}

func (s *Sender) sendWhatsApp(
	ctx context.Context,
	payload providerPayload,
) (communication.DeliveryAttemptResult, bool) {
	if strings.TrimSpace(payload.RecipientPhone) == "" {
		return failure("none", "missing_recipient_phone")
	}
	provider := strings.ToLower(strings.TrimSpace(s.cfg.WhatsAppProvider))
	switch provider {
	case "console":
		slog.Info("notification_delivery", "provider", "console", "channel", "whatsapp", "id", payload.ID)
		return communication.DeliveryAttemptResult{Provider: "console", ProviderMessageID: "console:" + payload.ID}, true
	case "whatsapp_cloud":
		if strings.TrimSpace(s.cfg.WhatsAppAccessToken) == "" || strings.TrimSpace(s.cfg.WhatsAppPhoneNumberID) == "" {
			return failure("whatsapp_cloud", "whatsapp_cloud_not_configured")
		}
		body := map[string]any{
			"messaging_product": "whatsapp",
			"to": payload.RecipientPhone,
			"type": "text",
			"text": map[string]any{"preview_url": false, "body": payload.Body},
		}
		url := "https://graph.facebook.com/v20.0/" + s.cfg.WhatsAppPhoneNumberID + "/messages"
		data, err := s.postJSON(ctx, url, body, map[string]string{
			"Authorization": "Bearer " + s.cfg.WhatsAppAccessToken,
		})
		if err != nil {
			return failure("whatsapp_cloud", err.Error())
		}
		messageID := responseMessageID(data)
		if record, ok := data.(map[string]any); ok {
			if messages, ok := record["messages"].([]any); ok && len(messages) > 0 {
				if first, ok := messages[0].(map[string]any); ok {
					if id, ok := first["id"].(string); ok {
						messageID = id
					}
				}
			}
		}
		return communication.DeliveryAttemptResult{Provider: "whatsapp_cloud", ProviderMessageID: messageID}, true
	case "http":
		if strings.TrimSpace(s.cfg.WhatsAppWebhookURL) == "" {
			return failure("whatsapp_http", "whatsapp_webhook_not_configured")
		}
		headers := map[string]string{}
		if token := strings.TrimSpace(s.cfg.WhatsAppWebhookToken); token != "" {
			headers["Authorization"] = "Bearer " + token
		}
		data, err := s.postJSON(ctx, s.cfg.WhatsAppWebhookURL, payload, headers)
		if err != nil {
			return failure("whatsapp_http", err.Error())
		}
		return communication.DeliveryAttemptResult{Provider: "whatsapp_http", ProviderMessageID: responseMessageID(data)}, true
	default:
		if provider == "" {
			provider = "none"
		}
		return failure(provider, "whatsapp_provider_not_configured")
	}
}

func failure(provider, reason string) (communication.DeliveryAttemptResult, bool) {
	reason = strings.TrimSpace(reason)
	if len(reason) > 500 {
		reason = reason[:500]
	}
	return communication.DeliveryAttemptResult{Provider: provider, FailureReason: reason}, false
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return value
		}
	}
	return ""
}

func (s *Sender) postJSON(
	ctx context.Context,
	url string,
	body any,
	headers map[string]string,
) (any, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodPost, url, bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	request.Header.Set("Content-Type", "application/json")
	for key, value := range headers {
		request.Header.Set(key, value)
	}
	response, err := s.client.Do(request)
	if err != nil {
		return nil, fmt.Errorf("provider_request_failed:%w", err)
	}
	defer response.Body.Close()

	responseRaw, err := io.ReadAll(io.LimitReader(response.Body, 64<<10))
	if err != nil {
		return nil, err
	}
	var data any
	if len(responseRaw) > 0 {
		if err = json.Unmarshal(responseRaw, &data); err != nil {
			data = map[string]any{"raw": string(responseRaw)}
		}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return nil, fmt.Errorf("provider_http_%d:%s", response.StatusCode, string(responseRaw))
	}
	return data, nil
}

func responseMessageID(data any) string {
	record, ok := data.(map[string]any)
	if !ok {
		return ""
	}
	for _, key := range []string{"id", "messageId", "message_id", "sid"} {
		if value, ok := record[key].(string); ok {
			return value
		}
	}
	return ""
}
