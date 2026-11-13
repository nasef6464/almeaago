package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type selfQuizRepoStub struct {
	existing       string
	scopes         []assessment.SelfQuizSkillScope
	candidates     []assessment.EligibleSelfQuizQuestion
	selected       []assessment.EligibleSelfQuizQuestion
	candidateCalls int
}

func (r *selfQuizRepoStub) CreateSelfQuizSnapshot(_ context.Context, _ string, _ assessment.SelfQuizInput, selected []assessment.EligibleSelfQuizQuestion) (string, error) {
	if len(selected) == 0 {
		if r.existing != "" {
			return r.existing, nil
		}
		return "", assessment.ErrNoSelfQuizQuestions
	}
	r.selected = selected
	return "new-attempt", nil
}
func (r *selfQuizRepoStub) ResolveSelfQuizSkills(context.Context, []string) ([]assessment.SelfQuizSkillScope, error) {
	return r.scopes, nil
}
func (r *selfQuizRepoStub) ListSelfQuizCandidates(context.Context, assessment.SelfQuizInput) ([]assessment.EligibleSelfQuizQuestion, error) {
	r.candidateCalls++
	return r.candidates, nil
}
func (r *selfQuizRepoStub) GetAttempt(_ context.Context, id string) (assessment.Attempt, error) {
	return assessment.Attempt{ID: id, StudentID: "student"}, nil
}

func TestSelfQuizStartAuthenticatesSamplesAndRetries(t *testing.T) {
	ctx := context.Background()
	path := "11111111-1111-4111-8111-111111111111"
	subject := "22222222-2222-4222-8222-222222222222"
	skill := "33333333-3333-4333-8333-333333333333"
	input := assessment.SelfQuizInput{PathID: path, SubjectID: subject, SkillIDs: []string{skill}, EvidenceType: "remediation", QuestionCount: 3, TimeLimitMinutes: 10, StartKey: "key"}
	r := &selfQuizRepoStub{scopes: []assessment.SelfQuizSkillScope{{ID: skill, PathID: path, SubjectID: subject, Active: true}}, candidates: []assessment.EligibleSelfQuizQuestion{{ID: "q1", Version: 1, PathID: path, SubjectID: subject, SkillIDs: []string{skill}}, {ID: "q2", Version: 1, PathID: path, SubjectID: subject}}}
	s := NewSelfQuizService(r)
	if _, err := s.Start(ctx, identity.User{}, input); !errors.Is(err, ErrForbidden) {
		t.Fatalf("guest: %v", err)
	}
	got, err := s.Start(ctx, student("student"), input)
	if err != nil || got.ID != "new-attempt" || len(r.selected) != 1 || r.selected[0].ID != "q1" {
		t.Fatalf("scoped sample: %+v %+v %v", got, r.selected, err)
	}
	r.existing = "old-attempt"
	r.candidateCalls = 0
	r.candidates = nil
	got, err = s.Start(ctx, student("student"), input)
	if err != nil || got.ID != "old-attempt" || r.candidateCalls != 0 {
		t.Fatalf("retry rebuilt sample: %+v %v", got, err)
	}
}
