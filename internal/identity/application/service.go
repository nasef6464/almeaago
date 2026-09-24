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
	ErrProviderUnavailable = errors.New("provider unavailable")
	ErrRateLimited         = errors.New("rate limited")
	ErrTooManyAttempts     = errors.New("too many attempts")
)

const (
	sessionTTL           = 7 * 24 * time.Hour
	lockDuration         = 15 * time.Minute
	maxFailedAttempts    = 5
	passwordResetTTL     = time.Hour
	emailVerificationTTL = 24 * time.Hour
	purposePasswordReset = "password_reset"
	purposeEmailVerify   = "email_verification"
	whatsAppOTPTTL       = 10 * time.Minute
	whatsAppOTPLimit     = 3
	whatsAppOTPWindow    = 15 * time.Minute
	whatsAppMaxAttempts  = 5
)

var (
	nationalIDPattern = regexp.MustCompile(`^[12][0-9]{9}$`)
	otpPattern        = regexp.MustCompile(`^[0-9]{6}$`)
)

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

	CountRecentOTPChallenges(ctx context.Context, phone, channel string, since time.Time) (int, error)
	CreateOTPChallenge(ctx context.Context, phone, channel, codeHash string, expiresAt time.Time) (domain.OTPChallenge, error)
	LatestActiveOTPChallenge(ctx context.Context, phone, channel string) (domain.OTPChallenge, error)
	IncrementOTPAttempts(ctx context.Context, challengeID string) error
	ConsumeOTPChallenge(ctx context.Context, challengeID string) error
	ExpireOTPChallenge(ctx context.Context, challengeID string) error
	ResolveWhatsAppUser(ctx context.Context, phone string, verifiedAt time.Time) (domain.User, error)
	ResolveGoogleUser(ctx context.Context, profile domain.GoogleProfile, verifiedAt time.Time) (domain.User, error)
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

type WhatsAppOTPDelivery interface {
	Available() bool
	SendOTP(ctx context.Context, phone, code string, ttl time.Duration) error
}

type UnavailableWhatsAppDelivery struct{}

func (UnavailableWhatsAppDelivery) Available() bool {
	return false
}

func (UnavailableWhatsAppDelivery) SendOTP(context.Context, string, string, time.Duration) error {
	return ErrProviderUnavailable
}

type ServiceOptions struct {
	EmailDelivery    Delivery
	WhatsAppDelivery WhatsAppOTPDelivery
	OTPPepper        string
}

