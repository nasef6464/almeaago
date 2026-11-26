package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (s *Service) SupervisorMoveStudent(ctx context.Context, actor identity.User, schoolID, studentID string, move org.SupervisorClassMove) (bool, error) {
	if !actor.HasRole(identity.RoleSupervisor) {
		return false, ErrForbidden
	}
	for _, id := range []string{schoolID, studentID, move.FromClassID, move.ClassID} {
		if !directorSchoolUUIDPattern.MatchString(id) {
			return false, ErrInvalidInput
		}
	}
	if strings.EqualFold(move.FromClassID, move.ClassID) {
		return false, ErrInvalidInput
	}
	return s.repo.SupervisorMoveStudent(ctx, actor.ID, schoolID, studentID, move)
}
