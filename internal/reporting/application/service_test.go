package application

import (
	"bytes"
	"context"
	"errors"
	"strings"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

type reportRepoStub struct {
	scope        reporting.ResolvedScope
	overview     reporting.Overview
	results      reporting.ResultPage
	exportRows   []reporting.ResultItem
	exportTotal  int
	resolveCalls int
}

func (s *reportRepoStub) ResolveScope(context.Context, identity.User, reporting.Query) (reporting.ResolvedScope, error) {
	s.resolveCalls++
	return s.scope, nil
}
func (s *reportRepoStub) Overview(context.Context, reporting.ResolvedScope, reporting.Query) (reporting.Overview, error) {
	return s.overview, nil
}
func (s *reportRepoStub) Results(context.Context, reporting.ResolvedScope, reporting.Query, int, int) (reporting.ResultPage, error) {
	return s.results, nil
}
func (s *reportRepoStub) ExportResults(context.Context, reporting.ResolvedScope, reporting.Query, int) ([]reporting.ResultItem, int, error) {
	return s.exportRows, s.exportTotal, nil
}

func reportActor(role identity.Role) identity.User {
	return identity.User{ID: "actor-1", Roles: []identity.Role{role}}
}

func TestOverviewRejectsParentBeforeRepository(t *testing.T) {
	repo := &reportRepoStub{}
	s := NewService(repo)
	_, err := s.Overview(context.Background(), reportActor(identity.RoleParent), reporting.Query{})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if repo.resolveCalls != 0 {
		t.Fatalf("repository must not resolve unsupported actor")
	}
}

func TestOverviewAcceptsUUIDv7ScopeIDs(t *testing.T) {
	repo := &reportRepoStub{scope: reporting.ResolvedScope{Kind: reporting.ScopeSchool}}
	s := NewService(repo)
	_, err := s.Overview(context.Background(), reportActor(identity.RoleAdmin), reporting.Query{
		SchoolID: "0199aabb-ccdd-7eee-8fff-001122334455",
		ClassID:  "0199aabb-ccdd-7eee-8fff-001122334466",
	})
	if err != nil {
		t.Fatalf("uuidv7 scope should be valid: %v", err)
	}
	if repo.resolveCalls != 1 {
		t.Fatalf("expected one scope resolution, got %d", repo.resolveCalls)
	}
}

func TestResultsFailClosedWhenScopeHasNoDetailPermission(t *testing.T) {
	repo := &reportRepoStub{scope: reporting.ResolvedScope{Kind: reporting.ScopeSchool, CanDetail: false}}
	s := NewService(repo)
	_, err := s.Results(context.Background(), reportActor(identity.RoleSchoolAdmin), reporting.Query{}, 1, 20)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected detail permission denial, got %v", err)
	}
}

func TestExportRejectsOversizedDirectDownload(t *testing.T) {
	repo := &reportRepoStub{
		scope:       reporting.ResolvedScope{Kind: reporting.ScopePlatform, CanExport: true},
		exportTotal: MaxExportRows + 1,
	}
	s := NewService(repo)
	var out bytes.Buffer
	_, err := s.ExportCSV(context.Background(), reportActor(identity.RoleAdmin), reporting.Query{}, &out)
	if !errors.Is(err, ErrTooLarge) {
		t.Fatalf("expected direct export cap, got %v", err)
	}
	if out.Len() != 0 {
		t.Fatalf("oversized export must not emit partial csv")
	}
}

func TestExportCSVContainsOnlySummaryColumns(t *testing.T) {
	repo := &reportRepoStub{
		scope: reporting.ResolvedScope{Kind: reporting.ScopeStudent, CanExport: true},
		exportRows: []reporting.ResultItem{{
			AttemptID: "attempt-1", StudentID: "student-1", StudentName: "سارة",
			AssessmentID: "assessment-1", AssessmentVersion: 2, Title: "اختبار",
			PathID: "path-1", SubjectID: "subject-1", Score: 82, Passed: true,
			CorrectAnswers: 8, WrongAnswers: 2, Unanswered: 0, TimeSpentSeconds: 300,
		}},
		exportTotal: 1,
	}
	s := NewService(repo)
	var out bytes.Buffer
	total, err := s.ExportCSV(context.Background(), reportActor(identity.RoleStudent), reporting.Query{}, &out)
	if err != nil {
		t.Fatal(err)
	}
	if total != 1 {
		t.Fatalf("unexpected total %d", total)
	}
	text := out.String()
	for _, expected := range []string{"attempt_id", "student_name", "score", "correct", "wrong", "unanswered"} {
		if !strings.Contains(text, expected) {
			t.Fatalf("missing summary column %q", expected)
		}
	}
	for _, forbidden := range []string{"selected_option", "correct_option", "answer_key", "question_text"} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("export leaked answer-level field %q", forbidden)
		}
	}
}
