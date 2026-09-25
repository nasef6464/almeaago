package domain

import "errors"

var (
	ErrNotFound        = errors.New("question not found")
	ErrConflict        = errors.New("question conflict")
	ErrInvalidTaxonomy = errors.New("invalid question taxonomy")
	ErrVersionConflict = errors.New("question version conflict")
)
