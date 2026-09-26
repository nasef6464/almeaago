package application

import (
	"context"
	"errors"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type commerceAccessRepo struct {
	repoStub
	course content.LearnerCourse
	lesson content.LearnerLessonDetail
}
func (r *commerceAccessRepo) GetLearnerCourse(context.Context,string)(content.LearnerCourse,error){return r.course,nil}
func (r *commerceAccessRepo) GetLearnerCourseLesson(context.Context,string,string)(content.LearnerLessonDetail,error){return r.lesson,nil}

type courseAccessStub struct{ allowed,configured bool; reason string }
func (a courseAccessStub) CheckCourseAccess(context.Context,string,string)(bool,bool,string,error){return a.allowed,a.configured,a.reason,nil}

func TestLearnerCourseMarksOnlyNonPreviewLessonsCommerceLocked(t *testing.T){
	repo:=&commerceAccessRepo{course:content.LearnerCourse{Course:content.LearnerCourseSummary{ID:"course-1"},Modules:[]content.LearnerCourseModule{{Lessons:[]content.LearnerLessonSummary{{ID:"preview",IsPreview:true},{ID:"paid"}}}}}}
	s:=NewServiceWithAuthorScope(repo,repo,courseAccessStub{allowed:false,configured:true,reason:"paid_required"})
	row,err:=s.LearnerCourse(context.Background(),identity.User{ID:"student-1"},"course-1")
	if err!=nil{t.Fatal(err)}
	if row.Modules[0].Lessons[0].CommerceLocked{t.Fatal("preview must remain accessible")}
	if !row.Modules[0].Lessons[1].CommerceLocked{t.Fatal("paid lesson must be commerce locked")}
	if row.AccessAllowed||!row.AccessConfigured||row.AccessReason!="paid_required"{t.Fatalf("unexpected access projection %#v",row)}
}

func TestLearnerCourseLessonEnforcesCommerceButKeepsPreview(t *testing.T){
	actor:=identity.User{ID:"student-1"}
	repo:=&commerceAccessRepo{lesson:content.LearnerLessonDetail{LearnerLessonSummary:content.LearnerLessonSummary{ID:"lesson-1"}}}
	s:=NewServiceWithAuthorScope(repo,repo,courseAccessStub{allowed:false,configured:true,reason:"paid_required"})
	if _,err:=s.LearnerCourseLesson(context.Background(),actor,"course-1","lesson-1");!errors.Is(err,ErrForbidden){t.Fatalf("expected commerce forbidden, got %v",err)}
	repo.lesson.IsPreview=true
	if _,err:=s.LearnerCourseLesson(context.Background(),actor,"course-1","lesson-1");err!=nil{t.Fatalf("preview should bypass paid grant: %v",err)}
}
