package application

import (
	"context"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type subjectGuideContentSource interface {
	CountSubjectAccessContent(context.Context, string, string) (content.SubjectAccessGuideCounts, error)
}
type subjectGuideCourseSource interface {
	ListSubjectGuideCourses(context.Context, string, string, int) (content.SubjectGuideCourses, error)
}
type subjectGuideCourseAccess interface {
	CheckGuideCourseAccess(context.Context, string, string) (commerce.AccessDecision, error)
}
type subjectGuidePlacementSource interface {
	ListSubjectGuidePlacementGroups(context.Context, string, string) ([]assessment.GuidePlacementGroup, error)
}
type subjectGuideContentAccess interface {
	CheckFoundationAccess(context.Context, string, string, string) (commerce.AccessDecision, error)
	CheckLibraryAccess(context.Context, string, string, string) (commerce.AccessDecision, error)
}

// SubjectAccessGuide uses the same publication and access policies as the
// learner views, and marks any course summary it cannot fully verify unavailable.
func (s *PlacementService) SubjectAccessGuide(ctx context.Context, actor identity.User, pathID, subjectID string) (assessment.SubjectAccessGuide, error) {
	if !canAccessLearner(actor) {
		return assessment.SubjectAccessGuide{}, ErrForbidden
	}
	target := assessment.PlacementWrite{PathID: strings.TrimSpace(pathID), SubjectID: strings.TrimSpace(subjectID), Slot: assessment.PlacementTraining}
	if err := normalizePlacementTarget(&target); err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	if err := s.validateLearnerScope(ctx, target.PathID, target.SubjectID); err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	if err := s.validateContent(ctx, target); err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	contentRepo, ok := s.content.(subjectGuideContentSource)
	if !ok {
		return assessment.SubjectAccessGuide{}, ErrForbidden
	}
	placementRepo, ok := s.repo.(subjectGuidePlacementSource)
	if !ok {
		return assessment.SubjectAccessGuide{}, ErrForbidden
	}
	counts, err := contentRepo.CountSubjectAccessContent(ctx, target.PathID, target.SubjectID)
	if err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	groups, err := placementRepo.ListSubjectGuidePlacementGroups(ctx, target.PathID, target.SubjectID)
	if err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	categories := []assessment.SubjectGuideCategory{{Type: "foundation"}, {Type: "banks"}, {Type: "tests"}, {Type: "library"}}
	applyContent := func(category *assessment.SubjectGuideCategory, free, paid int, foundation bool) error {
		category.HasContent, category.HasFree, category.HasOpen = free+paid > 0, free > 0, free > 0
		if paid == 0 {
			return nil
		}
		allowed := false
		if strings.TrimSpace(actor.ID) != "" && actor.HasRole(identity.RoleStudent) {
			resolver, ok := s.access.(subjectGuideContentAccess)
			if !ok {
				return assessment.ErrConflict
			}
			var decision commerce.AccessDecision
			var e error
			if foundation {
				decision, e = resolver.CheckFoundationAccess(ctx, actor.ID, target.PathID, target.SubjectID)
			} else {
				decision, e = resolver.CheckLibraryAccess(ctx, actor.ID, target.PathID, target.SubjectID)
			}
			if e != nil {
				return e
			}
			allowed = decision.Allowed
		}
		category.HasOpen = category.HasOpen || allowed
		category.HasLocked = !allowed
		return nil
	}
	if err := applyContent(&categories[0], counts.FoundationFree, counts.FoundationPaid, true); err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	if err := applyContent(&categories[3], counts.LibraryFree, counts.LibraryPaid, false); err != nil {
		return assessment.SubjectAccessGuide{}, err
	}
	for _, group := range groups {
		index := 1
		if group.Slot == assessment.PlacementTests {
			index = 2
		} else if group.Slot != assessment.PlacementTraining {
			return assessment.SubjectAccessGuide{}, assessment.ErrConflict
		}
		category := &categories[index]
		category.HasContent = true
		category.HasFree = category.HasFree || group.PlacementAccess == assessment.PlacementAccessFree || (group.PlacementAccess == assessment.PlacementAccessInherit && group.BaseAccess == assessment.AccessFree)
		if actor.HasRole(identity.RoleAdmin) {
			category.HasOpen = true
			continue
		}
		scope := assessment.AccessContext{AssessmentKind: group.Kind, BaseAccess: group.BaseAccess, PlacementSlot: group.Slot, PlacementAccess: group.PlacementAccess, PathID: target.PathID, SubjectID: target.SubjectID}
		allowed, reason, e := resolvePlacementAssessmentAccess(ctx, s.access, actor.ID, scope)
		if e != nil {
			return assessment.SubjectAccessGuide{}, e
		}
		if allowed {
			category.HasOpen = true
		} else if reason == "paid_required" || reason == "package_required" {
			category.HasLocked = true
		} else {
			category.HasRestricted = true
		}
	}
	unavailable := []string{}
	courseSource, sourceOK := s.content.(subjectGuideCourseSource)
	if !sourceOK {
		unavailable = append(unavailable, "courses")
	} else {
		const maxGuideCourses = 100
		courses, e := courseSource.ListSubjectGuideCourses(ctx, target.PathID, target.SubjectID, maxGuideCourses)
		if e != nil {
			return assessment.SubjectAccessGuide{}, e
		}
		if courses.HasMore {
			unavailable = append(unavailable, "courses")
		} else {
			courseCategory := assessment.SubjectGuideCategory{Type: "courses", HasContent: len(courses.IDs) > 0}
			resolver, resolverOK := s.access.(subjectGuideCourseAccess)
			if len(courses.IDs) > 0 && !resolverOK {
				unavailable = append(unavailable, "courses")
			} else {
				complete := true
				for _, id := range courses.IDs {
					decision, e := resolver.CheckGuideCourseAccess(ctx, actor.ID, id)
					if e != nil {
						return assessment.SubjectAccessGuide{}, e
					}
					if !decision.Configured || (!decision.Allowed && decision.Reason != "paid_required") {
						complete = false
						break
					}
					courseCategory.HasFree = courseCategory.HasFree || decision.Reason == "free_product"
					courseCategory.HasOpen = courseCategory.HasOpen || decision.Allowed
					courseCategory.HasLocked = courseCategory.HasLocked || !decision.Allowed
				}
				if complete {
					categories = append(categories, courseCategory)
				} else {
					unavailable = append(unavailable, "courses")
				}
			}
		}
	}
	return assessment.SubjectAccessGuide{PathID: target.PathID, SubjectID: target.SubjectID, Categories: categories, Unavailable: unavailable, Complete: len(unavailable) == 0}, nil
}
