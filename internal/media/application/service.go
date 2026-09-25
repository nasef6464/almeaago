package application

import (
	"context"
	"errors"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	media "github.com/nasef6464/almeaago/internal/media/domain"
)

var (
	ErrInvalidInput = errors.New("invalid media input")
	ErrForbidden    = errors.New("media operation forbidden")
)

type Repository interface {
	FindLiveBySHA(ctx context.Context, sha256 string) (media.Asset, error)
	Reserve(ctx context.Context, actorUserID string, request media.ReserveRequest) (media.Asset, error)
	RefreshPending(ctx context.Context, actorUserID, assetID string, expiresAt time.Time) (media.Asset, error)
	Get(ctx context.Context, assetID string) (media.Asset, error)
	Activate(ctx context.Context, actorUserID, assetID string, info media.ObjectInfo) (media.Asset, error)
}

type Provider interface {
	Available() bool
	PresignPut(objectKey, mimeType, sha256 string, expires time.Duration) (media.UploadTarget, error)
	Head(ctx context.Context, objectKey string) (media.ObjectInfo, error)
	PublicURL(objectKey string) string
}

type Service struct {
	repo      Repository
	provider  Provider
	maxUpload int64
	presignTTL time.Duration
}

func NewService(repo Repository, provider Provider, maxUpload int64, presignTTL time.Duration) *Service {
	return &Service{repo: repo, provider: provider, maxUpload: maxUpload, presignTTL: presignTTL}
}

type PresignInput struct {
	Kind         media.UploadKind `json:"kind"`
	QuestionCode string           `json:"questionCode"`
	SHA256       string           `json:"sha256"`
	MimeType     string           `json:"mimeType"`
	SizeBytes    int64            `json:"sizeBytes"`
}

type PresignResult struct {
	Asset          media.Asset
	UploadRequired bool
	Target         *media.UploadTarget
}

func (s *Service) Presign(ctx context.Context, actor identity.User, input PresignInput) (PresignResult, error) {
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return PresignResult{}, ErrForbidden
	}
	if s.provider == nil || !s.provider.Available() {
		return PresignResult{}, media.ErrUnavailable
	}
	normalized, ext, err := s.normalizePresign(input)
	if err != nil {
		return PresignResult{}, err
	}

	existing, err := s.repo.FindLiveBySHA(ctx, normalized.SHA256)
	if err == nil {
		return s.presignExisting(ctx, actor, existing, normalized)
	}
	if !errors.Is(err, media.ErrNotFound) {
		return PresignResult{}, err
	}

	objectKey := objectKey(normalized.Kind, normalized.QuestionCode, normalized.SHA256, ext)
	expiresAt := time.Now().UTC().Add(s.presignTTL)
	asset, err := s.repo.Reserve(ctx, actor.ID, media.ReserveRequest{
		ObjectKey:       objectKey,
		PublicURL:       s.provider.PublicURL(objectKey),
		MimeType:        normalized.MimeType,
		SizeBytes:       normalized.SizeBytes,
		SHA256:          normalized.SHA256,
		UploadExpiresAt: expiresAt,
	})
	if errors.Is(err, media.ErrConflict) {
		existing, findErr := s.repo.FindLiveBySHA(ctx, normalized.SHA256)
		if findErr != nil {
			return PresignResult{}, err
		}
		return s.presignExisting(ctx, actor, existing, normalized)
	}
	if err != nil {
		return PresignResult{}, err
	}
	target, err := s.provider.PresignPut(asset.ObjectKey, asset.MimeType, asset.SHA256, s.presignTTL)
	if err != nil {
		return PresignResult{}, err
	}
	return PresignResult{Asset: asset, UploadRequired: true, Target: &target}, nil
}

func (s *Service) presignExisting(ctx context.Context, actor identity.User, asset media.Asset, input PresignInput) (PresignResult, error) {
	if asset.SizeBytes != input.SizeBytes || !sameMime(asset.MimeType, input.MimeType) {
		return PresignResult{}, media.ErrConflict
	}
	if asset.Status == media.StatusActive {
		return PresignResult{Asset: asset, UploadRequired: false}, nil
	}
	if asset.Status != media.StatusPendingUpload {
		return PresignResult{}, media.ErrConflict
	}
	if asset.CreatedBy != actor.ID && !actor.HasRole(identity.RoleAdmin) {
		return PresignResult{}, ErrForbidden
	}
	expiresAt := time.Now().UTC().Add(s.presignTTL)
	refreshed, err := s.repo.RefreshPending(ctx, actor.ID, asset.ID, expiresAt)
	if err != nil {
		return PresignResult{}, err
	}
	target, err := s.provider.PresignPut(refreshed.ObjectKey, refreshed.MimeType, refreshed.SHA256, s.presignTTL)
	if err != nil {
		return PresignResult{}, err
	}
	return PresignResult{Asset: refreshed, UploadRequired: true, Target: &target}, nil
}

