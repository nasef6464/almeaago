package organizationshttp

import (
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestPresentSchoolContextIncludesPermissionsAndModules(t *testing.T) {
	got := presentSchoolContext(org.SchoolContext{
		SchoolID:    "school-1",
		SchoolName:  "مدرسة المئة",
		Role:        identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolStudentsView},
		Modules:     []string{string(org.ModuleSchoolCore)},
		Source:      "membership",
	})
	if got.SchoolID != "school-1" || got.Role != "school_admin" {
		t.Fatalf("unexpected context %#v", got)
	}
	if len(got.Permissions) != 1 || got.Permissions[0] != org.PermissionSchoolStudentsView {
		t.Fatalf("unexpected permissions %#v", got.Permissions)
	}
	if len(got.Modules) != 1 || got.Modules[0] != string(org.ModuleSchoolCore) {
		t.Fatalf("unexpected modules %#v", got.Modules)
	}
}
