package application

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	media "github.com/nasef6464/almeaago/internal/media/domain"
)

type repoStub struct {
	live       media.Asset
	liveErr    error
	reserved   media.ReserveRequest
	asset      media.Asset
	activated  bool
}

func (r *repoStub) FindLiveBySHA(context.Context, string) (media.Asset, error) {
	if r.liveErr != nil {
		return media.Asset{}, r.liveErr
	}
	if r.live.ID == "" {
		return media.Asset{}, media.ErrNotFound
	}
	return r.live, nil
}

func (r *repoStub) Reserve(_ context.Context, actor string, request media.ReserveRequest) (media.Asset, error) {
	r.reserved = request
	r.asset = media.Asset{
		ID:              "asset-1",
		ObjectKey:       request.ObjectKey,
		PublicURL:       request.PublicURL,
		MimeType:        request.MimeType,
		SizeBytes:       request.SizeBytes,
		SHA256:          request.SHA256,
		Status:          media.StatusPendingUpload,
		CreatedBy:       actor,
		UploadExpiresAt: &request.UploadExpiresAt,
	}
	return r.asset, nil
}

func (r *repoStub) RefreshPending(_ context.Context, _ string, _ string, expires time.Time) (media.Asset, error) {
	row := r.live
	row.UploadExpiresAt = &expires
	return row, nil
}

func (r *repoStub) Get(context.Context, string) (media.Asset, error) {
	if r.asset.ID != "" {
		return r.asset, nil
	}
	return r.live, nil
}

func (r *repoStub) Activate(_ context.Context, _ string, _ string, _ media.ObjectInfo) (media.Asset, error) {
	r.activated = true
	row := r.asset
	row.Status = media.StatusActive
	now := time.Now()
	row.VerifiedAt = &now
	return row, nil
}

type providerStub struct {
	available   bool
	presignCalls int
	head         media.ObjectInfo
	headErr      error
}

func (p *providerStub) Available() bool { return p.available }

func (p *providerStub) PresignPut(key, mimeType, sha256 string, expires time.Duration) (media.UploadTarget, error) {
	p.presignCalls++
	return media.UploadTarget{
		URL:       "https://r2.example/" + key,
		Headers:   map[string]string{"Content-Type": mimeType, "x-amz-meta-sha256": sha256},
		ExpiresAt: time.Now().Add(expires),
	}, nil
}

func (p *providerStub) Head(context.Context, string) (media.ObjectInfo, error) {
	return p.head, p.headErr
}

func (p *providerStub) PublicURL(key string) string {
	return "https://cdn.example/" + key
}

func mediaAdmin() identity.User {
	return identity.User{ID: "11111111-1111-7111-8111-111111111111", Roles: []identity.Role{identity.RoleAdmin}}
}

func TestPresignQuestionImageUsesHashAddressedR2Key(t *testing.T) {
	repo := &repoStub{}
	provider := &providerStub{available: true}
	service := NewService(repo, provider, 10*1024*1024, 15*time.Minute)
	hash := strings.Repeat("a", 64)

	result, err := service.Presign(context.Background(), mediaAdmin(), PresignInput{
		Kind:         media.UploadQuestionImage,
		QuestionCode: "Q-001",
		SHA256:       hash,
		MimeType:     "image/webp",
		SizeBytes:    12345,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	expectedKey := "questions/v2/Q-001/" + hash + ".webp"
	if repo.reserved.ObjectKey != expectedKey {
		t.Fatalf("unexpected key %q", repo.reserved.ObjectKey)
	}
	if !result.UploadRequired || result.Target == nil || provider.presignCalls != 1 {
		t.Fatalf("expected direct upload target: %#v", result)
	}
	if repo.reserved.PublicURL != "https://cdn.example/"+expectedKey {
		t.Fatalf("unexpected public URL %q", repo.reserved.PublicURL)
	}
}

func TestPresignReusesVerifiedHashWithoutReupload(t *testing.T) {
	hash := strings.Repeat("b", 64)
	repo := &repoStub{live: media.Asset{
		ID: "asset-existing", Status: media.StatusActive, MimeType: "image/webp",
		SizeBytes: 100, SHA256: hash, PublicURL: "https://cdn.example/existing.webp",
	}}
	provider := &providerStub{available: true}
	service := NewService(repo, provider, 1024, 15*time.Minute)

	result, err := service.Presign(context.Background(), mediaAdmin(), PresignInput{
		Kind: media.UploadQuestionImportImage, QuestionCode: "Q-002",
		SHA256: hash, MimeType: "image/webp", SizeBytes: 100,
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.UploadRequired || result.Target != nil || result.Asset.ID != "asset-existing" {
		t.Fatalf("expected verified asset reuse: %#v", result)
	}
	if provider.presignCalls != 0 {
		t.Fatalf("expected no new upload URL, got %d calls", provider.presignCalls)
	}
}

func TestCompleteRejectsR2MetadataMismatch(t *testing.T) {
	hash := strings.Repeat("c", 64)
	repo := &repoStub{asset: media.Asset{
		ID: "asset-1", ObjectKey: "questions/v2/Q-1/" + hash + ".webp",
		MimeType: "image/webp", SizeBytes: 100, SHA256: hash,
		Status: media.StatusPendingUpload, CreatedBy: mediaAdmin().ID,
	}}
	provider := &providerStub{available: true, head: media.ObjectInfo{
		Exists: true, SizeBytes: 101, MimeType: "image/webp", SHA256: hash,
	}}
	service := NewService(repo, provider, 1024, 15*time.Minute)

	_, err := service.Complete(context.Background(), mediaAdmin(), "asset-1")
	if !errors.Is(err, media.ErrConflict) {
		t.Fatalf("expected conflict, got %v", err)
	}
	if repo.activated {
		t.Fatal("mismatched object must not become active")
	}
}

func TestCompleteActivatesOnlyVerifiedObject(t *testing.T) {
	hash := strings.Repeat("d", 64)
	repo := &repoStub{asset: media.Asset{
		ID: "asset-1", ObjectKey: "questions/v2/Q-1/" + hash + ".webp",
		MimeType: "image/webp", SizeBytes: 100, SHA256: hash,
		Status: media.StatusPendingUpload, CreatedBy: mediaAdmin().ID,
	}}
	provider := &providerStub{available: true, head: media.ObjectInfo{
		Exists: true, SizeBytes: 100, MimeType: "image/webp", SHA256: hash,
	}}
	service := NewService(repo, provider, 1024, 15*time.Minute)

	asset, err := service.Complete(context.Background(), mediaAdmin(), "asset-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !repo.activated || asset.Status != media.StatusActive {
		t.Fatalf("expected active verified asset: %#v", asset)
	}
}

func TestPresignRejectsUnsupportedImageMime(t *testing.T) {
	service := NewService(&repoStub{}, &providerStub{available: true}, 1024, 15*time.Minute)
	_, err := service.Presign(context.Background(), mediaAdmin(), PresignInput{
		Kind: media.UploadQuestionImage, QuestionCode: "Q-1",
		SHA256: strings.Repeat("e", 64), MimeType: "image/svg+xml", SizeBytes: 100,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}
