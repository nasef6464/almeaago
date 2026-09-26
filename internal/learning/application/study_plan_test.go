package application

import (
	"context"
	"errors"
	"testing"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type studyPlanRepoStub struct {
	plan      learning.StudyPlan
	page      learning.StudyPlanPage
	lastWrite learning.StudyPlanWrite
	lastItems []learning.StudyPlanItemSeed
}
func (r *studyPlanRepoStub) CreateStudyPlan(_ context.Context,_ string,w learning.StudyPlanWrite,items []learning.StudyPlanItemSeed)(learning.StudyPlan,error){r.lastWrite=w;r.lastItems=items;return r.plan,nil}
func (r *studyPlanRepoStub) ListStudyPlans(context.Context,string,string,learning.StudyPlanStatus,int,int)(learning.StudyPlanPage,error){return r.page,nil}
func (r *studyPlanRepoStub) GetStudyPlan(context.Context,string,string)(learning.StudyPlan,error){return r.plan,nil}
func (r *studyPlanRepoStub) UpdateStudyPlan(_ context.Context,_ string,_ string,p learning.StudyPlanPatch,items []learning.StudyPlanItemSeed)(learning.StudyPlan,error){r.lastWrite=p.StudyPlanWrite;r.lastItems=items;return r.plan,nil}
func (r *studyPlanRepoStub) DeleteStudyPlan(context.Context,string,string)error{return nil}
func (r *studyPlanRepoStub) CompletedStudyPlanLessons(context.Context,string,[]learning.StudyPlanLessonRef)(map[string]bool,error){return map[string]bool{},nil}

type studyPlanTaxonomyStub struct{ok bool}
func (s studyPlanTaxonomyStub) ValidateStudyPlanScope(context.Context,string,[]string)(bool,error){return s.ok,nil}

type studyPlanContentStub struct{ok bool;items []content.StudyPlanResource}
func (s studyPlanContentStub) ValidateStudyPlanCourses(context.Context,string,[]string,[]string)(bool,error){return s.ok,nil}
func (s studyPlanContentStub) ListStudyPlanResources(context.Context,string,[]string,[]string,int)([]content.StudyPlanResource,error){return s.items,nil}

type studyPlanAssessmentStub struct{items []assessment.StudyPlanResource}
func (s studyPlanAssessmentStub) ListStudyPlanResources(context.Context,string,string,[]string,[]string,int)([]assessment.StudyPlanResource,error){return s.items,nil}

func planStudent() identity.User{return identity.User{ID:"student-1",Roles:[]identity.Role{identity.RoleStudent}}}
func validPlanWrite() learning.StudyPlanWrite{return learning.StudyPlanWrite{
	Name:"خطة القدرات",PathID:"path-1",SubjectIDs:[]string{"subject-1"},CourseIDs:[]string{"course-1"},
	StartDate:"2026-09-26",EndDate:"2026-09-28",SkipCompletedAssessments:true,
	DailyMinutes:60,PreferredStartTime:"17:00",Status:learning.StudyPlanActive,
}}

func TestStudyPlanRejectsNonStudentAndUnboundedShape(t *testing.T){
	s:=NewStudyPlanService(&studyPlanRepoStub{},studyPlanTaxonomyStub{ok:true},studyPlanContentStub{ok:true},studyPlanAssessmentStub{})
	if _,err:=s.Create(context.Background(),identity.User{ID:"teacher",Roles:[]identity.Role{identity.RoleTeacher}},validPlanWrite());!errors.Is(err,ErrForbidden){t.Fatalf("want forbidden got %v",err)}
	w:=validPlanWrite();w.DailyMinutes=500
	if _,err:=s.Create(context.Background(),planStudent(),w);!errors.Is(err,ErrInvalidInput){t.Fatalf("want invalid minutes got %v",err)}
	w=validPlanWrite();w.OffDays=[]learning.StudyPlanWeekday{learning.StudyPlanSaturday,learning.StudyPlanSunday,learning.StudyPlanMonday,learning.StudyPlanTuesday,learning.StudyPlanWednesday,learning.StudyPlanThursday,learning.StudyPlanFriday}
	if _,err:=s.Create(context.Background(),planStudent(),w);!errors.Is(err,ErrInvalidInput){t.Fatalf("want invalid all-off-days got %v",err)}
}

func TestStudyPlanGenerationIsDeterministicBoundedAndSkipsCompletedAssessments(t *testing.T){
	repo:=&studyPlanRepoStub{plan:learning.StudyPlan{StudyPlanSummary:learning.StudyPlanSummary{ID:"plan-1",PathID:"path-1"}}}
	contentStub:=studyPlanContentStub{ok:true,items:[]content.StudyPlanResource{
		{Kind:content.StudyPlanLessonResource,ID:"lesson-2",CourseID:"course-1",SubjectID:"subject-1",Title:"درس 2",DurationMinutes:30,SortOrder:2},
		{Kind:content.StudyPlanLessonResource,ID:"lesson-1",CourseID:"course-1",SubjectID:"subject-1",Title:"درس 1",DurationMinutes:30,SortOrder:1},
	}}
	assessmentStub:=studyPlanAssessmentStub{items:[]assessment.StudyPlanResource{
		{PlacementID:"placement-complete",SubjectID:"subject-1",Title:"مكتمل",DurationMinutes:20,SortOrder:0,Completed:true,CanStart:false},
		{PlacementID:"placement-open",SubjectID:"subject-1",Title:"تدريب",DurationMinutes:20,SortOrder:1,Completed:false,CanStart:true},
	}}
	s:=NewStudyPlanService(repo,studyPlanTaxonomyStub{ok:true},contentStub,assessmentStub)
	if _,err:=s.Create(context.Background(),planStudent(),validPlanWrite());err!=nil{t.Fatal(err)}
	if len(repo.lastItems)!=3{t.Fatalf("want 3 generated items got %d",len(repo.lastItems))}
	for _,item:=range repo.lastItems{if item.AssessmentPlacementID=="placement-complete"{t.Fatal("completed assessment was not skipped")}}
	first:=repo.lastItems[0]
	if first.ItemType!=learning.StudyPlanLesson||first.LessonID!="lesson-1"||first.ScheduledDate!="2026-09-26"||first.ScheduledTime!="17:00"{t.Fatalf("unexpected first item %#v",first)}
	if repo.lastItems[1].ScheduledTime!="17:30"{t.Fatalf("unexpected deterministic second time %s",repo.lastItems[1].ScheduledTime)}
}

func TestStudyPlanUpdateRequiresOptimisticTimestamp(t *testing.T){
	s:=NewStudyPlanService(&studyPlanRepoStub{},studyPlanTaxonomyStub{ok:true},studyPlanContentStub{ok:true},studyPlanAssessmentStub{})
	_,err:=s.Update(context.Background(),planStudent(),"plan-1",learning.StudyPlanPatch{StudyPlanWrite:validPlanWrite()})
	if !errors.Is(err,ErrInvalidInput){t.Fatalf("want invalid expected timestamp got %v",err)}
	_,err=s.Update(context.Background(),planStudent(),"plan-1",learning.StudyPlanPatch{ExpectedUpdatedAt:time.Now(),StudyPlanWrite:validPlanWrite()})
	if err!=nil{t.Fatal(err)}
}
