package application

import (
	"context"
	"errors"
	"fmt"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/platform/security"
)

var (
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrLoginLocked        = errors.New("login locked")
	ErrEmailExists        = errors.New("email already exists")
	ErrInvalidInput       = errors.New("invalid input")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrCSRF               = errors.New("invalid csrf token")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

const (
	sessionTTL           = 7 * 24 * time.Hour
	lockDuration         = 15 * time.Minute
	maxFailedAttempts    = 5
	emailVerificationTTL = 24 * time.Hour
	passwordResetTTL     = time.Hour
)

var nationalIDPattern = regexp.MustCompile("^[12][0-9]{9}$")

const dummyPasswordHash = "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"

type Repository interface {
	CreateRegisteredUser(
		ctx context.Context,
		name string,
		email string,
		passwordHash string,
		role domain.Role,
		verificationTokenHash string,
		verificationExpiresAt time.Time,
	) (domain.User, error)
	UserByEmail(ctx context.Context, email string) (domain.User, error)
	UserByNationalID(ctx context.Context, nationalID string) (domain.User, error)
	UserByPhone(ctx context.Context, phone string) (domain.User, error)
	UserByID(ctx context.Context, id string) (domain.User, error)
	RecordFailedLogin(ctx context.Context, userID string, threshold int, lockDuration time.Duration) error
	ClearFailedLogin(ctx context.Context, userID string) error
	UpdatePasswordHash(ctx context.Context, userID, passwordHash string) error
	CreateSession(ctx context.Context, userID, tokenHash, csrfHash string, expiresAt time.Time) (domain.Session, error)
	SessionByTokenHash(ctx context.Context, tokenHash string) (domain.Session, domain.User, error)
	RotateSessionCSRF(ctx context.Context, sessionID, csrfHash string) error
	RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error
	ReplaceOneTimeToken(
		ctx context.Context,
		userID string,
		purpose string,
		tokenHash string,
		expiresAt time.Time,
	) error
	ConsumePasswordResetToken(
		ctx context.Context,
		tokenHash string,
		newPasswordHash string,
		changedAt time.Time,
	) (domain.User, error)
	ConsumeEmailVerificationToken(
		ctx context.Context,
		tokenHash string,
		verifiedAt time.Time,
	) (domain.User, error)
}

type Service struct {
	repo     Repository
	delivery Delivery
	now      func() time.Time
}

type AuthResult struct {
	User         domain.User
	SessionToken string
	CSRFToken    string
	ExpiresAt    time.Time
}

type Authenticated struct {
	User    domain.User
	Session domain.Session
}

func NewService(repo Repository, delivery Delivery) *Service {
	if delivery == nil {
		delivery = DiscardDelivery{}
	}
	return &Service{repo: repo, delivery: delivery, now: time.Now}
}

func (s *Service) Register(ctx context.Context, name, email, password string) (AuthResult, error) {
	name = strings.TrimSpace(name)
	email = normalizeEmail(email)
	if len(name) < 2 || !validEmail(email) || !validPassword(password) {
		return AuthResult{}, ErrInvalidInput
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return AuthResult{}, fmt.Errorf("hash password: %w", err)
	}

	verificationToken, err := security.NewOpaqueToken(32)
	if err != nil {
		return AuthResult{}, err
	}

	user, err := s.repo.CreateRegisteredUser(
		ctx,
		name,
		email,
		passwordHash,
		domain.RoleStudent,
		security.DigestToken(verificationToken),
		s.now().Add(emailVerificationTTL),
	)
	if errors.Is(err, domain.ErrConflict) {
		return AuthResult{}, ErrEmailExists
	}
	if err != nil {
		return AuthResult{}, err
	}

	_ = s.delivery.SendEmailVerification(ctx, user.Email, verificationToken)
	return s.createSession(ctx, user)
}

func (s *Service) Login(ctx context.Context, email, password string) (AuthResult, error) {
	user, err := s.repo.UserByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrNotFound) {
		_ = security.VerifyPassword(dummyPasswordHash, password)
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	return s.loginUser(ctx, user, password)
}

func (s *Service) LoginNationalID(ctx context.Context, nationalID, password string) (AuthResult, error) {
	nationalID = strings.TrimSpace(nationalID)
	if !nationalIDPattern.MatchString(nationalID) {
		return AuthResult{}, ErrInvalidCredentials
	}

	user, err := s.repo.UserByNationalID(ctx, nationalID)
	if errors.Is(err, domain.ErrNotFound) {
		_ = security.VerifyPassword(dummyPasswordHash, password)
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	return s.loginUser(ctx, user, password)
}

func (s *Service) LoginPhone(ctx context.Context, phone, password string) (AuthResult, error) {
	phone = normalizePhone(phone)
	if len(phone) < 8 || len(phone) > 24 {
		return AuthResult{}, ErrInvalidCredentials
	}

	user, err := s.repo.UserByPhone(ctx, phone)
	if errors.Is(err, domain.ErrNotFound) {
		_ = security.VerifyPassword(dummyPasswordHash, password)
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	return s.loginUser(ctx, user, password)
}

func (s *Service) Authenticate(ctx context.Context, rawToken string) (Authenticated, error) {
	if strings.TrimSpace(rawToken) == "" {
		return Authenticated{}, ErrUnauthenticated
	}

	session, user, err := s.repo.SessionByTokenHash(ctx, security.DigestToken(rawToken))
	if errors.Is(err, domain.ErrNotFound) {
		return Authenticated{}, ErrUnauthenticated
	}
	if err != nil {
		return Authenticated{}, err
	}
	if session.ExpiresAt.Before(s.now()) {
		return Authenticated{}, ErrUnauthenticated
	}
	if user.IsDisabled() {
		return Authenticated{}, ErrAccountDisabled
	}

	return Authenticated{User: user, Session: session}, nil
}

func (s *Service) RotateCSRF(ctx context.Context, auth Authenticated) (string, error) {
	raw, err := security.NewOpaqueToken(32)
	if err != nil {
		return "", err
	}
	if err := s.repo.RotateSessionCSRF(ctx, auth.Session.ID, security.DigestToken(raw)); err != nil {
		return "", err
	}
	return raw, nil
}

func (s *Service) VerifyCSRF(auth Authenticated, rawCSRF string) error {
	if rawCSRF == "" || security.DigestToken(rawCSRF) != auth.Session.CSRFHash {
		return ErrCSRF
	}
	return nil
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	if rawToken == "" {
		return nil
	}
	return s.repo.RevokeSessionByTokenHash(ctx, security.DigestToken(rawToken))
}

func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	user, err := s.repo.UserByEmail(ctx, normalizeEmail(email))
	if err != nil || user.IsDisabled() {
		return nil
	}

	rawToken, err := security.NewOpaqueToken(32)
	if err != nil {
		return nil
	}
	if err := s.repo.ReplaceOneTimeToken(
		ctx,
		user.ID,
		"password_reset",
		security.DigestToken(rawToken),
		s.now().Add(passwordResetTTL),
	); err != nil {
		return nil
	}

	_ = s.delivery.SendPasswordReset(ctx, user.Email, rawToken)
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, rawToken, password string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" || !validPassword(password) {
		return domain.User{}, ErrInvalidInput
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return domain.User{}, err
	}

	user, err := s.repo.ConsumePasswordResetToken(
		ctx,
		security.DigestToken(rawToken),
		passwordHash,
		s.now(),
	)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrInvalidToken
	}
	return user, err
}

