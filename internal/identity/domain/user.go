package domain

import "time"

type Role string

const (
	RoleStudent     Role = "student"
	RoleTeacher     Role = "teacher"
	RoleAdmin       Role = "admin"
	RoleSupervisor  Role = "supervisor"
	RoleSchoolAdmin Role = "school_admin"
	RoleParent      Role = "parent"
)

type User struct {
	ID                  string
	Email               string
	Name                string
	PasswordHash        string
	Status              string
	AvatarURL           string
	EmailVerifiedAt     *time.Time
	NationalID          *string
	Phone               *string
	FailedLoginAttempts int
	LastFailedLoginAt   *time.Time
	LoginLockedUntil    *time.Time
	PasswordChangedAt   *time.Time
	Roles               []Role
	CreatedAt           time.Time
	UpdatedAt           time.Time
}

func (u User) EmailVerified() bool {
	return u.EmailVerifiedAt != nil
}

func (u User) Active() bool {
	return u.Status == "active"
}
