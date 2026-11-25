package application

import (
	"context"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type EvidenceRepository interface {
	ReadLearningEvidence(ctx context.Context, actor identity.User, query learning.LearningEvidenceQuery) (learning.LearningEvidenceReport, error)
}

type EvidenceService struct {
	repo EvidenceRepository
}

func NewEvidenceService(repo EvidenceRepository) *EvidenceService {
	return &EvidenceService{repo: repo}
}

func (s *EvidenceService) Read(ctx context.Context, actor identity.User, query learning.LearningEvidenceQuery) (learning.LearningEvidenceReport, error) {
	if strings.TrimSpace(actor.ID) == "" ||
		(!actor.HasRole(identity.RoleAdmin) &&
			!actor.HasRole(identity.RoleSchoolAdmin) &&
			!actor.HasRole(identity.RoleSupervisor) &&
			!actor.HasRole(identity.RoleTeacher)) {
		return learning.LearningEvidenceReport{}, ErrForbidden
	}
	query.Source = strings.TrimSpace(query.Source)
	if query.Source != "platform_self_study" && query.Source != "school_assessment" {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	query.SubjectID = strings.TrimSpace(query.SubjectID)
	if query.SubjectID == "" || len(query.SubjectID) > 128 {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	query.Search = strings.TrimSpace(query.Search)
	if len([]rune(query.Search)) > 80 {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	query.PathID = strings.TrimSpace(query.PathID)
	query.SchoolID = strings.TrimSpace(query.SchoolID)
	query.ClassID = strings.TrimSpace(query.ClassID)
	query.QuizID = strings.TrimSpace(query.QuizID)
	if query.Days == 0 {
		query.Days = 90
	}
	if query.Days < 1 || query.Days > 180 {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Page < 1 || query.Page > 100000 {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	if query.Limit == 0 {
		query.Limit = 12
	}
	if query.Limit < 1 || query.Limit > 30 {
		return learning.LearningEvidenceReport{}, ErrInvalidInput
	}
	query.Status = strings.TrimSpace(query.Status)
	if query.Status != "" {
		switch learning.EvidenceStatus(query.Status) {
		case learning.EvidenceUnmeasured, learning.EvidenceInsufficient, learning.EvidenceSupport, learning.EvidenceDeveloping, learning.EvidenceReady:
		default:
			return learning.LearningEvidenceReport{}, ErrInvalidInput
		}
	}
	if s.repo == nil {
		return learning.LearningEvidenceReport{}, ErrForbidden
	}
	return s.repo.ReadLearningEvidence(ctx, actor, query)
}
