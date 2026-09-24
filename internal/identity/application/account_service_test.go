package application

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type accountRepoMock struct {
	profileInput  domain.SelfProfileUpdate
	identityInput domain.SelfIdentityUpdate
	err           error
}

func (m *accountRepoMock) UpdateSelfProfile(
	_ context.Context,
	userID string,
	input domain.SelfProfileUpdate,
) (domain.User, error) {
	m.profileInput = input
	if m.err != nil {
		return domain.User{}, m.err
	}
	return domain.User{ID: userID, Name: deref(input.Name), Status: "active"}, nil
}

func (m *accountRepoMock) UpdateSelfIdentity(
	_ context.Context,
	userID string,
	input domain.SelfIdentityUpdate,
) (domain.User, error) {
	m.identityInput = input
	if m.err != nil {
		return domain.User{}, m.err
	}
	user := domain.User{ID: userID, Status: "active"}
	if input.NationalID != nil {
		user.NationalID = *input.NationalID
	}
	if input.Phone != nil {
		user.Phone = *input.Phone
	}
	return user, nil
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}

func TestUpdateProfileTrimsFields(t *testing.T) {
	repo := &accountRepoMock{}
	service := NewAccountService(repo)
	name := "  طالب جديد  "
	avatar := "  https://cdn.example/avatar.webp  "

	_, err := service.UpdateProfile(
		context.Background(),
		domain.User{ID: "user-1"},
		domain.SelfProfileUpdate{Name: &name, AvatarURL: &avatar},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := deref(repo.profileInput.Name); got != "طالب جديد" {
		t.Fatalf("unexpected trimmed name %q", got)
	}
	if got := deref(repo.profileInput.AvatarURL); got != "https://cdn.example/avatar.webp" {
		t.Fatalf("unexpected avatar %q", got)
	}
}

func TestUpdateProfileRejectsLargeInlineAvatar(t *testing.T) {
	repo := &accountRepoMock{}
	service := NewAccountService(repo)
	avatar := strings.Repeat("x", 2001)

	_, err := service.UpdateProfile(
		context.Background(),
		domain.User{ID: "user-1"},
		domain.SelfProfileUpdate{AvatarURL: &avatar},
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestUpdateIdentityCanonicalizesPhone(t *testing.T) {
	repo := &accountRepoMock{}
	service := NewAccountService(repo)
	phone := "050 123 4567"
	nationalID := "1234567890"

	_, err := service.UpdateIdentity(
		context.Background(),
		domain.User{ID: "user-1"},
		domain.SelfIdentityUpdate{
			NationalIDSet: true,
			NationalID:    &nationalID,
			PhoneSet:      true,
			Phone:         &phone,
		},
	)
	if err != nil {
		t.Fatal(err)
	}
	if got := deref(repo.identityInput.Phone); got != "966501234567" {
		t.Fatalf("unexpected canonical phone %q", got)
	}
	if got := deref(repo.identityInput.NationalID); got != "1234567890" {
		t.Fatalf("unexpected national ID %q", got)
	}
}

func TestUpdateIdentityRejectsInvalidNationalID(t *testing.T) {
	service := NewAccountService(&accountRepoMock{})
	value := "3234567890"

	_, err := service.UpdateIdentity(
		context.Background(),
		domain.User{ID: "user-1"},
		domain.SelfIdentityUpdate{NationalIDSet: true, NationalID: &value},
	)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid input, got %v", err)
	}
}

func TestUpdateIdentityMapsRepositoryConflict(t *testing.T) {
	repo := &accountRepoMock{err: domain.ErrConflict}
	service := NewAccountService(repo)
	value := "1234567890"

	_, err := service.UpdateIdentity(
		context.Background(),
		domain.User{ID: "user-1"},
		domain.SelfIdentityUpdate{NationalIDSet: true, NationalID: &value},
	)
	if !errors.Is(err, ErrIdentityConflict) {
		t.Fatalf("expected identity conflict, got %v", err)
	}
}
