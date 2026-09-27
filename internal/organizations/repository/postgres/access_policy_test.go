package postgres

import (
	"testing"

	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestSchoolCoreGatedPermissionMatchesDelegatedCoreCapabilities(t *testing.T) {
	gated := []string{
		org.PermissionSchoolStudentsUpdateBasic,
		org.PermissionSchoolStudentsDeactivate,
		org.PermissionSchoolClassesManage,
		org.PermissionSchoolTeachersAssign,
	}
	for _, permission := range gated {
		if !schoolCoreGatedPermission(permission) {
			t.Fatalf("expected %s to require SCHOOL_CORE", permission)
		}
	}

	notGated := []string{
		org.PermissionSchoolOverviewView,
		org.PermissionSchoolStudentsView,
		org.PermissionSchoolStudentsAdd,
		org.PermissionSchoolStudentsMoveClass,
		org.PermissionSchoolReportsExport,
	}
	for _, permission := range notGated {
		if schoolCoreGatedPermission(permission) {
			t.Fatalf("did not expect %s to require SCHOOL_CORE in Organizations", permission)
		}
	}
}
