package idempotency

import (
	"errors"
	"strings"
)

const MaxKeyLength = 160

var ErrInvalidKey = errors.New("invalid idempotency key")

func Normalize(raw string) (string, error) {
	key := strings.TrimSpace(raw)
	if key == "" || len(key) > MaxKeyLength {
		return "", ErrInvalidKey
	}
	return key, nil
}
