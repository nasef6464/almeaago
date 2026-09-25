package domain

type AdminUserQuery struct {
	Page   int
	Limit  int
	Search string
	Role   *Role
	Active *bool

	ActorUserID string
	ActorRoles  []Role
}

type AdminUserRecord struct {
	User             User
	SchoolID         string
	ClassIDs         []string
	LinkedStudentIDs []string
}

type AdminUserPage struct {
	Users []AdminUserRecord
	Page  int
	Limit int
	Total int
}

type AdminUserSummary struct {
	Total            int
	Inactive         int
	ByRole           map[Role]int
	PlatformTrainers int
}

type AdminUpsertUserInput struct {
	Name             string
	Email            string
	PasswordHash     string
	Role             Role
	SchoolID         string
	ClassIDs         []string
	LinkedStudentIDs []string
}

type AdminUpdateUserInput struct {
	Name             *string
	AvatarURL        *string
	Role             *Role
	Active           *bool
	SchoolID         *string
	ClassIDs         *[]string
	LinkedStudentIDs *[]string
}

type AdminBulkStatusResult struct {
	UserID string `json:"userId"`
	Status string `json:"status"`
	Reason string `json:"reason,omitempty"`
}
