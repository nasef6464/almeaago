package application

import (
	"context"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

var (
	ErrInvalidPhase = errors.New("invalid taxonomy bootstrap phase")
	ErrInvalidInput = errors.New("invalid taxonomy input")
	ErrForbidden    = errors.New("taxonomy mutation forbidden")
)

type Repository interface {
	PublicBootstrap(ctx context.Context, includeSkills bool) (taxonomy.Bootstrap, error)
	CreatePath(ctx context.Context, actorUserID string, write taxonomy.PathWrite) (taxonomy.Path, error)
	UpdatePath(ctx context.Context, actorUserID, pathID string, patch taxonomy.PathPatch) (taxonomy.Path, error)
	CreateLevel(ctx context.Context, actorUserID string, write taxonomy.LevelWrite) (taxonomy.Level, error)
	UpdateLevel(ctx context.Context, actorUserID, levelID string, patch taxonomy.LevelPatch) (taxonomy.Level, error)
	CreateSubject(ctx context.Context, actorUserID string, write taxonomy.SubjectWrite) (taxonomy.Subject, error)
	UpdateSubject(ctx context.Context, actorUserID, subjectID string, patch taxonomy.SubjectPatch) (taxonomy.Subject, error)
	CreateSkill(ctx context.Context, actorUserID string, write taxonomy.SkillWrite) (taxonomy.Skill, error)
	UpdateSkill(ctx context.Context, actorUserID, skillID string, patch taxonomy.SkillPatch) (taxonomy.Skill, error)
}

type Service struct{ repo Repository }

func NewService(repo Repository) *Service { return &Service{repo: repo} }

func (s *Service) PublicBootstrap(ctx context.Context, phase string) (taxonomy.Bootstrap, error) {
	switch phase {
	case "", "full", "compact":
		return s.repo.PublicBootstrap(ctx, true)
	case "core":
		return s.repo.PublicBootstrap(ctx, false)
	default:
		return taxonomy.Bootstrap{}, ErrInvalidPhase
	}
}

func (s *Service) CreatePath(ctx context.Context, actor identity.User, write taxonomy.PathWrite) (taxonomy.Path, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Path{}, ErrForbidden
	}
	write.Code, write.Name = normalizeCode(write.Code), strings.TrimSpace(write.Name)
	write.ParentPathID, write.Description = strings.TrimSpace(write.ParentPathID), strings.TrimSpace(write.Description)
	if write.Code == "" || write.Name == "" || write.SortOrder < 0 || len(write.Name) > 160 || len(write.Description) > 4000 {
		return taxonomy.Path{}, ErrInvalidInput
	}
	return s.repo.CreatePath(ctx, actor.ID, write)
}

func (s *Service) UpdatePath(ctx context.Context, actor identity.User, pathID string, patch taxonomy.PathPatch) (taxonomy.Path, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Path{}, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	if patch.ParentPathID != nil {
		v := strings.TrimSpace(*patch.ParentPathID)
		patch.ParentPathID = &v
	}
	if pathID == "" || !validCommonPatch(patch.Name, patch.Description, patch.SortOrder, patch.Status, patch.ParentPathID != nil) {
		return taxonomy.Path{}, ErrInvalidInput
	}
	return s.repo.UpdatePath(ctx, actor.ID, pathID, patch)
}

func (s *Service) CreateLevel(ctx context.Context, actor identity.User, write taxonomy.LevelWrite) (taxonomy.Level, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Level{}, ErrForbidden
	}
	write.PathID, write.Code, write.Name = strings.TrimSpace(write.PathID), normalizeCode(write.Code), strings.TrimSpace(write.Name)
	if write.PathID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || len(write.Name) > 160 {
		return taxonomy.Level{}, ErrInvalidInput
	}
	return s.repo.CreateLevel(ctx, actor.ID, write)
}

