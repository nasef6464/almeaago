package application

import (
	"context"
	"errors"
	"reflect"
	"strings"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type pathPresentationRepo struct {
	repoStub
	calls int
	actor string
	id    string
	patch taxonomy.PathPatch
}

func (r *pathPresentationRepo) UpdatePath(_ context.Context, actor, id string, patch taxonomy.PathPatch) (taxonomy.Path, error) {
	r.calls++
	r.actor, r.id, r.patch = actor, id, patch
	return taxonomy.Path{ID: id}, nil
}

func TestUpdatePathPresentationOnly(t *testing.T) {
	visible, hidden := true, false
	for _, tc := range []struct {
		name  string
		patch taxonomy.PathPatch
	}{
		{"home_hidden", taxonomy.PathPatch{ShowInHome: &hidden}},
		{"home_visible", taxonomy.PathPatch{ShowInHome: &visible}},
		{"navbar_hidden", taxonomy.PathPatch{ShowInNavbar: &hidden}},
		{"navbar_visible", taxonomy.PathPatch{ShowInNavbar: &visible}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &pathPresentationRepo{}
			actor := taxonomyActorForService(identity.RoleAdmin)
			row, err := NewService(repo).UpdatePath(context.Background(), actor, " path-1 ", tc.patch)
			if err != nil {
				t.Fatalf("presentation-only update rejected: %v", err)
			}
			if repo.calls != 1 || repo.actor != actor.ID || repo.id != "path-1" || row.ID != "path-1" || !reflect.DeepEqual(repo.patch, tc.patch) {
				t.Fatalf("presentation update not forwarded intact: %#v", repo)
			}
		})
	}
}

func TestUpdatePathPresentationPreservesValidation(t *testing.T) {
	hidden := false
	blankName, longName, longDescription := "   ", strings.Repeat("م", 161), strings.Repeat("م", 4001)
	negative := -1
	badStatus := taxonomy.Status("unrecognized")
	for _, tc := range []struct {
		name  string
		id    string
		role  identity.Role
		patch taxonomy.PathPatch
		want  error
	}{
		{"empty_patch", "path-1", identity.RoleAdmin, taxonomy.PathPatch{}, ErrInvalidInput},
		{"empty_settings", "path-1", identity.RoleAdmin, taxonomy.PathPatch{Settings: &taxonomy.PathSettings{}}, ErrInvalidInput},
		{"empty_id", " ", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden}, ErrInvalidInput},
		{"teacher", "path-1", identity.RoleTeacher, taxonomy.PathPatch{ShowInNavbar: &hidden}, ErrForbidden},
		{"student", "path-1", identity.RoleStudent, taxonomy.PathPatch{ShowInNavbar: &hidden}, ErrForbidden},
		{"blank_name", "path-1", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden, Name: &blankName}, ErrInvalidInput},
		{"long_name", "path-1", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden, Name: &longName}, ErrInvalidInput},
		{"long_description", "path-1", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden, Description: &longDescription}, ErrInvalidInput},
		{"negative_sort", "path-1", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden, SortOrder: &negative}, ErrInvalidInput},
		{"bad_status", "path-1", identity.RoleAdmin, taxonomy.PathPatch{ShowInNavbar: &hidden, Status: &badStatus}, ErrInvalidInput},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &pathPresentationRepo{}
			_, err := NewService(repo).UpdatePath(context.Background(), taxonomyActorForService(tc.role), tc.id, tc.patch)
			if !errors.Is(err, tc.want) || repo.calls != 0 {
				t.Fatalf("expected %v without repository call; got err=%v calls=%d", tc.want, err, repo.calls)
			}
		})
	}
}
