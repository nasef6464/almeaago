package taxonomyhttp

import (
	"context"
	"net/http"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type deleteHTTPRepo struct {
	taxonomyHTTPRepo
	calls int
	err   error
}

func (r *deleteHTTPRepo) DeleteTaxonomy(_ context.Context, _, _, _ string) error {
	r.calls++
	return r.err
}

func TestDeleteHTTPAuthorizationAndConflict(t *testing.T) {
	for _, tc := range []struct {
		role          identity.Role
		csrf          string
		err           error
		status, calls int
	}{
		{identity.RoleStudent, "valid-csrf", nil, http.StatusForbidden, 0},
		{identity.RoleAdmin, "bad", nil, http.StatusForbidden, 0},
		{identity.RoleAdmin, "valid-csrf", taxonomy.ErrHasDependencies, http.StatusConflict, 1},
		{identity.RoleAdmin, "valid-csrf", nil, http.StatusOK, 1},
	} {
		repo := &deleteHTTPRepo{err: tc.err}
		h := New(taxonomyapp.NewService(repo), taxonomyHTTPAuth{role: tc.role})
		for _, kind := range []string{"paths", "levels", "subjects"} {
			repo.calls = 0
			w := taxonomyHTTPCall(h, http.MethodDelete, "/admin/"+kind+"/id", "", tc.csrf)
			if w.Code != tc.status || repo.calls != tc.calls {
				t.Fatalf("%s: status %d calls %d", kind, w.Code, repo.calls)
			}
		}
	}
}
