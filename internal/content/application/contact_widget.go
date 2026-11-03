package application

import (
	"context"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

type ContactWidgetRepository interface {
	GetContactWidgetSettings(context.Context) (content.PublicContactWidgetSettings, error)
}

type ContactWidgetService struct {
	repo ContactWidgetRepository
}

func NewContactWidgetService(repo ContactWidgetRepository) *ContactWidgetService {
	return &ContactWidgetService{repo: repo}
}

func (s *ContactWidgetService) Get(ctx context.Context) (content.PublicContactWidgetSettings, error) {
	if s == nil || s.repo == nil {
		return content.DefaultContactWidgetSettings(), nil
	}
	settings, err := s.repo.GetContactWidgetSettings(ctx)
	if err != nil {
		return content.DefaultContactWidgetSettings(), nil
	}
	return settings, nil
}
