package cloudinary

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"strings"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) { return f(req) }

func fixedClock() time.Time { return time.Date(2026, time.October, 31, 10, 0, 0, 0, time.UTC) }

func TestPresignPutReturnsBoundCloudinaryImagePOST(t *testing.T) {
	hash := strings.Repeat("a", 64)
	client := New(Config{CloudName: "staging", APIKey: "testkey", APISecret: "testsecret", Clock: fixedClock})
	target, err := client.PresignPut("questions/v2/Q-1/"+hash+".webp", "image/webp", hash, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	if target.Method != http.MethodPost || target.URL != "https://api.cloudinary.com/v1_1/staging/image/upload" {
		t.Fatalf("expected Cloudinary POST target, got %+v", target)
	}
	if target.FormFields["public_id"] != "questions/v2/Q-1/"+hash ||
		target.FormFields["context"] != "sha256="+hash ||
		target.FormFields["allowed_formats"] != "webp" ||
		target.FormFields["overwrite"] != "false" ||
		target.FormFields["unique_filename"] != "false" ||
		target.FormFields["api_key"] != "testkey" ||
		target.FormFields["timestamp"] != "1793440800" ||
		target.FormFields["signature"] != "85cb598a108c28f62df487c3eb06c3c980a6b23b" {
		t.Fatalf("incorrect signed fields: %#v", target.FormFields)
	}
	if !target.ExpiresAt.Equal(fixedClock().Add(15 * time.Minute)) {
		t.Fatalf("unexpected expiry: %v", target.ExpiresAt)
	}
	if len(target.Headers) > 0 {
		t.Fatalf("POST FormData must not receive a forced Content-Type header")
	}
}

func TestPresignPutSupportsAudioAndRejectsMismatches(t *testing.T) {
	hash := strings.Repeat("b", 64)
	client := New(Config{CloudName: "staging", APIKey: "testkey", APISecret: "testsecret", Clock: fixedClock})
	target, err := client.PresignPut("questions/audio/v1/Q-7/"+hash+".mp3", "audio/mpeg", hash, time.Minute)
	if err != nil || target.URL != "https://api.cloudinary.com/v1_1/staging/video/upload" {
		t.Fatalf("audio target: %+v, %v", target, err)
	}
	for _, tc := range []struct{ key, mime, sha string }{
		{"arbitrary/path/file.webp", "image/webp", hash},
		{"questions/v2/Q-1/" + hash + ".webp", "image/png", hash},
		{"questions/v2/Q-1/" + hash + ".webp", "image/webp", strings.Repeat("c", 64)},
		{"questions/v2/Q-1/../" + hash + ".webp", "image/webp", hash},
	} {
		if _, err := client.PresignPut(tc.key, tc.mime, tc.sha, time.Minute); err == nil {
			t.Errorf("unexpected signature for %+v", tc)
		}
	}
	if New(Config{CloudName: "staging", APIKey: "testkey"}).Available() {
		t.Fatal("provider must require API secret")
	}
}

func TestHeadReadsAuthenticatedCloudinaryMetadata(t *testing.T) {
	hash := strings.Repeat("d", 64)
	client := New(Config{
		CloudName: "staging", APIKey: "testkey", APISecret: "testsecret",
		HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
			parsed, err := url.Parse(req.URL.String())
			if err != nil {
				t.Fatal(err)
			}
			if parsed.Path != "/v1_1/staging/resources/image/upload/questions/v2/Q-1/"+hash || parsed.Query().Get("context") != "true" {
				t.Fatalf("unexpected resource query: %s", req.URL)
			}
			user, pass, ok := req.BasicAuth()
			if !ok || user != "testkey" || pass != "testsecret" {
				t.Fatal("missing Admin API authentication")
			}
			return &http.Response{StatusCode: http.StatusOK, Header: http.Header{"Content-Type": []string{"application/json"}}, Body: io.NopCloser(strings.NewReader(`{"bytes":1234,"format":"webp","resource_type":"image","context":{"custom":{"sha256":"` + hash + `"}}}`))}, nil
		})},
	})
	info, err := client.Head(context.Background(), "questions/v2/Q-1/"+hash+".webp")
	if err != nil || !info.Exists || info.SizeBytes != 1234 || info.MimeType != "image/webp" || info.SHA256 != hash {
		t.Fatalf("bad metadata: %+v, %v", info, err)
	}
	if want := "https://res.cloudinary.com/staging/image/upload/questions/v2/Q-1/" + hash + ".webp"; client.PublicURL("questions/v2/Q-1/"+hash+".webp") != want {
		t.Fatalf("wrong public URL")
	}
}

func TestHeadFailsClosedForMissingOrUntrustedMetadata(t *testing.T) {
	hash := strings.Repeat("e", 64)
	status := http.StatusNotFound
	body := `{}`
	client := New(Config{CloudName: "staging", APIKey: "testkey", APISecret: "testsecret", HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		return &http.Response{StatusCode: status, Header: http.Header{}, Body: io.NopCloser(strings.NewReader(body))}, nil
	})}})
	info, err := client.Head(context.Background(), "questions/v2/Q-1/"+hash+".png")
	if err != nil || info.Exists {
		t.Fatalf("missing asset must not activate: %+v, %v", info, err)
	}
	status, body = http.StatusOK, `{"bytes":1234,"format":"png","resource_type":"image","context":{"custom":{}}}`
	if _, err := client.Head(context.Background(), "questions/v2/Q-1/"+hash+".png"); err == nil {
		t.Fatal("missing signed hash must fail closed")
	}
	status = http.StatusForbidden
	if _, err := client.Head(context.Background(), "questions/v2/Q-1/"+hash+".png"); err == nil {
		t.Fatal("Admin API failure must be visible")
	}
}

func TestHeadRequiresAudioTrackAndNoVideoTrackForExplanationAudio(t *testing.T) {
	hash := strings.Repeat("f", 64)
	for _, tc := range []struct {
		name, details string
		valid         bool
	}{
		{"audio only", `"audio_codec":"opus","width":0,"height":0`, true},
		{"video only", `"video_codec":"vp9","width":1920,"height":1080`, false},
		{"video with audio", `"video_codec":"vp9","audio_codec":"opus","width":1920,"height":1080`, false},
		{"no audio codec", `"width":0,"height":0`, false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			client := New(Config{CloudName: "staging", APIKey: "testkey", APISecret: "testsecret", HTTPClient: &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
				if req.URL.Query().Get("media_metadata") != "true" {
					t.Fatalf("audio verification requires media metadata: %s", req.URL)
				}
				body := `{"bytes":123,"format":"webm","resource_type":"video","context":{"custom":{"sha256":"` + hash + `"}},` + tc.details + `}`
				return &http.Response{StatusCode: http.StatusOK, Body: io.NopCloser(strings.NewReader(body)), Header: http.Header{}}, nil
			})}})
			info, err := client.Head(context.Background(), "questions/audio/v1/Q-1/"+hash+".webm")
			if tc.valid && (err != nil || !info.Exists || info.MimeType != "audio/webm") {
				t.Fatalf("audio-only metadata must pass: %+v, %v", info, err)
			}
			if !tc.valid && err == nil {
				t.Fatalf("non-audio-only resource must fail: %+v", info)
			}
		})
	}
}
