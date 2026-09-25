package r2

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	media "github.com/nasef6464/almeaago/internal/media/domain"
)

const (
	region          = "auto"
	service         = "s3"
	algorithm       = "AWS4-HMAC-SHA256"
	unsignedPayload = "UNSIGNED-PAYLOAD"
	emptyPayloadSHA = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
	cacheControl    = "public, max-age=31536000, immutable"
)

type Config struct {
	AccountID       string
	Bucket          string
	PublicBaseURL   string
	AccessKeyID     string
	SecretAccessKey string
	HTTPClient      *http.Client
	Clock           func() time.Time
}

type Client struct {
	accountID       string
	bucket          string
	publicBaseURL   string
	accessKeyID     string
	secretAccessKey string
	httpClient      *http.Client
	clock           func() time.Time
}

func New(cfg Config) *Client {
	client := cfg.HTTPClient
	if client == nil {
		client = &http.Client{Timeout: 10 * time.Second}
	}
	clock := cfg.Clock
	if clock == nil {
		clock = time.Now
	}
	return &Client{
		accountID:       strings.TrimSpace(cfg.AccountID),
		bucket:          strings.TrimSpace(cfg.Bucket),
		publicBaseURL:   strings.TrimRight(strings.TrimSpace(cfg.PublicBaseURL), "/"),
		accessKeyID:     strings.TrimSpace(cfg.AccessKeyID),
		secretAccessKey: cfg.SecretAccessKey,
		httpClient:      client,
		clock:           clock,
	}
}

func (c *Client) Available() bool {
	return c != nil && c.accountID != "" && c.bucket != "" && c.publicBaseURL != "" && c.accessKeyID != "" && c.secretAccessKey != ""
}

func (c *Client) PresignPut(objectKey, mimeType, sha256sum string, expires time.Duration) (media.UploadTarget, error) {
	if !c.Available() {
		return media.UploadTarget{}, media.ErrUnavailable
	}
	if expires < time.Minute || expires > time.Hour {
		return media.UploadTarget{}, fmt.Errorf("invalid presign expiry")
	}

	now := c.clock().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	scope := credentialScope(dateStamp)
	signedHeaders := "cache-control;content-type;host;x-amz-meta-sha256"
	canonicalHeaders := strings.Join([]string{
		"cache-control:" + canonicalHeaderValue(cacheControl),
		"content-type:" + canonicalHeaderValue(mimeType),
		"host:" + c.host(),
		"x-amz-meta-sha256:" + canonicalHeaderValue(sha256sum),
	}, "\n")

	query := url.Values{}
	query.Set("X-Amz-Algorithm", algorithm)
	query.Set("X-Amz-Credential", c.accessKeyID+"/"+scope)
	query.Set("X-Amz-Date", amzDate)
	query.Set("X-Amz-Expires", strconv.FormatInt(int64(expires/time.Second), 10))
	query.Set("X-Amz-SignedHeaders", signedHeaders)

	uri := c.canonicalURI(objectKey)
	canonicalRequest := strings.Join([]string{
		http.MethodPut,
		uri,
		query.Encode(),
		canonicalHeaders,
		signedHeaders,
		unsignedPayload,
	}, "\n")
	stringToSign := strings.Join([]string{
		algorithm,
		amzDate,
		scope,
		sha256Hex(canonicalRequest),
	}, "\n")
	query.Set("X-Amz-Signature", c.signature(dateStamp, stringToSign))

	return media.UploadTarget{
		URL: c.endpoint() + uri + "?" + query.Encode(),
		Headers: map[string]string{
			"Content-Type":      mimeType,
			"Cache-Control":     cacheControl,
			"x-amz-meta-sha256": sha256sum,
		},
		ExpiresAt: now.Add(expires),
	}, nil
}

