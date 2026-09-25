package application

import (
	"context"
	"net/mail"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type DirectorDirectory interface {
	ListDirectorStudents(
		ctx context.Context,
		schoolID string,
		query org.DirectorStudentQuery,
	) (org.DirectorStudentPage, error)
	DirectorTeachers(
		ctx context.Context,
		schoolID string,
	) (org.DirectorTeacherWorkspace, error)
}

func (s *Service) DirectorStudents(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	query org.DirectorStudentQuery,
) (org.DirectorStudentPage, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.DirectorStudentPage{}, ErrInvalidInput
	}
	if err := s.requireDirectorPermission(ctx, actor, schoolID, org.PermissionSchoolStudentsView); err != nil {
		return org.DirectorStudentPage{}, err
	}
	if s.directorDirectory == nil {
		return org.DirectorStudentPage{}, ErrForbidden
	}

	query.Page = clampPage(query.Page)
	query.Limit = clampDirectorStudentLimit(query.Limit)
	query.Search = strings.TrimSpace(query.Search)
	if len(query.Search) > 120 {
		return org.DirectorStudentPage{}, ErrInvalidInput
	}
	return s.directorDirectory.ListDirectorStudents(ctx, schoolID, query)
}

func (s *Service) DirectorAddStudent(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input org.DirectorStudentCreate,
) (org.DirectorStudentMutationResult, error) {
	schoolID = strings.TrimSpace(schoolID)
	input.Name = strings.TrimSpace(input.Name)
	input.Email = strings.ToLower(strings.TrimSpace(input.Email))
	input.ClassID = strings.TrimSpace(input.ClassID)

	if schoolID == "" ||
		len(input.Name) < 2 ||
		len(input.Name) > 120 ||
		!validDirectorEmail(input.Email) ||
		!validDirectorPassword(input.Password) ||
		input.ClassID == "" {
		return org.DirectorStudentMutationResult{}, ErrInvalidInput
	}
	if err := s.requireDirectorPermission(ctx, actor, schoolID, org.PermissionSchoolStudentsAdd); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return s.repo.DirectorAddStudent(ctx, actor.ID, schoolID, input)
}

func (s *Service) DirectorMoveStudent(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	studentID string,
	classID string,
) (org.DirectorStudentMutationResult, error) {
	schoolID = strings.TrimSpace(schoolID)
	studentID = strings.TrimSpace(studentID)
	classID = strings.TrimSpace(classID)
	if schoolID == "" || studentID == "" || classID == "" {
		return org.DirectorStudentMutationResult{}, ErrInvalidInput
	}
	if err := s.requireDirectorPermission(ctx, actor, schoolID, org.PermissionSchoolStudentsMoveClass); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return s.repo.DirectorMoveStudent(ctx, actor.ID, schoolID, studentID, classID)
}

func (s *Service) DirectorUpdateStudentBasic(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	studentID string,
	patch org.DirectorStudentBasicPatch,
) (org.DirectorStudentMutationResult, error) {
	schoolID = strings.TrimSpace(schoolID)
	studentID = strings.TrimSpace(studentID)
	if schoolID == "" || studentID == "" || (patch.Name == nil && patch.Phone == nil) {
		return org.DirectorStudentMutationResult{}, ErrInvalidInput
	}
	if patch.Name != nil {
		value := strings.TrimSpace(*patch.Name)
		if len(value) < 2 || len(value) > 120 {
			return org.DirectorStudentMutationResult{}, ErrInvalidInput
		}
		patch.Name = &value
	}
	if patch.Phone != nil {
		value := strings.TrimSpace(*patch.Phone)
		if len(value) > 40 {
			return org.DirectorStudentMutationResult{}, ErrInvalidInput
		}
		patch.Phone = &value
	}
	if err := s.requireDirectorCapability(
		ctx,
		actor,
		schoolID,
		org.PermissionSchoolStudentsUpdateBasic,
		org.SchoolModuleCore,
	); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return s.repo.DirectorUpdateStudentBasic(ctx, actor.ID, schoolID, studentID, patch)
}

func (s *Service) DirectorSetStudentActive(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	studentID string,
	active bool,
) (org.DirectorStudentMutationResult, error) {
	schoolID = strings.TrimSpace(schoolID)
	studentID = strings.TrimSpace(studentID)
	if schoolID == "" || studentID == "" {
		return org.DirectorStudentMutationResult{}, ErrInvalidInput
	}
	if err := s.requireDirectorCapability(
		ctx,
		actor,
		schoolID,
		org.PermissionSchoolStudentsDeactivate,
		org.SchoolModuleCore,
	); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return s.repo.DirectorSetStudentActive(ctx, actor.ID, schoolID, studentID, active)
}

func (s *Service) DirectorTeachers(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (org.DirectorTeacherWorkspace, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.DirectorTeacherWorkspace{}, ErrInvalidInput
	}
	if err := s.requireDirectorCapability(
		ctx,
		actor,
		schoolID,
		org.PermissionSchoolTeachersAssign,
		org.SchoolModuleCore,
	); err != nil {
		return org.DirectorTeacherWorkspace{}, err
	}
	if s.directorDirectory == nil {
		return org.DirectorTeacherWorkspace{}, ErrForbidden
	}
	return s.directorDirectory.DirectorTeachers(ctx, schoolID)
}

func (s *Service) DirectorOverviewAccess(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) error {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return ErrInvalidInput
	}
	return s.requireDirectorPermission(ctx, actor, schoolID, org.PermissionSchoolOverviewView)
}

func (s *Service) requireDirectorCapability(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	permission string,
	module org.SchoolModule,
) error {
	if err := s.requireDirectorPermission(ctx, actor, schoolID, permission); err != nil {
		return err
	}
	return s.requireSchoolModule(ctx, schoolID, module)
}

func (s *Service) requireDirectorPermission(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	permission string,
) error {
	if !actor.HasRole(identity.RoleSchoolAdmin) {
		return ErrForbidden
	}
	allowed, err := s.repo.HasSchoolPermission(ctx, actor.ID, schoolID, permission)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func validDirectorEmail(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && strings.EqualFold(address.Address, value)
}

func validDirectorPassword(value string) bool {
	if len(value) < 8 || len(value) > 160 {
		return false
	}
	hasLetter := false
	hasDigit := false
	for _, r := range value {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') {
			hasLetter = true
		}
		if r >= '0' && r <= '9' {
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}

func clampDirectorStudentLimit(limit int) int {
	if limit < 1 {
		return 100
	}
	if limit > 500 {
		return 500
	}
	return limit
}
