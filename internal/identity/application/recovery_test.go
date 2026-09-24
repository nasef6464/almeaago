package application

import (
	"context"
	"errors"
	"testing"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

type recoveryRepo struct {
	userByEmail      domain.User
	userByEmailErr   error
	issuedUserID     string
	issuedPurpose    string
	issuedTokenHash  string
	issuedExpiresAt  time.Time
	resetTokenHash   string
	resetPasswordHash string
	verifyTokenHash  string
}

func (r *recoveryRepo) CreateUser(context.Context, string, string, string, domain.Role) (domain.User, error) {
	return domain.User{}, errors.New("not implemented")
}

func (r *recoveryRepo) UserByEmail(context.Context, string) (domain.User, error) {
	if r.userByEmailErr != nil {
		return domain.User{}, r.userByEmailErr
	}
	return r.userByEmail, nil
}

func (r *recoveryRepo) UserByNationalID(context.Context, string) (domain.User, error) {
	return domain.User{}, domain.ErrNotFound
}

func (r *recoveryRepo) UserByID(context.Context, string) (domain.User, error) {
	return r.userByEmail, nil
}

func (r *recoveryRepo) RecordFailedLogin(context.Context, string, int, time.Duration) error {
	return nil
}

func (r *recoveryRepo) ClearFailedLogin(context.Context, string) error {
	return nil
}

func (r *recoveryRepo) CreateSession(context.Context, string, string, string, time.Time) (domain.Session, error) {
	return domain.Session{}, nil
}

func (r *recoveryRepo) SessionByTokenHash(context.Context, string) (domain.Session, domain.User, error) {
	return domain.Session{}, domain.User{}, domain.ErrNotFound
}

func (r *recoveryRepo) RotateSessionCSRF(context.Context, string, string) error {
	return nil
}

func (r *recoveryRepo) RevokeSessionByTokenHash(context.Context, string) error {
	return nil
}

func (r *recoveryRepo) IssueOneTimeToken(
	_ context.Context,
	userID string,
	purpose string,
	tokenHash string,
	expiresAt time.Time,
) error {
	r.issuedUserID = userID
	r.issuedPurpose = purpose
	r.issuedTokenHash = tokenHash
	r.issuedExpiresAt = expiresAt
	return nil
}

func (r *recoveryRepo) ResetPasswordByToken(
	_ context.Context,
	tokenHash string,
	passwordHash string,
	_ time.Time,
) (domain.User, error) {
	r.resetTokenHash = tokenHash
	r.resetPasswordHash = passwordHash
	if tokenHash == "" {
		return domain.User{}, domain.ErrNotFound
	}
	return r.userByEmail, nil
}

func (r *recoveryRepo) VerifyEmailByToken(
	_ context.Context,
	tokenHash string,
	_ time.Time,
) (domain.User, error) {
	r.verifyTokenHash = tokenHash
	if tokenHash == "" {
		return domain.User{}, domain.ErrNotFound
	}
	user := r.userByEmail
	user.EmailVerified = true
	return user, nil
}

type captureDelivery struct {
	resetEmail        string
	resetToken        string
	verificationEmail string
	verificationToken string
}

func (d *captureDelivery) SendPasswordReset(_ context.Context, email, rawToken string) error {
	d.resetEmail = email
	d.resetToken = rawToken
	return nil
}

func (d *captureDelivery) SendEmailVerification(_ context.Context, email, rawToken string) error {
	d.verificationEmail = email
	d.verificationToken = rawToken
	return nil
}

func TestForgotPasswordIsGenericForUnknownAccount(t *testing.T) {
	repo := &recoveryRepo{userByEmailErr: domain.ErrNotFound}
	delivery := &captureDelivery{}
	service := NewService(repo, delivery)

	if err := service.ForgotPassword(context.Background(), "missing@example.com"); err != nil {
		t.Fatalf("forgot password should stay generic: %v", err)
	}
	if delivery.resetToken != "" {
		t.Fatal("unknown account must not trigger a recovery delivery")
	}
}

func TestForgotPasswordStoresDigestAndDeliversRawToken(t *testing.T) {
	fixed := time.Date(2026, 9, 24, 18, 0, 0, 0, time.UTC)
	repo := &recoveryRepo{
		userByEmail: domain.User{ID: "user-1", Email: "student@example.com", Status: "active"},
	}
	delivery := &captureDelivery{}
	service := NewService(repo, delivery)
	service.now = func() time.Time { return fixed }

	if err := service.ForgotPassword(context.Background(), " STUDENT@example.com "); err != nil {
		t.Fatal(err)
	}
	if delivery.resetToken == "" {
		t.Fatal("expected raw reset token to be delivered")
	}
	if repo.issuedTokenHash == delivery.resetToken {
		t.Fatal("raw reset token must never be persisted")
	}
	if repo.issuedTokenHash != security.DigestToken(delivery.resetToken) {
		t.Fatal("persisted reset token must be a digest of the delivered token")
	}
	if repo.issuedPurpose != purposePasswordReset {
		t.Fatalf("unexpected purpose %q", repo.issuedPurpose)
	}
	if !repo.issuedExpiresAt.Equal(fixed.Add(passwordResetTTL)) {
		t.Fatalf("unexpected expiry %s", repo.issuedExpiresAt)
	}
}

func TestResetPasswordHashesPasswordAndUsesTokenDigest(t *testing.T) {
	repo := &recoveryRepo{
		userByEmail: domain.User{ID: "user-1", Email: "student@example.com", Status: "active"},
	}
	service := NewService(repo)
	rawToken := "sample-reset-token-value-123456"

	if err := service.ResetPassword(context.Background(), rawToken, "NewPassword1"); err != nil {
		t.Fatal(err)
	}
	if repo.resetTokenHash != security.DigestToken(rawToken) {
		t.Fatal("reset lookup must use token digest")
	}
	if !security.VerifyPassword(repo.resetPasswordHash, "NewPassword1") {
		t.Fatal("new password must be stored as a valid Argon2id hash")
	}
}

func TestResendVerificationSkipsVerifiedUser(t *testing.T) {
	repo := &recoveryRepo{}
	delivery := &captureDelivery{}
	service := NewService(repo, delivery)

	err := service.ResendEmailVerification(context.Background(), Authenticated{
		User: domain.User{ID: "user-1", Email: "verified@example.com", EmailVerified: true},
	})
	if err != nil {
		t.Fatal(err)
	}
	if delivery.verificationToken != "" {
		t.Fatal("verified user must not receive another verification token")
	}
}

func TestVerifyEmailUsesTokenDigest(t *testing.T) {
	repo := &recoveryRepo{
		userByEmail: domain.User{ID: "user-1", Email: "student@example.com", Status: "active"},
	}
	service := NewService(repo)
	rawToken := "sample-verification-token-123456"

	user, err := service.VerifyEmail(context.Background(), rawToken)
	if err != nil {
		t.Fatal(err)
	}
	if repo.verifyTokenHash != security.DigestToken(rawToken) {
		t.Fatal("email verification lookup must use token digest")
	}
	if !user.EmailVerified {
		t.Fatal("expected verified user")
	}
}
