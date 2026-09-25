package r2

import (
	"context"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) {
	return f(r)
}

func fixedClock() time.Time {
	return time.Date(2026, 9, 25, 10, 0, 0, 0, time.UTC)
}

func TestPresignPutProducesScopedR2URL(t *testing.T) {
	hash := strings.Repeat("a", 64)
	client := New(Config{
		AccountID:       "account123",
		Bucket:          "almeaa-media",
		PublicBaseURL:   "https://cdn.example",
		AccessKeyID:     "k",
		SecretAccessKey: "s",
		Clock:           fixedClock,
	})

	target, err := client.PresignPut("questions/v2/Q-1/"+hash+".webp", "image/webp", hash, 15*time.Minute)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	parsed, err := url.Parse(target.URL)
	if err != nil {
		t.Fatalf("parse presigned URL: %v", err)
	}
	if parsed.Host != "account123.r2.cloudflarestorage.com" {
		t.Fatalf("unexpected host %q", parsed.Host)
	}
	if parsed.Path != "/almeaa-media/questions/v2/Q-1/"+hash+".webp" {
		t.Fatalf("unexpected path %q", parsed.Path)
	}
	query := parsed.Query()
	if query.Get("X-Amz-Algorithm") != algorithm || query.Get("X-Amz-Signature") == "" {
		t.Fatalf("missing signature query: %s", parsed.RawQuery)
	}
	if query.Get("X-Amz-Expires") != "900" {
		t.Fatalf("unexpected expiry %q", query.Get("X-Amz-Expires"))
	}
	if !strings.Contains(query.Get("X-Amz-Credential"), "/20260925/auto/s3/aws4_request") {
		t.Fatalf("unexpected credential scope %q", query.Get("X-Amz-Credential"))
	}
	if target.Headers["Content-Type"] != "image/webp" ||
		target.Headers["x-amz-meta-sha256"] != hash ||
		target.Headers["Cache-Control"] != cacheControl {
		t.Fatalf("unexpected signed headers: %#v", target.Headers)
	}
	if !target.ExpiresAt.Equal(fixedClock().Add(15 * time.Minute)) {
		t.Fatalf("unexpected expiresAt %v", target.ExpiresAt)
	}
}

func TestHeadVerifiesStoredObjectMetadata(t *testing.T) {
	hash := strings.Repeat("b", 64)
	transport := roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.Method != http.MethodHead {
			t.Fatalf("expected HEAD, got %s", req.Method)
		}
		if req.Header.Get("X-Amz-Content-Sha256") != emptyPayloadSHA || req.Header.Get("X-Amz-Date") != "20260925T100000Z" {
			t.Fatalf("missing signed request headers: %#v", req.Header)
		}
		return &http.Response{
			StatusCode: http.StatusOK,
			Header: http.Header{
				"Content-Length":    []string{"3456"},
				"Content-Type":      []string{"image/webp"},
				"X-Amz-Meta-Sha256": []string{hash},
			},
			Body: http.NoBody,
		}, nil
	})
	client := New(Config{
		AccountID:       "account123",
		Bucket:          "almeaa-media",
		PublicBaseURL:   "https://cdn.example",
		AccessKeyID:     "k",
		SecretAccessKey: "s",
		Clock:           fixedClock,
		HTTPClient:      &http.Client{Transport: transport},
	})

	info, err := client.Head(context.Background(), "questions/v2/Q-1/"+hash+".webp")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !info.Exists || info.SizeBytes != 3456 || info.MimeType != "image/webp" || info.SHA256 != hash {
		t.Fatalf("unexpected object info: %#v", info)
	}
}

func TestPublicURLUsesEscapedImmutableKey(t *testing.T) {
	client := New(Config{PublicBaseURL: "https://cdn.example/"})
	got := client.PublicURL("questions/v2/Q 1/a.webp")
	if got != "https://cdn.example/questions/v2/Q%201/a.webp" {
		t.Fatalf("unexpected public URL %q", got)
	}
}
