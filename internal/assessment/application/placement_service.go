package application

import (
	"context"
	"strings"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type PlacementRepository interface {
	CreatePlacement(context.Context, string, string, assessment.PlacementWrite) (assessment.Placement, error)
	GetPlacement(context.Context, string) (assessment.Placement, error)
	ListPlacements(context.Context, string, int, int) (assessment.PlacementPage, error)
	PatchPlacement(context.Context, string, string, time.Time, bool, int) (assessment.Placement, error)
	ListLearnerPlacements(context.Context, string, assessment.LearnerPlacementQuery) (assessment.LearnerPlacementPage, error)
	StartPlacement(context.Context, string, string, string) (assessment.Attempt, error)
}

type PlacementContentResolver interface {
	ValidateAssessmentPlacementTarget(context.Context, string, string, string, string, string, string) (bool, error)
}

type PlacementService struct {
	repo        PlacementRepository
	definitions *Service
	content     PlacementContentResolver
}

func NewPlacementService(repo PlacementRepository, definitions *Service, content PlacementContentResolver) *PlacementService {
	return &PlacementService{repo: repo, definitions: definitions, content: content}
}

func normalizePlacementTarget(w *assessment.PlacementWrite) error {
	w.PathID = strings.TrimSpace(w.PathID)
	w.SubjectID = strings.TrimSpace(w.SubjectID)
	w.CourseID = strings.TrimSpace(w.CourseID)
	w.LessonID = strings.TrimSpace(w.LessonID)
	w.TopicID = strings.TrimSpace(w.TopicID)
	if !assessment.ValidPlacementSlot(w.Slot) || w.PathID == "" || w.SubjectID == "" || w.SortOrder < 0 {
		return ErrInvalidInput
	}
	switch w.Slot {
	case assessment.PlacementTraining, assessment.PlacementTests:
		if w.CourseID != "" || w.LessonID != "" || w.TopicID != "" {
			return ErrInvalidInput
		}
	case assessment.PlacementFoundation:
		if w.TopicID == "" || w.CourseID != "" || w.LessonID != "" {
			return ErrInvalidInput
		}
	case assessment.PlacementCourse:
		if w.CourseID == "" || w.TopicID != "" {
			return ErrInvalidInput
		}
	default:
		return ErrInvalidInput
	}
	return nil
}

func (s *PlacementService) validateContent(ctx context.Context, w assessment.PlacementWrite) error {
	if s.content == nil {
		return ErrForbidden
	}
	ok, err := s.content.ValidateAssessmentPlacementTarget(
		ctx,
		string(w.Slot),
		w.PathID,
		w.SubjectID,
		w.CourseID,
		w.LessonID,
		w.TopicID,
	)
	if err != nil {
		return err
	}
	if !ok {
		return assessment.ErrConflict
	}
	return nil
}

func (s *PlacementService) Create(ctx context.Context, actor identity.User, assessmentID string, w assessment.PlacementWrite) (assessment.Placement, error) {
	if s.definitions == nil {
		return assessment.Placement{}, ErrForbidden
	}
	assessmentID = strings.TrimSpace(assessmentID)
	if assessmentID == "" {
		return assessment.Placement{}, ErrInvalidInput
	}
	def, err := s.definitions.Get(ctx, actor, assessmentID)
	if err != nil {
		return assessment.Placement{}, err
	}
	if def.WorkflowStatus != assessment.WorkflowApproved || !def.IsPublished || def.PublishedVersion == nil {
		return assessment.Placement{}, ErrWorkflow
	}
	if err := normalizePlacementTarget(&w); err != nil {
		return assessment.Placement{}, err
	}
	if w.PathID != strings.TrimSpace(def.Version.PathID) || w.SubjectID != strings.TrimSpace(def.Version.SubjectID) {
		return assessment.Placement{}, assessment.ErrConflict
	}
	if err := s.validateContent(ctx, w); err != nil {
		return assessment.Placement{}, err
	}
	return s.repo.CreatePlacement(ctx, actor.ID, assessmentID, w)
}

func (s *PlacementService) List(ctx context.Context, actor identity.User, assessmentID string, page, limit int) (assessment.PlacementPage, error) {
	if s.definitions == nil {
		return assessment.PlacementPage{}, ErrForbidden
	}
	assessmentID = strings.TrimSpace(assessmentID)
	if assessmentID == "" {
		return assessment.PlacementPage{}, ErrInvalidInput
	}
	if _, err := s.definitions.Get(ctx, actor, assessmentID); err != nil {
		return assessment.PlacementPage{}, err
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return assessment.PlacementPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListPlacements(ctx, assessmentID, page, limit)
}

func (s *PlacementService) Patch(ctx context.Context, actor identity.User, placementID string, patch assessment.PlacementPatch) (assessment.Placement, error) {
	if s.definitions == nil {
		return assessment.Placement{}, ErrForbidden
	}
	placementID = strings.TrimSpace(placementID)
	if placementID == "" || patch.ExpectedUpdatedAt.IsZero() || patch.SortOrder < 0 {
		return assessment.Placement{}, ErrInvalidInput
	}
	current, err := s.repo.GetPlacement(ctx, placementID)
	if err != nil {
		return assessment.Placement{}, err
	}
	if _, err = s.definitions.Get(ctx, actor, current.AssessmentID); err != nil {
		return assessment.Placement{}, err
	}
	return s.repo.PatchPlacement(ctx, actor.ID, placementID, patch.ExpectedUpdatedAt, patch.IsVisible, patch.SortOrder)
}

func learnerPlacementWrite(q assessment.LearnerPlacementQuery) assessment.PlacementWrite {
	return assessment.PlacementWrite{
		Slot:      q.Slot,
		PathID:    q.PathID,
		SubjectID: q.SubjectID,
		CourseID:  q.CourseID,
		LessonID:  q.LessonID,
		TopicID:   q.TopicID,
		IsVisible: true,
	}
}

func (s *PlacementService) Learner(ctx context.Context, actor identity.User, q assessment.LearnerPlacementQuery) (assessment.LearnerPlacementPage, error) {
	if requireStudent(actor) != nil {
		return assessment.LearnerPlacementPage{}, ErrForbidden
	}
	q.PathID = strings.TrimSpace(q.PathID)
	q.SubjectID = strings.TrimSpace(q.SubjectID)
	q.CourseID = strings.TrimSpace(q.CourseID)
	q.LessonID = strings.TrimSpace(q.LessonID)
	q.TopicID = strings.TrimSpace(q.TopicID)
	if q.Page < 1 {
		q.Page = 1
	}
	if q.Page > 10000 {
		return assessment.LearnerPlacementPage{}, ErrInvalidInput
	}
	if q.Limit < 1 {
		q.Limit = 30
	}
	if q.Limit > 100 {
		q.Limit = 100
	}
	target := learnerPlacementWrite(q)
	if err := normalizePlacementTarget(&target); err != nil {
		return assessment.LearnerPlacementPage{}, err
	}
	if err := s.validateContent(ctx, target); err != nil {
		return assessment.LearnerPlacementPage{}, err
	}
	q.PathID, q.SubjectID, q.CourseID, q.LessonID, q.TopicID = target.PathID, target.SubjectID, target.CourseID, target.LessonID, target.TopicID
	return s.repo.ListLearnerPlacements(ctx, actor.ID, q)
}

func (s *PlacementService) Start(ctx context.Context, actor identity.User, placementID, startKey string) (assessment.Attempt, error) {
	if requireStudent(actor) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	placementID = strings.TrimSpace(placementID)
	startKey = key(startKey)
	if placementID == "" || startKey == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	placement, err := s.repo.GetPlacement(ctx, placementID)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if !placement.IsVisible {
		return assessment.Attempt{}, ErrForbidden
	}
	target := assessment.PlacementWrite{
		Slot: placement.Slot, PathID: placement.PathID, SubjectID: placement.SubjectID,
		CourseID: placement.CourseID, LessonID: placement.LessonID, TopicID: placement.TopicID, IsVisible: true,
	}
	if err = s.validateContent(ctx, target); err != nil {
		return assessment.Attempt{}, err
	}
	return s.repo.StartPlacement(ctx, actor.ID, placementID, startKey)
}
