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
	ErrInvalidCredentials  = errors.New("invalid credentials")
	ErrAccountDisabled     = errors.New("account disabled")
	ErrLoginLocked         = errors.New("login locked")
	ErrEmailExists         = errors.New("email already exists")
	ErrInvalidInput        = errors.New("invalid input")
	ErrUnauthenticated     = errors.New("unauthenticated")
	ErrCSRF                = errors.New("invalid csrf token")
	ErrInvalidToken        = errors.New("invalid or expired token")
	ErrPasswordUnavailable = errors.New("password unavailable")
)

const (
	sessionTTL           = 7 * 24 * time.Hour
	lockDuration         = 15 * time.Minute
	maxFailedAttempts    = 5
	passwordResetTTL     = time.Hour
	emailVerificationTTL = 24 * time.Hour
	purposePasswordReset = "password_reset"
	purposeEmailVerify   = "email_verification"
)

var nationalIDPattern = regexp.MustCompile(`^[12][0-9]{9}$`)

type Repository interface {
	CreateUser(ctx context.Context, name, email, passwordHash string, role domain.Role) (domain.User, error)
	UserByEmail(ctx context.Context, email string) (domain.User, error)
	UserByNationalID(ctx context.Context, nationalID string) (domain.User, error)
	UserByPhone(ctx context.Context, phone string) (domain.User, error)
	UserByID(ctx context.Context, id string) (domain.User, error)
	RecordFailedLogin(ctx context.Context, userID string, threshold int, lockDuration time.Duration) error
	ClearFailedLogin(ctx context.Context, userID string) error
	CreateSession(ctx context.Context, userID, tokenHash, csrfHash string, expiresAt time.Time) (domain.Session, error)
	SessionByTokenHash(ctx context.Context, tokenHash string) (domain.Session, domain.User, error)
	RotateSessionCSRF(ctx context.Context, sessionID, csrfHash string) error
	RevokeSessionByTokenHash(ctx context.Context, tokenHash string) error
	IssueOneTimeToken(ctx context.Context, userID, purpose, tokenHash string, expiresAt time.Time) error
	ResetPasswordByToken(ctx context.Context, tokenHash, passwordHash string, changedAt time.Time) (domain.User, error)
	VerifyEmailByToken(ctx context.Context, tokenHash string, verifiedAt time.Time) (domain.User, error)
}

type Delivery interface {
	SendPasswordReset(ctx context.Context, email, rawToken string) error
	SendEmailVerification(ctx context.Context, email, rawToken string) error
}

type DiscardDelivery struct{}

func (DiscardDelivery) SendPasswordReset(context.Context, string, string) error {
	return nil
}

func (DiscardDelivery) SendEmailVerification(context.Context, string, string) error {
	return nil
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

func NewService(repo Repository, deliveries ...Delivery) *Service {
	var delivery Delivery = DiscardDelivery{}
	if len(deliveries) > 0 && deliveries[0] != nil {
		delivery = deliveries[0]
	}
	return &Service{repo: repo, delivery: delivery, now: time.Now}
}

func (s *Service) Register(ctx context.Context, name, email, password string) (AuthResult, error) {
	name = strings.TrimSpace(name)
	email = normalizeEmail(email)
	if len(name) < 2 || !validEmail(email) || !validPassword(password) {
		return AuthResult{}, ErrInvalidInput
	}

	hash, err := security.HashPassword(password)
	if err != nil {
		return AuthResult{}, fmt.Errorf("hash password: %w", err)
	}

	user, err := s.repo.CreateUser(ctx, name, email, hash, domain.RoleStudent)
	if errors.Is(err, domain.ErrConflict) {
		return AuthResult{}, ErrEmailExists
	}
	if err != nil {
		return AuthResult{}, err
	}

	result, err := s.createSession(ctx, user)
	if err != nil {
		return AuthResult{}, err
	}

	// Verification delivery must never make a successfully-created account unusable.
	_ = s.issueEmailVerification(ctx, user)
	return result, nil
}

func (s *Service) Login(ctx context.Context, email, password string) (AuthResult, error) {
	user, err := s.repo.UserByEmail(ctx, normalizeEmail(email))
	if errors.Is(err, domain.ErrNotFound) {
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
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	return s.loginUser(ctx, user, password)
}

func (s *Service) LoginPhonePassword(ctx context.Context, phone, password string) (AuthResult, error) {
	normalized, ok := domain.NormalizeSaudiPhone(phone)
	if !ok || strings.TrimSpace(password) == "" {
		return AuthResult{}, ErrInvalidCredentials
	}

	user, err := s.repo.UserByPhone(ctx, normalized)
	if errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, ErrInvalidCredentials
	}
	if err != nil {
		return AuthResult{}, err
	}
	if strings.TrimSpace(user.PasswordHash) == "" {
		return AuthResult{}, ErrPasswordUnavailable
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
	email = normalizeEmail(email)
	if !validEmail(email) {
		return nil
	}

	user, err := s.repo.UserByEmail(ctx, email)
	if errors.Is(err, domain.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	if user.IsDisabled() {
		return nil
	}

	raw, err := security.NewOpaqueToken(32)
	if err != nil {
		return err
	}
	if err := s.repo.IssueOneTimeToken(
		ctx,
		user.ID,
		purposePasswordReset,
		security.DigestToken(raw),
		s.now().Add(passwordResetTTL),
	); err != nil {
		return err
	}

	return s.delivery.SendPasswordReset(ctx, user.Email, raw)
}

func (s *Service) ResetPassword(ctx context.Context, rawToken, password string) error {
	if strings.TrimSpace(rawToken) == "" || !validPassword(password) {
		return ErrInvalidInput
	}

	passwordHash, err := security.HashPassword(password)
	if err != nil {
		return err
	}

	_, err = s.repo.ResetPasswordByToken(
		ctx,
		security.DigestToken(rawToken),
		passwordHash,
		s.now(),
	)
	if errors.Is(err, domain.ErrNotFound) {
		return ErrInvalidToken
	}
	return err
}

func (s *Service) VerifyEmail(ctx context.Context, rawToken string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" {
		return domain.User{}, ErrInvalidToken
	}

	user, err := s.repo.VerifyEmailByToken(ctx, security.DigestToken(rawToken), s.now())
	if errors.Is(err, domain.ErrNotFound) {
		return domain.User{}, ErrInvalidToken
	}
	return user, err
}

func (s *Service) ResendEmailVerification(ctx context.Context, auth Authenticated) error {
	if auth.User.EmailVerified {
		return nil
	}
	return s.issueEmailVerification(ctx, auth.User)
}

func (s *Service) issueEmailVerification(ctx context.Context, user domain.User) error {
	raw, err := security.NewOpaqueToken(32)
	if err != nil {
		return err
	}
	if err := s.repo.IssueOneTimeToken(
		ctx,
		user.ID,
		purposeEmailVerify,
		security.DigestToken(raw),
		s.now().Add(emailVerificationTTL),
	); err != nil {
		return err
	}
	return s.delivery.SendEmailVerification(ctx, user.Email, raw)
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
