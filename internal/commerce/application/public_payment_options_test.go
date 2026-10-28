package application

import (
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	"testing"
)

func TestPublicPaymentOptionsReflectServerGateway(t *testing.T) {
	manual := NewCheckoutService(nil, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayManualReview, ProviderCode: "manual"}).PublicPaymentOptions()
	if len(manual.Methods) != 3 {
		t.Fatal(manual)
	}
	unconfigured := NewCheckoutService(nil, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayPaymentLink, ProviderCode: "tap"}).PublicPaymentOptions()
	if len(unconfigured.Methods) != 0 {
		t.Fatalf("unconfigured provider offered: %#v", unconfigured)
	}
	configured := NewCheckoutServiceWithProvider(nil, commerce.CheckoutPolicy{GatewayMode: commerce.GatewayPaymentLink, ProviderCode: "tap"}, nil, &sessionInitiatorStub{}).PublicPaymentOptions()
	if len(configured.Methods) != 1 || configured.Methods[0] != commerce.PaymentCard {
		t.Fatalf("payment-link methods: %#v", configured)
	}
}
