package application

import (
	"context"
	"errors"
	"time"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	ErrInvalidInput       = errors.New("invalid input")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrAccountLocked      = errors.New("account locked")
	ErrAccountDisabled    = errors.New("account disabled")
	ErrEmailExists        = errors.New("email already exists")
	ErrUnauthenticated    = errors.New("unauthenticated")
	ErrInvalidToken       = errors.New("invalid or expired token")
)

const (
	PurposeEmailVerification = "email_verification"
	PurposePasswordReset      = "password_reset"
)

type Repository interface {
	CreateUserWithRole(ctx context.Context, name, email, passwordHash string, role domain.Role) (domain.User, error)
	FindUserByID(ctx context.Context, userID string) (domain.User, error)
	FindUserByEmail(ctx context.Context, email string) (domain.User, error)
	FindUserByNationalID(ctx context.Context, nationalID string) (domain.User, error)
	RecordFailedLogin(ctx context.Context, userID string, threshold int, lockedUntil time.Time) error
	ClearFailedLogin(ctx context.Context, userID string) error
	CreateSession(ctx context.Context, userID, tokenHash, userAgent string, expiresAt time.Time) error
	FindUserBySessionHash(ctx context.Context, tokenHash string) (domain.User, error)
	RevokeSessionByHash(ctx context.Context, tokenHash string) error
	RevokeAllSessions(ctx context.Context, userID string) error
	CreateOneTimeToken(ctx context.Context, userID, purpose, tokenHash string, expiresAt time.Time) error
	ResetPasswordByToken(ctx context.Context, tokenHash, newPasswordHash string, changedAt time.Time) (domain.User, error)
	VerifyEmailByToken(ctx context.Context, tokenHash string, verifiedAt time.Time) (domain.User, error)
}

type PasswordHasher interface {
	Hash(password string) (string, error)
	Verify(encodedHash, password string) (bool, error)
}

type Delivery interface {
	SendEmailVerification(ctx context.Context, email, rawToken string) error
	SendPasswordReset(ctx context.Context, email, rawToken string) error
}

type DiscardDelivery struct{}

func (DiscardDelivery) SendEmailVerification(context.Context, string, string) error { return nil }
func (DiscardDelivery) SendPasswordReset(context.Context, string, string) error      { return nil }
