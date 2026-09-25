package identityhttp

import (
	"encoding/json"
	"net/http/httptest"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/application"
)

func TestParseAdminUserQueryDefaults(t *testing.T) {
	request := httptest.NewRequest("GET", "/api/v1/auth/admin/users", nil)
	query, err := parseAdminUserQuery(request)
	if err != nil {
		t.Fatal(err)
	}
	if query.Page != 1 || query.Limit != 50 || query.Search != "" {
		t.Fatalf("unexpected defaults %#v", query)
	}
}

func TestParseAdminUserQueryRejectsLimitAbove100(t *testing.T) {
	request := httptest.NewRequest(
		"GET",
		"/api/v1/auth/admin/users?limit=101",
		nil,
	)
	_, err := parseAdminUserQuery(request)
	if err != application.ErrInvalidInput {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestOptionalAdminStringDistinguishesNullAndValue(t *testing.T) {
	var nullValue optionalAdminString
	if err := json.Unmarshal([]byte("null"), &nullValue); err != nil {
		t.Fatal(err)
	}
	if !nullValue.Present || nullValue.Value != "" {
		t.Fatalf("unexpected null parse %#v", nullValue)
	}

	var value optionalAdminString
	if err := json.Unmarshal([]byte(`"school-1"`), &value); err != nil {
		t.Fatal(err)
	}
	if !value.Present || value.Value != "school-1" {
		t.Fatalf("unexpected value parse %#v", value)
	}
}
