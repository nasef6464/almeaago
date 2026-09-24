package application

import (
	"context"
	"errors"
	"strings"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

var (
	ErrForbiddenAdminAction = errors.New("admin action forbidden")
	ErrLastActiveAdmin       = errors.New("cannot remove last active admin")
	ErrSelfDelete            = errors.New("cannot delete current account")
)

type AdminCreateUserInput struct {
	Name             string
	Email            string
	Password         string
	Role             domain.Role
	SchoolID         string
	ClassIDs         []string
	LinkedStudentIDs []string
}

type AdminUpdateUserInput struct {
	Name             *string
	Role             *domain.Role
	Active           *bool
	AvatarURL        *string
	SchoolID         *string
	ClassIDs         *[]string
	LinkedStudentIDs *[]string
}

type AdminUserListInput struct {
	Page   int
	Limit  int
	Search string
	Role   *domain.Role
	Active *bool
}

func (s *Service) AdminCreateUser(
	ctx context.Context,
	actor Authenticated,
	input AdminCreateUserInput,
) (domain.AdminUserRecord, error) {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) {
		return domain.AdminUserRecord{}, ErrForbiddenAdminAction
	}

	name := strings.TrimSpace(input.Name)
	email := normalizeEmail(input.Email)
	if len(name) < 2 || !validEmail(email) || !validPassword(input.Password) || !domain.IsValidRole(input.Role) {
		return domain.AdminUserRecord{}, ErrInvalidInput
	}

	passwordHash, err := security.HashPassword(input.Password)
	if err != nil {
		return domain.AdminUserRecord{}, err
	}

	schoolID := strings.TrimSpace(input.SchoolID)
	classIDs := normalizeIDs(input.ClassIDs, 200)
	linkedStudentIDs := normalizeIDs(input.LinkedStudentIDs, 500)
	if input.Role != domain.RoleParent {
		linkedStudentIDs = nil
	}

	write := domain.AdminUserWrite{
		Name:             &name,
		Email:            &email,
		PasswordHash:     &passwordHash,
		Role:             &input.Role,
		SchoolID:         &schoolID,
		ClassIDs:         &classIDs,
		LinkedStudentIDs: &linkedStudentIDs,
	}
	record, err := s.repo.AdminCreateOrUpsertUser(ctx, actor.User.ID, write)
	if errors.Is(err, domain.ErrConflict) {
		return domain.AdminUserRecord{}, ErrEmailExists
	}
	if errors.Is(err, domain.ErrInvariant) {
		return domain.AdminUserRecord{}, ErrLastActiveAdmin
	}
	return record, err
}

func (s *Service) AdminUpdateUser(
	ctx context.Context,
	actor Authenticated,
	targetUserID string,
	input AdminUpdateUserInput,
) (domain.AdminUserRecord, error) {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) {
		return domain.AdminUserRecord{}, ErrForbiddenAdminAction
	}
	targetUserID = strings.TrimSpace(targetUserID)
	if targetUserID == "" {
		return domain.AdminUserRecord{}, ErrInvalidInput
	}

	write := domain.AdminUserWrite{
		Role:   input.Role,
		Active: input.Active,
	}
	if input.Role != nil && !domain.IsValidRole(*input.Role) {
		return domain.AdminUserRecord{}, ErrInvalidInput
	}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if len(name) < 2 || len(name) > 120 {
			return domain.AdminUserRecord{}, ErrInvalidInput
		}
		write.Name = &name
	}
	if input.AvatarURL != nil {
		avatar := strings.TrimSpace(*input.AvatarURL)
		if len(avatar) > 2_000_000 {
			return domain.AdminUserRecord{}, ErrInvalidInput
		}
		write.AvatarURL = &avatar
	}
	if input.SchoolID != nil {
		schoolID := strings.TrimSpace(*input.SchoolID)
		write.SchoolID = &schoolID
	}
	if input.ClassIDs != nil {
		classIDs := normalizeIDs(*input.ClassIDs, 200)
		write.ClassIDs = &classIDs
	}
	if input.LinkedStudentIDs != nil {
		linked := normalizeIDs(*input.LinkedStudentIDs, 500)
		write.LinkedStudentIDs = &linked
	}

	record, err := s.repo.AdminUpdateUser(ctx, actor.User.ID, targetUserID, write)
	if errors.Is(err, domain.ErrInvariant) {
		return domain.AdminUserRecord{}, ErrLastActiveAdmin
	}
	return record, err
}

func (s *Service) AdminDeleteUser(
	ctx context.Context,
	actor Authenticated,
	targetUserID string,
) error {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) {
		return ErrForbiddenAdminAction
	}
	targetUserID = strings.TrimSpace(targetUserID)
	if targetUserID == "" {
		return ErrInvalidInput
	}
	if targetUserID == actor.User.ID {
		return ErrSelfDelete
	}

	err := s.repo.AdminDeleteUser(ctx, actor.User.ID, targetUserID)
	if errors.Is(err, domain.ErrInvariant) {
		return ErrLastActiveAdmin
	}
	return err
}

func (s *Service) AdminBulkStatus(
	ctx context.Context,
	actor Authenticated,
	userIDs []string,
	active bool,
) ([]domain.BulkStatusResult, error) {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) {
		return nil, ErrForbiddenAdminAction
	}
	ids := normalizeIDs(userIDs, 100)
	if len(ids) == 0 {
		return nil, ErrInvalidInput
	}
	return s.repo.AdminBulkStatus(ctx, actor.User.ID, ids, active)
}

func (s *Service) AdminListUsers(
	ctx context.Context,
	actor Authenticated,
	input AdminUserListInput,
) (domain.AdminUserPage, error) {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) &&
		!domain.HasRole(actor.User.Roles, domain.RoleSupervisor) &&
		!domain.HasRole(actor.User.Roles, domain.RoleTeacher) {
		return domain.AdminUserPage{}, ErrForbiddenAdminAction
	}

	page := input.Page
	if page < 1 {
		page = 1
	}
	limit := input.Limit
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	search := strings.TrimSpace(input.Search)
	if len(search) > 120 {
		return domain.AdminUserPage{}, ErrInvalidInput
	}
	if input.Role != nil && !domain.IsValidRole(*input.Role) {
		return domain.AdminUserPage{}, ErrInvalidInput
	}

	return s.repo.AdminListUsers(ctx, domain.AdminUserListOptions{
		Page:        page,
		Limit:       limit,
		Search:      search,
		Role:        input.Role,
		Active:      input.Active,
		ActorUserID: actor.User.ID,
		ActorRoles:  actor.User.Roles,
	})
}

func (s *Service) AdminSummary(ctx context.Context, actor Authenticated) (domain.AdminSummary, error) {
	if !domain.HasRole(actor.User.Roles, domain.RoleAdmin) {
		return domain.AdminSummary{}, ErrForbiddenAdminAction
	}
	return s.repo.AdminSummary(ctx)
}

func normalizeIDs(values []string, max int) []string {
	seen := make(map[string]struct{}, len(values))
	result := make([]string, 0, len(values))
	for _, value := range values {
		id := strings.TrimSpace(value)
		if id == "" {
			continue
		}
		if _, exists := seen[id]; exists {
			continue
		}
		seen[id] = struct{}{}
		result = append(result, id)
		if len(result) >= max {
			break
		}
	}
	return result
}
