package application

import (
	"context"
	"crypto/rand"
	"errors"
	"math/big"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type SelfQuizRepository interface {
	CreateSelfQuizSnapshot(context.Context, string, assessment.SelfQuizInput, []assessment.EligibleSelfQuizQuestion) (string, error)
	ResolveSelfQuizSkills(context.Context, []string) ([]assessment.SelfQuizSkillScope, error)
	ListSelfQuizCandidates(context.Context, assessment.SelfQuizInput) ([]assessment.EligibleSelfQuizQuestion, error)
	GetAttempt(context.Context, string) (assessment.Attempt, error)
}

type SelfQuizService struct{ repo SelfQuizRepository }

type selfQuizResumer interface {
	LatestSelfQuizAttempt(context.Context, string) (string, error)
}

type selfQuizSectionValidator interface {
	ValidateSelfQuizSection(context.Context, assessment.SelfQuizInput) error
}

func (s *SelfQuizService) Resume(ctx context.Context, actor identity.User) (assessment.Attempt, error) {
	if requireStudent(actor) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	repo, ok := s.repo.(selfQuizResumer)
	if !ok {
		return assessment.Attempt{}, ErrWorkflow
	}
	id, err := repo.LatestSelfQuizAttempt(ctx, actor.ID)
	if err != nil {
		return assessment.Attempt{}, err
	}
	return s.ownedAttempt(ctx, actor.ID, id)
}

func NewSelfQuizService(repo SelfQuizRepository) *SelfQuizService {
	return &SelfQuizService{repo: repo}
}

func (s *SelfQuizService) Start(ctx context.Context, actor identity.User, input assessment.SelfQuizInput) (assessment.Attempt, error) {
	if requireStudent(actor) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	in, err := assessment.NormalizeSelfQuizInput(input)
	if err != nil {
		return assessment.Attempt{}, err
	}
	// Probe the locked persistence boundary first so retries survive later
	// content or entitlement changes and never generate a different sample.
	id, err := s.repo.CreateSelfQuizSnapshot(ctx, actor.ID, in, nil)
	if err == nil {
		return s.ownedAttempt(ctx, actor.ID, id)
	}
	if !errors.Is(err, assessment.ErrNoSelfQuizQuestions) {
		return assessment.Attempt{}, err
	}
	if in.SectionID != "" {
		validator, ok := s.repo.(selfQuizSectionValidator)
		if !ok {
			return assessment.Attempt{}, assessment.ErrSelfQuizSectionUnsupported
		}
		if err = validator.ValidateSelfQuizSection(ctx, in); err != nil {
			return assessment.Attempt{}, err
		}
	}
	scopes, err := s.repo.ResolveSelfQuizSkills(ctx, in.SkillIDs)
	if err != nil {
		return assessment.Attempt{}, err
	}
	candidates, err := s.repo.ListSelfQuizCandidates(ctx, in)
	if err != nil {
		return assessment.Attempt{}, err
	}
	var randomErr error
	selected, err := assessment.SelectSelfQuizQuestions(in, scopes, candidates, in.SectionID != "", func(n int) int {
		if randomErr != nil {
			return 0
		}
		var v *big.Int
		v, randomErr = rand.Int(rand.Reader, big.NewInt(int64(n)))
		if randomErr != nil {
			return 0
		}
		return int(v.Int64())
	})
	if randomErr != nil {
		return assessment.Attempt{}, randomErr
	}
	if err != nil {
		return assessment.Attempt{}, err
	}
	id, err = s.repo.CreateSelfQuizSnapshot(ctx, actor.ID, in, selected)
	if err != nil {
		return assessment.Attempt{}, err
	}
	return s.ownedAttempt(ctx, actor.ID, id)
}

func (s *SelfQuizService) ownedAttempt(ctx context.Context, student, id string) (assessment.Attempt, error) {
	attempt, err := s.repo.GetAttempt(ctx, id)
	if err != nil {
		return assessment.Attempt{}, err
	}
	if attempt.StudentID != student {
		return assessment.Attempt{}, ErrForbidden
	}
	return attempt, nil
}
