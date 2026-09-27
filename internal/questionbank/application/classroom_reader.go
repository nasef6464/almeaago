package application

import (
	"context"
	"errors"
	"fmt"
	"strings"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var ErrClassroomQuestionUnavailable = errors.New("classroom question unavailable")

type ClassroomQuestionRepository interface {
	ClassroomList(context.Context, string, string, int, int) (question.ClassroomQuestionPage, error)
	ClassroomBatch(context.Context, []string, string) ([]question.ClassroomQuestion, error)
	ClassroomBatchByRefs(context.Context, []question.ReviewRef) ([]question.ClassroomQuestion, error)
}

type ClassroomReader struct {
	repo ClassroomQuestionRepository
}

func NewClassroomReader(repo ClassroomQuestionRepository) *ClassroomReader {
	return &ClassroomReader{repo: repo}
}

func (r *ClassroomReader) List(
	ctx context.Context,
	subjectID, search string,
	page, limit int,
) (question.ClassroomQuestionPage, error) {
	subjectID = strings.TrimSpace(subjectID)
	search = strings.TrimSpace(search)
	if !validUUID(subjectID) || len(search) > 160 {
		return question.ClassroomQuestionPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 30
	}
	if page > 10000 || limit > 50 {
		return question.ClassroomQuestionPage{}, ErrInvalidInput
	}
	return r.repo.ClassroomList(ctx, subjectID, search, page, limit)
}

func (r *ClassroomReader) Resolve(
	ctx context.Context,
	questionIDs []string,
	subjectID string,
) ([]question.ClassroomQuestion, error) {
	subjectID = strings.TrimSpace(subjectID)
	if subjectID == "" || len(questionIDs) < 1 || len(questionIDs) > 30 {
		return nil, ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(questionIDs))
	normalized := make([]string, 0, len(questionIDs))
	for _, raw := range questionIDs {
		id := strings.TrimSpace(raw)
		if !validUUID(id) {
			return nil, ErrInvalidInput
		}
		if _, exists := seen[id]; exists {
			return nil, ErrInvalidInput
		}
		seen[id] = struct{}{}
		normalized = append(normalized, id)
	}
	rows, err := r.repo.ClassroomBatch(ctx, normalized, subjectID)
	if err != nil {
		return nil, err
	}
	return validateClassroomRows(rows, len(normalized))
}

func (r *ClassroomReader) ResolveOne(
	ctx context.Context,
	questionID string,
	version int,
) (question.ClassroomQuestion, error) {
	questionID = strings.TrimSpace(questionID)
	if !validUUID(questionID) || version < 1 {
		return question.ClassroomQuestion{}, ErrInvalidInput
	}
	rows, err := r.repo.ClassroomBatchByRefs(ctx, []question.ReviewRef{{QuestionID: questionID, Version: version}})
	if err != nil {
		return question.ClassroomQuestion{}, err
	}
	rows, err = validateClassroomRows(rows, 1)
	if err != nil {
		return question.ClassroomQuestion{}, err
	}
	return rows[0], nil
}


func (r *ClassroomReader) ResolveRefs(
	ctx context.Context,
	refs []question.ReviewRef,
) ([]question.ClassroomQuestion, error) {
	if len(refs) == 0 {
		return []question.ClassroomQuestion{}, nil
	}
	if len(refs) > 50 {
		return nil, ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(refs))
	normalized := make([]question.ReviewRef, 0, len(refs))
	for _, ref := range refs {
		ref.QuestionID = strings.TrimSpace(ref.QuestionID)
		if !validUUID(ref.QuestionID) || ref.Version < 1 {
			return nil, ErrInvalidInput
		}
		key := ref.QuestionID + ":" + fmt.Sprint(ref.Version)
		if _, exists := seen[key]; exists {
			return nil, ErrInvalidInput
		}
		seen[key] = struct{}{}
		normalized = append(normalized, ref)
	}
	rows, err := r.repo.ClassroomBatchByRefs(ctx, normalized)
	if err != nil {
		return nil, err
	}
	return validateClassroomRows(rows, len(normalized))
}

func validateClassroomRows(rows []question.ClassroomQuestion, expected int) ([]question.ClassroomQuestion, error) {
	if len(rows) != expected {
		return nil, ErrClassroomQuestionUnavailable
	}
	for _, row := range rows {
		if row.QuestionType != question.QuestionMCQ && row.QuestionType != question.QuestionTrueFalse {
			return nil, ErrClassroomQuestionUnavailable
		}
		if row.CorrectOptionIndex == nil {
			return nil, ErrClassroomQuestionUnavailable
		}
		if *row.CorrectOptionIndex < 0 || *row.CorrectOptionIndex >= len(row.Options) {
			return nil, ErrClassroomQuestionUnavailable
		}
	}
	return rows, nil
}
