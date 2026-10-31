// Package cloudinary implements direct signed browser uploads and authenticated
// metadata verification without routing image/audio bytes through the Go API.
package cloudinary

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strconv"
	"strings"
	"time"

	media "github.com/nasef6464/almeaago/internal/media/domain"
)

type Config struct {
	CloudName  string
	APIKey     string
	APISecret  string
	HTTPClient *http.Client
	Clock      func() time.Time
}

type Client struct {
	cloudName string
	apiKey    string
	apiSecret string
	http      *http.Client
	clock     func() time.Time
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
	return &Client{cloudName: strings.TrimSpace(cfg.CloudName), apiKey: strings.TrimSpace(cfg.APIKey), apiSecret: cfg.APISecret, http: client, clock: clock}
}

func (c *Client) Available() bool {
	if c == nil || c.cloudName == "" || c.apiKey == "" || c.apiSecret == "" {
		return false
	}
	return simpleName(c.cloudName)
}

// PresignPut retains the shared provider method name, but Cloudinary uploads
// use signed multipart POST (not PUT) directly from the browser.
func (c *Client) PresignPut(objectKey, mimeType, sha256sum string, expires time.Duration) (media.UploadTarget, error) {
	if !c.Available() {
		return media.UploadTarget{}, media.ErrUnavailable
	}
	if expires < time.Minute || expires > time.Hour {
		return media.UploadTarget{}, fmt.Errorf("invalid media upload expiry")
	}
	typ, publicID, expectedMime, embeddedHash, ok := parseKey(objectKey)
	if !ok || mimeType != expectedMime || sha256sum != embeddedHash {
		return media.UploadTarget{}, fmt.Errorf("invalid media object key or MIME")
	}
	stamp := strconv.FormatInt(c.clock().UTC().Unix(), 10)
	fields := map[string]string{
		"allowed_formats": strings.TrimPrefix(path.Ext(objectKey), "."),
		"api_key":         c.apiKey,
		"context":         "sha256=" + sha256sum,
		"overwrite":       "false",
		"public_id":       publicID,
		"timestamp":       stamp,
		"unique_filename": "false",
	}
	// Cloudinary expects alphabetical parameter sorting and the API secret
	// appended to the plaintext. Neither the secret nor this input is returned.
	params := "allowed_formats=" + fields["allowed_formats"] + "&context=" + fields["context"] + "&overwrite=false&public_id=" + publicID + "&timestamp=" + stamp + "&unique_filename=false"
	sig := sha1.Sum([]byte(params + c.apiSecret))
	fields["signature"] = hex.EncodeToString(sig[:])
	return media.UploadTarget{
		URL:        "https://api.cloudinary.com/v1_1/" + c.cloudName + "/" + typ + "/upload",
		Method:     http.MethodPost,
		FormFields: fields,
		ExpiresAt:  c.clock().UTC().Add(expires),
	}, nil
}

