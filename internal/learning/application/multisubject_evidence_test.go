package application

import (
	"context"
	"errors"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	"testing"
	"time"
)

func TestApplyPathLevelSubmissionRequiresPerQuestionSourceScope(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, nil)
	event := learning.SubmissionEvidence{StudentID: "student", AttemptID: "attempt", AssessmentID: "mock", AssessmentVersion: 1, PathID: "path", OccurredAt: time.Now(), Questions: []learning.QuestionEvidence{
		{QuestionID: "q1", QuestionVersion: 1, PathID: "path", SubjectID: "quant"},
		{QuestionID: "q2", QuestionVersion: 1, PathID: "path", SubjectID: "verbal"},
	}}
	if err := service.ApplyAssessmentSubmission(context.Background(), event); err != nil {
		t.Fatalf("multi-subject mock rejected: %v", err)
	}
	for _, mutate := range []func(*learning.SubmissionEvidence){
		func(e *learning.SubmissionEvidence) { e.Questions[1].SubjectID = "" },
		func(e *learning.SubmissionEvidence) { e.Questions[1].PathID = "foreign" },
	} {
		copyEvent := event
		copyEvent.Questions = append([]learning.QuestionEvidence(nil), event.Questions...)
		mutate(&copyEvent)
		if err := service.ApplyAssessmentSubmission(context.Background(), copyEvent); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid scope accepted: %v", err)
		}
	}
}

func TestSelfQuizEvidenceScopesAndType(t *testing.T) {
	service := NewService(&repoStub{}, nil)
	event := learning.SubmissionEvidence{StudentID: "student", AttemptID: "attempt", SourceKind: "self", EvidenceType: "recheck", OccurredAt: time.Now(), Questions: []learning.QuestionEvidence{
		{QuestionID: "q1", QuestionVersion: 1, PathID: "path1", SubjectID: "subject1"},
		{QuestionID: "q2", QuestionVersion: 1, PathID: "path2", SubjectID: "subject2"},
	}}
	if err := service.ApplyAssessmentSubmission(context.Background(), event); err != nil {
		t.Fatal(err)
	}
	for _, mutate := range []func(*learning.SubmissionEvidence){
		func(e *learning.SubmissionEvidence) { e.EvidenceType = "practice" },
		func(e *learning.SubmissionEvidence) { e.SourceKind = "unknown" },
		func(e *learning.SubmissionEvidence) { e.AssessmentID = "other" },
		func(e *learning.SubmissionEvidence) { e.PathID = "path1" },
		func(e *learning.SubmissionEvidence) { e.Questions[1].PathID = "" },
	} {
		copyEvent := event
		copyEvent.Questions = append([]learning.QuestionEvidence(nil), event.Questions...)
		mutate(&copyEvent)
		if err := service.ApplyAssessmentSubmission(context.Background(), copyEvent); !errors.Is(err, ErrInvalidInput) {
			t.Fatalf("invalid self evidence accepted: %v", err)
		}
	}
}
