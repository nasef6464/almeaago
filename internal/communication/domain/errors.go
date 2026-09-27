package domain

import "errors"

var (
	ErrNotFound = errors.New("notification resource not found")
	ErrConflict = errors.New("notification state conflict")
)
