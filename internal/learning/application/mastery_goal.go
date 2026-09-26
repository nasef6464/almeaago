package application

import (
	"context"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type MasteryGoalRepository interface {
	CreateMasteryGoal(context.Context, string, learning.MasteryGoalWrite) (learning.MasteryGoal, error)
	ListMasteryGoals(context.Context, string, string, string, learning.GoalStatus, int, int) (learning.MasteryGoalPage, error)
	UpdateMasteryGoal(context.Context, string, string, learning.MasteryGoalPatch) (learning.MasteryGoal, error)
}

type MasteryGoalTaxonomyResolver interface {
	ValidateMasteryGoalScope(context.Context, string, string) (bool, error)
}

type MasteryGoalService struct {
	repo     MasteryGoalRepository
	taxonomy MasteryGoalTaxonomyResolver
}

func NewMasteryGoalService(repo MasteryGoalRepository, taxonomy MasteryGoalTaxonomyResolver) *MasteryGoalService {
	return &MasteryGoalService{repo: repo, taxonomy: taxonomy}
}

func normalizeGoalDate(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", nil
	}
	if _, err := time.Parse("2006-01-02", value); err != nil {
		return "", ErrInvalidInput
	}
	return value, nil
}

func (s *MasteryGoalService) validateScope(ctx context.Context, pathID, subjectID string) error {
	if s.taxonomy == nil {
		return ErrForbidden
	}
	ok, err := s.taxonomy.ValidateMasteryGoalScope(ctx, pathID, subjectID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidInput
	}
	return nil
}

func (s *MasteryGoalService) Create(
	ctx context.Context,
	actor identity.User,
	write learning.MasteryGoalWrite,
) (learning.MasteryGoal, error) {
	if requireStudent(actor) != nil {
		return learning.MasteryGoal{}, ErrForbidden
	}
	write.PathID = strings.TrimSpace(write.PathID)
	write.SubjectID = strings.TrimSpace(write.SubjectID)
	write.TargetID = strings.TrimSpace(write.TargetID)
	write.Title = strings.TrimSpace(write.Title)
	if write.PathID == "" || write.TargetID == "" || write.Title == "" || len(write.Title) > 160 {
		return learning.MasteryGoal{}, ErrInvalidInput
	}
	if write.TargetMastery == 0 {
		write.TargetMastery = 90
	}
	if write.TargetMastery < 50 || write.TargetMastery > 100 {
		return learning.MasteryGoal{}, ErrInvalidInput
	}
	if write.Horizon == "" {
		write.Horizon = learning.GoalHorizonShort
	}
	if !learning.ValidGoalHorizon(write.Horizon) || !learning.ValidGoalTargetType(write.TargetType) {
		return learning.MasteryGoal{}, ErrInvalidInput
	}

	// The verified legacy UI creates section or path targets, but the normalized
	// platform no longer has a canonical Section identity. Fail closed until that
	// mapping is explicitly owned by Taxonomy instead of storing an unchecked ID.
	if write.TargetType != learning.GoalTargetPath || write.TargetID != write.PathID {
		return learning.MasteryGoal{}, ErrInvalidInput
	}
	var err error
	write.DueDate, err = normalizeGoalDate(write.DueDate)
	if err != nil {
		return learning.MasteryGoal{}, err
	}
	if err = s.validateScope(ctx, write.PathID, write.SubjectID); err != nil {
		return learning.MasteryGoal{}, err
	}
	return s.repo.CreateMasteryGoal(ctx, actor.ID, write)
}

func (s *MasteryGoalService) List(
	ctx context.Context,
	actor identity.User,
	pathID, subjectID string,
	status learning.GoalStatus,
	page, limit int,
) (learning.MasteryGoalPage, error) {
	if requireStudent(actor) != nil {
		return learning.MasteryGoalPage{}, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if pathID == "" {
		return learning.MasteryGoalPage{}, ErrInvalidInput
	}
	if status == "" {
		status = learning.GoalStatusActive
	}
	if !learning.ValidGoalStatus(status) {
		return learning.MasteryGoalPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.MasteryGoalPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if err := s.validateScope(ctx, pathID, subjectID); err != nil {
		return learning.MasteryGoalPage{}, err
	}
	return s.repo.ListMasteryGoals(ctx, actor.ID, pathID, subjectID, status, page, limit)
}

func (s *MasteryGoalService) Update(
	ctx context.Context,
	actor identity.User,
	goalID string,
	patch learning.MasteryGoalPatch,
) (learning.MasteryGoal, error) {
	if requireStudent(actor) != nil {
		return learning.MasteryGoal{}, ErrForbidden
	}
	goalID = strings.TrimSpace(goalID)
	if goalID == "" || patch.ExpectedUpdatedAt.IsZero() {
		return learning.MasteryGoal{}, ErrInvalidInput
	}
	changed := false
	if patch.Title != nil {
		value := strings.TrimSpace(*patch.Title)
		if value == "" || len(value) > 160 {
			return learning.MasteryGoal{}, ErrInvalidInput
		}
		patch.Title = &value
		changed = true
	}
	if patch.TargetMastery != nil {
		if *patch.TargetMastery < 50 || *patch.TargetMastery > 100 {
			return learning.MasteryGoal{}, ErrInvalidInput
		}
		changed = true
	}
	if patch.DueDate != nil {
		value, err := normalizeGoalDate(*patch.DueDate)
		if err != nil {
			return learning.MasteryGoal{}, err
		}
		patch.DueDate = &value
		changed = true
	}
	if patch.Status != nil {
		if !learning.ValidGoalStatus(*patch.Status) {
			return learning.MasteryGoal{}, ErrInvalidInput
		}
		changed = true
	}
	if !changed {
		return learning.MasteryGoal{}, ErrInvalidInput
	}
	return s.repo.UpdateMasteryGoal(ctx, actor.ID, goalID, patch)
}
