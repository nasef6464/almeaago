package application

import (
	"context"
	"errors"
	"testing"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type accessRepoStub struct {
	created commerce.AccessCodeCreate
	redeemSchools []string
	assignSchools []string
}

func (r *accessRepoStub) ListAccessCodes(context.Context, int, int) (commerce.AccessCodePage, error) { return commerce.AccessCodePage{}, nil }
func (r *accessRepoStub) CreateAccessCode(_ context.Context, _ string, in commerce.AccessCodeCreate) (commerce.AccessCode, error) { r.created=in; return commerce.AccessCode{Code:in.Code},nil }
func (r *accessRepoStub) UpdateAccessCodeStatus(context.Context,string,string,int,commerce.AccessCodeStatus)(commerce.AccessCode,error){return commerce.AccessCode{},nil}
func (r *accessRepoStub) RedeemAccessCode(_ context.Context,_ string,schools []string,code string)(commerce.AccessCodeRedemption,error){r.redeemSchools=schools;return commerce.AccessCodeRedemption{AccessCode:commerce.AccessCode{Code:code}},nil}
func (r *accessRepoStub) ListSchoolSeats(context.Context,string,int,int)(commerce.SchoolSeatPage,error){return commerce.SchoolSeatPage{},nil}
func (r *accessRepoStub) AssignSchoolSeat(_ context.Context,_,_,_ string,schools []string)(commerce.SchoolSeatAssignment,error){r.assignSchools=schools;return commerce.SchoolSeatAssignment{ID:"seat-1"},nil}
func (r *accessRepoStub) RevokeSchoolSeat(context.Context,string,string,int,string)(commerce.SchoolSeatAssignment,error){return commerce.SchoolSeatAssignment{},nil}

type productReaderStub struct{ product commerce.Product }
func (r productReaderStub) GetProduct(context.Context,string)(commerce.Product,error){return r.product,nil}
type schoolResolverStub struct{ ids []string }
func (r schoolResolverStub) ActiveSchoolIDsForUser(context.Context,string)([]string,error){return r.ids,nil}

func TestAccessCodeRequiresPaidPackage(t *testing.T){
	repo:=&accessRepoStub{}
	s:=NewAccessService(repo,productReaderStub{product:commerce.Product{Status:commerce.ProductActive,AccessMode:commerce.AccessPaid,Package:&commerce.Package{}}},schoolResolverStub{})
	expires:=time.Now().UTC().Add(24*time.Hour)
	out,err:=s.CreateAccessCode(context.Background(),checkoutAdmin(),commerce.AccessCodeCreate{Code:" school-2026 ",ProductID:"product-1",MaxUses:5,ExpiresAt:expires})
	if err!=nil||out.Code!="SCHOOL-2026"{t.Fatalf("create failed: %#v %v",out,err)}
	if repo.created.Code!="SCHOOL-2026"{t.Fatalf("code not normalized: %#v",repo.created)}
}

func TestAccessCodeRejectsCourseProduct(t *testing.T){
	repo:=&accessRepoStub{}
	s:=NewAccessService(repo,productReaderStub{product:commerce.Product{Status:commerce.ProductActive,AccessMode:commerce.AccessPaid}},schoolResolverStub{})
	_,err:=s.CreateAccessCode(context.Background(),checkoutAdmin(),commerce.AccessCodeCreate{Code:"CODE-1",ProductID:"course-product",MaxUses:1,ExpiresAt:time.Now().UTC().Add(time.Hour)})
	if !errors.Is(err,commerce.ErrConflict){t.Fatalf("expected conflict, got %v",err)}
}

func TestRedeemAndSeatUseOrganizationsMembershipProjection(t *testing.T){
	repo:=&accessRepoStub{}
	s:=NewAccessService(repo,productReaderStub{},schoolResolverStub{ids:[]string{"school-1"}})
	if _,err:=s.Redeem(context.Background(),checkoutUser()," access-1 ");err!=nil{t.Fatal(err)}
	if len(repo.redeemSchools)!=1||repo.redeemSchools[0]!="school-1"{t.Fatalf("missing school projection: %#v",repo.redeemSchools)}
	if _,err:=s.AssignSchoolSeat(context.Background(),checkoutAdmin(),"school-entitlement-1","student-1");err!=nil{t.Fatal(err)}
	if len(repo.assignSchools)!=1||repo.assignSchools[0]!="school-1"{t.Fatalf("missing assignment school projection: %#v",repo.assignSchools)}
}
