package questionhttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type authStub struct {
	auth    identityapp.Authenticated
	authErr error
	csrfErr error
}

func (a authStub) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return a.auth, a.authErr
}

func (a authStub) VerifyCSRF(identityapp.Authenticated, string) error {
	return a.csrfErr
}

type repoStub struct {
	current question.Question
}

func (r *repoStub) Create(context.Context, string, question.CreateCommand) (question.Question, error) {
	return r.current, nil
}
func (r *repoStub) AppendVersion(context.Context, string, string, int, question.VersionCommand) (question.Question, error) {
	return r.current, nil
}
func (r *repoStub) SetWorkflow(context.Context, string, string, int, question.WorkflowStatus, string) (question.Question, error) {
	return r.current, nil
}
func (r *repoStub) Get(context.Context, string) (question.Question, error) {
	return r.current, nil
}

func approvedQuestion() question.Question {
	correct := 1
	return question.Question{
		ID:             "question-1",
		QuestionCode:   "Q-001",
		CurrentVersion: 3,
		WorkflowStatus: question.WorkflowApproved,
		PathID:         "path-1",
		SubjectID:      "subject-1",
		ReviewerNotes:  "private review notes",
		Version: question.QuestionVersion{
			Version:                3,
			QuestionType:           question.QuestionMCQ,
			TextContent:            "Visible prompt",
			ImageAssetID:           "asset-1",
			ImageAlt:               "Accessible image description",
			OptionsEmbeddedInImage: true,
			CorrectOptionIndex:     &correct,
			Explanation:            "private explanation",
			Hint:                   "private hint",
			SolvingStrategy:        "private strategy",
			SourceMeta:             []byte(`{"documentCode":"secret-source"}`),
			AIContext:              []byte(`{"readableText":"AI readable question","visualDescription":"AI visual description","optionTexts":["A","B","C","D"],"requiredData":["private"]}`),
			VoiceExplanation:       []byte(`{"text":"private voice explanation"}`),
			Difficulty:             "medium",
			ExamType:               "qudurat",
		},
		Options: []question.Option{{Index: 0, Text: "A"}, {Index: 1, Text: "B"}},
		SkillLinks: []question.SkillLink{{SkillID: "skill-main", RelationType: question.RelationMain}},
	}
}

func TestLearnerProjectionStripsAnswerAndPrivateAIFields(t *testing.T) {
	repo := &repoStub{current: approvedQuestion()}
	service := questionapp.NewService(repo)
	auth := identityapp.Authenticated{User: identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}}
	handler := New(service, authStub{auth: auth})

	request := httptest.NewRequest(http.MethodGet, "/question-1", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d body=%s", response.Code, response.Body.String())
	}
	body := response.Body.String()
	for _, forbidden := range []string{"correctOptionIndex", "private explanation", "private hint", "private strategy", "secret-source", "requiredData", "reviewerNotes", "voiceExplanation"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("learner response leaked %q: %s", forbidden, body)
		}
	}
	for _, required := range []string{`"questionCode":"Q-001"`, `"imageAssetId":"asset-1"`, `"imageAlt":"Accessible image description"`, `"embeddedOptionTexts":["A","B","C","D"]`} {
		if !strings.Contains(body, required) {
			t.Fatalf("learner response missing %s: %s", required, body)
		}
	}
}

func TestLearnerCannotReadUnapprovedQuestion(t *testing.T) {
	row := approvedQuestion()
	row.WorkflowStatus = question.WorkflowDraft
	service := questionapp.NewService(&repoStub{current: row})
	auth := identityapp.Authenticated{User: identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}}
	handler := New(service, authStub{auth: auth})

	request := httptest.NewRequest(http.MethodGet, "/question-1", nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusNotFound {
		t.Fatalf("expected 404, got %d body=%s", response.Code, response.Body.String())
	}
}

func TestQuestionMutationRequiresCSRF(t *testing.T) {
	service := questionapp.NewService(&repoStub{current: approvedQuestion()})
	auth := identityapp.Authenticated{User: identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}}
	handler := New(service, authStub{auth: auth, csrfErr: errors.New("bad csrf")})

	request := httptest.NewRequest(http.MethodPatch, "/question-1/workflow", strings.NewReader(`{"expectedCurrentVersion":3,"status":"archived"}`))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)

	if response.Code != http.StatusForbidden {
		t.Fatalf("expected 403, got %d body=%s", response.Code, response.Body.String())
	}
}
