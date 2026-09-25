package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type repoStub struct {
	current       question.Question
	create        question.CreateCommand
	workflowCall  bool
	lastListQuery question.ListQuery
}

type scopeStub struct {
	allowed bool
}

func (s scopeStub) CanAuthor(context.Context, string, string, string) (bool, error) {
	return s.allowed, nil
}

func (r *repoStub) Create(_ context.Context, _ string, command question.CreateCommand) (question.Question, error) {
	r.create = command
	return question.Question{ID: "question-1"}, nil
}

func (r *repoStub) AppendVersion(context.Context, string, string, int, question.VersionCommand) (question.Question, error) {
	return r.current, nil
}

func (r *repoStub) SetWorkflow(_ context.Context, _ string, _ string, _ int, status question.WorkflowStatus, _ string) (question.Question, error) {
	r.workflowCall = true
	row := r.current
	row.WorkflowStatus = status
	return row, nil
}

func (r *repoStub) Get(context.Context, string) (question.Question, error) {
	return r.current, nil
}

func (r *repoStub) List(_ context.Context, query question.ListQuery) (question.QuestionPage, error) {
	r.lastListQuery = query
	return question.QuestionPage{Page: query.Page, Limit: query.Limit}, nil
}

func (r *repoStub) Coverage(_ context.Context, query question.CoverageQuery) (question.Coverage, error) {
	r.lastListQuery = query.ListQuery
	return question.Coverage{SkillPage: query.SkillPage, SkillLimit: query.SkillLimit}, nil
}

func actor(role identity.Role) identity.User {
	return identity.User{ID: "actor-1", Roles: []identity.Role{role}}
}

func baseVersion() VersionInput {
	correct := 1
	return VersionInput{
		PathID:             "path-1",
		SubjectID:          "subject-1",
		QuestionType:       question.QuestionMCQ,
		TextContent:        "2 + 2 = ?",
		CorrectOptionIndex: &correct,
		Options: []OptionInput{
			{Text: "3"},
			{Text: "4"},
		},
		SkillLinks: []SkillLinkInput{{SkillID: "skill-main", RelationType: question.RelationMain}},
	}
}

func TestCreateAcceptsImageOnlyWithAccessibleEmbeddedOptions(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	correct := 0
	input := CreateInput{
		QuestionCode: "IMG-001",
		Version: VersionInput{
			PathID:                 "path-1",
			SubjectID:              "subject-1",
			QuestionType:           question.QuestionMCQ,
			ImageAssetID:           "asset-1",
			ImageAlt:               "سؤال هندسي مصور",
			OptionsEmbeddedInImage: true,
			CorrectOptionIndex:     &correct,
			Explanation:            "شرح مكتوب للسؤال المصور",
			AIContext:              json.RawMessage(`{"readableText":"سؤال هندسي","visualDescription":"شكل هندسي","optionTexts":["أ","ب","ج","د"]}`),
			SkillLinks:             []SkillLinkInput{{SkillID: "skill-main", RelationType: question.RelationMain}},
		},
	}

	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.create.Version.TextContent != "" || repo.create.Version.ImageAssetID != "asset-1" {
		t.Fatalf("unexpected image-only normalization: %#v", repo.create.Version)
	}
	if len(repo.create.Version.AIContext) == 0 {
		t.Fatal("expected AI context to be retained for server-side AI use")
	}
}

