package application

import (
	"context"
	"errors"
	"strconv"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var (
	ErrInvalidInput = errors.New("invalid learning request")
	ErrForbidden    = errors.New("learning operation forbidden")
	ErrNotFound     = learning.ErrNotFound
)

type Repository interface {
	ApplyAssessmentEvidence(context.Context, learning.SubmissionEvidence) (learning.ApplyResult, error)
	ListSkillProgress(context.Context, string, string, string, int, int) (learning.SkillProgressPage, error)
	WeakestSkillProgress(context.Context, string, string, string) (*learning.SkillProgress, error)
	ListReviewCards(context.Context, string, learning.ReviewTab, string, string, int, int) ([]learning.ReviewCard, bool, error)
	SetSavedReview(context.Context, string, string, bool) error
}

type ReviewQuestionReader interface {
	ReviewBatch(context.Context, []question.ReviewRef) ([]question.ReviewProjection, error)
}

type Service struct {
	repo      Repository
	questions ReviewQuestionReader
}

func NewService(repo Repository, questions ReviewQuestionReader) *Service {
	return &Service{repo: repo, questions: questions}
}

func requireStudent(actor identity.User) error {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
		return ErrForbidden
	}
	return nil
}

func (s *Service) ApplyAssessmentSubmission(ctx context.Context, event learning.SubmissionEvidence) error {
	if strings.TrimSpace(event.StudentID) == "" || strings.TrimSpace(event.AttemptID) == "" ||
		strings.TrimSpace(event.AssessmentID) == "" || event.AssessmentVersion < 1 ||
		strings.TrimSpace(event.PathID) == "" || strings.TrimSpace(event.SubjectID) == "" ||
		event.OccurredAt.IsZero() || len(event.Questions) == 0 || len(event.Questions) > 500 {
		return ErrInvalidInput
	}
	for _, item := range event.Questions {
		if strings.TrimSpace(item.QuestionID) == "" || item.QuestionVersion < 1 || len(item.SkillIDs) > 20 {
			return ErrInvalidInput
		}
	}
	_, err := s.repo.ApplyAssessmentEvidence(ctx, event)
	return err
}

func (s *Service) Progress(ctx context.Context, actor identity.User, pathID, subjectID string, page, limit int) (learning.SkillProgressPage, error) {
	if requireStudent(actor) != nil {
		return learning.SkillProgressPage{}, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if pathID == "" {
		return learning.SkillProgressPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.SkillProgressPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListSkillProgress(ctx, actor.ID, pathID, subjectID, page, limit)
}

func (s *Service) NextAction(ctx context.Context, actor identity.User, pathID, subjectID string) (*learning.SkillProgress, error) {
	if requireStudent(actor) != nil {
		return nil, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if pathID == "" {
		return nil, ErrInvalidInput
	}
	return s.repo.WeakestSkillProgress(ctx, actor.ID, pathID, subjectID)
}

func (s *Service) ReviewLibrary(ctx context.Context, actor identity.User, tab learning.ReviewTab, pathID, subjectID string, page, limit int) (learning.ReviewPage, error) {
	if requireStudent(actor) != nil {
		return learning.ReviewPage{}, ErrForbidden
	}
	if !learning.ValidReviewTab(tab) {
		tab = learning.ReviewAll
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if pathID == "" {
		return learning.ReviewPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.ReviewPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	cards, more, err := s.repo.ListReviewCards(ctx, actor.ID, tab, pathID, subjectID, page, limit)
	if err != nil {
		return learning.ReviewPage{}, err
	}
	if len(cards) == 0 {
		return learning.ReviewPage{Items: []learning.ReviewItem{}, Page: page, Limit: limit, HasMore: more}, nil
	}
	if s.questions == nil {
		return learning.ReviewPage{}, errors.New("review question reader is not configured")
	}
	refs := make([]question.ReviewRef, 0, len(cards))
	for _, card := range cards {
		refs = append(refs, question.ReviewRef{QuestionID: card.QuestionID, Version: card.QuestionVersion})
	}
	projections, err := s.questions.ReviewBatch(ctx, refs)
	if err != nil {
		return learning.ReviewPage{}, err
	}
	byKey := make(map[string]question.ReviewProjection, len(projections))
	for _, projection := range projections {
		byKey[projection.ID+":"+strconv.Itoa(projection.Version)] = projection
	}
	items := make([]learning.ReviewItem, 0, len(cards))
	for _, card := range cards {
		projection, ok := byKey[card.QuestionID+":"+strconv.Itoa(card.QuestionVersion)]
		if !ok {
			continue
		}
		reviewQuestion := learning.ReviewQuestion{
			ID: projection.ID, Version: projection.Version, Type: string(projection.QuestionType),
			Text: projection.TextContent, ImageAssetID: projection.ImageAssetID, ImageAlt: projection.ImageAlt,
			OptionsEmbeddedInImage: projection.OptionsEmbeddedInImage, VideoURL: projection.VideoURL,
			Difficulty: projection.Difficulty, CorrectOptionIndex: projection.CorrectOptionIndex,
			Explanation: projection.Explanation, Hint: projection.Hint, SolvingStrategy: projection.SolvingStrategy,
		}
		for _, option := range projection.Options {
			reviewQuestion.Options = append(reviewQuestion.Options, learning.ReviewQuestionOption{
				Index: option.Index, Text: option.Text, AssetID: option.AssetID,
			})
		}
		items = append(items, learning.ReviewItem{Card: card, Question: reviewQuestion})
	}
	return learning.ReviewPage{Items: items, Page: page, Limit: limit, HasMore: more}, nil
}

func (s *Service) SetSaved(ctx context.Context, actor identity.User, questionID string, saved bool) error {
	if requireStudent(actor) != nil {
		return ErrForbidden
	}
	questionID = strings.TrimSpace(questionID)
	if questionID == "" {
		return ErrInvalidInput
	}
	return s.repo.SetSavedReview(ctx, actor.ID, questionID, saved)
}
