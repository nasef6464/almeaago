package domain

type AdminUserQuery struct {
	Page   int
	Limit  int
	Search string
	Role   *Role
	Active *bool
}

type AdminUserPage struct {
	Users []User
	Page  int
	Limit int
	Total int
}

type AdminUserSummary struct {
	Total    int
	Inactive int
	ByRole   map[Role]int
}

type AdminUpsertUserInput struct {
	Name         string
	Email        string
	PasswordHash string
	Role         Role
}

type AdminUpdateUserInput struct {
	Name      *string
	AvatarURL *string
	Role      *Role
	Active    *bool
}

type AdminBulkStatusResult struct {
	UserID string
	Status string
	Reason string
}
