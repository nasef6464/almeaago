//go:build cloudinarylive

package cloudinary

import (
	"bytes"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"image"
	"image/color"
	"image/png"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"testing"
	"time"
)

// Opt-in staging-only canaries; temporary assets are deleted after verification.
// Run only with dedicated staging Cloudinary credentials, never in CI/prod.
func TestLiveSignedCloudinaryStagingCanary(t *testing.T) {
	img := image.NewRGBA(image.Rect(0, 0, 2, 2))
	img.Set(0, 0, color.RGBA{R: 200, G: 100, B: 50, A: 255})
	var encoded bytes.Buffer
	if err := png.Encode(&encoded, img); err != nil {
		t.Fatal(err)
	}
	verifyLiveCanary(t, encoded.Bytes(), "image/png", "png", "questions/v2")
}

func TestLiveSignedCloudinaryAudioCanary(t *testing.T) {
	if _, err := exec.LookPath("ffmpeg"); err != nil {
		t.Skip("ffmpeg unavailable for audio canary")
	}
	payload, err := exec.Command("ffmpeg", "-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=0.25", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "32k", "-f", "mp3", "pipe:1").Output()
	if err != nil {
		t.Fatal(err)
	}
	verifyLiveCanary(t, payload, "audio/mpeg", "mp3", "questions/audio/v1")
}

func verifyLiveCanary(t *testing.T, payload []byte, mime, ext, prefix string) {
	t.Helper()
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")
	if cloudName == "" || apiKey == "" || apiSecret == "" {
		t.Skip("Cloudinary canary credentials not configured")
	}
	client := New(Config{CloudName: cloudName, APIKey: apiKey, APISecret: apiSecret})
	sum := sha256.Sum256(payload)
	hash := hex.EncodeToString(sum[:])
	objectKey := prefix + "/CANARY-" + strconv.FormatInt(time.Now().Unix(), 10) + "/" + hash + "." + ext
	target, err := client.PresignPut(objectKey, mime, hash, 15*time.Minute)
	if err != nil {
		t.Fatal(err)
	}
	_, publicID, _, _, _ := parseKey(objectKey)
	// Cleanup is limited to this exact canary key; it cannot affect owner files.
	defer func() {
		form := url.Values{"public_id": {publicID}}
		req, err := http.NewRequest(http.MethodPost, target.URL[:strings.LastIndex(target.URL, "/")]+"/destroy", strings.NewReader(form.Encode()))
		if err != nil {
			t.Errorf("create canary cleanup request: %v", err)
			return
		}
		req.SetBasicAuth(apiKey, apiSecret)
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, err := (&http.Client{Timeout: 15 * time.Second}).Do(req)
		if err != nil {
			t.Errorf("canary cleanup failed: %v", err)
			return
		}
		defer resp.Body.Close()
		var result struct {
			Result string `json:"result"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Result != "ok" {
			t.Errorf("canary cleanup result=%q HTTP=%d err=%v", result.Result, resp.StatusCode, err)
		}
	}()
	var body bytes.Buffer
	writer := multipart.NewWriter(&body)
	for key, value := range target.FormFields {
		if err := writer.WriteField(key, value); err != nil {
			t.Fatal(err)
		}
	}
	part, err := writer.CreateFormFile("file", "canary."+ext)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := part.Write(payload); err != nil {
		t.Fatal(err)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	req, err := http.NewRequest(http.MethodPost, target.URL, &body)
	if err != nil {
		t.Fatal(err)
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())
	resp, err := (&http.Client{Timeout: 25 * time.Second}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	responseBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("Cloudinary signed POST failed HTTP %d: %s", resp.StatusCode, responseBody)
	}
	var info mediaInfo
	for attempts := 0; attempts < 3; attempts++ {
		resource, err := client.Head(context.Background(), objectKey)
		if err == nil && resource.Exists {
			info = mediaInfo{resource.SizeBytes, resource.MimeType, resource.SHA256}
			break
		}
		if attempts == 2 {
			t.Fatalf("Cloudinary Admin resource missing: %v %+v", err, resource)
		}
		time.Sleep(time.Second)
	}
	if info.SizeBytes != int64(len(payload)) || info.MimeType != mime || info.SHA256 != hash {
		t.Fatalf("Cloudinary metadata verification failed: uploadedBytes=%d info=%+v", len(payload), info)
	}
	t.Log("Cloudinary signed POST and Admin metadata verified for one tiny staging canary")
}

type mediaInfo struct {
	SizeBytes int64
	MimeType  string
	SHA256    string
}
