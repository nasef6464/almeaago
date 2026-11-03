package contenthttp

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func TestPublicContactWidgetEndpoint(t *testing.T) {
	contactService := contentapp.NewContactWidgetService(nil)
	handler := NewManagementWithPresentation(nil, nil, nil, nil, contactService)

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodGet, "/public-contact-widget", nil)

	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d: %s", rec.Code, rec.Body.String())
	}

	if cacheControl := rec.Header().Get("Cache-Control"); cacheControl != "public, max-age=60" {
		t.Errorf("expected Cache-Control 'public, max-age=60', got %q", cacheControl)
	}

	var resp content.PublicContactWidgetSettings
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
		t.Fatalf("failed to parse response JSON: %v", err)
	}

	if !resp.Enabled {
		t.Errorf("expected enabled=true, got %v", resp.Enabled)
	}
	if resp.Channel != "whatsapp" {
		t.Errorf("expected channel='whatsapp', got %s", resp.Channel)
	}
	if resp.WhatsAppNumber != "+966500000000" {
		t.Errorf("expected whatsappNumber='+966500000000', got %s", resp.WhatsAppNumber)
	}
	if !resp.OpenInNewTab {
		t.Errorf("expected openInNewTab=true")
	}
	if !resp.ShowOnPublicPages {
		t.Errorf("expected showOnPublicPages=true")
	}
	if !resp.ShowOnDashboardPages {
		t.Errorf("expected showOnDashboardPages=true")
	}
}
