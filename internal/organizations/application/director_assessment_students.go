package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (s *Service) DirectorAssessmentEligibleStudents(ctx context.Context, actor identity.User, schoolID, search string, page, limit int) (org.DirectorAssessmentStudentPage, error) {
	search = strings.TrimSpace(search)
	if page < 1 || page > 10000 || limit < 1 || limit > 50 || len(search) > 120 {
		return org.DirectorAssessmentStudentPage{}, ErrInvalidInput
	}
	if err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments); err != nil {
		return org.DirectorAssessmentStudentPage{}, err
	}
	return s.repo.DirectorAssessmentEligibleStudents(ctx, actor.ID, strings.TrimSpace(schoolID), search, page, limit)
}
