package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type HomepageRepository interface {
	GetHomepageSettings(context.Context) (content.HomepageSettings, error)
	PatchHomepageSettings(context.Context, string, content.HomepageSettings) (content.HomepageSettings, error)
}
type HomepageService struct{ repo HomepageRepository }

func NewHomepageService(repo HomepageRepository) *HomepageService {
	return &HomepageService{repo: repo}
}
func (s *HomepageService) Get(ctx context.Context) (content.HomepageSettings, error) {
	settings, err := s.repo.GetHomepageSettings(ctx)
	if err != nil {
		return nil, err
	}
	if settings == nil {
		return content.DefaultHomepageSettings(), nil
	}
	return settings, nil
}
func (s *HomepageService) Patch(ctx context.Context, actor identity.User, input map[string]any) (content.HomepageSettings, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	patch, err := content.ParseHomepagePatch(input)
	if err != nil {
		return nil, ErrInvalidInput
	}
	return s.repo.PatchHomepageSettings(ctx, actor.ID, patch)
}
