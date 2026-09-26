package application

import (
	"context"
	"fmt"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type InterventionRepository interface {
	InterventionEvidenceSnapshot(context.Context, string, string, string, string, *time.Time) (learning.InterventionEvidence, error)
	CreateSchoolIntervention(context.Context, string, learning.InterventionCreate, learning.StudyPlanWrite, []learning.StudyPlanItemSeed, learning.InterventionEvidence) (learning.SchoolIntervention, error)
	ListSchoolInterventions(context.Context, string, string, learning.InterventionStatus, int, int) (learning.InterventionPage, error)
	GetSchoolIntervention(context.Context, string) (learning.SchoolIntervention, error)
	PatchSchoolIntervention(context.Context, string, string, learning.InterventionPatch) (learning.SchoolIntervention, error)
	MeasureSchoolIntervention(context.Context, string, string, time.Time, learning.InterventionEvidence) (learning.SchoolIntervention, error)
	ListStudentInterventions(context.Context, string, learning.InterventionStatus, int, int) (learning.InterventionPage, error)
}

type InterventionOrganizationResolver interface {
	CanManageLearningIntervention(context.Context, string, string, string) (bool, error)
	CanViewLearningInterventions(context.Context, string, string, string) (bool, error)
	ValidateLearningInterventionStudent(context.Context, string, string, string) (bool, error)
}

type InterventionTaxonomyResolver interface {
	ValidateLearningInterventionSkill(context.Context, string, string, string) (bool, error)
}

type InterventionService struct {
	repo      InterventionRepository
	org       InterventionOrganizationResolver
	taxonomy  InterventionTaxonomyResolver
	studyPlan *StudyPlanService
}

func NewInterventionService(repo InterventionRepository, org InterventionOrganizationResolver, taxonomy InterventionTaxonomyResolver, studyPlan *StudyPlanService) *InterventionService {
	return &InterventionService{repo: repo, org: org, taxonomy: taxonomy, studyPlan: studyPlan}
}

func normalizeInterventionCreate(input learning.InterventionCreate) (learning.InterventionCreate, error) {
	input.SchoolID = strings.TrimSpace(input.SchoolID)
	input.ClassID = strings.TrimSpace(input.ClassID)
	input.StudentID = strings.TrimSpace(input.StudentID)
	input.PathID = strings.TrimSpace(input.PathID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	input.SkillID = strings.TrimSpace(input.SkillID)
	if input.SchoolID == "" || input.ClassID == "" || input.StudentID == "" || input.PathID == "" || input.SubjectID == "" || input.SkillID == "" {
		return input, ErrInvalidInput
	}
	if input.MinimumEvidence == 0 {
		input.MinimumEvidence = 3
	}
	if input.MinimumEvidence < 1 || input.MinimumEvidence > 100 {
		return input, ErrInvalidInput
	}
	if input.RemediationThreshold != nil && (*input.RemediationThreshold < 0 || *input.RemediationThreshold > 100) {
		return input, ErrInvalidInput
	}
	return input, nil
}

func (s *InterventionService) authorize(ctx context.Context, actor identity.User, schoolID, classID string, manage bool) error {
	if strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if s.org == nil {
		return ErrForbidden
	}
	var allowed bool
	var err error
	if manage {
		allowed, err = s.org.CanManageLearningIntervention(ctx, actor.ID, schoolID, classID)
	} else {
		allowed, err = s.org.CanViewLearningInterventions(ctx, actor.ID, schoolID, classID)
	}
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func (s *InterventionService) Create(ctx context.Context, actor identity.User, input learning.InterventionCreate) (learning.SchoolIntervention, error) {
	var err error
	input, err = normalizeInterventionCreate(input)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if err = s.authorize(ctx, actor, input.SchoolID, input.ClassID, true); err != nil {
		return learning.SchoolIntervention{}, err
	}
	if s.org == nil || s.taxonomy == nil || s.studyPlan == nil {
		return learning.SchoolIntervention{}, ErrForbidden
	}
	ok, err := s.org.ValidateLearningInterventionStudent(ctx, input.SchoolID, input.ClassID, input.StudentID)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if !ok {
		return learning.SchoolIntervention{}, ErrForbidden
	}
	ok, err = s.taxonomy.ValidateLearningInterventionSkill(ctx, input.PathID, input.SubjectID, input.SkillID)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if !ok {
		return learning.SchoolIntervention{}, ErrInvalidInput
	}

	now := time.Now().UTC()
	end := now.AddDate(0, 0, 13)
	write := learning.StudyPlanWrite{
		Name:                     fmt.Sprintf("خطة علاج مهارة %s", input.SkillID),
		PathID:                   input.PathID,
		SubjectIDs:               []string{input.SubjectID},
		StartDate:                now.Format("2006-01-02"),
		EndDate:                  end.Format("2006-01-02"),
		SkipCompletedAssessments: true,
		OffDays:                  []learning.StudyPlanWeekday{},
		DailyMinutes:             30,
		PreferredStartTime:       "17:00",
		Status:                   learning.StudyPlanActive,
	}
	write, err = normalizeStudyPlanWrite(write)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if err = s.studyPlan.validatePlanScope(ctx, write); err != nil {
		return learning.SchoolIntervention{}, err
	}
	items, err := s.studyPlan.generateItems(ctx, input.StudentID, write)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	baseline, err := s.repo.InterventionEvidenceSnapshot(ctx, input.StudentID, input.PathID, input.SubjectID, input.SkillID, nil)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	return s.repo.CreateSchoolIntervention(ctx, actor.ID, input, write, items, baseline)
}

func (s *InterventionService) List(ctx context.Context, actor identity.User, schoolID, classID string, status learning.InterventionStatus, page, limit int) (learning.InterventionPage, error) {
	schoolID = strings.TrimSpace(schoolID)
	classID = strings.TrimSpace(classID)
	if schoolID == "" {
		return learning.InterventionPage{}, ErrInvalidInput
	}
	if actor.HasRole(identity.RoleSupervisor) && !actor.HasRole(identity.RoleAdmin) && classID == "" {
		return learning.InterventionPage{}, ErrInvalidInput
	}
	if status == "" {
		status = learning.InterventionActive
	}
	if !learning.ValidInterventionStatus(status) {
		return learning.InterventionPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.InterventionPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	if err := s.authorize(ctx, actor, schoolID, classID, false); err != nil {
		return learning.InterventionPage{}, err
	}
	return s.repo.ListSchoolInterventions(ctx, schoolID, classID, status, page, limit)
}

func (s *InterventionService) Patch(ctx context.Context, actor identity.User, id string, patch learning.InterventionPatch) (learning.SchoolIntervention, error) {
	id = strings.TrimSpace(id)
	if id == "" || patch.ExpectedUpdatedAt.IsZero() || !learning.ValidInterventionStatus(patch.Status) {
		return learning.SchoolIntervention{}, ErrInvalidInput
	}
	if patch.MinimumEvidence < 1 || patch.MinimumEvidence > 100 {
		return learning.SchoolIntervention{}, ErrInvalidInput
	}
	if patch.RemediationThreshold != nil && (*patch.RemediationThreshold < 0 || *patch.RemediationThreshold > 100) {
		return learning.SchoolIntervention{}, ErrInvalidInput
	}
	current, err := s.repo.GetSchoolIntervention(ctx, id)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if err = s.authorize(ctx, actor, current.SchoolID, current.ClassID, true); err != nil {
		return learning.SchoolIntervention{}, err
	}
	return s.repo.PatchSchoolIntervention(ctx, actor.ID, id, patch)
}

func (s *InterventionService) Measure(ctx context.Context, actor identity.User, id string, expectedUpdatedAt time.Time) (learning.InterventionOutcome, error) {
	id = strings.TrimSpace(id)
	if id == "" || expectedUpdatedAt.IsZero() {
		return learning.InterventionOutcome{}, ErrInvalidInput
	}
	current, err := s.repo.GetSchoolIntervention(ctx, id)
	if err != nil {
		return learning.InterventionOutcome{}, err
	}
	if err = s.authorize(ctx, actor, current.SchoolID, current.ClassID, true); err != nil {
		return learning.InterventionOutcome{}, err
	}
	since := current.CreatedAt
	snapshot, err := s.repo.InterventionEvidenceSnapshot(ctx, current.StudentID, current.PathID, current.SubjectID, current.SkillID, &since)
	if err != nil {
		return learning.InterventionOutcome{}, err
	}
	measured, err := s.repo.MeasureSchoolIntervention(ctx, actor.ID, id, expectedUpdatedAt, snapshot)
	if err != nil {
		return learning.InterventionOutcome{}, err
	}
	out := learning.InterventionOutcome{Intervention: measured, Confidence: "insufficient"}
	if snapshot.EvidenceCount >= measured.MinimumEvidence && snapshot.Accuracy != nil && measured.Baseline.Accuracy != nil {
		out.Confidence = "measured"
		delta := *snapshot.Accuracy - *measured.Baseline.Accuracy
		out.Delta = &delta
		if measured.RemediationThreshold != nil {
			ok := *snapshot.Accuracy >= *measured.RemediationThreshold
			out.ThresholdMet = &ok
		}
	}
	return out, nil
}

func (s *InterventionService) Mine(ctx context.Context, actor identity.User, status learning.InterventionStatus, page, limit int) (learning.InterventionPage, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
		return learning.InterventionPage{}, ErrForbidden
	}
	if status == "" {
		status = learning.InterventionActive
	}
	if !learning.ValidInterventionStatus(status) {
		return learning.InterventionPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return s.repo.ListStudentInterventions(ctx, actor.ID, status, page, limit)
}
