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
	NationalID          string
	Phone               string
	EmailVerified       bool
	FailedLoginAttempts int
	LoginLockedUntil    time.Time
	CreatedAt           time.Time
	UpdatedAt           time.Time
	Roles               []Role
}

type Session struct {
	ID         string
	UserID     string
	TokenHash  string
	CSRFHash   string
	ExpiresAt  time.Time
	LastSeenAt time.Time
}

func (u User) IsDisabled() bool {
	return u.Status == "disabled"
}

func (u User) IsLoginLocked(now time.Time) bool {
	return !u.LoginLockedUntil.IsZero() && u.LoginLockedUntil.After(now)
}

func (u User) HasRole(role Role) bool {
	for _, current := range u.Roles {
		if current == role {
			return true
		}
	}
	return false
}

func ValidRole(role Role) bool {
	switch role {
	case RoleStudent, RoleTeacher, RoleAdmin, RoleSupervisor, RoleSchoolAdmin, RoleParent:
		return true
	default:
		return false
	}
}
