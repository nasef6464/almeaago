package domain

import (
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type MembershipStatus string

const (
	MembershipStatusActive    MembershipStatus = "active"
	MembershipStatusSuspended MembershipStatus = "suspended"
	MembershipStatusGraduated MembershipStatus = "graduated"
	MembershipStatusRevoked   MembershipStatus = "revoked"
)

type AssignmentStatus string

const (
	AssignmentStatusActive  AssignmentStatus = "active"
	AssignmentStatusEnded   AssignmentStatus = "ended"
	AssignmentStatusRevoked AssignmentStatus = "revoked"
)

const (
	PermissionSchoolOverviewView         = "SCHOOL_OVERVIEW_VIEW"
	PermissionSchoolReportsAggregateView = "SCHOOL_REPORTS_AGGREGATE_VIEW"
	PermissionSchoolStudentsView         = "SCHOOL_STUDENTS_VIEW"
	PermissionSchoolStudentsAdd          = "SCHOOL_STUDENTS_ADD"
	PermissionSchoolStudentsMoveClass    = "SCHOOL_STUDENTS_MOVE_CLASS"
	PermissionSchoolStudentsUpdateBasic  = "SCHOOL_STUDENTS_UPDATE_BASIC"
	PermissionSchoolStudentsDeactivate   = "SCHOOL_STUDENTS_DEACTIVATE"
	PermissionSchoolClassesManage        = "SCHOOL_CLASSES_MANAGE"
	PermissionSchoolTeachersAssign       = "SCHOOL_TEACHERS_ASSIGN"
	PermissionSchoolReportsDetailedView  = "SCHOOL_REPORTS_DETAILED_VIEW"
	PermissionSchoolReportsExport        = "SCHOOL_REPORTS_EXPORT"
	PermissionSchoolAssessmentsManage    = "SCHOOL_ASSESSMENTS_MANAGE"
	PermissionSchoolSmartClassroomView   = "SCHOOL_SMART_CLASSROOM_VIEW"
	PermissionSchoolInterventionsView    = "SCHOOL_INTERVENTIONS_VIEW"
	PermissionSchoolInterventionsManage  = "SCHOOL_INTERVENTIONS_MANAGE"
	PermissionSchoolStudentsTransfer     = "SCHOOL_STUDENTS_TRANSFER_SCHOOL"
)

var SchoolDirectorPermissions = []string{
	PermissionSchoolOverviewView,
	PermissionSchoolReportsAggregateView,
	PermissionSchoolStudentsView,
	PermissionSchoolStudentsAdd,
	PermissionSchoolStudentsMoveClass,
	PermissionSchoolStudentsUpdateBasic,
	PermissionSchoolStudentsDeactivate,
	PermissionSchoolClassesManage,
	PermissionSchoolTeachersAssign,
	PermissionSchoolReportsDetailedView,
	PermissionSchoolReportsExport,
	PermissionSchoolAssessmentsManage,
	PermissionSchoolSmartClassroomView,
	PermissionSchoolInterventionsView,
	PermissionSchoolInterventionsManage,
	PermissionSchoolStudentsTransfer,
}

var DefaultSchoolDirectorPermissions = []string{
	PermissionSchoolOverviewView,
	PermissionSchoolReportsAggregateView,
	PermissionSchoolStudentsView,
}

type SchoolMembership struct {
	ID          string
	SchoolID    string
	UserID      string
	Role        identity.Role
	Status      MembershipStatus
	Permissions []string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type MembershipWrite struct {
	UserID string
	Role   identity.Role
	Status MembershipStatus
}

type DirectorWrite struct {
	UserID      string
	Status      MembershipStatus
	Permissions []string
}

type DirectorRecord struct {
	Membership SchoolMembership
	UserName   string
	UserEmail  string
	UserStatus string
}

type DirectorQuery struct {
	Page   int
	Limit  int
	Status *MembershipStatus
}

type DirectorPage struct {
	Directors []DirectorRecord
	Page      int
	Limit     int
	Total     int
}

type TeachingAssignment struct {
	ID        string
	SchoolID  string
	TeacherID string
	ClassID   string
	SubjectID string
	Status    AssignmentStatus
	CreatedAt time.Time
	UpdatedAt time.Time
}

type AssignmentWrite struct {
	TeacherID string
	ClassID   string
	SubjectID string
	Status    AssignmentStatus
}

type AssignmentQuery struct {
	Page      int
	Limit     int
	TeacherID string
	ClassID   string
	SubjectID *string
	Status    *AssignmentStatus
}

type AssignmentPage struct {
	Assignments []TeachingAssignment
	Page        int
	Limit       int
	Total       int
}

func ValidMembershipStatus(status MembershipStatus) bool {
	switch status {
	case MembershipStatusActive,
		MembershipStatusSuspended,
		MembershipStatusGraduated,
		MembershipStatusRevoked:
		return true
	default:
		return false
	}
}

func ValidAssignmentStatus(status AssignmentStatus) bool {
	switch status {
	case AssignmentStatusActive, AssignmentStatusEnded, AssignmentStatusRevoked:
		return true
	default:
		return false
	}
}

func ValidSchoolMembershipRole(role identity.Role) bool {
	switch role {
	case identity.RoleStudent,
		identity.RoleTeacher,
		identity.RoleSupervisor,
		identity.RoleSchoolAdmin,
		identity.RoleParent:
		return true
	default:
		return false
	}
}

func ValidSchoolDirectorPermission(permission string) bool {
	for _, allowed := range SchoolDirectorPermissions {
		if permission == allowed {
			return true
		}
	}
	return false
}
