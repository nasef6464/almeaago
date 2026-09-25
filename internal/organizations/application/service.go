package application

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

var (
	ErrForbidden    = errors.New("organization action forbidden")
	ErrInvalidInput = errors.New("invalid organization input")
)

const (
	permissionSchoolStudentsView = "SCHOOL_STUDENTS_VIEW"
	permissionSchoolClassesManage = "SCHOOL_CLASSES_MANAGE"
	maxMetadataBytes              = 16 << 10
)

type Repository interface {
	ListSchools(ctx context.Context, access org.AccessContext, query org.SchoolListQuery) (org.SchoolPage, error)
	SchoolByID(ctx context.Context, access org.AccessContext, schoolID string) (org.School, error)
	CreateSchool(ctx context.Context, actorUserID string, write org.SchoolWrite) (org.School, error)
	UpdateSchool(ctx context.Context, actorUserID, schoolID string, patch org.SchoolPatch) (org.School, error)
	ArchiveSchool(ctx context.Context, actorUserID, schoolID string) (org.School, error)

	ListClasses(ctx context.Context, access org.AccessContext, schoolID string, query org.ClassListQuery) (org.ClassPage, error)
	CreateClass(ctx context.Context, actorUserID, schoolID string, write org.ClassWrite) (org.Class, error)
	UpdateClass(ctx context.Context, actorUserID, schoolID, classID string, patch org.ClassPatch) (org.Class, error)
	ArchiveClass(ctx context.Context, actorUserID, schoolID, classID string) (org.Class, error)

	Roster(ctx context.Context, access org.AccessContext, schoolID string, query org.RosterQuery) (org.RosterPage, error)
	CanAccessSchool(ctx context.Context, access org.AccessContext, schoolID string) (bool, error)
	CanManageSchool(ctx context.Context, userID, schoolID string) (bool, error)
	HasSchoolPermission(ctx context.Context, userID, schoolID, permission string) (bool, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CreateSchoolInput struct {
	Code     string
	Name     string
	Metadata json.RawMessage
}

type UpdateSchoolInput struct {
	Name     *string
	Status   *org.SchoolStatus
	Metadata *json.RawMessage
}

type CreateClassInput struct {
	Code     string
	Name     string
	Metadata json.RawMessage
}

type UpdateClassInput struct {
	Name     *string
	Status   *org.ClassStatus
	Metadata *json.RawMessage
}

func (s *Service) ListSchools(
	ctx context.Context,
	actor identity.User,
	query org.SchoolListQuery,
) (org.SchoolPage, error) {
	if !canReadOrganizations(actor) {
		return org.SchoolPage{}, ErrForbidden
	}
	if query.Status != nil && !org.ValidSchoolStatus(*query.Status) {
		return org.SchoolPage{}, ErrInvalidInput
	}
	query.Search = strings.TrimSpace(query.Search)
	if len(query.Search) > 120 {
		return org.SchoolPage{}, ErrInvalidInput
	}
	query = normalizeSchoolQuery(query)
	return s.repo.ListSchools(ctx, accessOf(actor), query)
}

func (s *Service) SchoolByID(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (org.School, error) {
	if !canReadOrganizations(actor) {
		return org.School{}, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.School{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanAccessSchool(ctx, accessOf(actor), schoolID)
	if err != nil {
		return org.School{}, err
	}
	if !allowed {
		return org.School{}, ErrForbidden
	}
	return s.repo.SchoolByID(ctx, accessOf(actor), schoolID)
}

func (s *Service) CreateSchool(
	ctx context.Context,
	actor identity.User,
	input CreateSchoolInput,
) (org.School, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return org.School{}, ErrForbidden
	}
	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > 160 {
		return org.School{}, ErrInvalidInput
	}
	code := normalizeCode(input.Code)
	if code == "" {
		var err error
		code, err = randomCode("SCH")
		if err != nil {
			return org.School{}, err
		}
	}
	metadata, err := normalizeMetadata(input.Metadata)
	if err != nil {
		return org.School{}, err
	}
	return s.repo.CreateSchool(ctx, actor.ID, org.SchoolWrite{
		Code:     code,
		Name:     name,
		Status:   org.SchoolStatusActive,
		Metadata: metadata,
	})
}

func (s *Service) UpdateSchool(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input UpdateSchoolInput,
) (org.School, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.School{}, ErrInvalidInput
	}
	if err := s.requireSchoolManagement(ctx, actor, schoolID); err != nil {
		return org.School{}, err
	}

	patch := org.SchoolPatch{Status: input.Status}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" || len(name) > 160 {
			return org.School{}, ErrInvalidInput
		}
		patch.Name = &name
	}
	if input.Status != nil {
		if !org.ValidSchoolStatus(*input.Status) || *input.Status == org.SchoolStatusArchived {
			return org.School{}, ErrInvalidInput
		}
	}
	if input.Metadata != nil {
		metadata, err := normalizeMetadata(*input.Metadata)
		if err != nil {
			return org.School{}, err
		}
		patch.Metadata = &metadata
	}
	if patch.Name == nil && patch.Status == nil && patch.Metadata == nil {
		return org.School{}, ErrInvalidInput
	}
	return s.repo.UpdateSchool(ctx, actor.ID, schoolID, patch)
}

func (s *Service) ArchiveSchool(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (org.School, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.School{}, ErrInvalidInput
	}
	if err := s.requireSchoolManagement(ctx, actor, schoolID); err != nil {
		return org.School{}, err
	}
	return s.repo.ArchiveSchool(ctx, actor.ID, schoolID)
}

func (s *Service) ListClasses(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	query org.ClassListQuery,
) (org.ClassPage, error) {
	if !canReadOrganizations(actor) {
		return org.ClassPage{}, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.ClassPage{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanAccessSchool(ctx, accessOf(actor), schoolID)
	if err != nil {
		return org.ClassPage{}, err
	}
	if !allowed {
		return org.ClassPage{}, ErrForbidden
	}
	if query.Status != nil && !org.ValidClassStatus(*query.Status) {
		return org.ClassPage{}, ErrInvalidInput
	}
	query.Search = strings.TrimSpace(query.Search)
	if len(query.Search) > 120 {
		return org.ClassPage{}, ErrInvalidInput
	}
	query = normalizeClassQuery(query)
	return s.repo.ListClasses(ctx, accessOf(actor), schoolID, query)
}

func (s *Service) CreateClass(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input CreateClassInput,
) (org.Class, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.Class{}, ErrInvalidInput
	}
	if err := s.requireClassManagement(ctx, actor, schoolID); err != nil {
		return org.Class{}, err
	}

	name := strings.TrimSpace(input.Name)
	if name == "" || len(name) > 160 {
		return org.Class{}, ErrInvalidInput
	}
	code := normalizeCode(input.Code)
	if code == "" {
		var err error
		code, err = randomCode("CLS")
		if err != nil {
			return org.Class{}, err
		}
	}
	metadata, err := normalizeMetadata(input.Metadata)
	if err != nil {
		return org.Class{}, err
	}
	return s.repo.CreateClass(ctx, actor.ID, schoolID, org.ClassWrite{
		Code:     code,
		Name:     name,
		Status:   org.ClassStatusActive,
		Metadata: metadata,
	})
}

func (s *Service) UpdateClass(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	classID string,
	input UpdateClassInput,
) (org.Class, error) {
	schoolID = strings.TrimSpace(schoolID)
	classID = strings.TrimSpace(classID)
	if schoolID == "" || classID == "" {
		return org.Class{}, ErrInvalidInput
	}
	if err := s.requireClassManagement(ctx, actor, schoolID); err != nil {
		return org.Class{}, err
	}

	patch := org.ClassPatch{Status: input.Status}
	if input.Name != nil {
		name := strings.TrimSpace(*input.Name)
		if name == "" || len(name) > 160 {
			return org.Class{}, ErrInvalidInput
		}
		patch.Name = &name
	}
	if input.Status != nil {
		if !org.ValidClassStatus(*input.Status) || *input.Status == org.ClassStatusArchived {
			return org.Class{}, ErrInvalidInput
		}
	}
	if input.Metadata != nil {
		metadata, err := normalizeMetadata(*input.Metadata)
		if err != nil {
			return org.Class{}, err
		}
		patch.Metadata = &metadata
	}
	if patch.Name == nil && patch.Status == nil && patch.Metadata == nil {
		return org.Class{}, ErrInvalidInput
	}
	return s.repo.UpdateClass(ctx, actor.ID, schoolID, classID, patch)
}

func (s *Service) ArchiveClass(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	classID string,
) (org.Class, error) {
	schoolID = strings.TrimSpace(schoolID)
	classID = strings.TrimSpace(classID)
	if schoolID == "" || classID == "" {
		return org.Class{}, ErrInvalidInput
	}
	if err := s.requireClassManagement(ctx, actor, schoolID); err != nil {
		return org.Class{}, err
	}
	return s.repo.ArchiveClass(ctx, actor.ID, schoolID, classID)
}

func (s *Service) Roster(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	query org.RosterQuery,
) (org.RosterPage, error) {
	if !actor.HasRole(identity.RoleAdmin) &&
		!actor.HasRole(identity.RoleSupervisor) &&
		!actor.HasRole(identity.RoleTeacher) &&
		!actor.HasRole(identity.RoleSchoolAdmin) {
		return org.RosterPage{}, ErrForbidden
	}

	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.RosterPage{}, ErrInvalidInput
	}
	allowed, err := s.repo.CanAccessSchool(ctx, accessOf(actor), schoolID)
	if err != nil {
		return org.RosterPage{}, err
	}
	if !allowed {
		return org.RosterPage{}, ErrForbidden
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleSupervisor) {
		if query.Role != nil && *query.Role != identity.RoleStudent {
			return org.RosterPage{}, ErrForbidden
		}
		role := identity.RoleStudent
		query.Role = &role
	}
	if actor.HasRole(identity.RoleSchoolAdmin) && !actor.HasRole(identity.RoleAdmin) {
		permitted, err := s.repo.HasSchoolPermission(ctx, actor.ID, schoolID, permissionSchoolStudentsView)
		if err != nil {
			return org.RosterPage{}, err
		}
		if !permitted {
			return org.RosterPage{}, ErrForbidden
		}
		if query.Role != nil && *query.Role != identity.RoleStudent {
			return org.RosterPage{}, ErrForbidden
		}
		role := identity.RoleStudent
		query.Role = &role
	}

	query.Page = clampPage(query.Page)
	query.Limit = clampLimit(query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	query.ClassID = strings.TrimSpace(query.ClassID)
	if len(query.Search) > 120 {
		return org.RosterPage{}, ErrInvalidInput
	}
	if query.Role != nil && !identity.ValidRole(*query.Role) {
		return org.RosterPage{}, ErrInvalidInput
	}
	return s.repo.Roster(ctx, accessOf(actor), schoolID, query)
}

func (s *Service) requireSchoolManagement(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if !actor.HasRole(identity.RoleSupervisor) {
		return ErrForbidden
	}
	allowed, err := s.repo.CanManageSchool(ctx, actor.ID, schoolID)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func (s *Service) requireClassManagement(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if actor.HasRole(identity.RoleSupervisor) {
		allowed, err := s.repo.CanManageSchool(ctx, actor.ID, schoolID)
		if err != nil {
			return err
		}
		if allowed {
			return nil
		}
	}
	if actor.HasRole(identity.RoleSchoolAdmin) {
		allowed, err := s.repo.HasSchoolPermission(ctx, actor.ID, schoolID, permissionSchoolClassesManage)
		if err != nil {
			return err
		}
		if allowed {
			return nil
		}
	}
	return ErrForbidden
}

func canReadOrganizations(actor identity.User) bool {
	return actor.HasRole(identity.RoleAdmin) ||
		actor.HasRole(identity.RoleSupervisor) ||
		actor.HasRole(identity.RoleTeacher) ||
		actor.HasRole(identity.RoleSchoolAdmin)
}

func accessOf(actor identity.User) org.AccessContext {
	return org.AccessContext{
		ActorUserID: actor.ID,
		ActorRoles:  append([]identity.Role(nil), actor.Roles...),
	}
}

func normalizeSchoolQuery(query org.SchoolListQuery) org.SchoolListQuery {
	query.Page = clampPage(query.Page)
	query.Limit = clampLimit(query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	return query
}

func normalizeClassQuery(query org.ClassListQuery) org.ClassListQuery {
	query.Page = clampPage(query.Page)
	query.Limit = clampLimit(query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	if len(query.Search) > 120 {
		query.Search = query.Search[:120]
	}
	return query
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

func normalizeCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	if len(value) > 64 {
		return ""
	}
	return value
}

func randomCode(prefix string) (string, error) {
	buf := make([]byte, 6)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + "-" + strings.ToUpper(hex.EncodeToString(buf)), nil
}

func normalizeMetadata(raw json.RawMessage) (json.RawMessage, error) {
	raw = json.RawMessage(strings.TrimSpace(string(raw)))
	if len(raw) == 0 {
		return json.RawMessage(`{}`), nil
	}
	if len(raw) > maxMetadataBytes {
		return nil, ErrInvalidInput
	}
	var object map[string]any
	if err := json.Unmarshal(raw, &object); err != nil || object == nil {
		return nil, ErrInvalidInput
	}
	normalized, err := json.Marshal(object)
	if err != nil {
		return nil, err
	}
	return normalized, nil
}
