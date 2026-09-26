package tap

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

var ErrProvider = errors.New("tap provider error")

type Config struct {
	SecretKey       string
	WebhookURL      string
	RedirectBaseURL string
	Endpoint        string
	Client          *http.Client
}

type Client struct {
	secretKey       string
	webhookURL      string
	redirectBaseURL string
	endpoint        string
	http            *http.Client
}

func New(cfg Config) *Client {
	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		endpoint = "https://api.tap.company/v2/charges/"
	}
	client := cfg.Client
	if client == nil {
		client = &http.Client{Timeout: 12 * time.Second}
	}
	return &Client{
		secretKey:       strings.TrimSpace(cfg.SecretKey),
		webhookURL:      strings.TrimSpace(cfg.WebhookURL),
		redirectBaseURL: strings.TrimSpace(cfg.RedirectBaseURL),
		endpoint:        endpoint,
		http:            client,
	}
}

func supportedCurrency(currency string) bool {
	switch strings.ToUpper(strings.TrimSpace(currency)) {
	case "SAR", "EGP":
		return true
	default:
		return false
	}
}

func amountNumber(minor int64) (json.Number, error) {
	if minor < 1 {
		return "", ErrProvider
	}
	return json.Number(fmt.Sprintf("%d.%02d", minor/100, minor%100)), nil
}

func (c *Client) redirectURL(in commerce.ProviderSessionInit) (string, error) {
	base, err := url.Parse(c.redirectBaseURL)
	if err != nil || base.Scheme == "" || base.Host == "" {
		return "", ErrProvider
	}
	if base.Scheme != "https" && base.Hostname() != "localhost" && base.Hostname() != "127.0.0.1" {
		return "", ErrProvider
	}
	q := base.Query()
	q.Set("productId", in.ProductID)
	q.Set("requestId", in.PaymentRequestID)
	q.Set("paymentReturn", "1")
	base.RawQuery = q.Encode()
	return base.String(), nil
}

func splitName(name string) (string, string) {
	fields := strings.Fields(strings.TrimSpace(name))
	if len(fields) == 0 {
		return "ALMEAA", "Customer"
	}
	if len(fields) == 1 {
		return fields[0], "Customer"
	}
	return fields[0], strings.Join(fields[1:], " ")
}

