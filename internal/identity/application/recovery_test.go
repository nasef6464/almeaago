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
	userByEmail       domain.User
	userByEmailErr    error
	issuedUserID      string
	issuedPurpose     string
	issuedTokenHash   string
	issuedExpiresAt   time.Time
	resetTokenHash    string
	resetPasswordHash string
	verifyTokenHash   string
	phoneLookup       string

	recentOTPCount   int
	otpChallenge     domain.OTPChallenge
	otpChallengeErr  error
	otpIncrementedID string
	otpConsumedID    string
	otpExpiredID     string
	whatsAppUser     domain.User
	googleUser       domain.User
	googleProfile    domain.GoogleProfile
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

func (r *recoveryRepo) UserByPhone(_ context.Context, phone string) (domain.User, error) {
	r.phoneLookup = phone
	if r.userByEmailErr != nil {
		return domain.User{}, r.userByEmailErr
	}
	return r.userByEmail, nil
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

func (r *recoveryRepo) CountRecentOTPChallenges(
	context.Context,
	string,
	string,
	time.Time,
) (int, error) {
	return r.recentOTPCount, nil
}

func (r *recoveryRepo) CreateOTPChallenge(
	_ context.Context,
	phone string,
	channel string,
	codeHash string,
	expiresAt time.Time,
) (domain.OTPChallenge, error) {
	r.otpChallenge = domain.OTPChallenge{
		ID:        "otp-1",
		Phone:     phone,
		Channel:   channel,
		CodeHash:  codeHash,
		ExpiresAt: expiresAt,
	}
	return r.otpChallenge, nil
}

func (r *recoveryRepo) LatestActiveOTPChallenge(
	context.Context,
	string,
	string,
) (domain.OTPChallenge, error) {
	if r.otpChallengeErr != nil {
		return domain.OTPChallenge{}, r.otpChallengeErr
	}
	return r.otpChallenge, nil
}

func (r *recoveryRepo) IncrementOTPAttempts(_ context.Context, challengeID string) error {
	r.otpIncrementedID = challengeID
	return nil
}

func (r *recoveryRepo) ConsumeOTPChallenge(_ context.Context, challengeID string) error {
	r.otpConsumedID = challengeID
	return nil
}

func (r *recoveryRepo) ExpireOTPChallenge(_ context.Context, challengeID string) error {
	r.otpExpiredID = challengeID
	return nil
}

func (r *recoveryRepo) ResolveWhatsAppUser(context.Context, string, time.Time) (domain.User, error) {
	if r.whatsAppUser.ID != "" {
		return r.whatsAppUser, nil
	}
	return domain.User{
		ID:     "whatsapp-user",
		Name:   "طالب واتساب",
		Status: "active",
		Roles:  []domain.Role{domain.RoleStudent},
	}, nil
}

func (r *recoveryRepo) ResolveGoogleUser(
	_ context.Context,
	profile domain.GoogleProfile,
	_ time.Time,
) (domain.User, error) {
	r.googleProfile = profile
	if r.googleUser.ID != "" {
		return r.googleUser, nil
	}
	return domain.User{
		ID:            "google-user",
		Email:         profile.Email,
		Name:          profile.Name,
		AvatarURL:     profile.AvatarURL,
		Status:        "active",
		EmailVerified: true,
		Roles:         []domain.Role{domain.RoleStudent},
	}, nil
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

func TestPhonePasswordLoginCanonicalizesSaudiNumber(t *testing.T) {
	passwordHash, err := security.HashPassword("PhonePass123")
	if err != nil {
		t.Fatal(err)
	}
	repo := &recoveryRepo{
		userByEmail: domain.User{
			ID:           "user-phone",
			Name:         "طالب",
			Phone:        "966501234567",
			PasswordHash: passwordHash,
			Status:       "active",
			Roles:        []domain.Role{domain.RoleStudent},
		},
	}
	service := NewService(repo)

	result, err := service.LoginPhonePassword(context.Background(), "050 123 4567", "PhonePass123")
	if err != nil {
		t.Fatal(err)
	}
	if repo.phoneLookup != "966501234567" {
		t.Fatalf("expected canonical lookup, got %q", repo.phoneLookup)
	}
	if result.SessionToken == "" || result.CSRFToken == "" {
		t.Fatal("expected authenticated session")
	}
}

func TestPhonePasswordLoginRejectsProviderOnlyAccount(t *testing.T) {
	repo := &recoveryRepo{
		userByEmail: domain.User{
			ID:     "user-whatsapp",
			Name:   "طالب واتساب",
			Phone:  "966501234567",
			Status: "active",
		},
	}
	service := NewService(repo)

	_, err := service.LoginPhonePassword(context.Background(), "+966501234567", "Anything1")
	if !errors.Is(err, ErrPasswordUnavailable) {
		t.Fatalf("expected ErrPasswordUnavailable, got %v", err)
	}
}

type captureWhatsApp struct {
	available bool
	phone     string
	code      string
	ttl       time.Duration
	err       error
}

func (w *captureWhatsApp) Available() bool {
	return w.available
}

func (w *captureWhatsApp) SendOTP(_ context.Context, phone, code string, ttl time.Duration) error {
	w.phone = phone
	w.code = code
	w.ttl = ttl
	return w.err
}

func TestStartWhatsAppOTPStoresPepperedDigestOnly(t *testing.T) {
	fixed := time.Date(2026, 9, 24, 19, 0, 0, 0, time.UTC)
	repo := &recoveryRepo{}
	delivery := &captureWhatsApp{available: true}
	service := NewServiceWithOptions(repo, ServiceOptions{
		WhatsAppDelivery: delivery,
		OTPPepper:        "0123456789abcdef0123456789abcdef",
	})
	service.now = func() time.Time { return fixed }

	result, err := service.StartWhatsAppOTP(context.Background(), "0501234567")
	if err != nil {
		t.Fatal(err)
	}
	if result.ExpiresInSeconds != 600 {
		t.Fatalf("unexpected expiry %d", result.ExpiresInSeconds)
	}
	if delivery.code == "" || delivery.phone != "966501234567" {
		t.Fatalf("unexpected delivery phone=%q code=%q", delivery.phone, delivery.code)
	}
	if repo.otpChallenge.CodeHash == delivery.code {
		t.Fatal("plaintext OTP must never be stored")
	}
	if !security.VerifyOTPDigest(
		"0123456789abcdef0123456789abcdef",
		"966501234567",
		delivery.code,
		repo.otpChallenge.CodeHash,
	) {
		t.Fatal("stored OTP digest must verify with pepper and phone context")
	}
}

func TestStartWhatsAppOTPRateLimitsRecentRequests(t *testing.T) {
	repo := &recoveryRepo{recentOTPCount: whatsAppOTPLimit}
	delivery := &captureWhatsApp{available: true}
	service := NewServiceWithOptions(repo, ServiceOptions{
		WhatsAppDelivery: delivery,
		OTPPepper:        "0123456789abcdef0123456789abcdef",
	})

	_, err := service.StartWhatsAppOTP(context.Background(), "0501234567")
	if !errors.Is(err, ErrRateLimited) {
		t.Fatalf("expected ErrRateLimited, got %v", err)
	}
	if delivery.code != "" {
		t.Fatal("rate-limited request must not send OTP")
	}
}

func TestVerifyWhatsAppOTPConsumesChallengeAndCreatesSession(t *testing.T) {
	pepper := "0123456789abcdef0123456789abcdef"
	hash, err := security.DigestOTP(pepper, "966501234567", "123456")
	if err != nil {
		t.Fatal(err)
	}
	repo := &recoveryRepo{
		otpChallenge: domain.OTPChallenge{
			ID:        "otp-1",
			Phone:     "966501234567",
			Channel:   "whatsapp",
			CodeHash:  hash,
			ExpiresAt: time.Now().Add(time.Hour),
		},
		whatsAppUser: domain.User{
			ID:     "user-wa",
			Phone:  "966501234567",
			Name:   "طالب",
			Status: "active",
			Roles:  []domain.Role{domain.RoleStudent},
		},
	}
	service := NewServiceWithOptions(repo, ServiceOptions{OTPPepper: pepper})

	result, err := service.VerifyWhatsAppOTP(context.Background(), "+966501234567", "123456")
	if err != nil {
		t.Fatal(err)
	}
	if repo.otpConsumedID != "otp-1" {
		t.Fatalf("expected challenge consumption, got %q", repo.otpConsumedID)
	}
	if result.SessionToken == "" || result.CSRFToken == "" {
		t.Fatal("expected authenticated session")
	}
}

func TestVerifyWhatsAppOTPIncrementsAttemptsOnWrongCode(t *testing.T) {
	pepper := "0123456789abcdef0123456789abcdef"
	hash, err := security.DigestOTP(pepper, "966501234567", "123456")
	if err != nil {
		t.Fatal(err)
	}
	repo := &recoveryRepo{
		otpChallenge: domain.OTPChallenge{
			ID:        "otp-2",
			Phone:     "966501234567",
			Channel:   "whatsapp",
			CodeHash:  hash,
			ExpiresAt: time.Now().Add(time.Hour),
		},
	}
	service := NewServiceWithOptions(repo, ServiceOptions{OTPPepper: pepper})

	_, err = service.VerifyWhatsAppOTP(context.Background(), "0501234567", "654321")
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected invalid credentials, got %v", err)
	}
	if repo.otpIncrementedID != "otp-2" {
		t.Fatal("wrong OTP must increment attempts")
	}
}

func TestLoginGoogleRequiresVerifiedEmail(t *testing.T) {
	repo := &recoveryRepo{}
	service := NewService(repo)

	_, err := service.LoginGoogle(context.Background(), domain.GoogleProfile{
		Subject:       "sub",
		Email:         "student@example.com",
		EmailVerified: false,
	})
	if !errors.Is(err, ErrInvalidCredentials) {
		t.Fatalf("expected verified email requirement, got %v", err)
	}
}

func TestLoginGoogleResolvesProviderUserAndCreatesSession(t *testing.T) {
	repo := &recoveryRepo{}
	service := NewService(repo)

	result, err := service.LoginGoogle(context.Background(), domain.GoogleProfile{
		Subject:       "google-sub",
		Email:         "student@example.com",
		Name:          "Student",
		AvatarURL:     "https://example.test/avatar.png",
		EmailVerified: true,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.googleProfile.Subject != "google-sub" {
		t.Fatalf("provider profile was not resolved: %#v", repo.googleProfile)
	}
	if result.SessionToken == "" || result.CSRFToken == "" {
		t.Fatal("expected authenticated session")
	}
}
