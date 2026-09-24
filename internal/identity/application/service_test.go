package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

type fakeRepository struct {
	user              domain.User
	userErr           error
	phoneSeen         string
	passwordHashSaved string
	failedLogins      int
}

func (f *fakeRepository) CreateUser(
	context.Context,
	string,
	string,
	string,
	domain.Role,
) (domain.User, error) {
	return f.user, f.userErr
}

func (f *fakeRepository) UserByEmail(context.Context, string) (domain.User, error) {
	return f.user, f.userErr
}

func (f *fakeRepository) UserByNationalID(context.Context, string) (domain.User, error) {
	return f.user, f.userErr
}

func (f *fakeRepository) UserByPhone(_ context.Context, phone string) (domain.User, error) {
	f.phoneSeen = phone
	return f.user, f.userErr
}

func (f *fakeRepository) UserByID(context.Context, string) (domain.User, error) {
	return f.user, f.userErr
}

func (f *fakeRepository) RecordFailedLogin(
	context.Context,
	string,
	int,
	time.Duration,
) error {
	f.failedLogins++
	return nil
}

func (f *fakeRepository) ClearFailedLogin(context.Context, string) error {
	return nil
}

func (f *fakeRepository) UpdatePasswordHash(
	_ context.Context,
	_ string,
	passwordHash string,
) error {
	f.passwordHashSaved = passwordHash
	return nil
}

func (f *fakeRepository) CreateSession(
	_ context.Context,
	userID string,
	tokenHash string,
	csrfHash string,
	expiresAt time.Time,
) (domain.Session, error) {
	return domain.Session{
		ID:        "session-1",
		UserID:    userID,
		TokenHash: tokenHash,
		CSRFHash:  csrfHash,
		ExpiresAt: expiresAt,
	}, nil
}

func (f *fakeRepository) SessionByTokenHash(
	context.Context,
	string,
) (domain.Session, domain.User, error) {
	return domain.Session{}, f.user, f.userErr
}

func (f *fakeRepository) RotateSessionCSRF(context.Context, string, string) error {
	return nil
}

func (f *fakeRepository) RevokeSessionByTokenHash(context.Context, string) error {
	return nil
}

func (f *fakeRepository) IssueOneTimeToken(
	context.Context,
	string,
	string,
	string,
	time.Time,
) error {
	return nil
}

func (f *fakeRepository) ResetPasswordByToken(
	context.Context,
	string,
	string,
	time.Time,
) (domain.User, error) {
	return f.user, f.userErr
}

func (f *fakeRepository) VerifyEmailByToken(
	context.Context,
	string,
	time.Time,
) (domain.User, error) {
	return f.user, f.userErr
}

func TestPasswordPolicyMatchesLegacyContract(t *testing.T) {
	valid := []string{"Password1", "abc12345"}
	invalid := []string{"short1", "abcdefgh", "12345678", ""}

	for _, value := range valid {
		if !validPassword(value) {
			t.Fatalf("expected %q to be valid", value)
		}
	}
	for _, value := range invalid {
		if validPassword(value) {
			t.Fatalf("expected %q to be invalid", value)
		}
	}
}

func TestNationalIDPattern(t *testing.T) {
	if !nationalIDPattern.MatchString("1234567890") {
		t.Fatal("expected valid Saudi national ID shape")
	}
	if nationalIDPattern.MatchString("3234567890") {
		t.Fatal("national ID must start with 1 or 2")
	}
}

func TestPhoneLoginNormalizesDigits(t *testing.T) {
	hash, err := security.HashPassword("Password1")
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeRepository{
		user: domain.User{
			ID:           "user-1",
			PasswordHash: hash,
			Status:       "active",
			Roles:        []domain.Role{domain.RoleStudent},
		},
	}
	service := NewService(repo)

	if _, err := service.LoginPhone(
		context.Background(),
		"+966 (50) 123-4567",
		"Password1",
	); err != nil {
		t.Fatal(err)
	}

	if repo.phoneSeen != "966501234567" {
		t.Fatalf("unexpected normalized phone: %q", repo.phoneSeen)
	}
}

func TestPhoneLoginRejectsUnknownUser(t *testing.T) {
	repo := &fakeRepository{userErr: domain.ErrNotFound}
	service := NewService(repo)

	_, err := service.LoginPhone(context.Background(), "966501234567", "Password1")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
}

func TestBadPasswordRecordsFailedLogin(t *testing.T) {
	hash, err := security.HashPassword("Password1")
	if err != nil {
		t.Fatal(err)
	}
	repo := &fakeRepository{
		user: domain.User{
			ID:           "user-1",
			PasswordHash: hash,
			Status:       "active",
		},
	}
	service := NewService(repo)

	_, err = service.Login(context.Background(), "student@example.com", "WrongPass1")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if repo.failedLogins != 1 {
		t.Fatalf("expected one failed-login write, got %d", repo.failedLogins)
	}
}
