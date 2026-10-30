package application

import (
	"context"
	"testing"
	"time"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

// A saved card is a real learner record. If the pinned question version cannot
// be resolved, a successful empty/short page would falsely erase that record
// from the student's visible review history.
func TestReviewLibraryRejectsMissingPinnedQuestionProjection(t *testing.T) {
	repo := &repoStub{cards: []learning.ReviewCard{{
		ID: "card-1", QuestionID: "question-1", QuestionVersion: 2,
		PathID: "path-1", SubjectID: "subject-1", SavedForReview: true,
	}}}
	reader := &questionReaderStub{}
	page, err := NewService(repo, reader).ReviewLibrary(
		context.Background(), learner("student-1"), learning.ReviewSaved,
		"path-1", "subject-1", 1, 20,
	)
	if err == nil {
		t.Fatalf("missing pinned question version was reported as success: %+v", page)
	}
	if len(reader.refs) != 1 || reader.refs[0].Version != 2 {
		t.Fatalf("review must request the original pinned question version: %+v", reader.refs)
	}
}

func TestReviewLibraryRejectsPartialProjectionInsteadOfShortSuccess(t *testing.T) {
	repo := &repoStub{cards: []learning.ReviewCard{
		{ID: "card-1", QuestionID: "question-1", QuestionVersion: 2},
		{ID: "card-2", QuestionID: "question-2", QuestionVersion: 3},
	}}
	reader := &questionReaderStub{rows: []question.ReviewProjection{{
		ID: "question-1", Version: 2, TextContent: "available",
	}}}
	page, err := NewService(repo, reader).ReviewLibrary(
		context.Background(), learner("student-1"), learning.ReviewAll,
		"path-1", "", 1, 20,
	)
	if err == nil {
		t.Fatalf("partially resolved review page was reported as complete: %+v", page)
	}
}

func TestReviewPracticeRejectsMissingPinnedQuestionProjection(t *testing.T) {
	repo := &repoStub{dueCards: []learning.ReviewCard{{
		ID: "card-1", QuestionID: "question-1", QuestionVersion: 2,
		NextReviewAt: time.Now().Add(-time.Minute),
	}}}
	reader := &questionReaderStub{}
	page, err := NewService(repo, reader).ReviewPractice(
		context.Background(), learner("student-1"), learning.ReviewAll,
		"path-1", "", 1, 20,
	)
	if err == nil {
		t.Fatalf("unresolved due card was reported as an empty practice session: %+v", page)
	}
	if len(reader.refs) != 1 || reader.refs[0].Version != 2 {
		t.Fatalf("practice must request the original pinned question version: %+v", reader.refs)
	}
}

func TestReviewLibraryKeepsTrueEmptyStateWhenNoCardsExist(t *testing.T) {
	repo := &repoStub{}
	page, err := NewService(repo, nil).ReviewLibrary(
		context.Background(), learner("student-1"), learning.ReviewAll,
		"path-1", "", 1, 20,
	)
	if err != nil || len(page.Items) != 0 {
		t.Fatalf("true empty review library must remain successful: page=%+v err=%v", page, err)
	}
}
