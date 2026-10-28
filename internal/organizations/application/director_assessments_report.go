package application

import (
	"context"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorAssessmentReport never trusts the school context or role selected in
// the browser. A manager or aggregate-report director may read school totals;
// student-level evidence requires a separate stronger capability.
func (s *Service) DirectorAssessmentReport(ctx context.Context, actor identity.User, schoolID, assessmentID string) (org.DirectorAssessmentReport, error) {
	schoolID = strings.TrimSpace(schoolID)
	assessmentID = strings.TrimSpace(assessmentID)
	if !directorSchoolUUIDPattern.MatchString(schoolID) || !directorSchoolUUIDPattern.MatchString(assessmentID) {
		return org.DirectorAssessmentReport{}, ErrInvalidInput
	}
	err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments)
	if errors.Is(err, ErrForbidden) {
		err = s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolReportsAggregateView, org.ModuleSchoolAssessments)
	}
	if err != nil {
		return org.DirectorAssessmentReport{}, err
	}
	return s.repo.DirectorAssessmentReport(ctx, actor.ID, schoolID, assessmentID)
}
