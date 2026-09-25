package organizationshttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
)

func TestContractMutationRequiresCSRF(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo)
	handler := New(service, authStub{
		auth:    adminAuth(),
		csrfErr: identityapp.ErrCSRF,
	})

	request := httptest.NewRequest(
		http.MethodPut,
		"/school-1/contract",
		strings.NewReader(`{"status":"active","modules":["SCHOOL_CORE"]}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestMissingLegacyContractReturnsNull(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo)
	handler := NewLegacy(service, authStub{auth: adminAuth()})

	request := httptest.NewRequest(
		http.MethodGet,
		"/contracts/school-1",
		nil,
	)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	if !strings.Contains(response.Body.String(), `"contract":null`) {
		t.Fatalf("expected null contract, got %s", response.Body.String())
	}
}

func TestMissingContractDeniesEntitlement(t *testing.T) {
	repo := &repoStub{}
	service := orgapp.NewService(repo)
	handler := NewLegacy(service, authStub{auth: schoolAdminAuth()})

	request := httptest.NewRequest(
		http.MethodGet,
		"/entitlements/school-1/SCHOOL_CORE",
		nil,
	)
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	if !strings.Contains(body, `"allowed":false`) ||
		!strings.Contains(body, `"contract":null`) {
		t.Fatalf("unexpected entitlement response %s", body)
	}
}
