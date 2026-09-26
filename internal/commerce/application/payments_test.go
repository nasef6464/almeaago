package application

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type paymentRepoStub struct {
	repoStub
	quote              commerce.CheckoutQuote
	created            commerce.PaymentRequest
	payments           commerce.PaymentRequestPage
	discounts          commerce.DiscountPage
	discount           commerce.DiscountCode
	providerResult     commerce.ProviderEventResult
	lastCreate         commerce.PaymentRequestCreate
	lastProviderCode   string
	lastGatewayMode    commerce.GatewayMode
	lastProviderEvent  commerce.ProviderEventInput
}

func (r *paymentRepoStub) GetCheckoutQuote(context.Context,string,string,string)(commerce.CheckoutQuote,error){return r.quote,nil}
func (r *paymentRepoStub) CreatePaymentRequest(_ context.Context,_ string,in commerce.PaymentRequestCreate,provider string,mode commerce.GatewayMode)(commerce.PaymentRequest,error){r.lastCreate=in;r.lastProviderCode=provider;r.lastGatewayMode=mode;return r.created,nil}
func (r *paymentRepoStub) ListPaymentRequests(context.Context,int,int,commerce.PaymentStatus,string)(commerce.PaymentRequestPage,error){return r.payments,nil}
func (r *paymentRepoStub) GetPaymentRequest(context.Context,string)(commerce.PaymentRequest,error){return r.created,nil}
func (r *paymentRepoStub) ReviewPaymentRequest(context.Context,string,string,commerce.PaymentReview)(commerce.PaymentRequest,error){return r.created,nil}
func (r *paymentRepoStub) ListDiscountCodes(context.Context,int,int,commerce.DiscountStatus,string)(commerce.DiscountPage,error){return r.discounts,nil}
func (r *paymentRepoStub) CreateDiscountCode(context.Context,string,commerce.DiscountWrite)(commerce.DiscountCode,error){return r.discount,nil}
func (r *paymentRepoStub) UpdateDiscountCode(context.Context,string,string,int,commerce.DiscountWrite)(commerce.DiscountCode,error){return r.discount,nil}
func (r *paymentRepoStub) ApplyProviderEvent(_ context.Context,in commerce.ProviderEventInput)(commerce.ProviderEventResult,error){r.lastProviderEvent=in;return r.providerResult,nil}

func TestCheckoutDerivesGatewayAndNeverAcceptsClientAmount(t *testing.T){
	r:=&paymentRepoStub{
		quote:commerce.CheckoutQuote{ProductID:"product-1",ProductName:"Course",ProductType:commerce.ProductPackage,OriginalAmountMinor:12000,FinalAmountMinor:9000,Currency:"SAR"},
		created:commerce.PaymentRequest{ID:"pay-1"},
	}
	s:=NewServiceWithOptions(r,catalogStub{},taxonomyStub{},schoolsStub{},ServiceOptions{WebhookSecret:"test-secret"})
	out,err:=s.CreatePaymentRequest(context.Background(),studentActor(),commerce.PaymentRequestCreate{
		ProductID:"product-1",DiscountCode:"save10",PaymentMethod:commerce.PaymentCard,PaymentCountry:"SA",IdempotencyKey:"checkout-1",
	})
	if err!=nil||out.ID!="pay-1"{t.Fatalf("create failed %#v %v",out,err)}
	if r.lastProviderCode!="card"||r.lastGatewayMode!=commerce.GatewayWebhook{t.Fatalf("server gateway not derived: %q %q",r.lastProviderCode,r.lastGatewayMode)}
	if r.lastCreate.ProductID!="product-1"||r.lastCreate.DiscountCode!="SAVE10"{t.Fatalf("input normalization failed %#v",r.lastCreate)}
}

func TestManualEvidenceAndDiscountValidation(t *testing.T){
	r:=&paymentRepoStub{quote:commerce.CheckoutQuote{ProductID:"product-1",ProductType:commerce.ProductPackage,OriginalAmountMinor:1000,FinalAmountMinor:1000,Currency:"SAR"}}
	s:=NewService(r,catalogStub{},taxonomyStub{},schoolsStub{})
	_,err:=s.CreatePaymentRequest(context.Background(),studentActor(),commerce.PaymentRequestCreate{ProductID:"product-1",PaymentMethod:commerce.PaymentTransfer,PaymentCountry:"SA",IdempotencyKey:"x"})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("transfer without evidence should fail, got %v",err)}
	_,err=s.CreateDiscountCode(context.Background(),adminActor(),commerce.DiscountWrite{Code:"BAD",Type:commerce.DiscountPercentage,Value:101,Currency:"SAR",Status:commerce.DiscountActive})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("percentage >100 should fail, got %v",err)}
}

func TestProviderSignatureMustVerifyBeforeRepository(t *testing.T){
	raw:=[]byte(`{"providerCode":"card","eventId":"evt-1","paymentRequestId":"pay-1","status":"paid","amountMinor":9000,"currency":"SAR","transactionId":"tx-1"}`)
	mac:=hmac.New(sha256.New,[]byte("secret"))
	_,_=mac.Write(raw)
	signature:=hex.EncodeToString(mac.Sum(nil))
	r:=&paymentRepoStub{providerResult:commerce.ProviderEventResult{Accepted:true,ProcessingStatus:"applied"}}
	s:=NewServiceWithOptions(r,catalogStub{},taxonomyStub{},schoolsStub{},ServiceOptions{WebhookSecret:"secret"})
	in:=commerce.ProviderEventInput{ProviderCode:"card",EventID:"evt-1",PaymentRequestID:"pay-1",Status:commerce.ProviderPaid,AmountMinor:9000,Currency:"SAR",TransactionID:"tx-1"}
	if _,err:=s.ApplyProviderEvent(context.Background(),raw,"bad",in);!errors.Is(err,ErrForbidden){t.Fatalf("bad signature must fail, got %v",err)}
	out,err:=s.ApplyProviderEvent(context.Background(),raw,"sha256="+signature,in)
	if err!=nil||!out.Accepted{t.Fatalf("valid provider event failed %#v %v",out,err)}
	if r.lastProviderEvent.PayloadSHA256==""||r.lastProviderEvent.EventID!="evt-1"{t.Fatalf("provider event not trusted/captured %#v",r.lastProviderEvent)}
}

func TestProviderUnavailableFailsClosed(t *testing.T){
	r:=&paymentRepoStub{}
	s:=NewService(r,catalogStub{},taxonomyStub{},schoolsStub{})
	_,err:=s.ApplyProviderEvent(context.Background(),[]byte("{}"),"anything",commerce.ProviderEventInput{})
	if !errors.Is(err,ErrProviderUnavailable){t.Fatalf("missing secret must fail closed, got %v",err)}
}
