package application

import (
	"context"
	"encoding/hex"
	"strings"
	"unicode/utf8"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type skillSectionWriter interface {
	CreateSkillSection(context.Context, string, taxonomy.SkillSectionWrite) (taxonomy.SkillSection, error)
	UpdateSkillSection(context.Context, string, string, taxonomy.SkillSectionPatch) (taxonomy.SkillSection, error)
	SetSkillSection(context.Context, string, string, string) (taxonomy.Skill, error)
}

func sectionUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	_, err := hex.DecodeString(strings.ReplaceAll(value, "-", ""))
	return err == nil && value != "00000000-0000-0000-0000-000000000000"
}

func (s *Service) CreateSkillSection(ctx context.Context, actor identity.User, write taxonomy.SkillSectionWrite) (taxonomy.SkillSection, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.SkillSection{}, ErrForbidden
	}
	write.SubjectID, write.Name = strings.TrimSpace(write.SubjectID), strings.TrimSpace(write.Name)
	if !sectionUUID(write.SubjectID) || write.Name == "" || utf8.RuneCountInString(write.Name) > 160 || write.SortOrder < 0 {
		return taxonomy.SkillSection{}, ErrInvalidInput
	}
	repo, ok := s.repo.(skillSectionWriter)
	if !ok {
		return taxonomy.SkillSection{}, taxonomy.ErrConflict
	}
	return repo.CreateSkillSection(ctx, actor.ID, write)
}

func (s *Service) UpdateSkillSection(ctx context.Context, actor identity.User, id string, patch taxonomy.SkillSectionPatch) (taxonomy.SkillSection, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.SkillSection{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if !sectionUUID(id) || (patch.Name == nil && patch.SortOrder == nil && patch.Status == nil) {
		return taxonomy.SkillSection{}, ErrInvalidInput
	}
	if patch.Name != nil {
		value := strings.TrimSpace(*patch.Name)
		if value == "" || utf8.RuneCountInString(value) > 160 {
			return taxonomy.SkillSection{}, ErrInvalidInput
		}
		patch.Name = &value
	}
	if patch.SortOrder != nil && *patch.SortOrder < 0 {
		return taxonomy.SkillSection{}, ErrInvalidInput
	}
	if patch.Status != nil && *patch.Status != "active" && *patch.Status != "archived" {
		return taxonomy.SkillSection{}, ErrInvalidInput
	}
	repo, ok := s.repo.(skillSectionWriter)
	if !ok {
		return taxonomy.SkillSection{}, taxonomy.ErrConflict
	}
	return repo.UpdateSkillSection(ctx, actor.ID, id, patch)
}

func (s *Service) SetSkillSection(ctx context.Context, actor identity.User, skillID, sectionID string) (taxonomy.Skill, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return taxonomy.Skill{}, ErrForbidden
	}
	skillID, sectionID = strings.TrimSpace(skillID), strings.TrimSpace(sectionID)
	if !sectionUUID(skillID) || (sectionID != "" && !sectionUUID(sectionID)) {
		return taxonomy.Skill{}, ErrInvalidInput
	}
	repo, ok := s.repo.(skillSectionWriter)
	if !ok {
		return taxonomy.Skill{}, taxonomy.ErrConflict
	}
	return repo.SetSkillSection(ctx, actor.ID, skillID, sectionID)
}
