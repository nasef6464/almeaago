package application

import (
	"context"
	"math"
	"sort"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorCreateAssessment never relies on a browser-supplied school role or
// ownership. The repository is responsible for transactional reference checks.
func (s *Service) DirectorCreateAssessment(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input org.DirectorAssessmentCreate,
) (org.DirectorAssessmentCreated, error) {
	input.Title = strings.TrimSpace(input.Title)
	input.PathID = strings.TrimSpace(input.PathID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	input.ClassID = strings.TrimSpace(input.ClassID)
	input.TargetScope = strings.TrimSpace(input.TargetScope)
	input.RequestKey = strings.TrimSpace(input.RequestKey)
	if input.TargetScope == "" {
		input.TargetScope = "class" // Older Node callers omit targetScope for a class.
	}
	if len(input.Title) < 2 || len(input.Title) > 240 ||
		!directorSchoolUUIDPattern.MatchString(input.PathID) ||
		!directorSchoolUUIDPattern.MatchString(input.SubjectID) ||
		!directorSchoolUUIDPattern.MatchString(input.RequestKey) ||
		(input.TargetScope != "school" && input.TargetScope != "class" && input.TargetScope != "classes" && input.TargetScope != "selected") ||
		(input.TargetScope == "class" && !directorSchoolUUIDPattern.MatchString(input.ClassID)) ||
		(input.TargetScope != "classes" && input.TargetScope != "selected" && len(input.ClassIDs) != 0) ||
		(input.TargetScope != "selected" && len(input.StudentIDs) != 0) ||
		((input.TargetScope == "classes" || input.TargetScope == "selected") && input.ClassID != "") ||
		(input.TargetScope == "classes" && (len(input.ClassIDs) < 2 || len(input.ClassIDs) > 50)) ||
		(input.TargetScope == "selected" && (len(input.ClassIDs) > 50 || len(input.StudentIDs) > 200 || (len(input.ClassIDs) == 0 && len(input.StudentIDs) == 0))) ||
		len(input.QuestionIDs) == 0 || len(input.QuestionIDs) > 500 {
		return org.DirectorAssessmentCreated{}, ErrInvalidInput
	}
	if input.TargetScope == "school" {
		input.ClassID = ""
	}
	if input.TargetScope == "classes" || input.TargetScope == "selected" {
		unique := make(map[string]struct{}, len(input.ClassIDs))
		for _, raw := range input.ClassIDs {
			id := strings.TrimSpace(raw)
			if !directorSchoolUUIDPattern.MatchString(id) {
				return org.DirectorAssessmentCreated{}, ErrInvalidInput
			}
			unique[id] = struct{}{}
		}
		if input.TargetScope == "classes" && len(unique) < 2 {
			return org.DirectorAssessmentCreated{}, ErrInvalidInput
		}
		input.ClassIDs = make([]string, 0, len(unique))
		for id := range unique {
			input.ClassIDs = append(input.ClassIDs, id)
		}
		sort.Strings(input.ClassIDs)
	}
	if input.TargetScope == "selected" {
		unique := make(map[string]struct{}, len(input.StudentIDs))
		for _, raw := range input.StudentIDs {
			id := strings.TrimSpace(raw)
			if !directorSchoolUUIDPattern.MatchString(id) {
				return org.DirectorAssessmentCreated{}, ErrInvalidInput
			}
			unique[id] = struct{}{}
		}
		input.StudentIDs = make([]string, 0, len(unique))
		for id := range unique {
			input.StudentIDs = append(input.StudentIDs, id)
		}
		sort.Strings(input.StudentIDs)
		if len(input.StudentIDs) == 0 && len(input.ClassIDs) == 0 {
			return org.DirectorAssessmentCreated{}, ErrInvalidInput
		}
	}
	if settings := input.Settings; settings != nil {
		if (settings.MaxAttempts != nil && (*settings.MaxAttempts < 1 || *settings.MaxAttempts > 100)) ||
			(settings.PassingScore != nil && (math.IsNaN(*settings.PassingScore) || math.IsInf(*settings.PassingScore, 0) || *settings.PassingScore < 0 || *settings.PassingScore > 100)) ||
			(settings.TimeLimitMinutes != nil && (*settings.TimeLimitMinutes < 0 || *settings.TimeLimitMinutes > 1440)) ||
			(settings.OptionLayout != nil && *settings.OptionLayout != "auto" && *settings.OptionLayout != "horizontal" && *settings.OptionLayout != "two_columns") {
			return org.DirectorAssessmentCreated{}, ErrInvalidInput
		}
	}
	seen := make(map[string]bool, len(input.QuestionIDs))
	questions := make([]string, 0, len(input.QuestionIDs))
	for _, questionID := range input.QuestionIDs {
		id := strings.TrimSpace(questionID)
		if !directorSchoolUUIDPattern.MatchString(id) {
			return org.DirectorAssessmentCreated{}, ErrInvalidInput
		}
		if !seen[id] {
			seen[id] = true
			questions = append(questions, id)
		}
	}
	input.QuestionIDs = questions
	if err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments); err != nil {
		return org.DirectorAssessmentCreated{}, err
	}
	return s.repo.DirectorCreateAssessment(ctx, actor.ID, strings.TrimSpace(schoolID), input)
}

// Do not widen the staff question-bank endpoint to the school_admin role.
func (s *Service) DirectorAssessmentQuestions(
	ctx context.Context, actor identity.User, schoolID, pathID, subjectID, search string, page, limit int,
) (org.DirectorAssessmentQuestionPage, error) {
	if !directorSchoolUUIDPattern.MatchString(strings.TrimSpace(pathID)) ||
		!directorSchoolUUIDPattern.MatchString(strings.TrimSpace(subjectID)) ||
		page < 1 || page > 10000 || limit < 1 || limit > 50 || len(search) > 120 {
		return org.DirectorAssessmentQuestionPage{}, ErrInvalidInput
	}
	if err := s.requireDirectorCapability(ctx, actor, schoolID, org.PermissionSchoolAssessmentsManage, org.ModuleSchoolAssessments); err != nil {
		return org.DirectorAssessmentQuestionPage{}, err
	}
	return s.repo.DirectorAssessmentQuestions(ctx, actor.ID, strings.TrimSpace(schoolID), strings.TrimSpace(pathID), strings.TrimSpace(subjectID), strings.TrimSpace(search), page, limit)
}