type Service struct {
	repo      Repository
	delivery  Delivery
	whatsApp  WhatsAppOTPDelivery
	otpPepper string
	now       func() time.Time
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

type OTPStartResult struct {
	ExpiresInSeconds int
}

func NewService(repo Repository, deliveries ...Delivery) *Service {
	var emailDelivery Delivery = DiscardDelivery{}
	if len(deliveries) > 0 && deliveries[0] != nil {
		emailDelivery = deliveries[0]
	}
	return NewServiceWithOptions(repo, ServiceOptions{EmailDelivery: emailDelivery})
}

func NewServiceWithOptions(repo Repository, options ServiceOptions) *Service {
	emailDelivery := options.EmailDelivery
	if emailDelivery == nil {
		emailDelivery = DiscardDelivery{}
	}
	whatsApp := options.WhatsAppDelivery
	if whatsApp == nil {
		whatsApp = UnavailableWhatsAppDelivery{}
	}
	return &Service{
		repo:      repo,
		delivery:  emailDelivery,
		whatsApp:  whatsApp,
		otpPepper: options.OTPPepper,
		now:       time.Now,
	}
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

func (s *Service) StartWhatsAppOTP(ctx context.Context, phone string) (OTPStartResult, error) {
	normalized, ok := domain.NormalizeSaudiPhone(phone)
	if !ok {
		return OTPStartResult{}, ErrInvalidInput
	}
	if !s.whatsApp.Available() || len(s.otpPepper) < 32 {
		return OTPStartResult{}, ErrProviderUnavailable
	}

	recent, err := s.repo.CountRecentOTPChallenges(
		ctx,
		normalized,
		"whatsapp",
		s.now().Add(-whatsAppOTPWindow),
	)
	if err != nil {
		return OTPStartResult{}, err
	}
	if recent >= whatsAppOTPLimit {
		return OTPStartResult{}, ErrRateLimited
	}

	code, err := security.NewNumericCode(6)
	if err != nil {
		return OTPStartResult{}, err
	}
	codeHash, err := security.DigestOTP(s.otpPepper, normalized, code)
	if err != nil {
		return OTPStartResult{}, err
	}

	challenge, err := s.repo.CreateOTPChallenge(
		ctx,
		normalized,
		"whatsapp",
		codeHash,
		s.now().Add(whatsAppOTPTTL),
	)
	if err != nil {
		return OTPStartResult{}, err
	}

	if err := s.whatsApp.SendOTP(ctx, normalized, code, whatsAppOTPTTL); err != nil {
		_ = s.repo.ExpireOTPChallenge(ctx, challenge.ID)
		return OTPStartResult{}, ErrProviderUnavailable
	}

	return OTPStartResult{ExpiresInSeconds: int(whatsAppOTPTTL.Seconds())}, nil
}

func (s *Service) VerifyWhatsAppOTP(ctx context.Context, phone, code string) (AuthResult, error) {
	normalized, ok := domain.NormalizeSaudiPhone(phone)
	code = strings.TrimSpace(code)
	if !ok || !otpPattern.MatchString(code) {
		return AuthResult{}, ErrInvalidInput
	}
	if len(s.otpPepper) < 32 {
		return AuthResult{}, ErrProviderUnavailable
	}

	challenge, err := s.repo.LatestActiveOTPChallenge(ctx, normalized, "whatsapp")
	if errors.Is(err, domain.ErrNotFound) {
		return AuthResult{}, ErrInvalidToken
	}
	if err != nil {
		return AuthResult{}, err
	}
	if challenge.ExpiresAt.Before(s.now()) {
		_ = s.repo.ExpireOTPChallenge(ctx, challenge.ID)
		return AuthResult{}, ErrInvalidToken
	}
	if challenge.Attempts >= whatsAppMaxAttempts {
		return AuthResult{}, ErrTooManyAttempts
	}

	if !security.VerifyOTPDigest(s.otpPepper, normalized, code, challenge.CodeHash) {
		_ = s.repo.IncrementOTPAttempts(ctx, challenge.ID)
		return AuthResult{}, ErrInvalidCredentials
	}

	if err := s.repo.ConsumeOTPChallenge(ctx, challenge.ID); err != nil {
		return AuthResult{}, err
	}
	user, err := s.repo.ResolveWhatsAppUser(ctx, normalized, s.now())
	if err != nil {
		return AuthResult{}, err
	}
	if user.IsDisabled() {
		return AuthResult{}, ErrAccountDisabled
	}
	return s.createSession(ctx, user)
}

func (s *Service) LoginGoogle(ctx context.Context, profile domain.GoogleProfile) (AuthResult, error) {
	profile.Subject = strings.TrimSpace(profile.Subject)
	profile.Email = normalizeEmail(profile.Email)
	profile.Name = strings.TrimSpace(profile.Name)
	profile.AvatarURL = strings.TrimSpace(profile.AvatarURL)

	if profile.Subject == "" || !profile.EmailVerified || !validEmail(profile.Email) {
		return AuthResult{}, ErrInvalidCredentials
	}

	user, err := s.repo.ResolveGoogleUser(ctx, profile, s.now())
	if err != nil {
		return AuthResult{}, err
	}
	if user.IsDisabled() {
		return AuthResult{}, ErrAccountDisabled
	}
	return s.createSession(ctx, user)
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
	if user.IsDisabled() || user.Email == "" {
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
	if auth.User.EmailVerified || auth.User.Email == "" {
		return nil
	}
	return s.issueEmailVerification(ctx, auth.User)
}

func (s *Service) issueEmailVerification(ctx context.Context, user domain.User) error {
	if user.Email == "" {
		return nil
	}
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
	if user.PasswordHash == "" {
		return AuthResult{}, ErrPasswordUnavailable
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