func (c *Client) Head(ctx context.Context, objectKey string) (media.ObjectInfo, error) {
	if !c.Available() {
		return media.ObjectInfo{}, media.ErrUnavailable
	}
	typ, publicID, expectedMime, _, ok := parseKey(objectKey)
	if !ok {
		return media.ObjectInfo{}, fmt.Errorf("invalid media object key")
	}
	endpoint := "https://api.cloudinary.com/v1_1/" + c.cloudName + "/resources/" + typ + "/upload/" + escapePath(publicID) + "?context=true"
	if typ == "video" {
		endpoint += "&media_metadata=true"
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return media.ObjectInfo{}, err
	}
	req.SetBasicAuth(c.apiKey, c.apiSecret)
	resp, err := c.http.Do(req)
	if err != nil {
		return media.ObjectInfo{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusNotFound {
		return media.ObjectInfo{Exists: false}, nil
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return media.ObjectInfo{}, fmt.Errorf("%w: Cloudinary resource status %d", media.ErrUnavailable, resp.StatusCode)
	}
	var resource struct {
		Bytes        int64  `json:"bytes"`
		Format       string `json:"format"`
		ResourceType string `json:"resource_type"`
		AudioCodec   string `json:"audio_codec"`
		VideoCodec   string `json:"video_codec"`
		Width        int    `json:"width"`
		Height       int    `json:"height"`
		Context      struct {
			Custom map[string]string `json:"custom"`
		} `json:"context"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1024*1024)).Decode(&resource); err != nil {
		return media.ObjectInfo{}, fmt.Errorf("%w: invalid Cloudinary metadata: %v", media.ErrUnavailable, err)
	}
	if resource.Bytes <= 0 || resource.ResourceType != typ || resource.Format != strings.TrimPrefix(path.Ext(objectKey), ".") {
		return media.ObjectInfo{}, fmt.Errorf("%w: invalid Cloudinary size or format", media.ErrUnavailable)
	}
	// Cloudinary classifies both audio and video as resource_type=video.
	// Explanation audio must contain an audio stream and no video stream;
	// extension and resource type alone cannot establish that distinction.
	if typ == "video" && (strings.TrimSpace(resource.AudioCodec) == "" || strings.TrimSpace(resource.VideoCodec) != "" || resource.Width > 0 || resource.Height > 0) {
		return media.ObjectInfo{}, fmt.Errorf("%w: explanation audio contains no audio track or includes video", media.ErrUnavailable)
	}
	sha := strings.ToLower(strings.TrimSpace(resource.Context.Custom["sha256"]))
	if !validSHA(sha) {
		return media.ObjectInfo{}, fmt.Errorf("%w: missing signed Cloudinary SHA256 context", media.ErrUnavailable)
	}
	return media.ObjectInfo{Exists: true, SizeBytes: resource.Bytes, MimeType: expectedMime, SHA256: sha}, nil
}

func (c *Client) PublicURL(objectKey string) string {
	if !c.Available() {
		return ""
	}
	typ, _, _, _, ok := parseKey(objectKey)
	if !ok {
		return ""
	}
	return "https://res.cloudinary.com/" + c.cloudName + "/" + typ + "/upload/" + escapePath(objectKey)
}

func parseKey(key string) (typ, publicID, mime, sha string, ok bool) {
	parts := strings.Split(key, "/")
	var code, base string
	switch {
	case len(parts) == 4 && parts[0] == "questions" && parts[1] == "v2":
		typ, code, base = "image", parts[2], parts[3]
	case len(parts) == 5 && parts[0] == "questions" && parts[1] == "audio" && parts[2] == "v1":
		typ, code, base = "video", parts[3], parts[4]
	default:
		return "", "", "", "", false
	}
	if !simpleName(code) || code == "." || code == ".." {
		return "", "", "", "", false
	}
	ext := strings.TrimPrefix(path.Ext(base), ".")
	sha = strings.TrimSuffix(base, "."+ext)
	if !validSHA(sha) {
		return "", "", "", "", false
	}
	formats := map[string]string{
		"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp",
		"mp3": "audio/mpeg", "m4a": "audio/mp4", "webm": "audio/webm", "ogg": "audio/ogg",
	}
	mime = formats[ext]
	if mime == "" || (typ == "image" && !strings.HasPrefix(mime, "image/")) || (typ == "video" && !strings.HasPrefix(mime, "audio/")) {
		return "", "", "", "", false
	}
	publicID = strings.TrimSuffix(key, "."+ext)
	return typ, publicID, mime, sha, true
}

func validSHA(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, b := range value {
		if (b < '0' || b > '9') && (b < 'a' || b > 'f') {
			return false
		}
	}
	return true
}

func simpleName(value string) bool {
	if value == "" {
		return false
	}
	for _, ch := range value {
		if !(ch >= 'a' && ch <= 'z') && !(ch >= 'A' && ch <= 'Z') && !(ch >= '0' && ch <= '9') && ch != '_' && ch != '-' && ch != '.' {
			return false
		}
	}
	return true
}

func escapePath(value string) string {
	parts := strings.Split(value, "/")
	for index := range parts {
		parts[index] = url.PathEscape(parts[index])
	}
	return strings.Join(parts, "/")
}
