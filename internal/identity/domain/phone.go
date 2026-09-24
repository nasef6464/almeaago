package domain

import "strings"

func NormalizeSaudiPhone(value string) (string, bool) {
	var builder strings.Builder
	builder.Grow(len(value))

	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}

	digits := builder.String()

	switch {
	case len(digits) == 14 && strings.HasPrefix(digits, "009665"):
		return digits[2:], true
	case len(digits) == 12 && strings.HasPrefix(digits, "9665"):
		return digits, true
	case len(digits) == 10 && strings.HasPrefix(digits, "05"):
		return "966" + digits[1:], true
	case len(digits) == 9 && strings.HasPrefix(digits, "5"):
		return "966" + digits, true
	default:
		return "", false
	}
}
