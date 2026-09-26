package application

import (
	"context"
	"errors"
	"testing"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type repoStub struct {
	product commerce.Product
	page commerce.ProductPage
	entitlement commerce.Entitlement
	entitlements commerce.EntitlementPage
	decision commerce.AccessDecision
	lastUser string
	lastSchools []string
	lastCourse string
	lastPath string
	lastSubject string
	lastGrant commerce.EntitlementGrant
}
func (r *repoStub) ListProducts(context.Context,int,int,commerce.ProductType,commerce.ProductStatus,string)(commerce.ProductPage,error){return r.page,nil}
func (r *repoStub) GetProduct(context.Context,string)(commerce.Product,error){return r.product,nil}
func (r *repoStub) CreateProduct(context.Context,string,commerce.ProductWrite)(commerce.Product,error){return r.product,nil}
func (r *repoStub) UpdateProduct(context.Context,string,string,int,commerce.ProductWrite)(commerce.Product,error){return r.product,nil}
func (r *repoStub) ListEntitlements(context.Context,int,int,commerce.SubjectType,string)(commerce.EntitlementPage,error){return r.entitlements,nil}
func (r *repoStub) GrantEntitlement(_ context.Context,_ string,in commerce.EntitlementGrant)(commerce.Entitlement,error){r.lastGrant=in;return r.entitlement,nil}
func (r *repoStub) RevokeEntitlement(context.Context,string,string,int,string)(commerce.Entitlement,error){return r.entitlement,nil}
func (r *repoStub) ResolveCourseAccess(_ context.Context,user string,schools []string,course,path,subject string)(commerce.AccessDecision,error){r.lastUser=user;r.lastSchools=append([]string(nil),schools...);r.lastCourse=course;r.lastPath=path;r.lastSubject=subject;return r.decision,nil}

type catalogStub struct{ eligible bool; pathID,subjectID string }
func (c catalogStub) CourseCommerceScope(context.Context,string)(string,string,bool,error){return c.pathID,c.subjectID,c.eligible,nil}
type taxonomyStub struct{ ok bool }
func (t taxonomyStub) ValidCommerceScope(context.Context,string,string)(bool,error){return t.ok,nil}
type schoolsStub struct{ ids []string }
func (s schoolsStub) ActiveSchoolIDsForUser(context.Context,string)([]string,error){return append([]string(nil),s.ids...),nil}

func adminActor() identity.User { return identity.User{ID:"admin-1",Roles:[]identity.Role{identity.RoleAdmin}} }
func studentActor() identity.User { return identity.User{ID:"student-1",Roles:[]identity.Role{identity.RoleStudent}} }

func TestCourseProductRequiresCanonicalPublishedCourse(t *testing.T){
	r:=&repoStub{product:commerce.Product{ID:"p-1"}}
	s:=NewService(r,catalogStub{eligible:false,pathID:"path-1",subjectID:"subject-1"},taxonomyStub{ok:true},schoolsStub{})
	_,err:=s.CreateProduct(context.Background(),adminActor(),commerce.ProductWrite{
		Code:"COURSE-1",ProductType:commerce.ProductCourse,Name:"Course",Status:commerce.ProductActive,
		AccessMode:commerce.AccessPaid,PriceMinor:12000,Currency:"SAR",CourseID:"course-1",IsVisible:true,
	})
	if !errors.Is(err,commerce.ErrConflict){t.Fatalf("expected canonical course conflict, got %v",err)}
}

func TestPackageScopeIsValidatedWithoutCopyingContent(t *testing.T){
	r:=&repoStub{product:commerce.Product{ID:"pkg-1"}}
	s:=NewService(r,catalogStub{eligible:true,pathID:"path-1",subjectID:"subject-1"},taxonomyStub{ok:false},schoolsStub{})
	_,err:=s.CreateProduct(context.Background(),adminActor(),commerce.ProductWrite{
		Code:"PKG-1",ProductType:commerce.ProductPackage,Name:"Package",Status:commerce.ProductActive,
		AccessMode:commerce.AccessPaid,PriceMinor:25000,Currency:"SAR",IsVisible:true,
		Package:&commerce.PackageWrite{PackageKind:commerce.PackageBundle,Items:[]commerce.PackageItem{{ScopeType:commerce.ScopePath,PathID:"path-1"}}},
	})
	if !errors.Is(err,commerce.ErrConflict){t.Fatalf("expected taxonomy conflict, got %v",err)}
}

func TestCourseAccessComposesActiveSchoolMemberships(t *testing.T){
	r:=&repoStub{decision:commerce.AccessDecision{Allowed:true,Configured:true,Reason:"school_entitlement"}}
	s:=NewService(r,catalogStub{eligible:true,pathID:"path-1",subjectID:"subject-1"},taxonomyStub{ok:true},schoolsStub{ids:[]string{"school-1","school-2"}})
	out,err:=s.CourseAccess(context.Background(),studentActor(),"course-1")
	if err!=nil{t.Fatal(err)}
	if !out.Allowed||r.lastUser!="student-1"||r.lastCourse!="course-1"||r.lastPath!="path-1"||r.lastSubject!="subject-1"||len(r.lastSchools)!=2{
		t.Fatalf("unexpected composed access: %#v repo=%#v",out,r)
	}
}

func TestManualGrantIsAdminOnlyAndServerOwned(t *testing.T){
	now:=time.Now().UTC()
	r:=&repoStub{product:commerce.Product{ID:"course-product",Status:commerce.ProductActive},entitlement:commerce.Entitlement{ID:"e-1"}}
	s:=NewService(r,catalogStub{},taxonomyStub{},schoolsStub{})
	_,err:=s.GrantManual(context.Background(),studentActor(),commerce.EntitlementGrant{SubjectType:commerce.SubjectUser,UserID:"student-1",ProductID:"course-product",IdempotencyKey:"grant-1"})
	if !errors.Is(err,ErrForbidden){t.Fatalf("student grant should be forbidden, got %v",err)}
	out,err:=s.GrantManual(context.Background(),adminActor(),commerce.EntitlementGrant{SubjectType:commerce.SubjectUser,UserID:"student-1",ProductID:"course-product",StartsAt:&now,IdempotencyKey:"grant-1"})
	if err!=nil||out.ID!="e-1"{t.Fatalf("admin grant failed %#v %v",out,err)}
	if r.lastGrant.SubjectType!=commerce.SubjectUser||r.lastGrant.UserID!="student-1"||r.lastGrant.ProductID!="course-product"{t.Fatalf("unexpected grant %#v",r.lastGrant)}
}

func TestFreeProductMustHaveZeroPrice(t *testing.T){
	r:=&repoStub{}
	s:=NewService(r,catalogStub{eligible:true},taxonomyStub{ok:true},schoolsStub{})
	_,err:=s.CreateProduct(context.Background(),adminActor(),commerce.ProductWrite{Code:"COURSE-2",ProductType:commerce.ProductCourse,Name:"Free",Status:commerce.ProductActive,AccessMode:commerce.AccessFree,PriceMinor:1,Currency:"SAR",CourseID:"course-2"})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("expected invalid free price, got %v",err)}
}
