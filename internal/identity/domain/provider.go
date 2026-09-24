package domain

import "time"

type OTPChallenge struct {
	ID        string
	Phone     string
	Channel   string
	CodeHash  string
	ExpiresAt time.Time
	Attempts  int
	UsedAt    *time.Time
	CreatedAt time.Time
}

type GoogleProfile struct {
	Subject       string
	Email         string
	Name          string
	AvatarURL     string
	EmailVerified bool
}
