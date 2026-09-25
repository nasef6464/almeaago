package domain

import "errors"

var (
	ErrNotFound        = errors.New("content record not found")
	ErrConflict        = errors.New("content state conflict")
	ErrInvalidTaxonomy = errors.New("content taxonomy conflict")
	ErrVersionConflict = errors.New("content revision conflict")
)
