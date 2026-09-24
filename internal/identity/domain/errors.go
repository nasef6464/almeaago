package domain

import "errors"

var (
	ErrNotFound = errors.New("identity record not found")
	ErrConflict = errors.New("identity record conflict")
)
