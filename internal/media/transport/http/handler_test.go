package mediahttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	mediaapp "github.com/nasef6464/almeaago/internal/media/application"
	media "github.com/nasef6464/almeaago/internal/media/domain"
)

type authStub struct {
	auth    identityapp.Authenticated
	authErr error
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return a.auth, a.authErr
}

func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error {
	return a.csrfErr
}

type repoStub struct {
	asset media.Asset
}

func (r *repoStub) FindLiveBySHA(context.Context, string) (media.Asset, error) {
	return media.Asset{}, media.ErrNotFound
}

func (r *repoStub) Reserve(_ context.Context, actor string, request media.ReserveRequest) (media.Asset, error) {
	r.asset = media.Asset{
		ID: "asset-1", ObjectKey: request.ObjectKey, PublicURL: request.PublicURL,
		MimeType: request.MimeType, SizeBytes: request.SizeBytes, SHA256: request.SHA256,
		Status: media.StatusPendingUpload, CreatedBy: actor,
	}
	return r.asset, nil
}

func (r *repoStub) RefreshPending(context.Context, string, string, time.Time) (media.Asset, error) {
	return r.asset, nil
}

func (r *repoStub) Get(context.Context, string) (media.Asset, error) {
	if r.asset.ID == "" {
		return media.Asset{}, media.ErrNotFound
	}
	return r.asset, nil
}

func (r *repoStub) Activate(context.Context, string, string, media.ObjectInfo) (media.Asset, error) {
	r.asset.Status = media.StatusActive
	return r.asset, nil
}

type providerStub struct{}

func (providerStub) Available() bool { return true }

func (providerStub) PresignPut(key, mimeType, sha256 string, expires time.Duration) (media.UploadTarget, error) {
	return media.UploadTarget{
		URL:       "https://upload.example/" + key,
		Headers:   map[string]string{"Content-Type": mimeType, "x-amz-meta-sha256": sha256},
		ExpiresAt: time.Now().Add(expires),
	}, nil
}

func (providerStub) Head(context.Context, string) (media.ObjectInfo, error) {
	return media.ObjectInfo{}, nil
}

func (providerStub) PublicURL(key string) string { return "https://cdn.example/" + key }

func adminAuth() identityapp.Authenticated {
	return identityapp.Authenticated{User: identity.User{
		ID: "11111111-1111-7111-8111-111111111111",
		Roles: []identity.Role{identity.RoleAdmin},
	}}
}

func TestPresignRequiresCSRF(t *testing.T) {
	service := mediaapp.NewService(&repoStub{}, providerStub{}, 1024*1024, 15*time.Minute)
	handler := New(service, authStub{auth: adminAuth(), csrfErr: errors.New("bad csrf")})
	body := `{"kind":"question_image","questionCode":"Q-1","sha256":"` + strings.Repeat("a", 64) + `","mimeType":"image/webp","sizeBytes":100}`
	request := httptest.NewRequest(http.MethodPost, "/uploads/presign", strings.NewReader(body))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestPresignReturnsDirectUploadMetadataOnly(t *testing.T) {
	service := mediaapp.NewService(&repoStub{}, providerStub{}, 1024*1024, 15*time.Minute)
	handler := New(service, authStub{auth: adminAuth()})
	body := `{"kind":"question_image","questionCode":"Q-1","sha256":"` + strings.Repeat("b", 64) + `","mimeType":"image/webp","sizeBytes":100}`
	request := httptest.NewRequest(http.MethodPost, "/uploads/presign", strings.NewReader(body))
	response := httptest.NewRecorder()

	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	got := response.Body.String()
	for _, fragment := range []string{`"uploadRequired":true`, `"mimeType":"image/webp"`, `"sizeBytes":100`, `"url":"https://upload.example/questions/v2/Q-1/`} {
		if !strings.Contains(got, fragment) {
			t.Fatalf("missing %s in %s", fragment, got)
		}
	}
	if strings.Contains(got, "R2_SECRET_ACCESS_KEY") || strings.Contains(got, "objectKey") {
		t.Fatalf("internal provider data leaked: %s", got)
	}
}
