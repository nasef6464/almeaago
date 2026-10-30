package contenthttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// Admin content writes must consume exactly one JSON document. A successful
// first decode cannot authorize a write while trailing bytes remain unread.
func TestAdminContentDecodeJSONRequiresSingleDocument(t *testing.T) {
	tests := []struct {
		name string
		body string
		wantOK bool
	}{
		{name: "single document", body: `{"title":"درس"}`, wantOK: true},
		{name: "single document with whitespace", body: "  \n" + `{"title":"درس"}` + "\n\t", wantOK: true},
		{name: "two objects", body: `{"title":"درس"} {"title":"آخر"}`, wantOK: false},
		{name: "trailing null", body: `{"title":"درس"} null`, wantOK: false},
		{name: "trailing array", body: `{"title":"درس"} []`, wantOK: false},
		{name: "trailing scalar", body: `{"title":"درس"} 123`, wantOK: false},
		{name: "trailing garbage", body: `{"title":"درس"} !`, wantOK: false},
		{name: "unknown field", body: `{"title":"درس","unexpected":true}`, wantOK: false},
		{name: "invalid first document", body: `{"title":`, wantOK: false},
		{name: "empty body", body: "", wantOK: false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/api/v1/lessons", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			var dst struct { Title string `json:"title"` }
			got := decodeJSON(rec, req, &dst)
			if got != tc.wantOK {
				t.Fatalf("decodeJSON(%q): got ok=%v HTTP=%d body=%q; want ok=%v", tc.body, got, rec.Code, rec.Body.String(), tc.wantOK)
			}
			if !tc.wantOK && rec.Code != http.StatusBadRequest {
				t.Fatalf("invalid payload must return HTTP 400, got %d", rec.Code)
			}
			if tc.wantOK && dst.Title != "درس" {
				t.Fatalf("valid Arabic content changed: %q", dst.Title)
			}
		})
	}
}