func (c *Client) Initiate(ctx context.Context, in commerce.ProviderSessionInit) (commerce.ProviderSession, error) {
	if c.secretKey == "" || c.webhookURL == "" || c.redirectBaseURL == "" || !supportedCurrency(in.Currency) {
		return commerce.ProviderSession{}, ErrProvider
	}
	amount, err := amountNumber(in.AmountMinor)
	if err != nil {
		return commerce.ProviderSession{}, err
	}
	redirectURL, err := c.redirectURL(in)
	if err != nil {
		return commerce.ProviderSession{}, err
	}
	firstName, lastName := splitName(in.UserName)

	payload := map[string]any{
		"amount":             amount,
		"currency":           strings.ToUpper(in.Currency),
		"customer_initiated": true,
		"threeDSecure":       true,
		"save_card":          false,
		"description":        "ALMEAA " + strings.TrimSpace(in.ProductName),
		"metadata": map[string]string{
			"payment_request_id": in.PaymentRequestID,
			"user_id":            in.UserID,
		},
		"reference": map[string]string{
			"transaction": in.PaymentRequestID,
			"order":       in.PaymentRequestID,
			"idempotent":  in.PaymentRequestID,
		},
		"customer": map[string]any{
			"first_name": firstName,
			"last_name":  lastName,
			"email":      strings.TrimSpace(in.UserEmail),
		},
		"source":   map[string]string{"id": "src_all"},
		"post":     map[string]string{"url": c.webhookURL},
		"redirect": map[string]string{"url": redirectURL},
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return commerce.ProviderSession{}, ErrProvider
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.endpoint, bytes.NewReader(raw))
	if err != nil {
		return commerce.ProviderSession{}, ErrProvider
	}
	req.Header.Set("Authorization", "Bearer "+c.secretKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("lang_code", "ar")

	resp, err := c.http.Do(req)
	if err != nil {
		return commerce.ProviderSession{}, ErrProvider
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if err != nil || resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return commerce.ProviderSession{}, ErrProvider
	}
	var out struct {
		ID          string `json:"id"`
		Status      string `json:"status"`
		Transaction struct {
			URL string `json:"url"`
		} `json:"transaction"`
		Redirect struct {
			URL string `json:"url"`
		} `json:"redirect"`
	}
	if err = json.Unmarshal(body, &out); err != nil {
		return commerce.ProviderSession{}, ErrProvider
	}
	sessionID := strings.TrimSpace(out.ID)
	paymentURL := strings.TrimSpace(out.Transaction.URL)
	if paymentURL == "" {
		paymentURL = strings.TrimSpace(out.Redirect.URL)
	}
	u, parseErr := url.Parse(paymentURL)
	if sessionID == "" || paymentURL == "" || parseErr != nil || u.Scheme != "https" || u.Host == "" {
		return commerce.ProviderSession{}, ErrProvider
	}
	if strings.ToUpper(strings.TrimSpace(out.Status)) != "INITIATED" {
		return commerce.ProviderSession{}, ErrProvider
	}
	return commerce.ProviderSession{SessionID: sessionID, RedirectURL: paymentURL, Status: "initiated"}, nil
}

type webhookPayload struct {
	ID        string      `json:"id"`
	Object    string      `json:"object"`
	Status    string      `json:"status"`
	Amount    json.Number `json:"amount"`
	Currency  string      `json:"currency"`
	Reference struct {
		Gateway     string `json:"gateway"`
		Payment     string `json:"payment"`
		Transaction string `json:"transaction"`
		Order       string `json:"order"`
	} `json:"reference"`
	Transaction struct {
		Created json.RawMessage `json:"created"`
	} `json:"transaction"`
}

func createdString(raw json.RawMessage) string {
	var s string
	if json.Unmarshal(raw, &s) == nil {
		return strings.TrimSpace(s)
	}
	var n json.Number
	if json.Unmarshal(raw, &n) == nil {
		return n.String()
	}
	return ""
}

func normalizeAmountForHash(amount json.Number, currency string) (string, int64, error) {
	if !supportedCurrency(currency) {
		return "", 0, ErrProvider
	}
	f, err := strconv.ParseFloat(amount.String(), 64)
	if err != nil || f < 0 {
		return "", 0, ErrProvider
	}
	formatted := fmt.Sprintf("%.2f", f)
	parts := strings.SplitN(formatted, ".", 2)
	whole, err := strconv.ParseInt(parts[0], 10, 64)
	if err != nil {
		return "", 0, ErrProvider
	}
	fraction, err := strconv.ParseInt(parts[1], 10, 64)
	if err != nil {
		return "", 0, ErrProvider
	}
	return formatted, whole*100 + fraction, nil
}

func VerifyWebhook(secretKey string, raw []byte, postedHash string) (commerce.ProviderEvent, error) {
	secretKey = strings.TrimSpace(secretKey)
	postedHash = strings.TrimSpace(postedHash)
	if secretKey == "" || len(postedHash) != sha256.Size*2 {
		return commerce.ProviderEvent{}, ErrProvider
	}
	var payload webhookPayload
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.UseNumber()
	if err := dec.Decode(&payload); err != nil {
		return commerce.ProviderEvent{}, ErrProvider
	}
	payload.ID = strings.TrimSpace(payload.ID)
	payload.Object = strings.ToLower(strings.TrimSpace(payload.Object))
	payload.Status = strings.ToUpper(strings.TrimSpace(payload.Status))
	payload.Currency = strings.ToUpper(strings.TrimSpace(payload.Currency))
	requestID := strings.TrimSpace(payload.Reference.Order)
	if requestID == "" {
		requestID = strings.TrimSpace(payload.Reference.Transaction)
	}
	created := createdString(payload.Transaction.Created)
	amountString, amountMinor, err := normalizeAmountForHash(payload.Amount, payload.Currency)
	if err != nil || payload.ID == "" || payload.Object != "charge" || requestID == "" || created == "" {
		return commerce.ProviderEvent{}, ErrProvider
	}
	toHash := "x_id" + payload.ID +
		"x_amount" + amountString +
		"x_currency" + payload.Currency +
		"x_gateway_reference" + strings.TrimSpace(payload.Reference.Gateway) +
		"x_payment_reference" + strings.TrimSpace(payload.Reference.Payment) +
		"x_status" + payload.Status +
		"x_created" + created
	mac := hmac.New(sha256.New, []byte(secretKey))
	_, _ = mac.Write([]byte(toHash))
	expected := hex.EncodeToString(mac.Sum(nil))
	if !hmac.Equal([]byte(strings.ToLower(postedHash)), []byte(expected)) {
		return commerce.ProviderEvent{}, ErrProvider
	}
	var status commerce.ProviderEventStatus
	switch payload.Status {
	case "CAPTURED":
		status = commerce.ProviderPaid
	case "CANCELLED":
		status = commerce.ProviderCancelled
	case "FAILED", "DECLINED", "RESTRICTED", "VOID", "TIMEDOUT", "UNKNOWN", "ABANDONED":
		status = commerce.ProviderFailed
	default:
		return commerce.ProviderEvent{}, ErrProvider
	}
	sum := sha256.Sum256(raw)
	return commerce.ProviderEvent{
		EventID:          payload.ID,
		PaymentRequestID: requestID,
		Status:           status,
		AmountMinor:      &amountMinor,
		Currency:         payload.Currency,
		TransactionID:    payload.ID,
		PayloadSHA256:    hex.EncodeToString(sum[:]),
	}, nil
}