func TestCreateRejectsQuestionWithoutTextOrImage(t *testing.T) {
	service := NewService(&repoStub{})
	input := CreateInput{QuestionCode: "EMPTY-1", Version: baseVersion()}
	input.Version.TextContent = ""
	input.Version.ImageAssetID = ""
	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestCreateRejectsMalformedAIJSON(t *testing.T) {
	service := NewService(&repoStub{})
	input := CreateInput{QuestionCode: "BAD-AI", Version: baseVersion()}
	input.Version.AIContext = json.RawMessage(`{"readableText":`)
	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestTeacherCannotApproveOwnQuestion(t *testing.T) {
	current := question.Question{
		ID:             "question-1",
		WorkflowStatus: question.WorkflowPendingReview,
		OwnerType:      question.OwnerTeacher,
		OwnerID:        "actor-1",
		CurrentVersion: 1,
		Version: question.QuestionVersion{
			QuestionType:       question.QuestionMCQ,
			CorrectOptionIndex: intPtr(0),
		},
	}
	service := NewServiceWithAuthorScope(&repoStub{current: current}, scopeStub{allowed: true})
	_, err := service.SetWorkflow(context.Background(), actor(identity.RoleTeacher), current.ID, WorkflowInput{
		ExpectedCurrentVersion: 1,
		Status:                 question.WorkflowApproved,
	})
	if !errors.Is(err, ErrWorkflow) {
		t.Fatalf("expected workflow error, got %v", err)
	}
}

func TestAdminCannotSkipDraftDirectlyToApproved(t *testing.T) {
	repo := &repoStub{current: question.Question{
		ID:             "question-1",
		WorkflowStatus: question.WorkflowDraft,
		CurrentVersion: 1,
		Version: question.QuestionVersion{
			QuestionType:       question.QuestionMCQ,
			CorrectOptionIndex: intPtr(0),
		},
	}}
	service := NewService(repo)
	_, err := service.SetWorkflow(context.Background(), actor(identity.RoleAdmin), "question-1", WorkflowInput{
		ExpectedCurrentVersion: 1,
		Status:                 question.WorkflowApproved,
	})
	if !errors.Is(err, ErrWorkflow) {
		t.Fatalf("expected workflow error, got %v", err)
	}
	if repo.workflowCall {
		t.Fatal("repository workflow write must not run for an invalid transition")
	}
}

func TestStaffListDefaultsToBoundedPage(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	page, err := service.StaffList(context.Background(), actor(identity.RoleAdmin), question.ListQuery{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if page.Page != 1 || page.Limit != 80 {
		t.Fatalf("unexpected defaults: %#v", page)
	}
}

func TestTeacherListIsForcedToOwnScope(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo)
	teacher := identity.User{ID: "11111111-1111-7111-8111-111111111111", Roles: []identity.Role{identity.RoleTeacher}}
	if _, err := service.StaffList(context.Background(), teacher, question.ListQuery{}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if repo.lastListQuery.TeacherScopeUserID != teacher.ID {
		t.Fatalf("teacher scope not enforced: %#v", repo.lastListQuery)
	}
}

func TestStaffListRejectsUnboundedLimit(t *testing.T) {
	service := NewService(&repoStub{})
	_, err := service.StaffList(context.Background(), actor(identity.RoleAdmin), question.ListQuery{Limit: 101})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func intPtr(value int) *int { return &value }

func TestTeacherCreateRequiresCanonicalAuthorScope(t *testing.T) {
	input := CreateInput{QuestionCode: "Q-SCOPE", Version: baseVersion()}

	denied := NewServiceWithAuthorScope(&repoStub{}, scopeStub{allowed: false})
	if _, err := denied.Create(context.Background(), actor(identity.RoleTeacher), input); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden outside trainer scope, got %v", err)
	}

	repo := &repoStub{}
	allowed := NewServiceWithAuthorScope(repo, scopeStub{allowed: true})
	if _, err := allowed.Create(context.Background(), actor(identity.RoleTeacher), input); err != nil {
		t.Fatalf("unexpected scoped trainer error: %v", err)
	}
	if repo.create.OwnerType != question.OwnerTeacher || repo.create.OwnerID != "actor-1" || repo.create.AssignedTeacherID != "actor-1" {
		t.Fatalf("trainer ownership was not forced: %#v", repo.create)
	}
}

func TestAdminCannotAssignQuestionOutsideTrainerScope(t *testing.T) {
	input := CreateInput{
		QuestionCode:      "Q-ASSIGN",
		OwnerType:         question.OwnerPlatform,
		AssignedTeacherID: "teacher-2",
		Version:           baseVersion(),
	}
	service := NewServiceWithAuthorScope(&repoStub{}, scopeStub{allowed: false})
	if _, err := service.Create(context.Background(), actor(identity.RoleAdmin), input); !errors.Is(err, question.ErrConflict) {
		t.Fatalf("expected trainer assignment conflict, got %v", err)
	}
}
