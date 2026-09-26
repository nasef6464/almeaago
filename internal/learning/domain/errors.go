package domain

import "errors"

var (
	ErrNotFound = errors.New("learning resource not found")
	ErrConflict = errors.New("learning state conflict")
	ErrNotDue   = errors.New("review item is not due")
)
