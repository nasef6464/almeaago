package application

import (
	"context"
	"errors"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

var ErrInvalidPhase = errors.New("invalid taxonomy bootstrap phase")

type Repository interface {
	PublicBootstrap(ctx context.Context, includeSkills bool) (taxonomy.Bootstrap, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) PublicBootstrap(ctx context.Context, phase string) (taxonomy.Bootstrap, error) {
	switch phase {
	case "", "full", "compact":
		return s.repo.PublicBootstrap(ctx, true)
	case "core":
		return s.repo.PublicBootstrap(ctx, false)
	default:
		return taxonomy.Bootstrap{}, ErrInvalidPhase
	}
}
