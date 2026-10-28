package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type FontRepository interface {
	GetFontSettings(context.Context) (content.FontSettings, error)
	PatchFontSettings(context.Context, string, content.FontSettings) (content.FontSettings, error)
}
type FontService struct{ repo FontRepository }

func NewFontService(repo FontRepository) *FontService { return &FontService{repo: repo} }
func (s *FontService) Get(ctx context.Context) (content.FontSettings, error) {
	settings, err := s.repo.GetFontSettings(ctx)
	if err != nil {
		return nil, err
	}
	return withFontDefaults(settings), nil
}
func (s *FontService) Patch(ctx context.Context, actor identity.User, input map[string]any) (content.FontSettings, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	patch, err := content.ParseFontPatch(input)
	if err != nil {
		return nil, ErrInvalidInput
	}
	saved, err := s.repo.PatchFontSettings(ctx, actor.ID, patch)
	if err != nil {
		return nil, err
	}
	return withFontDefaults(saved), nil
}
func withFontDefaults(settings content.FontSettings) content.FontSettings {
	result := content.DefaultFontSettings()
	for key, value := range settings {
		result[key] = value
	}
	return result
}
