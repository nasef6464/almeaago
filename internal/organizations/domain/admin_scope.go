package domain

import (
	"errors"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var ErrScopeNotFound = errors.New("organization scope record not found")

type AdminAccountScopeCommand struct {
	UserID             string
	Role               identity.Role
	RoleChanged        bool
	SchoolID           *string
	ClassIDs           *[]string
	LinkedStudentIDs   *[]string
}
