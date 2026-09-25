package domain

import "errors"

var (
	ErrNotFound   = errors.New("identity record not found")
	ErrConflict   = errors.New("identity record conflict")
	ErrLastAdmin  = errors.New("at least one active admin is required")
	ErrSelfDelete         = errors.New("current account cannot be deleted")
	ErrAdminScopeConflict = errors.New("admin trainer scope conflict")
)
