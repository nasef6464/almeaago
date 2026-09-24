package application

import (
	"context"
	"errors"
	"strings"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

var ErrIdentityConflict = errors.New("identity value already in use or would remove final login identity")

type AccountRepository interface {
	UpdateSelfProfile(
		ctx context.Context,
		userID string,
		input domain.SelfProfileUpdate,
	) (domain.User, error)
	UpdateSelfIdentity(
		ctx context.Context,
		userID string,
		input domain.SelfIdentityUpdate,
	) (domain.User, error)
}

type AccountService struct {
	repo AccountRepository
}

func NewAccountService(repo AccountRepository) *AccountService {
	return &AccountService{repo: repo}
}

func (s *AccountService) UpdateProfile(
	ctx context.Context,
	actor domain.User,
	input domain.SelfProfileUpdate,
) (domain.User, error) {
	if actor.ID == "" {
		return domain.User{}, ErrUnauthenticated
	}
	if input.Name == nil && input.AvatarURL == nil {
		return domain.User{}, ErrInvalidInput
	}

	if input.Name != nil {
		value := strings.TrimSpace(*input.Name)
		if len(value) < 2 || len(value) > 120 {
			return domain.User{}, ErrInvalidInput
		}
		input.Name = &value
	}
	if input.AvatarURL != nil {
		value := strings.TrimSpace(*input.AvatarURL)
		if len(value) > 2000 {
			return domain.User{}, ErrInvalidInput
		}
		input.AvatarURL = &value
	}

	user, err := s.repo.UpdateSelfProfile(ctx, actor.ID, input)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrUnauthenticated
	}
	return user, err
}

func (s *AccountService) UpdateIdentity(
	ctx context.Context,
	actor domain.User,
	input domain.SelfIdentityUpdate,
) (domain.User, error) {
	if actor.ID == "" {
		return domain.User{}, ErrUnauthenticated
	}
	if !input.NationalIDSet && !input.PhoneSet {
		return domain.User{}, ErrInvalidInput
	}

	if input.NationalIDSet && input.NationalID != nil {
		value := strings.TrimSpace(*input.NationalID)
		if !nationalIDPattern.MatchString(value) {
			return domain.User{}, ErrInvalidInput
		}
		input.NationalID = &value
	}

	if input.PhoneSet && input.Phone != nil {
		value, ok := domain.NormalizeSaudiPhone(*input.Phone)
		if !ok {
			return domain.User{}, ErrInvalidInput
		}
		input.Phone = &value
	}

	user, err := s.repo.UpdateSelfIdentity(ctx, actor.ID, input)
	if errors.Is(err, domain.ErrConflict) {
		return domain.User{}, ErrIdentityConflict
	}
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrUnauthenticated
	}
	return user, err
}
