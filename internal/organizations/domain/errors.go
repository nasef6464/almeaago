package domain

import "errors"

var (
	ErrNotFound = errors.New("organization record not found")
	ErrConflict = errors.New("organization record conflict")
)