func (s *Service) UpdateLevel(ctx context.Context, actor identity.User, levelID string, patch taxonomy.LevelPatch) (taxonomy.Level, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Level{}, ErrForbidden
	}
	levelID = strings.TrimSpace(levelID)
	if levelID == "" || !validCommonPatch(patch.Name, nil, patch.SortOrder, patch.Status, false) {
		return taxonomy.Level{}, ErrInvalidInput
	}
	return s.repo.UpdateLevel(ctx, actor.ID, levelID, patch)
}

func (s *Service) CreateSubject(ctx context.Context, actor identity.User, write taxonomy.SubjectWrite) (taxonomy.Subject, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Subject{}, ErrForbidden
	}
	write.PathID, write.LevelID, write.Code, write.Name = strings.TrimSpace(write.PathID), strings.TrimSpace(write.LevelID), normalizeCode(write.Code), strings.TrimSpace(write.Name)
	if write.PathID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || len(write.Name) > 160 {
		return taxonomy.Subject{}, ErrInvalidInput
	}
	return s.repo.CreateSubject(ctx, actor.ID, write)
}

func (s *Service) UpdateSubject(ctx context.Context, actor identity.User, subjectID string, patch taxonomy.SubjectPatch) (taxonomy.Subject, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Subject{}, ErrForbidden
	}
	subjectID = strings.TrimSpace(subjectID)
	if patch.LevelID != nil {
		v := strings.TrimSpace(*patch.LevelID)
		patch.LevelID = &v
	}
	if subjectID == "" || !validCommonPatch(patch.Name, nil, patch.SortOrder, patch.Status, patch.LevelID != nil) {
		return taxonomy.Subject{}, ErrInvalidInput
	}
	return s.repo.UpdateSubject(ctx, actor.ID, subjectID, patch)
}

func (s *Service) CreateSkill(ctx context.Context, actor identity.User, write taxonomy.SkillWrite) (taxonomy.Skill, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Skill{}, ErrForbidden
	}
	write.SubjectID, write.ParentSkillID = strings.TrimSpace(write.SubjectID), strings.TrimSpace(write.ParentSkillID)
	write.Code, write.Name, write.Description = normalizeCode(write.Code), strings.TrimSpace(write.Name), strings.TrimSpace(write.Description)
	if write.SubjectID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || (write.Kind != "main" && write.Kind != "sub") || len(write.Name) > 160 || len(write.Description) > 4000 {
		return taxonomy.Skill{}, ErrInvalidInput
	}
	if (write.Kind == "main" && write.ParentSkillID != "") || (write.Kind == "sub" && write.ParentSkillID == "") {
		return taxonomy.Skill{}, ErrInvalidInput
	}
	return s.repo.CreateSkill(ctx, actor.ID, write)
}

func (s *Service) UpdateSkill(ctx context.Context, actor identity.User, skillID string, patch taxonomy.SkillPatch) (taxonomy.Skill, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Skill{}, ErrForbidden
	}
	skillID = strings.TrimSpace(skillID)
	if patch.ParentSkillID != nil {
		v := strings.TrimSpace(*patch.ParentSkillID)
		patch.ParentSkillID = &v
	}
	if skillID == "" || !validCommonPatch(patch.Name, patch.Description, patch.SortOrder, patch.Status, patch.ParentSkillID != nil) {
		return taxonomy.Skill{}, ErrInvalidInput
	}
	return s.repo.UpdateSkill(ctx, actor.ID, skillID, patch)
}

func validCommonPatch(name, description *string, sortOrder *int, status *taxonomy.Status, relationChanged bool) bool {
	if name != nil {
		v := strings.TrimSpace(*name)
		*name = v
		if v == "" || len(v) > 160 {
			return false
		}
	}
	if description != nil {
		v := strings.TrimSpace(*description)
		*description = v
		if len(v) > 4000 {
			return false
		}
	}
	if sortOrder != nil && *sortOrder < 0 {
		return false
	}
	if status != nil && !taxonomy.ValidStatus(*status) {
		return false
	}
	return name != nil || description != nil || sortOrder != nil || status != nil || relationChanged
}

func normalizeCode(value string) string {
	value = strings.ToUpper(strings.TrimSpace(value))
	if len(value) == 0 || len(value) > 64 {
		return ""
	}
	return value
}
