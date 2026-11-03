package application

import (
	"context"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type CompletionRepository interface {
	ResolvePathID(ctx context.Context, input string) (string, error)
	ResolveSubjectID(ctx context.Context, pathID, input string) (string, error)
	GetStudentCompletedQuizIDs(ctx context.Context, studentID string) ([]string, error)
	GetTrainingAndTestsCompletion(ctx context.Context, pathID, subjectID string, completedQuizIDs []string) (assessment.CompletionBucket, assessment.CompletionBucket, error)
	GetMockExamsCompletion(ctx context.Context, pathID string, completedQuizIDs []string) (assessment.CompletionBucket, error)
	GetFoundationCompletion(ctx context.Context, studentID, pathID, subjectID string, completedQuizIDs []string) (map[string]assessment.TopicCompletionDetail, []string, error)
}

type CompletionService struct {
	repo CompletionRepository
}

func NewCompletionService(repo CompletionRepository) *CompletionService {
	return &CompletionService{repo: repo}
}

func (s *CompletionService) GetLearningCompletion(ctx context.Context, studentID, rawPathID, rawSubjectID string) (assessment.LearningCompletionResponse, error) {
	if s == nil || s.repo == nil {
		return assessment.LearningCompletionResponse{
			CompletedQuizIDs: []string{},
			Foundation:       map[string]assessment.TopicCompletionDetail{},
			FoundationLocked: []string{},
		}, nil
	}

	cleanPathID := strings.TrimSpace(rawPathID)
	if cleanPathID == "" {
		return assessment.LearningCompletionResponse{}, ErrInvalidInput
	}

	pathID, err := s.repo.ResolvePathID(ctx, cleanPathID)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}

	cleanSubjectID := strings.TrimSpace(rawSubjectID)
	subjectID, err := s.repo.ResolveSubjectID(ctx, pathID, cleanSubjectID)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}

	completedQuizIDs, err := s.repo.GetStudentCompletedQuizIDs(ctx, studentID)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}
	if completedQuizIDs == nil {
		completedQuizIDs = []string{}
	}

	training, tests, err := s.repo.GetTrainingAndTestsCompletion(ctx, pathID, subjectID, completedQuizIDs)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}

	mock, err := s.repo.GetMockExamsCompletion(ctx, pathID, completedQuizIDs)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}

	foundation, foundationLocked, err := s.repo.GetFoundationCompletion(ctx, studentID, pathID, subjectID, completedQuizIDs)
	if err != nil {
		return assessment.LearningCompletionResponse{}, err
	}
	if foundation == nil {
		foundation = map[string]assessment.TopicCompletionDetail{}
	}
	if foundationLocked == nil {
		foundationLocked = []string{}
	}

	return assessment.LearningCompletionResponse{
		Training:         training,
		Tests:            tests,
		Mock:             mock,
		CompletedQuizIDs: completedQuizIDs,
		Foundation:       foundation,
		FoundationLocked: foundationLocked,
	}, nil
}