func (s *Service) Complete(ctx context.Context, actor identity.User, assetID string) (media.Asset, error) {
	assetID = strings.TrimSpace(assetID)
	if assetID == "" || strings.TrimSpace(actor.ID) == "" {
		return media.Asset{}, ErrInvalidInput
	}
	asset, err := s.repo.Get(ctx, assetID)
	if err != nil {
		return media.Asset{}, err
	}
	if asset.Status == media.StatusActive {
		return asset, nil
	}
	if asset.Status != media.StatusPendingUpload {
		return media.Asset{}, media.ErrConflict
	}
	if asset.CreatedBy != actor.ID && !actor.HasRole(identity.RoleAdmin) {
		return media.Asset{}, ErrForbidden
	}
	if s.provider == nil || !s.provider.Available() {
		return media.Asset{}, media.ErrUnavailable
	}
	info, err := s.provider.Head(ctx, asset.ObjectKey)
	if err != nil {
		return media.Asset{}, err
	}
	if !info.Exists || info.SizeBytes != asset.SizeBytes || !sameMime(info.MimeType, asset.MimeType) ||
		!strings.EqualFold(strings.TrimSpace(info.SHA256), asset.SHA256) {
		return media.Asset{}, media.ErrConflict
	}
	return s.repo.Activate(ctx, actor.ID, asset.ID, info)
}

func (s *Service) Get(ctx context.Context, actor identity.User, assetID string) (media.Asset, error) {
	if strings.TrimSpace(actor.ID) == "" || strings.TrimSpace(assetID) == "" {
		return media.Asset{}, ErrForbidden
	}
	asset, err := s.repo.Get(ctx, strings.TrimSpace(assetID))
	if err != nil {
		return media.Asset{}, err
	}
	if asset.Status == media.StatusActive {
		return asset, nil
	}
	if actor.HasRole(identity.RoleAdmin) || asset.CreatedBy == actor.ID {
		return asset, nil
	}
	return media.Asset{}, media.ErrNotFound
}

func (s *Service) normalizePresign(input PresignInput) (PresignInput, string, error) {
	input.QuestionCode = strings.TrimSpace(input.QuestionCode)
	input.SHA256 = strings.ToLower(strings.TrimSpace(input.SHA256))
	input.MimeType = canonicalMime(input.MimeType)
	if input.SizeBytes <= 0 || input.SizeBytes > s.maxUpload || !validQuestionCode(input.QuestionCode) || !validSHA256(input.SHA256) {
		return PresignInput{}, "", ErrInvalidInput
	}

	var ext string
	switch input.Kind {
	case media.UploadQuestionImage, media.UploadQuestionImportImage:
		switch input.MimeType {
		case "image/jpeg":
			ext = "jpg"
		case "image/png":
			ext = "png"
		case "image/webp":
			ext = "webp"
		default:
			return PresignInput{}, "", ErrInvalidInput
		}
	case media.UploadExplanationAudio:
		switch input.MimeType {
		case "audio/mpeg":
			ext = "mp3"
		case "audio/mp4":
			ext = "m4a"
		case "audio/webm":
			ext = "webm"
		case "audio/ogg":
			ext = "ogg"
		default:
			return PresignInput{}, "", ErrInvalidInput
		}
	default:
		return PresignInput{}, "", ErrInvalidInput
	}
	return input, ext, nil
}

func objectKey(kind media.UploadKind, questionCode, sha256, ext string) string {
	prefix := "questions/v2"
	if kind == media.UploadExplanationAudio {
		prefix = "questions/audio/v1"
	}
	return prefix + "/" + questionCode + "/" + sha256 + "." + ext
}

func canonicalMime(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	if index := strings.IndexByte(value, ';'); index >= 0 {
		value = strings.TrimSpace(value[:index])
	}
	return value
}

func sameMime(a, b string) bool {
	return canonicalMime(a) == canonicalMime(b)
}

func validQuestionCode(value string) bool {
	if value == "" || len(value) > 120 {
		return false
	}
	for _, ch := range value {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') ||
			ch == '-' || ch == '_' || ch == '.' {
			continue
		}
		return false
	}
	return true
}

func validSHA256(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, ch := range value {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') {
			continue
		}
		return false
	}
	return true
}
