package domain

import "errors"

var (
	ErrNotFound = errors.New("ai resource not found")
	ErrConflict = errors.New("ai state conflict")
)
