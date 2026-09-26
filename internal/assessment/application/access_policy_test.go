package application

import (
	"context"
	"errors"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type commerceAccessStub struct {
	allowed     bool
	reason      string
	err         error
	calls       int
	packageOnly bool
	contentType commerce.ContentType
	courseID    string
}

func (s *commerceAccessStub) CheckAssessmentAccess(
	context.Context,
	string,
	string,
	string,
	string,
	commerce.ContentType,
	bool,
) (commerce.AccessDecision, error) {
	panic("unexpected unbound stub call")
}

type recordingCommerceAccess struct {
	commerceAccessStub
}

func (s *recordingCommerceAccess) CheckAssessmentAccess(
	_ context.Context,
	_ string,
	_ string,
	_ string,
	courseID string,
	contentType commerce.ContentType,
	packageOnly bool,
) (commerce.AccessDecision, error) {
	s.calls++
	s.packageOnly = packageOnly
	s.contentType = contentType
	s.courseID = courseID
	if s.err != nil {
		return commerce.AccessDecision{}, s.err
	}
	return commerce.AccessDecision{Allowed: s.allowed, Reason: s.reason, Configured: true}, nil
}

func TestDirectAssessmentAccessPolicy(t *testing.T) {
	scope := assessment.AccessContext{
		AssessmentKind: assessment.KindNormal,
		BaseAccess:     assessment.AccessFree,
		PathID:         "path-1",
		SubjectID:      "subject-1",
	}
	allowed, reason, err := resolveDirectAssessmentAccess(context.Background(), nil, "student-1", scope)
	if err != nil || !allowed || reason != "free_assessment" {
		t.Fatalf("free direct access mismatch allowed=%v reason=%q err=%v", allowed, reason, err)
	}

	scope.BaseAccess = assessment.AccessPrivate
	allowed, reason, err = resolveDirectAssessmentAccess(context.Background(), nil, "student-1", scope)
	if err != nil || allowed || reason != "directed_assignment_required" {
		t.Fatalf("private direct access mismatch allowed=%v reason=%q err=%v", allowed, reason, err)
	}

	scope.BaseAccess = assessment.AccessPaid
	resolver := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: true, reason: "user_entitlement"}}
	allowed, reason, err = resolveDirectAssessmentAccess(context.Background(), resolver, "student-1", scope)
	if err != nil || !allowed || reason != "user_entitlement" || resolver.calls != 1 || resolver.contentType != commerce.ContentTests {
		t.Fatalf("paid direct access mismatch allowed=%v reason=%q calls=%d type=%q err=%v", allowed, reason, resolver.calls, resolver.contentType, err)
	}
}

func TestPlacementAccessPolicyOverridesAndCourseContext(t *testing.T) {
	scope := assessment.AccessContext{
		AssessmentKind:  assessment.KindMock,
		BaseAccess:      assessment.AccessCourseOnly,
		PlacementSlot:   assessment.PlacementTests,
		PlacementAccess: assessment.PlacementAccessInherit,
		PathID:          "path-1",
		SubjectID:       "subject-1",
	}
	allowed, reason, err := resolvePlacementAssessmentAccess(context.Background(), nil, "student-1", scope)
	if err != nil || allowed || reason != "course_context_required" {
		t.Fatalf("course-only outside course mismatch allowed=%v reason=%q err=%v", allowed, reason, err)
	}

	scope.PlacementAccess = assessment.PlacementAccessFree
	allowed, reason, err = resolvePlacementAssessmentAccess(context.Background(), nil, "student-1", scope)
	if err != nil || !allowed || reason != "free_placement" {
		t.Fatalf("free override mismatch allowed=%v reason=%q err=%v", allowed, reason, err)
	}

	scope.PlacementAccess = assessment.PlacementAccessInherit
	scope.PlacementSlot = assessment.PlacementCourse
	scope.CourseID = "course-1"
	resolver := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: true, reason: "user_entitlement"}}
	allowed, _, err = resolvePlacementAssessmentAccess(context.Background(), resolver, "student-1", scope)
	if err != nil || !allowed || resolver.courseID != "course-1" || resolver.contentType != commerce.ContentMockExams || resolver.packageOnly {
		t.Fatalf("course-only entitlement mismatch allowed=%v course=%q type=%q packageOnly=%v err=%v", allowed, resolver.courseID, resolver.contentType, resolver.packageOnly, err)
	}

	scope.BaseAccess = assessment.AccessFree
	scope.PlacementAccess = assessment.PlacementAccessPackage
	resolver = &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{allowed: false, reason: "paid_required"}}
	allowed, reason, err = resolvePlacementAssessmentAccess(context.Background(), resolver, "student-1", scope)
	if err != nil || allowed || reason != "paid_required" || !resolver.packageOnly {
		t.Fatalf("package override mismatch allowed=%v reason=%q packageOnly=%v err=%v", allowed, reason, resolver.packageOnly, err)
	}
}

func TestCommerceAccessErrorsFailClosed(t *testing.T) {
	scope := assessment.AccessContext{AssessmentKind: assessment.KindNormal, BaseAccess: assessment.AccessPaid, PathID: "path-1"}
	resolver := &recordingCommerceAccess{commerceAccessStub: commerceAccessStub{err: errors.New("commerce down")}}
	allowed, _, err := resolveDirectAssessmentAccess(context.Background(), resolver, "student-1", scope)
	if err == nil || allowed {
		t.Fatalf("expected fail-closed commerce error allowed=%v err=%v", allowed, err)
	}
}
