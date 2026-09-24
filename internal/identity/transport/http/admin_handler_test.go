package identityhttp

import (
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

func TestAdminScopeFieldsProvided(t *testing.T) {
	school := "school-1"
	if !adminScopeFieldsProvided(&school, nil, nil, nil, nil) {
		t.Fatal("school scope must be detected")
	}
	if !adminScopeFieldsProvided(nil, []string{"class-1"}, nil, nil, nil) {
		t.Fatal("group/class scope must be detected")
	}
	if adminScopeFieldsProvided(nil, nil, nil, nil, nil) {
		t.Fatal("empty scope must not be detected")
	}
}
