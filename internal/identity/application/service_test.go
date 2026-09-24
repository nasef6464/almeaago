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
	user                domain.User
	userErr             error
	phoneSeen           string
	verificationHash    string
	sessionTokenHash    string
	sessionCSRFHash     string
	replacedPurpose     string
	replacedTokenHash   string
	resetErr            error
	verificationErr     error
}

func (f *fakeRepository) CreateRegisteredUser(
	_ context.Context,
	name string,
	email string,
	passwordHash string,
	role domain.Role,
	verificationTokenHash string,
	_ time.Time,
) (domain.User, error) {
	f.verificationHash = verificationTokenHash
	if f.userErr != nil {
		return domain.User{}, f.userErr
	}
	user := f.user
	user.Name = name
	user.Email = email
	user.PasswordHash = passwordHash
	user.Status = "active"
	user.Roles = []domain.Role{role}
	return user, nil
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

func (f *fakeRepository) RecordFailedLogin(context.Context, string, int, time.Duration) error {
	return nil
}

func (f *fakeRepository) ClearFailedLogin(context.Context, string) error {
	return nil
}

func (f *fakeRepository) UpdatePasswordHash(context.Context, string, string) error {
	return nil
}

func (f *fakeRepository) CreateSession(
	_ context.Context,
	userID string,
	tokenHash string,
	csrfHash string,
	expiresAt time.Time,
) (domain.Session, error) {
	f.sessionTokenHash = tokenHash
	f.sessionCSRFHash = csrfHash
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

func (f *fakeRepository) ReplaceOneTimeToken(
	_ context.Context,
	_ string,
	purpose string,
	tokenHash string,
	_ time.Time,
) error {
	f.replacedPurpose = purpose
	f.replacedTokenHash = tokenHash
	return nil
}

func (f *fakeRepository) ConsumePasswordResetToken(
	context.Context,
	string,
	string,
	time.Time,
) (domain.User, error) {
	if f.resetErr != nil {
		return domain.User{}, f.resetErr
	}
	return f.user, nil
}

func (f *fakeRepository) ConsumeEmailVerificationToken(
	context.Context,
	string,
	time.Time,
) (domain.User, error) {
	if f.verificationErr != nil {
		return domain.User{}, f.verificationErr
	}
	user := f.user
	user.EmailVerified = true
	return user, nil
}

type fakeDelivery struct {
	verificationToken string
	resetToken        string
}

func (f *fakeDelivery) SendEmailVerification(_ context.Context, _ string, token string) error {
	f.verificationToken = token
	return nil
}

func (f *fakeDelivery) SendPasswordReset(_ context.Context, _ string, token string) error {
	f.resetToken = token
	return nil
}

func TestRegisterStoresOnlyTokenDigests(t *testing.T) {
	repo := &fakeRepository{
		user: domain.User{ID: "user-1"},
	}
	delivery := &fakeDelivery{}
	service := NewService(repo, delivery)

	result, err := service.Register(
		context.Background(),
		"Student Name",
		"Student@Example.com",
		"Password1",
	)
	if err != nil {
		t.Fatal(err)
	}

	if result.User.Email != "student@example.com" {
		t.Fatalf("email was not normalized: %q", result.User.Email)
	}
	if delivery.verificationToken == "" {
		t.Fatal("verification token was not delivered")
	}
	if repo.verificationHash != security.DigestToken(delivery.verificationToken) {
		t.Fatal("verification token must be persisted only as a digest")
	}
	if repo.sessionTokenHash != security.DigestToken(result.SessionToken) {
		t.Fatal("session token must be persisted only as a digest")
	}
	if repo.sessionCSRFHash != security.DigestToken(result.CSRFToken) {
		t.Fatal("csrf token must be persisted only as a digest")
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
		},
	}
	service := NewService(repo, DiscardDelivery{})

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

func TestForgotPasswordDoesNotRevealMissingAccount(t *testing.T) {
	repo := &fakeRepository{userErr: domain.ErrNotFound}
	service := NewService(repo, DiscardDelivery{})

	if err := service.ForgotPassword(context.Background(), "missing@example.com"); err != nil {
		t.Fatalf("forgot password must remain generic: %v", err)
	}
	if repo.replacedTokenHash != "" {
		t.Fatal("missing account must not create a reset token")
	}
}

func TestForgotPasswordStoresResetTokenDigest(t *testing.T) {
	repo := &fakeRepository{
		user: domain.User{
			ID:     "user-1",
			Email:  "student@example.com",
			Status: "active",
		},
	}
	delivery := &fakeDelivery{}
	service := NewService(repo, delivery)

	if err := service.ForgotPassword(context.Background(), "student@example.com"); err != nil {
		t.Fatal(err)
	}
	if repo.replacedPurpose != "password_reset" {
		t.Fatalf("unexpected token purpose: %q", repo.replacedPurpose)
	}
	if delivery.resetToken == "" {
		t.Fatal("reset token was not delivered")
	}
	if repo.replacedTokenHash != security.DigestToken(delivery.resetToken) {
		t.Fatal("reset token must be persisted only as a digest")
	}
}

func TestResetPasswordMapsMissingTokenToInvalidToken(t *testing.T) {
	repo := &fakeRepository{resetErr: domain.ErrNotFound}
	service := NewService(repo, DiscardDelivery{})

	_, err := service.ResetPassword(
		context.Background(),
		"missing-token",
		"Password1",
	)
	if !errors.Is(err, ErrInvalidToken) {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
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
