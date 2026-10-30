package application

import (
    "context"
    "errors"
    "strings"
    "testing"

    identity "github.com/nasef6464/almeaago/internal/identity/domain"
    taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

// The Legacy skill/section name fields are Unicode strings (Mongoose trim),
// and the UI accepts Arabic text. A byte-length check rejects valid Arabic
// names at about half the documented 160-character Go limit. This contract
// retains the Go limits but measures user-visible Unicode code points.
func TestAdminTaxonomyArabicNamesUseCharactersNotUTF8Bytes(t *testing.T) {
    ctx := context.Background()
    s := NewService(&mutationRepoStub{})
    admin := taxonomyActor(identity.RoleAdmin)

    validName := strings.Repeat("م", 160)
    invalidName := strings.Repeat("م", 161)

    tests := []struct {
        name string
        save func(string) error
    }{
        {"create path", func(name string) error { _, err := s.CreatePath(ctx, admin, taxonomy.PathWrite{Code: "P1", Name: name}); return err }},
        {"create level", func(name string) error { _, err := s.CreateLevel(ctx, admin, taxonomy.LevelWrite{PathID: "path-1", Code: "L1", Name: name}); return err }},
        {"create subject", func(name string) error { _, err := s.CreateSubject(ctx, admin, taxonomy.SubjectWrite{PathID: "path-1", Code: "S1", Name: name}); return err }},
        {"create main skill", func(name string) error { _, err := s.CreateSkill(ctx, admin, taxonomy.SkillWrite{SubjectID: "subject-1", Code: "SK1", Name: name, Kind: "main"}); return err }},
        {"update path", func(name string) error { _, err := s.UpdatePath(ctx, admin, "path-1", taxonomy.PathPatch{Name: &name}); return err }},
        {"update level", func(name string) error { _, err := s.UpdateLevel(ctx, admin, "level-1", taxonomy.LevelPatch{Name: &name}); return err }},
        {"update subject", func(name string) error { _, err := s.UpdateSubject(ctx, admin, "subject-1", taxonomy.SubjectPatch{Name: &name}); return err }},
        {"update skill", func(name string) error { _, err := s.UpdateSkill(ctx, admin, "skill-1", taxonomy.SkillPatch{Name: &name}); return err }},
    }
    for _, tc := range tests {
        t.Run(tc.name+"/160 Arabic characters accepted", func(t *testing.T) {
            if err := tc.save(validName); err != nil { t.Fatalf("160 Arabic characters must be accepted, got %v", err) }
        })
        t.Run(tc.name+"/161 Arabic characters rejected", func(t *testing.T) {
            if err := tc.save(invalidName); !errors.Is(err, ErrInvalidInput) { t.Fatalf("161 Arabic characters must be rejected, got %v", err) }
        })
    }
}

func TestAdminTaxonomyArabicDescriptionsUseCharactersNotUTF8Bytes(t *testing.T) {
    ctx := context.Background()
    s := NewService(&mutationRepoStub{})
    admin := taxonomyActor(identity.RoleAdmin)
    valid := strings.Repeat("و", 4000)
    invalid := strings.Repeat("و", 4001)

    tests := []struct {
        name string
        save func(string) error
    }{
        {"create path", func(desc string) error { _, err := s.CreatePath(ctx, admin, taxonomy.PathWrite{Code: "P1", Name: "مسار", Description: desc}); return err }},
        {"create skill", func(desc string) error { _, err := s.CreateSkill(ctx, admin, taxonomy.SkillWrite{SubjectID: "subject-1", Code: "SK1", Name: "مهارة", Kind: "main", Description: desc}); return err }},
        {"update path", func(desc string) error { _, err := s.UpdatePath(ctx, admin, "path-1", taxonomy.PathPatch{Description: &desc}); return err }},
        {"update skill", func(desc string) error { _, err := s.UpdateSkill(ctx, admin, "skill-1", taxonomy.SkillPatch{Description: &desc}); return err }},
    }
    for _, tc := range tests {
        t.Run(tc.name+"/4000 Arabic characters accepted", func(t *testing.T) {
            if err := tc.save(valid); err != nil { t.Fatalf("4000 Arabic characters must be accepted, got %v", err) }
        })
        t.Run(tc.name+"/4001 Arabic characters rejected", func(t *testing.T) {
            if err := tc.save(invalid); !errors.Is(err, ErrInvalidInput) { t.Fatalf("4001 Arabic characters must be rejected, got %v", err) }
        })
    }

    // Authorization must remain unchanged by the text-length correction.
    if _, err := s.CreateSkill(ctx, taxonomyActor(identity.RoleTeacher), taxonomy.SkillWrite{
        SubjectID: "subject-1", Code: "SK1", Name: strings.Repeat("م", 160), Kind: "main",
    }); !errors.Is(err, ErrForbidden) {
        t.Fatalf("non-admin must remain forbidden, got %v", err)
    }
}
