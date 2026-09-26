package application

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type CommerceAccessResolver interface {
	CheckAssessmentAccess(context.Context, string, string, string, string, commerce.ContentType, bool) (commerce.AccessDecision, error)
}

func assessmentContentType(kind assessment.Kind) (commerce.ContentType, error) {
	switch kind {
	case assessment.KindNormal:
		return commerce.ContentTests, nil
	case assessment.KindMock:
		return commerce.ContentMockExams, nil
	default:
		return "", assessment.ErrConflict
	}
}

func resolveCommerceAccess(
	ctx context.Context,
	resolver CommerceAccessResolver,
	userID string,
	scope assessment.AccessContext,
	packageOnly bool,
) (bool, string, error) {
	if resolver == nil {
		return false, "commerce_unavailable", assessment.ErrConflict
	}
	contentType, err := assessmentContentType(scope.AssessmentKind)
	if err != nil {
		return false, "invalid_assessment_kind", err
	}
	decision, err := resolver.CheckAssessmentAccess(
		ctx, userID, scope.PathID, scope.SubjectID, scope.CourseID, contentType, packageOnly,
	)
	if err != nil {
		return false, "commerce_error", err
	}
	return decision.Allowed, decision.Reason, nil
}

func resolveDirectAssessmentAccess(
	ctx context.Context,
	resolver CommerceAccessResolver,
	userID string,
	scope assessment.AccessContext,
) (bool, string, error) {
	switch scope.BaseAccess {
	case assessment.AccessFree:
		return true, "free_assessment", nil
	case assessment.AccessPaid:
		return resolveCommerceAccess(ctx, resolver, userID, scope, false)
	case assessment.AccessPrivate:
		return false, "directed_assignment_required", nil
	case assessment.AccessCourseOnly:
		return false, "course_context_required", nil
	default:
		return false, "invalid_access_policy", assessment.ErrConflict
	}
}

func resolvePlacementAssessmentAccess(
	ctx context.Context,
	resolver CommerceAccessResolver,
	userID string,
	scope assessment.AccessContext,
) (bool, string, error) {
	switch scope.PlacementAccess {
	case assessment.PlacementAccessFree:
		return true, "free_placement", nil
	case assessment.PlacementAccessPaid:
		return resolveCommerceAccess(ctx, resolver, userID, scope, false)
	case assessment.PlacementAccessPackage:
		return resolveCommerceAccess(ctx, resolver, userID, scope, true)
	case assessment.PlacementAccessInherit:
		switch scope.BaseAccess {
		case assessment.AccessFree:
			return true, "free_assessment", nil
		case assessment.AccessPaid:
			return resolveCommerceAccess(ctx, resolver, userID, scope, false)
		case assessment.AccessPrivate:
			return false, "directed_assignment_required", nil
		case assessment.AccessCourseOnly:
			if scope.PlacementSlot != assessment.PlacementCourse || scope.CourseID == "" {
				return false, "course_context_required", nil
			}
			return resolveCommerceAccess(ctx, resolver, userID, scope, false)
		default:
			return false, "invalid_access_policy", assessment.ErrConflict
		}
	default:
		return false, "invalid_placement_access_policy", assessment.ErrConflict
	}
}
