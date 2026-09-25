package domain

import "errors"

var (
	ErrNotFound = errors.New("taxonomy record not found")
	ErrConflict = errors.New("taxonomy record conflict")
)
