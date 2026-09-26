package domain

type ProviderSessionInit struct {
	PaymentRequestID string
	UserID           string
	UserName         string
	UserEmail        string
	UserPhone        string
	ProductName      string
	AmountMinor      int64
	Currency         string
}

type ProviderSession struct {
	SessionID   string
	RedirectURL string
	Status      string
}
