package taxonomyhttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestTaxonomyMutationJSONSingleDocument prevents the admin mutation transport
// from silently applying the first document when a client sends two JSON values.
// It exercises the same decoder used by path/level/subject/skill mutations.
func TestTaxonomyMutationJSONSingleDocument(t *testing.T) {
	cases := []struct {
		name string
		body string
		ok   bool
	}{
		{name: "single object", body: `{"name":"مسار"}`, ok: true},
		{name: "single object with whitespace", body: "  {\"name\":\"مسار\"} \n\t ", ok: true},
		{name: "two objects", body: `{"name":"مسار"} {"name":"آخر"}`, ok: false},
		{name: "second null", body: `{"name":"مسار"} null`, ok: false},
		{name: "trailing malformed JSON", body: `{"name":"مسار"} {`, ok: false},
		{name: "unknown field", body: `{"name":"مسار","unexpected":1}`, ok: false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/admin/paths", strings.NewReader(tc.body))
			rec := httptest.NewRecorder()
			var payload struct {
				Name string `json:"name"`
			}
			ok := decodeJSON(rec, req, &payload)
			if ok != tc.ok {
				t.Fatalf("decodeJSON()=%v, want %v; status=%d", ok, tc.ok, rec.Code)
			}
			if !tc.ok && rec.Code != http.StatusBadRequest {
				t.Fatalf("rejected JSON status=%d, want 400", rec.Code)
			}
			if tc.ok && payload.Name != "مسار" {
				t.Fatalf("decoded name=%q, want original name", payload.Name)
			}
		})
	}
}
