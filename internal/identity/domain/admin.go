package domain

type AdminUserWrite struct {
	Name             *string
	Email            *string
	PasswordHash     *string
	Role             *Role
	Active           *bool
	AvatarURL        *string
	SchoolID         *string
	ClassIDs         *[]string
	LinkedStudentIDs *[]string
}

type AdminUserRecord struct {
	User             User
	SchoolID         string
	ClassIDs         []string
	LinkedStudentIDs []string
}

type AdminUserListOptions struct {
	Page   int
	Limit  int
	Search string
	Role   *Role
	Active *bool

	ActorUserID string
	ActorRoles  []Role
}

type AdminUserPage struct {
	Users      []AdminUserRecord
	Page       int
	Limit      int
	Total      int
	TotalPages int
}

type AdminSummary struct {
	Total            int
	Inactive         int
	ByRole           map[Role]int
	PlatformTrainers int
}

type BulkStatusResult struct {
	UserID string
	Status string
	Reason string
}

func IsValidRole(role Role) bool {
	switch role {
	case RoleStudent, RoleTeacher, RoleAdmin, RoleSupervisor, RoleSchoolAdmin, RoleParent:
		return true
	default:
		return false
	}
}

func HasRole(roles []Role, target Role) bool {
	for _, role := range roles {
		if role == target {
			return true
		}
	}
	return false
}
