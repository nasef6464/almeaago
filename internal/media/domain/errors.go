package domain

import "errors"

var (
	ErrNotFound    = errors.New("media asset not found")
	ErrConflict    = errors.New("media asset conflict")
	ErrUnavailable = errors.New("media provider unavailable")
)
