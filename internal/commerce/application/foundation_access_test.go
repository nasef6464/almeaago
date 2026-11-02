package application

import (
	"context"
	"errors"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type foundationScopedRepo struct { repoStub; user, path, subject, course string; kind commerce.ContentType; packageOnly bool }
func (r *foundationScopedRepo) ResolveScopedAccess(_ context.Context, user string, _ []string, path, subject, course string, kind commerce.ContentType, packageOnly bool) (commerce.AccessDecision,error) {
	r.user,r.path,r.subject,r.course,r.kind,r.packageOnly=user,path,subject,course,kind,packageOnly
	return commerce.AccessDecision{Allowed:true},nil
}
func TestFoundationAccessUsesFoundationScopedPackage(t *testing.T) {
	r:=&foundationScopedRepo{}
	s:=NewService(r,nil,nil,nil)
	if _,err:=s.CheckFoundationAccess(context.Background(),"user","path","subject"); err!=nil { t.Fatal(err) }
	if r.user!="user" || r.path!="path" || r.subject!="subject" || r.course!="" || r.kind!=commerce.ContentFoundation || !r.packageOnly { t.Fatalf("incorrect scope: %+v",r) }
	if _,err:=s.CheckFoundationAccess(context.Background(),"user","path",""); !errors.Is(err,ErrInvalidInput) { t.Fatalf("missing subject: %v",err) }
}
