package application

import (
	"context"
	"errors"
	"strings"
	"unicode/utf8"

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
	AdminBootstrap(ctx context.Context) (taxonomy.Bootstrap, error)
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

type deletionRepository interface {
	DeleteTaxonomy(context.Context, string, string, string) error
}

type BulkDeleteBlocked struct {
	ID     string `json:"id"`
	Reason string `json:"reason"`
}

type BulkDeleteResult struct {
	DeletedIDs []string            `json:"deletedIds"`
	Blocked    []BulkDeleteBlocked `json:"blocked"`
}

func validDeleteKind(kind string) bool {
	switch kind {
	case "path", "subject", "level", "skill", "skill_section":
		return true
	default:
		return false
	}
}

func (s *Service) DeleteTaxonomy(ctx context.Context, actor identity.User, kind, id string) error {
	if !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || !validDeleteKind(kind) {
		return ErrInvalidInput
	}
	repo, ok := s.repo.(deletionRepository)
	if !ok {
		return errors.New("taxonomy deletion unavailable")
	}
	return repo.DeleteTaxonomy(ctx, actor.ID, kind, id)
}

func (s *Service) BulkDeleteTaxonomy(ctx context.Context, actor identity.User, kind string, ids []string) (BulkDeleteResult, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return BulkDeleteResult{}, ErrForbidden
	}
	if !validDeleteKind(kind) || len(ids) == 0 || len(ids) > 100 {
		return BulkDeleteResult{}, ErrInvalidInput
	}
	repo, ok := s.repo.(deletionRepository)
	if !ok {
		return BulkDeleteResult{}, errors.New("taxonomy deletion unavailable")
	}
	seen := map[string]bool{}
	res := BulkDeleteResult{DeletedIDs: make([]string, 0, len(ids)), Blocked: make([]BulkDeleteBlocked, 0)}
	for _, raw := range ids {
		id := strings.TrimSpace(raw)
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		err := repo.DeleteTaxonomy(ctx, actor.ID, kind, id)
		switch {
		case err == nil:
			res.DeletedIDs = append(res.DeletedIDs, id)
		case errors.Is(err, taxonomy.ErrHasDependencies):
			res.Blocked = append(res.Blocked, BulkDeleteBlocked{ID: id, Reason: "مرتبط بعناصر أو بيانات نشطة"})
		case errors.Is(err, taxonomy.ErrNotFound):
			res.Blocked = append(res.Blocked, BulkDeleteBlocked{ID: id, Reason: "غير موجود"})
		default:
			res.Blocked = append(res.Blocked, BulkDeleteBlocked{ID: id, Reason: "تعذر الحذف"})
		}
	}
	return res, nil
}

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

func (s *Service) AdminBootstrap(ctx context.Context, actor identity.User) (taxonomy.Bootstrap, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Bootstrap{}, ErrForbidden
	}
	return s.repo.AdminBootstrap(ctx)
}

func (s *Service) CreatePath(ctx context.Context, actor identity.User, write taxonomy.PathWrite) (taxonomy.Path, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Path{}, ErrForbidden
	}
	write.Code, write.Name = normalizeCode(write.Code), strings.TrimSpace(write.Name)
	write.ParentPathID, write.Description = strings.TrimSpace(write.ParentPathID), strings.TrimSpace(write.Description)
	if write.Code == "" || write.Name == "" || write.SortOrder < 0 || utf8.RuneCountInString(write.Name) > 160 || utf8.RuneCountInString(write.Description) > 4000 {
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
	presentationChanged := patch.IsVisible != nil || patch.ShowInNavbar != nil || patch.ShowInHome != nil || patch.ShowSubjectCards != nil || patch.ShowMockExamCard != nil || patch.ShowPackageCard != nil || patch.Color != nil || patch.Icon != nil || patch.IconURL != nil || patch.IconStyle != nil || patch.Settings.HasValues()
	if pathID == "" || !validCommonPatch(patch.Name, patch.Description, patch.SortOrder, patch.Status, patch.ParentPathID != nil || presentationChanged) {
		return taxonomy.Path{}, ErrInvalidInput
	}
	return s.repo.UpdatePath(ctx, actor.ID, pathID, patch)
}

func (s *Service) CreateLevel(ctx context.Context, actor identity.User, write taxonomy.LevelWrite) (taxonomy.Level, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Level{}, ErrForbidden
	}
	write.PathID, write.Code, write.Name = strings.TrimSpace(write.PathID), normalizeCode(write.Code), strings.TrimSpace(write.Name)
	if write.PathID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || utf8.RuneCountInString(write.Name) > 160 {
		return taxonomy.Level{}, ErrInvalidInput
	}
	return s.repo.CreateLevel(ctx, actor.ID, write)
}

func (s *Service) UpdateLevel(ctx context.Context, actor identity.User, levelID string, patch taxonomy.LevelPatch) (taxonomy.Level, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Level{}, ErrForbidden
	}
	levelID = strings.TrimSpace(levelID)
	if levelID == "" || !validCommonPatch(patch.Name, nil, patch.SortOrder, patch.Status, patch.IsVisible != nil) {
		return taxonomy.Level{}, ErrInvalidInput
	}
	return s.repo.UpdateLevel(ctx, actor.ID, levelID, patch)
}

func (s *Service) CreateSubject(ctx context.Context, actor identity.User, write taxonomy.SubjectWrite) (taxonomy.Subject, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Subject{}, ErrForbidden
	}
	write.PathID, write.LevelID, write.Code, write.Name = strings.TrimSpace(write.PathID), strings.TrimSpace(write.LevelID), normalizeCode(write.Code), strings.TrimSpace(write.Name)
	if write.PathID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || utf8.RuneCountInString(write.Name) > 160 {
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
	if subjectID == "" || !validCommonPatch(patch.Name, nil, patch.SortOrder, patch.Status, patch.LevelID != nil || patch.IsVisible != nil) {
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
	if write.SubjectID == "" || write.Code == "" || write.Name == "" || write.SortOrder < 0 || (write.Kind != "main" && write.Kind != "sub") || utf8.RuneCountInString(write.Name) > 160 || utf8.RuneCountInString(write.Description) > 4000 {
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
		if v == "" || utf8.RuneCountInString(v) > 160 {
			return false
		}
	}
	if description != nil {
		v := strings.TrimSpace(*description)
		*description = v
		if utf8.RuneCountInString(v) > 4000 {
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
