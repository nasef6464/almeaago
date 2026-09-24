package application

import "context"

type Delivery interface {
	SendEmailVerification(ctx context.Context, email, rawToken string) error
	SendPasswordReset(ctx context.Context, email, rawToken string) error
}

type DiscardDelivery struct{}

func (DiscardDelivery) SendEmailVerification(context.Context, string, string) error {
	return nil
}

func (DiscardDelivery) SendPasswordReset(context.Context, string, string) error {
	return nil
}
