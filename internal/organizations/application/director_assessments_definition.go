package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorAssessmentDefinition reads only a managed assessment in the actor's
// active school. PostgreSQL repeats the authorization check in the same query
// that reads the assessment, protecting against a revoked membership/module.
func (s *Service) DirectorAssessmentDefinition(ctx context.Context, actor identity.User, schoolID, assessmentID string) (org.DirectorAssessmentDefinition, error) {
	schoolID = strings.TrimSpace(schoolID)
	assessmentID = strings.TrimSpace(assessmentID)
	if !directorSchoolUUIDPattern.MatchString(schoolID) || !directorSchoolUUIDPattern.MatchString(assessmentID) {
		return org.DirectorAssessmentDefinition{}, ErrInvalidInput
	}
	if err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments); err != nil {
		return org.DirectorAssessmentDefinition{}, err
	}
	return s.repo.DirectorAssessmentDefinition(ctx, actor.ID, schoolID, assessmentID)
}
