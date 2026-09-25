package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type mutationRepoStub struct{ lastSkill taxonomy.SkillWrite }

func (r *mutationRepoStub) PublicBootstrap(context.Context,bool)(taxonomy.Bootstrap,error){return taxonomy.Bootstrap{},nil}
func (r *mutationRepoStub) CreatePath(context.Context,string,taxonomy.PathWrite)(taxonomy.Path,error){return taxonomy.Path{},nil}
func (r *mutationRepoStub) UpdatePath(context.Context,string,string,taxonomy.PathPatch)(taxonomy.Path,error){return taxonomy.Path{},nil}
func (r *mutationRepoStub) CreateLevel(context.Context,string,taxonomy.LevelWrite)(taxonomy.Level,error){return taxonomy.Level{},nil}
func (r *mutationRepoStub) UpdateLevel(context.Context,string,string,taxonomy.LevelPatch)(taxonomy.Level,error){return taxonomy.Level{},nil}
func (r *mutationRepoStub) CreateSubject(context.Context,string,taxonomy.SubjectWrite)(taxonomy.Subject,error){return taxonomy.Subject{},nil}
func (r *mutationRepoStub) UpdateSubject(context.Context,string,string,taxonomy.SubjectPatch)(taxonomy.Subject,error){return taxonomy.Subject{},nil}
func (r *mutationRepoStub) CreateSkill(_ context.Context,_ string,w taxonomy.SkillWrite)(taxonomy.Skill,error){r.lastSkill=w;return taxonomy.Skill{},nil}
func (r *mutationRepoStub) UpdateSkill(context.Context,string,string,taxonomy.SkillPatch)(taxonomy.Skill,error){return taxonomy.Skill{},nil}

func taxonomyActor(role identity.Role) identity.User { return identity.User{ID:"actor-1",Roles:[]identity.Role{role}} }

func TestTaxonomyMutationRequiresPlatformAdmin(t *testing.T){
	s:=NewService(&mutationRepoStub{})
	_,err:=s.CreateLevel(context.Background(),taxonomyActor(identity.RoleTeacher),taxonomy.LevelWrite{PathID:"path-1",Code:"L1",Name:"Level"})
	if !errors.Is(err,ErrForbidden){t.Fatalf("expected forbidden, got %v",err)}
}

func TestSubSkillRequiresParent(t *testing.T){
	s:=NewService(&mutationRepoStub{})
	_,err:=s.CreateSkill(context.Background(),taxonomyActor(identity.RoleAdmin),taxonomy.SkillWrite{SubjectID:"subject-1",Code:"S1",Name:"Skill",Kind:"sub"})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("expected invalid input, got %v",err)}
}

func TestMainSkillRejectsParent(t *testing.T){
	s:=NewService(&mutationRepoStub{})
	_,err:=s.CreateSkill(context.Background(),taxonomyActor(identity.RoleAdmin),taxonomy.SkillWrite{SubjectID:"subject-1",ParentSkillID:"parent-1",Code:"S1",Name:"Skill",Kind:"main"})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("expected invalid input, got %v",err)}
}

func TestTaxonomyCodesNormalizeButRemainStableAfterCreate(t *testing.T){
	repo:=&mutationRepoStub{};s:=NewService(repo)
	_,err:=s.CreateSkill(context.Background(),taxonomyActor(identity.RoleAdmin),taxonomy.SkillWrite{SubjectID:"subject-1",Code:" skill-a ",Name:" Skill ",Kind:"main"})
	if err!=nil{t.Fatalf("unexpected error: %v",err)}
	if repo.lastSkill.Code!="SKILL-A"{t.Fatalf("expected normalized code, got %q",repo.lastSkill.Code)}
}
