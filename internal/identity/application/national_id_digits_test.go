package application

import (
	"context"
	"errors"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

// A repository spy proves the identifier reaches the authoritative lookup in
// ASCII form. No credentials, sessions, or production records are needed.
type nationalIDLookupProbe struct {
	recoveryRepo
	lookedUp string
}

func (r *nationalIDLookupProbe) UserByNationalID(_ context.Context, nationalID string) (domain.User, error) {
	r.lookedUp = nationalID
	return domain.User{}, domain.ErrNotFound
}

func TestLoginNationalIDNormalizesArabicIndicDigits(t *testing.T) {
	cases := []struct {
		name  string
		input string
		want  string
	}{
		{name: "ascii", input: "1234567890", want: "1234567890"},
		{name: "arabic_indic", input: "١٢٣٤٥٦٧٨٩٠", want: "1234567890"},
		{name: "mixed", input: "1٢3٤5٦7٨9٠", want: "1234567890"},
		{name: "trimmed", input: "  ١٢٣٤٥٦٧٨٩٠  ", want: "1234567890"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			repo := &nationalIDLookupProbe{}
			_, err := NewService(repo).LoginNationalID(context.Background(), tc.input, "not-a-real-password")
			if !errors.Is(err, ErrInvalidCredentials) {
				t.Fatalf("expected credentials error from absent fixture user, got %v", err)
			}
			if repo.lookedUp != tc.want {
				t.Fatalf("national ID lookup = %q, want %q", repo.lookedUp, tc.want)
			}
		})
	}
}

func TestLoginNationalIDRejectsInvalidDigitsBeforeLookup(t *testing.T) {
	for _, input := range []string{"٣٢٣٤٥٦٧٨٩٠", "۱۲۳۴۵۶۷۸۹۰", "123", "12345678901"} {
		repo := &nationalIDLookupProbe{}
		_, err := NewService(repo).LoginNationalID(context.Background(), input, "password")
		if !errors.Is(err, ErrInvalidCredentials) || repo.lookedUp != "" {
			t.Fatalf("invalid identifier %q reached lookup %q with error %v", input, repo.lookedUp, err)
		}
	}
}
