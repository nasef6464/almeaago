package application

import (
	"context"
	"strings"
	"unicode/utf8"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (s *Service) requireSchoolAssessmentDetailedAccess(ctx context.Context, actor identity.User, schoolID string) error {
	if err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolReportsDetailedView, org.ModuleSchoolIntelligence); err != nil {
		return err
	}
	return s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolReportsDetailedView, org.ModuleSchoolAssessments)
}

func (s *Service) DirectorAssessmentLearners(ctx context.Context, actor identity.User, schoolID, assessmentID string, query org.DirectorAssessmentLearnerQuery) (org.DirectorAssessmentLearnerPage, error) {
	schoolID = strings.TrimSpace(schoolID)
	assessmentID = strings.TrimSpace(assessmentID)
	query.Search = strings.TrimSpace(query.Search)
	if !directorSchoolUUIDPattern.MatchString(schoolID) || !directorSchoolUUIDPattern.MatchString(assessmentID) || utf8.RuneCountInString(query.Search) > 120 ||
		query.Page < 0 || query.Page > 100000 || query.Limit < 0 || query.Limit > 100 {
		return org.DirectorAssessmentLearnerPage{}, ErrInvalidInput
	}
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Limit == 0 {
		query.Limit = 12
	}
	if query.Status == "" {
		query.Status = "all"
	}
	switch query.Status {
	case "all", "completed", "not_completed", "needs_support":
	default:
		return org.DirectorAssessmentLearnerPage{}, ErrInvalidInput
	}
	if err := s.requireSchoolAssessmentDetailedAccess(ctx, actor, schoolID); err != nil {
		return org.DirectorAssessmentLearnerPage{}, err
	}
	return s.repo.DirectorAssessmentLearners(ctx, actor.ID, schoolID, assessmentID, query)
}

func (s *Service) DirectorAssessmentLearnerResult(ctx context.Context, actor identity.User, schoolID, assessmentID, attemptID string) (org.DirectorAssessmentLearnerResult, error) {
	schoolID = strings.TrimSpace(schoolID)
	assessmentID = strings.TrimSpace(assessmentID)
	attemptID = strings.TrimSpace(attemptID)
	if !directorSchoolUUIDPattern.MatchString(schoolID) || !directorSchoolUUIDPattern.MatchString(assessmentID) || !directorSchoolUUIDPattern.MatchString(attemptID) {
		return org.DirectorAssessmentLearnerResult{}, ErrInvalidInput
	}
	if err := s.requireSchoolAssessmentDetailedAccess(ctx, actor, schoolID); err != nil {
		return org.DirectorAssessmentLearnerResult{}, err
	}
	return s.repo.DirectorAssessmentLearnerResult(ctx, actor.ID, schoolID, assessmentID, attemptID)
}
