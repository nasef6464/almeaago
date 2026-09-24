package application

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"net/mail"
	"regexp"
	"strings"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

const (
	loginFailureThreshold = 5
	loginLockDuration      = 15 * time.Minute
	sessionTTL             = 7 * 24 * time.Hour
	emailVerificationTTL   = 24 * time.Hour
	passwordResetTTL       = time.Hour
)

var (
	letterPattern     = regexp.MustCompile("[A-Za-z]")
	digitPattern      = regexp.MustCompile("[0-9]")
	nationalIDPattern = regexp.MustCompile("^[12][0-9]{9}$")
)

type Service struct {
	repo      Repository
	passwords PasswordHasher
	delivery  Delivery
	now       func() time.Time
}

type AuthResult struct {
	User         domain.User
	SessionToken string
	ExpiresAt    time.Time
}

func NewService(repo Repository, passwords PasswordHasher, delivery Delivery) *Service {
	return &Service{repo: repo, passwords: passwords, delivery: delivery, now: time.Now}
}

func (s *Service) Register(ctx context.Context, name, email, password, userAgent string) (AuthResult, error) {
	name = strings.TrimSpace(name)
	email, err := normalizeEmail(email)
	if err != nil || len(name) < 2 || !validPassword(password) {
		return AuthResult{}, ErrInvalidInput
	}

	passwordHash, err := s.passwords.Hash(password)
	if err != nil {
		return AuthResult{}, err
	}

	user, err := s.repo.CreateUserWithRole(ctx, name, email, passwordHash, domain.RoleStudent)
	if err != nil {
		return AuthResult{}, err
	}

	rawVerification, verificationHash, err := newOpaqueToken()
	if err != nil {
		return AuthResult{}, err
	}
	if err := s.repo.CreateOneTimeToken(ctx, user.ID, PurposeEmailVerification, verificationHash, s.now().Add(emailVerificationTTL)); err != nil {
		return AuthResult{}, err
	}
	_ = s.delivery.SendEmailVerification(ctx, user.Email, rawVerification)

	return s.issueSession(ctx, user, userAgent)
}

func (s *Service) Login(ctx context.Context, email, password, userAgent string) (AuthResult, error) {
	email, err := normalizeEmail(email)
	if err != nil || password == "" {
		return AuthResult{}, ErrInvalidCredentials
	}

	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil {
		_, _ = s.passwords.Verify(dummyArgon2Hash, password)
		return AuthResult{}, ErrInvalidCredentials
	}
	return s.loginUser(ctx, user, password, userAgent)
}

func (s *Service) LoginNationalID(ctx context.Context, nationalID, password, userAgent string) (AuthResult, error) {
	nationalID = strings.TrimSpace(nationalID)
	if !nationalIDPattern.MatchString(nationalID) || password == "" {
		return AuthResult{}, ErrInvalidCredentials
	}
	user, err := s.repo.FindUserByNationalID(ctx, nationalID)
	if err != nil {
		_, _ = s.passwords.Verify(dummyArgon2Hash, password)
		return AuthResult{}, ErrInvalidCredentials
	}
	return s.loginUser(ctx, user, password, userAgent)
}

func (s *Service) loginUser(ctx context.Context, user domain.User, password, userAgent string) (AuthResult, error) {
	now := s.now()
	if user.LoginLockedUntil != nil && user.LoginLockedUntil.After(now) {
		return AuthResult{}, ErrAccountLocked
	}
	if !user.Active() {
		return AuthResult{}, ErrAccountDisabled
	}

	valid, err := s.passwords.Verify(user.PasswordHash, password)
	if err != nil || !valid {
		_ = s.repo.RecordFailedLogin(ctx, user.ID, loginFailureThreshold, now.Add(loginLockDuration))
		return AuthResult{}, ErrInvalidCredentials
	}
	if err := s.repo.ClearFailedLogin(ctx, user.ID); err != nil {
		return AuthResult{}, err
	}
	user.FailedLoginAttempts = 0
	user.LastFailedLoginAt = nil
	user.LoginLockedUntil = nil
	return s.issueSession(ctx, user, userAgent)
}

