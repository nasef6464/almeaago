package application

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type authorityStub struct{ value org.ParentAuthority }

func (s authorityStub) ParentAuthority(context.Context, identity.User) (org.ParentAuthority, error) {
	return s.value, nil
}

type studentDirectoryStub struct {
	ids  []string
	rows []identity.ParentStudentProfile
}

func (s *studentDirectoryStub) ParentStudentProfiles(_ context.Context, ids []string) ([]identity.ParentStudentProfile, error) {
	s.ids = append([]string(nil), ids...)
	return append([]identity.ParentStudentProfile(nil), s.rows...), nil
}

type assessmentReaderStub struct {
	snapshotIDs []string
	resultCalls int
	snapshots   map[string]assessment.ParentStudentAssessmentSnapshot
	results     assessment.ParentResultPage
}

func (s *assessmentReaderStub) ParentStudentAssessmentSnapshots(_ context.Context, ids []string, _ time.Time, _ int) (map[string]assessment.ParentStudentAssessmentSnapshot, error) {
	s.snapshotIDs = append([]string(nil), ids...)
	return s.snapshots, nil
}

func (s *assessmentReaderStub) ParentStudentResults(context.Context, string, int, int) (assessment.ParentResultPage, error) {
	s.resultCalls++
	return s.results, nil
}

type learningReaderStub struct {
	ids       []string
	snapshots map[string]learning.ParentStudentLearningSnapshot
}

func (s *learningReaderStub) ParentStudentLearningSnapshots(_ context.Context, ids []string, _ int) (map[string]learning.ParentStudentLearningSnapshot, error) {
	s.ids = append([]string(nil), ids...)
	return s.snapshots, nil
}

func parentActor() identity.User {
	return identity.User{ID: "parent-1", Roles: []identity.Role{identity.RoleParent}}
}

func TestDashboardUsesCanonicalAuthorityAndBoundedReaders(t *testing.T) {
	students := &studentDirectoryStub{rows: []identity.ParentStudentProfile{{ID: "student-1", Name: "سارة"}}}
	assess := &assessmentReaderStub{snapshots: map[string]assessment.ParentStudentAssessmentSnapshot{
		"student-1": {
			StudentID: "student-1", WeeklyAssessmentCount: 2, WeeklyAverageScore: 81.5, WeeklyStudySeconds: 601,
			RecentResults: []assessment.ParentResultSummary{{AttemptID: "attempt-1", Title: "اختبار", Score: 82}},
		},
	}}
	learningReader := &learningReaderStub{snapshots: map[string]learning.ParentStudentLearningSnapshot{
		"student-1": {StudentID: "student-1", WeakSkills: []learning.ParentWeakSkill{{
			SkillID: "skill-1", SkillName: "النسب", Mastery: 42, RecommendedAction: "خطة علاج عاجلة",
		}}},
	}}
	service := NewService(authorityStub{value: org.ParentAuthority{Relationships: []org.ParentStudentRelationship{
		{ID: "r1", StudentID: "student-1", SchoolID: "school-a", Status: "active"},
		{ID: "r2", StudentID: "student-1", SchoolID: "school-b", Status: "active"},
		{ID: "r3", StudentID: "student-2", SchoolID: "school-a", Status: "active"},
		{ID: "r4", StudentID: "student-3", Status: "revoked"},
	}}}, students, assess, learningReader)
	service.now = func() time.Time { return time.Date(2026, 9, 26, 12, 0, 0, 0, time.UTC) }

	out, err := service.Dashboard(context.Background(), parentActor(), 1, 1)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(students.ids, []string{"student-1"}) || !reflect.DeepEqual(assess.snapshotIDs, []string{"student-1"}) ||
		!reflect.DeepEqual(learningReader.ids, []string{"student-1"}) {
		t.Fatalf("foreign readers received ids outside selected canonical authority: students=%v assessment=%v learning=%v", students.ids, assess.snapshotIDs, learningReader.ids)
	}
	if out.Summary.TotalChildren != 2 || !out.HasMore || len(out.Children) != 1 {
		t.Fatalf("unexpected pagination/authority projection: %#v", out)
	}
	child := out.Children[0]
	if child.StudentID != "student-1" || child.Name != "سارة" || child.WeeklyStudyMinutes != 10 ||
		child.NextAction != "خطة علاج عاجلة" || len(child.SchoolIDs) != 2 {
		t.Fatalf("unexpected child summary: %#v", child)
	}
}

func TestResultsRejectsUnlinkedStudentBeforeAssessmentRead(t *testing.T) {
	assess := &assessmentReaderStub{}
	service := NewService(authorityStub{value: org.ParentAuthority{Relationships: []org.ParentStudentRelationship{
		{ID: "r1", StudentID: "student-1", Status: "active"},
	}}}, &studentDirectoryStub{}, assess, &learningReaderStub{})

	_, err := service.Results(context.Background(), parentActor(), "student-other", 1, 20)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if assess.resultCalls != 0 {
		t.Fatalf("assessment reader was called for unlinked student")
	}
}

func TestDashboardRequiresParentRole(t *testing.T) {
	service := NewService(authorityStub{}, &studentDirectoryStub{}, &assessmentReaderStub{}, &learningReaderStub{})
	_, err := service.Dashboard(context.Background(), identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}, 1, 20)
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected parent-only guard, got %v", err)
	}
}

func TestWeeklyReportIsReadOnlySevenDayProjection(t *testing.T) {
	students := &studentDirectoryStub{rows: []identity.ParentStudentProfile{{ID: "student-1", Name: "أحمد"}}}
	assess := &assessmentReaderStub{snapshots: map[string]assessment.ParentStudentAssessmentSnapshot{
		"student-1": {StudentID: "student-1", WeeklyAssessmentCount: 1, WeeklyAverageScore: 73, WeeklyStudySeconds: 420},
	}}
	learningReader := &learningReaderStub{snapshots: map[string]learning.ParentStudentLearningSnapshot{
		"student-1": {StudentID: "student-1", WeakSkills: []learning.ParentWeakSkill{{SkillID: "skill-1", SkillName: "الجبر", Mastery: 60, RecommendedAction: "إضافة تدريب قصير"}}},
	}}
	service := NewService(authorityStub{value: org.ParentAuthority{Relationships: []org.ParentStudentRelationship{
		{ID: "r1", StudentID: "student-1", Status: "active"},
	}}}, students, assess, learningReader)
	now := time.Date(2026, 9, 26, 15, 30, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	out, err := service.WeeklyReport(context.Background(), parentActor(), 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if !out.PeriodEnd.Equal(now) || out.PeriodEnd.Sub(out.PeriodStart) != 7*24*time.Hour {
		t.Fatalf("unexpected report period: %v -> %v", out.PeriodStart, out.PeriodEnd)
	}
	if len(out.Children) != 1 || out.Children[0].StudyMinutes != 7 || out.Children[0].NextAction != "إضافة تدريب قصير" {
		t.Fatalf("unexpected weekly report: %#v", out)
	}
}
