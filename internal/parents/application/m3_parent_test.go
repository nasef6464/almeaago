package application

import (
	"context"
	"errors"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
	parents "github.com/nasef6464/almeaago/internal/parents/domain"
)

type stubAuthority struct{ out org.ParentAuthority }

func (s stubAuthority) ParentAuthority(context.Context, identity.User) (org.ParentAuthority, error) {
	return s.out, nil
}

type stubStudents struct {
	items []identity.ParentStudentProfile
}

func (s stubStudents) ParentStudentProfiles(context.Context, []string) ([]identity.ParentStudentProfile, error) {
	return s.items, nil
}

type stubAssess struct{}

func (stubAssess) ParentStudentAssessmentSnapshots(context.Context, []string, time.Time, int) (map[string]assessment.ParentStudentAssessmentSnapshot, error) {
	return map[string]assessment.ParentStudentAssessmentSnapshot{
		"child-1": {WeeklyAssessmentCount: 2, WeeklyAverageScore: 84, WeeklyStudySeconds: 600},
	}, nil
}
func (stubAssess) ParentStudentResults(context.Context, string, int, int) (assessment.ParentResultPage, error) {
	return assessment.ParentResultPage{}, nil
}

type stubLearning struct{}

func (stubLearning) ParentStudentLearningSnapshots(context.Context, []string, int) (map[string]learning.ParentStudentLearningSnapshot, error) {
	return map[string]learning.ParentStudentLearningSnapshot{
		"child-1": {WeakSkills: []learning.ParentWeakSkill{{SkillID: "sk-1", SkillName: "الكسور", Mastery: 55, RecommendedAction: "حل 5 تدريبات"}}},
	}, nil
}

type stubApprovals struct {
	items        []parents.PaymentApproval
	targetChild  string
	targetStatus string
	targetParent string
	targetRev    int
	decided      string
}

func (s *stubApprovals) ListPendingApprovals(context.Context, []string) ([]parents.PaymentApproval, error) {
	return s.items, nil
}
func (s *stubApprovals) GetApprovalTarget(context.Context, string) (string, string, string, int, error) {
	if s.targetChild == "" {
		return "", "", "", 0, ErrNotFound
	}
	return s.targetChild, s.targetStatus, s.targetParent, s.targetRev, nil
}
func (s *stubApprovals) DecideApproval(_ context.Context, id, _, decision string, rev int) (parents.PaymentApproval, error) {
	s.decided = decision
	return parents.PaymentApproval{ID: id, StudentID: s.targetChild, ParentApprovalStatus: decision, Revision: rev + 1}, nil
}

type stubLinks struct{ revokedStudent string }

func (s *stubLinks) RevokeStudentLink(_ context.Context, _, studentID string) error {
	s.revokedStudent = studentID
	return nil
}

type stubSender struct {
	called bool
	title  string
	body   string
}

func (s *stubSender) SendParentWeeklySummary(_ context.Context, _, _, title, body string) (string, int, int, error) {
	s.called = true
	s.title = title
	s.body = body
	return "camp-1", 1, 1, nil
}

func TestParentM3Actions(t *testing.T) {
	parentActor := identity.User{ID: "parent-1", Roles: []identity.Role{identity.RoleParent}}
	studentActor := identity.User{ID: "child-1", Roles: []identity.Role{identity.RoleStudent}}

	approvals := &stubApprovals{
		items:        []parents.PaymentApproval{{ID: "req-1", StudentID: "child-1", ProductName: "دورة التأسيس", FinalAmountMinor: 15000, Currency: "SAR", Status: "pending", ParentApprovalStatus: "pending", Revision: 1}},
		targetChild:  "child-1",
		targetStatus: "pending",
		targetParent: "pending",
		targetRev:    1,
	}
	links := &stubLinks{}
	sender := &stubSender{}

	svc := NewService(
		stubAuthority{out: org.ParentAuthority{Relationships: []org.ParentStudentRelationship{{ID: "rel-1", ParentID: "parent-1", StudentID: "child-1", Status: "active"}}}},
		stubStudents{items: []identity.ParentStudentProfile{{ID: "child-1", Name: "سارة"}}},
		stubAssess{},
		stubLearning{},
	).WithExtras(approvals, links, sender)

	// 1. Weekly report send
	res, err := svc.SendWeeklyReport(context.Background(), parentActor)
	if err != nil || !res.OK || !sender.called || res.StudentsReported != 1 {
		t.Fatalf("expected weekly report send success, got res=%+v err=%v", res, err)
	}
	if _, err := svc.SendWeeklyReport(context.Background(), studentActor); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for student, got %v", err)
	}

	// 2. Approvals list + decide + out-of-scope rejection
	list, err := svc.Approvals(context.Background(), parentActor)
	if err != nil || len(list) != 1 {
		t.Fatalf("expected 1 pending approval, got %v err=%v", list, err)
	}
	out, err := svc.DecideApproval(context.Background(), parentActor, "req-1", "approved", 1)
	if err != nil || out.ParentApprovalStatus != "approved" || approvals.decided != "approved" {
		t.Fatalf("expected approval success, got %+v err=%v", out, err)
	}
	approvals.targetChild = "other-child"
	if _, err := svc.DecideApproval(context.Background(), parentActor, "req-2", "approved", 1); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden for unlinked child approval, got %v", err)
	}

	// 3. Self-link fail closed + unlink active child
	if err := svc.LinkStudentFailClosed(context.Background(), parentActor); !errors.Is(err, ErrSelfLinkRequiresVerification) {
		t.Fatalf("expected ErrSelfLinkRequiresVerification, got %v", err)
	}
	if _, err := svc.UnlinkStudent(context.Background(), parentActor, "other-child"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected ErrForbidden unlinking non-child, got %v", err)
	}
	unlinkOut, err := svc.UnlinkStudent(context.Background(), parentActor, "child-1")
	if err != nil || links.revokedStudent != "child-1" || unlinkOut.StudentID != "child-1" {
		t.Fatalf("expected unlink success, got %+v err=%v", unlinkOut, err)
	}

	// 4. Parent with 0 linked children cannot send weekly report
	emptySvc := NewService(stubAuthority{}, stubStudents{}, stubAssess{}, stubLearning{}).WithExtras(approvals, links, sender)
	if _, err := emptySvc.SendWeeklyReport(context.Background(), parentActor); !errors.Is(err, ErrNoLinkedChildren) {
		t.Fatalf("expected ErrNoLinkedChildren, got %v", err)
	}
}
