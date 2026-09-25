package domain

import "errors"

var (
	ErrNotFound        = errors.New("content record not found")
	ErrConflict        = errors.New("content record conflict")
	ErrInvalidTaxonomy = errors.New("invalid content taxonomy")
	ErrInvalidAsset    = errors.New("invalid content asset")
	ErrVersionConflict = errors.New("content revision conflict")
)