func (s *Service) VerifyEmail(ctx context.Context, rawToken string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" {
		return domain.User{}, ErrInvalidToken
	}

	user, err := s.repo.ConsumeEmailVerificationToken(
		ctx,
		security.DigestToken(rawToken),
		s.now(),
	)
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrInvalidToken
	}
	return user, err
}

func (s *Service) ResendEmailVerification(ctx context.Context, user domain.User) error {
	if user.EmailVerified {
		return nil
	}

	rawToken, err := security.NewOpaqueToken(32)
	if err != nil {
		return err
	}
	if err := s.repo.ReplaceOneTimeToken(
		ctx,
		user.ID,
		"email_verification",
		security.DigestToken(rawToken),
		s.now().Add(emailVerificationTTL),
	); err != nil {
		return err
	}

	_ = s.delivery.SendEmailVerification(ctx, user.Email, rawToken)
	return nil
}

func (s *Service) loginUser(ctx context.Context, user domain.User, password string) (AuthResult, error) {
	now := s.now()
	if user.IsLoginLocked(now) {
		return AuthResult{}, ErrLoginLocked
	}
	if user.IsDisabled() {
		return AuthResult{}, ErrAccountDisabled
	}
	if !security.VerifyPassword(user.PasswordHash, password) {
		_ = s.repo.RecordFailedLogin(ctx, user.ID, maxFailedAttempts, lockDuration)
		return AuthResult{}, ErrInvalidCredentials
	}

	if security.PasswordHashNeedsUpgrade(user.PasswordHash) {
		upgraded, err := security.HashPassword(password)
		if err == nil {
			if err := s.repo.UpdatePasswordHash(ctx, user.ID, upgraded); err == nil {
				user.PasswordHash = upgraded
			}
		}
	}

	if err := s.repo.ClearFailedLogin(ctx, user.ID); err != nil {
		return AuthResult{}, err
	}

	user.FailedLoginAttempts = 0
	user.LoginLockedUntil = time.Time{}
	return s.createSession(ctx, user)
}

func (s *Service) createSession(ctx context.Context, user domain.User) (AuthResult, error) {
	sessionToken, err := security.NewOpaqueToken(32)
	if err != nil {
		return AuthResult{}, err
	}
	csrfToken, err := security.NewOpaqueToken(32)
	if err != nil {
		return AuthResult{}, err
	}

	expiresAt := s.now().Add(sessionTTL)
	_, err = s.repo.CreateSession(
		ctx,
		user.ID,
		security.DigestToken(sessionToken),
		security.DigestToken(csrfToken),
		expiresAt,
	)
	if err != nil {
		return AuthResult{}, err
	}

	return AuthResult{
		User:         user,
		SessionToken: sessionToken,
		CSRFToken:    csrfToken,
		ExpiresAt:    expiresAt,
	}, nil
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizePhone(value string) string {
	var builder strings.Builder
	builder.Grow(len(value))
	for _, r := range value {
		if r >= '0' && r <= '9' {
			builder.WriteRune(r)
		}
	}
	return builder.String()
}

func validEmail(value string) bool {
	address, err := mail.ParseAddress(value)
	return err == nil && strings.EqualFold(address.Address, value)
}

func validPassword(value string) bool {
	if len(value) < 8 || len(value) > 160 {
		return false
	}

	hasLetter := false
	hasDigit := false
	for _, r := range value {
		if (r >= 'A' && r <= 'Z') || (r >= 'a' && r <= 'z') {
			hasLetter = true
		}
		if r >= '0' && r <= '9' {
			hasDigit = true
		}
	}
	return hasLetter && hasDigit
}