func (s *Service) issueSession(ctx context.Context, user domain.User, userAgent string) (AuthResult, error) {
	raw, hash, err := newOpaqueToken()
	if err != nil {
		return AuthResult{}, err
	}
	expiresAt := s.now().Add(sessionTTL)
	if err := s.repo.CreateSession(ctx, user.ID, hash, strings.TrimSpace(userAgent), expiresAt); err != nil {
		return AuthResult{}, err
	}
	return AuthResult{User: user, SessionToken: raw, ExpiresAt: expiresAt}, nil
}

func (s *Service) Authenticate(ctx context.Context, rawSessionToken string) (domain.User, error) {
	if strings.TrimSpace(rawSessionToken) == "" {
		return domain.User{}, ErrUnauthenticated
	}
	user, err := s.repo.FindUserBySessionHash(ctx, hashToken(rawSessionToken))
	if err != nil || !user.Active() {
		return domain.User{}, ErrUnauthenticated
	}
	return user, nil
}

func (s *Service) Logout(ctx context.Context, rawSessionToken string) error {
	if strings.TrimSpace(rawSessionToken) == "" {
		return nil
	}
	return s.repo.RevokeSessionByHash(ctx, hashToken(rawSessionToken))
}

func (s *Service) ForgotPassword(ctx context.Context, email string) error {
	email, err := normalizeEmail(email)
	if err != nil {
		return nil
	}
	user, err := s.repo.FindUserByEmail(ctx, email)
	if err != nil || !user.Active() {
		return nil
	}
	raw, hash, err := newOpaqueToken()
	if err != nil {
		return err
	}
	if err := s.repo.CreateOneTimeToken(ctx, user.ID, PurposePasswordReset, hash, s.now().Add(passwordResetTTL)); err != nil {
		return err
	}
	_ = s.delivery.SendPasswordReset(ctx, user.Email, raw)
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, rawToken, password string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" || !validPassword(password) {
		return domain.User{}, ErrInvalidInput
	}
	passwordHash, err := s.passwords.Hash(password)
	if err != nil {
		return domain.User{}, err
	}
	user, err := s.repo.ResetPasswordByToken(ctx, hashToken(rawToken), passwordHash, s.now())
	if err != nil {
		return domain.User{}, ErrInvalidToken
	}
	return user, nil
}

func (s *Service) VerifyEmail(ctx context.Context, rawToken string) (domain.User, error) {
	if strings.TrimSpace(rawToken) == "" {
		return domain.User{}, ErrInvalidToken
	}
	user, err := s.repo.VerifyEmailByToken(ctx, hashToken(rawToken), s.now())
	if err != nil {
		return domain.User{}, ErrInvalidToken
	}
	return user, nil
}

func (s *Service) ResendEmailVerification(ctx context.Context, user domain.User) error {
	if user.EmailVerified() {
		return nil
	}
	raw, hash, err := newOpaqueToken()
	if err != nil {
		return err
	}
	if err := s.repo.CreateOneTimeToken(ctx, user.ID, PurposeEmailVerification, hash, s.now().Add(emailVerificationTTL)); err != nil {
		return err
	}
	return s.delivery.SendEmailVerification(ctx, user.Email, raw)
}

func validPassword(password string) bool {
	return len(password) >= 8 &&
		len(password) <= 160 &&
		letterPattern.MatchString(password) &&
		digitPattern.MatchString(password)
}

func normalizeEmail(value string) (string, error) {
	email := strings.ToLower(strings.TrimSpace(value))
	address, err := mail.ParseAddress(email)
	if err != nil || strings.ToLower(address.Address) != email {
		return "", ErrInvalidInput
	}
	return email, nil
}

func newOpaqueToken() (raw string, hash string, err error) {
	buffer := make([]byte, 32)
	if _, err = rand.Read(buffer); err != nil {
		return "", "", err
	}
	raw = base64.RawURLEncoding.EncodeToString(buffer)
	return raw, hashToken(raw), nil
}

func hashToken(raw string) string {
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

const dummyArgon2Hash = "$argon2id$v=19$m=65536,t=3,p=2$MDEyMzQ1Njc4OWFiY2RlZg$waGIuS/4ugIZfWob0q6bwNCu7kJJvqbf9U+PAN1WQww"
