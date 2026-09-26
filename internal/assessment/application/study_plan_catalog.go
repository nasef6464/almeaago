package application

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type StudyPlanResourceRepository interface {
	ListStudyPlanResources(context.Context, string, string, []string, []string, int) ([]assessment.StudyPlanResource, error)
}

type StudyPlanCatalog struct {
	repo   StudyPlanResourceRepository
	access CommerceAccessResolver
}

func NewStudyPlanCatalog(repo StudyPlanResourceRepository, access CommerceAccessResolver) *StudyPlanCatalog {
	return &StudyPlanCatalog{repo: repo, access: access}
}

func (c *StudyPlanCatalog) ListStudyPlanResources(
	ctx context.Context,
	studentID, pathID string,
	subjectIDs, courseIDs []string,
	limit int,
) ([]assessment.StudyPlanResource, error) {
	rows, err := c.repo.ListStudyPlanResources(ctx, studentID, pathID, subjectIDs, courseIDs, limit)
	if err != nil {
		return nil, err
	}
	out := make([]assessment.StudyPlanResource, 0, len(rows))
	for _, item := range rows {
		scope := assessment.AccessContext{
			AssessmentID: item.AssessmentID, AssessmentKind: item.AssessmentKind, BaseAccess: item.BaseAccessType,
			PlacementID: item.PlacementID, PlacementSlot: item.Slot, PlacementAccess: item.PlacementAccess,
			PathID: pathID, SubjectID: item.SubjectID, CourseID: item.CourseID,
		}
		allowed, _, accessErr := resolvePlacementAssessmentAccess(ctx, c.access, studentID, scope)
		if accessErr != nil {
			return nil, accessErr
		}
		if allowed {
			out = append(out, item)
		}
	}
	return out, nil
}
