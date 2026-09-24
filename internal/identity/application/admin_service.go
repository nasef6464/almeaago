package application

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

var (
	ErrForbidden                = errors.New("forbidden")
	ErrOrganizationScopePending = errors.New("organization scope integration pending")
	ErrUnsupportedAdminScope    = errors.New("unsupported admin organization scope")
)

type AdminRepository interface {
	AdminListUsers(ctx context.Context, query domain.AdminUserQuery) (domain.AdminUserPage, error)
	AdminSummary(ctx context.Context) (domain.AdminUserSummary, error)
	AdminUpsertUser(ctx context.Context, actorID string, input domain.AdminUpsertUserInput) (domain.User, error)
	AdminUpdateUser(ctx context.Context, actorID, targetID string, input domain.AdminUpdateUserInput) (domain.User, error)
	AdminBulkStatus(ctx context.Context, actorID string, userIDs []string, active bool) ([]domain.AdminBulkStatusResult, error)
	AdminDeleteUser(ctx context.Context, actorID, targetID string) error
}

type AdminService struct {
	repo AdminRepository
}

func NewAdminService(repo AdminRepository) *AdminService {
	return &AdminService{repo: repo}
}

func (s *AdminService) ListUsers(
	ctx context.Context,
	actor domain.User,
	query domain.AdminUserQuery,
) (domain.AdminUserPage, error) {
	if actor.HasRole(domain.RoleAdmin) {
		query.Page = clampPage(query.Page)
		query.Limit = clampLimit(query.Limit)
		query.Search = strings.TrimSpace(query.Search)
		if len(query.Search) > 120 {
			return domain.AdminUserPage{}, ErrInvalidInput
		}
		if query.Role != nil && !domain.ValidRole(*query.Role) {
			return domain.AdminUserPage{}, ErrInvalidInput
		}
		return s.repo.AdminListUsers(ctx, query)
	}

	if actor.HasRole(domain.RoleSupervisor) || actor.HasRole(domain.RoleTeacher) {
		return domain.AdminUserPage{}, ErrOrganizationScopePending
	}
	return domain.AdminUserPage{}, ErrForbidden
}

func (s *AdminService) Summary(
	ctx context.Context,
	actor domain.User,
) (domain.AdminUserSummary, error) {
	if !actor.HasRole(domain.RoleAdmin) {
		return domain.AdminUserSummary{}, ErrForbidden
	}
	return s.repo.AdminSummary(ctx)
}

func (s *AdminService) UpsertUser(
	ctx context.Context,
	actor domain.User,
	name string,
	email string,
	password string,
	role domain.Role,
) (domain.User, error) {
	if !actor.HasRole(domain.RoleAdmin) {
		return domain.User{}, ErrForbidden
	}

	name = strings.TrimSpace(name)
	email = normalizeEmail(email)
	if len(name) < 2 || !validEmail(email) || !validPassword(password) || !domain.ValidRole(role) {
		return domain.User{}, ErrInvalidInput
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return domain.User{}, fmt.Errorf("hash admin-created password: %w", err)
	}

	user, err := s.repo.AdminUpsertUser(ctx, actor.ID, domain.AdminUpsertUserInput{
		Name:         name,
		Email:        email,
		PasswordHash: passwordHash,
		Role:         role,
	})
	if errors.Is(err, domain.ErrConflict) {
		return domain.User{}, ErrEmailExists
	}
	return user, err
}

func (s *AdminService) UpdateUser(
	ctx context.Context,
	actor domain.User,
	targetID string,
	input domain.AdminUpdateUserInput,
) (domain.User, error) {
	if !actor.HasRole(domain.RoleAdmin) {
		return domain.User{}, ErrForbidden
	}

	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return domain.User{}, ErrInvalidInput
	}

	if input.Name != nil {
		trimmed := strings.TrimSpace(*input.Name)
		if len(trimmed) < 2 || len(trimmed) > 120 {
			return domain.User{}, ErrInvalidInput
		}
		input.Name = &trimmed
	}
	if input.AvatarURL != nil {
		trimmed := strings.TrimSpace(*input.AvatarURL)
		if len(trimmed) > 2000 {
			return domain.User{}, ErrInvalidInput
		}
		input.AvatarURL = &trimmed
	}
	if input.Role != nil && !domain.ValidRole(*input.Role) {
		return domain.User{}, ErrInvalidInput
	}
	if input.Name == nil && input.AvatarURL == nil && input.Role == nil && input.Active == nil {
		return domain.User{}, ErrInvalidInput
	}

	return s.repo.AdminUpdateUser(ctx, actor.ID, targetID, input)
}

func (s *AdminService) BulkStatus(
	ctx context.Context,
	actor domain.User,
	userIDs []string,
	active bool,
) ([]domain.AdminBulkStatusResult, error) {
	if !actor.HasRole(domain.RoleAdmin) {
		return nil, ErrForbidden
	}

	seen := make(map[string]struct{}, len(userIDs))
	normalized := make([]string, 0, len(userIDs))
	for _, value := range userIDs {
		id := strings.TrimSpace(value)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	if len(normalized) == 0 || len(normalized) > 100 {
		return nil, ErrInvalidInput
	}

	return s.repo.AdminBulkStatus(ctx, actor.ID, normalized, active)
}

func (s *AdminService) DeleteUser(
	ctx context.Context,
	actor domain.User,
	targetID string,
) error {
	if !actor.HasRole(domain.RoleAdmin) {
		return ErrForbidden
	}
	targetID = strings.TrimSpace(targetID)
	if targetID == "" {
		return ErrInvalidInput
	}
	return s.repo.AdminDeleteUser(ctx, actor.ID, targetID)
}

func clampPage(page int) int {
	if page < 1 {
		return 1
	}
	return page
}

func clampLimit(limit int) int {
	if limit < 1 {
		return 50
	}
	if limit > 100 {
		return 100
	}
	return limit
}
