package application

import (
	"context"
	"errors"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"testing"
)

type homepageRepoFake struct {
	saved content.HomepageSettings
	fail  error
}

func (r *homepageRepoFake) GetHomepageSettings(context.Context) (content.HomepageSettings, error) {
	return r.saved, r.fail
}
func (r *homepageRepoFake) PatchHomepageSettings(_ context.Context, _ string, patch content.HomepageSettings) (content.HomepageSettings, error) {
	if r.fail != nil {
		return nil, r.fail
	}
	r.saved = patch
	return patch, nil
}
func TestHomepageServiceProtectsMutationAndPropagatesFailure(t *testing.T) {
	ctx := context.Background()
	repo := &homepageRepoFake{}
	service := NewHomepageService(repo)
	for _, role := range []identity.Role{identity.RoleStudent, identity.RoleTeacher, identity.RoleParent, identity.RoleSupervisor} {
		if _, err := service.Patch(ctx, identity.User{Roles: []identity.Role{role}}, map[string]any{"brand": map[string]any{"logoText": "x"}}); !errors.Is(err, ErrForbidden) {
			t.Fatalf("role %s: %v", role, err)
		}
	}
	if repo.saved != nil {
		t.Fatal("unauthorized mutation reached repository")
	}
	admin := identity.User{Roles: []identity.Role{identity.RoleAdmin}}
	if _, err := service.Patch(ctx, admin, map[string]any{"hero": map[string]any{"autoRotateImages": "false"}}); !errors.Is(err, ErrInvalidInput) {
		t.Fatal(err)
	}
	if repo.saved != nil {
		t.Fatal("invalid mutation reached repository")
	}
	repo.fail = errors.New("storage unavailable")
	if _, err := service.Patch(ctx, admin, map[string]any{}); !errors.Is(err, repo.fail) {
		t.Fatal("storage failure became success", err)
	}
	if _, err := service.Get(ctx); !errors.Is(err, repo.fail) {
		t.Fatal("read failure became defaults", err)
	}
	repo.fail = nil
	got, err := service.Get(ctx)
	if err != nil || got["key"] != "default" {
		t.Fatalf("default guest read: %v %v", got, err)
	}
}