func (c *Client) Head(ctx context.Context, objectKey string) (media.ObjectInfo, error) {
	if !c.Available() {
		return media.ObjectInfo{}, media.ErrUnavailable
	}
	now := c.clock().UTC()
	amzDate := now.Format("20060102T150405Z")
	dateStamp := now.Format("20060102")
	scope := credentialScope(dateStamp)
	signedHeaders := "host;x-amz-content-sha256;x-amz-date"
	canonicalHeaders := strings.Join([]string{
		"host:" + c.host(),
		"x-amz-content-sha256:" + emptyPayloadSHA,
		"x-amz-date:" + amzDate,
	}, "\n")
	uri := c.canonicalURI(objectKey)
	canonicalRequest := strings.Join([]string{
		http.MethodHead,
		uri,
		"",
		canonicalHeaders,
		signedHeaders,
		emptyPayloadSHA,
	}, "\n")
	stringToSign := strings.Join([]string{
		algorithm,
		amzDate,
		scope,
		sha256Hex(canonicalRequest),
	}, "\n")
	signature := c.signature(dateStamp, stringToSign)
	authorization := algorithm + " Credential=" + c.accessKeyID + "/" + scope +
		", SignedHeaders=" + signedHeaders + ", Signature=" + signature

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, c.endpoint()+uri, nil)
	if err != nil {
		return media.ObjectInfo{}, err
	}
	req.Header.Set("X-Amz-Date", amzDate)
	req.Header.Set("X-Amz-Content-Sha256", emptyPayloadSHA)
	req.Header.Set("Authorization", authorization)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return media.ObjectInfo{}, err
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return media.ObjectInfo{Exists: false}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return media.ObjectInfo{}, fmt.Errorf("%w: r2 head status %d", media.ErrUnavailable, resp.StatusCode)
	}
	size, err := strconv.ParseInt(resp.Header.Get("Content-Length"), 10, 64)
	if err != nil || size < 0 {
		return media.ObjectInfo{}, fmt.Errorf("%w: invalid r2 content length", media.ErrUnavailable)
	}
	return media.ObjectInfo{
		Exists:    true,
		SizeBytes: size,
		MimeType:  canonicalMime(resp.Header.Get("Content-Type")),
		SHA256:    strings.ToLower(strings.TrimSpace(resp.Header.Get("X-Amz-Meta-Sha256"))),
	}, nil
}

func (c *Client) PublicURL(objectKey string) string {
	if c == nil || c.publicBaseURL == "" {
		return ""
	}
	return c.publicBaseURL + "/" + escapeKey(objectKey)
}

func (c *Client) endpoint() string {
	return "https://" + c.host()
}

func (c *Client) host() string {
	return c.accountID + ".r2.cloudflarestorage.com"
}

func (c *Client) canonicalURI(objectKey string) string {
	return "/" + url.PathEscape(c.bucket) + "/" + escapeKey(objectKey)
}

func escapeKey(objectKey string) string {
	parts := strings.Split(strings.TrimLeft(objectKey, "/"), "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}

func credentialScope(dateStamp string) string {
	return dateStamp + "/" + region + "/" + service + "/aws4_request"
}

func (c *Client) signature(dateStamp, stringToSign string) string {
	keyDate := hmacSHA256([]byte("AWS4"+c.secretAccessKey), dateStamp)
	keyRegion := hmacSHA256(keyDate, region)
	keyService := hmacSHA256(keyRegion, service)
	keySigning := hmacSHA256(keyService, "aws4_request")
	return hex.EncodeToString(hmacSHA256(keySigning, stringToSign))
}

func hmacSHA256(key []byte, value string) []byte {
	mac := hmac.New(sha256.New, key)
	_, _ = mac.Write([]byte(value))
	return mac.Sum(nil)
}

func sha256Hex(value string) string {
	sum := sha256.Sum256([]byte(value))
	return hex.EncodeToString(sum[:])
}

func canonicalHeaderValue(value string) string {
	return strings.Join(strings.Fields(strings.TrimSpace(value)), " ")
}

func canonicalMime(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if index := strings.IndexByte(value, ';'); index >= 0 {
		value = strings.TrimSpace(value[:index])
	}
	return value
}
