package domain

import "errors"

var (
	ErrForbidden = errors.New("reporting scope forbidden")
	ErrNotFound  = errors.New("reporting scope not found")
)
