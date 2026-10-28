package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestDirectorAssessmentCreateValidatesInputAndAuthorizesSchool(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const path = "00000000-0000-0000-0000-000000000802"
	const subject = "00000000-0000-0000-0000-000000000803"
	const question = "00000000-0000-0000-0000-000000000901"
	const other = "00000000-0000-0000-0000-000000000902"
	const classroom = "00000000-0000-0000-0000-000000000201"
	const otherClassroom = "00000000-0000-0000-0000-000000000202"
	const learnerA = "00000000-0000-0000-0000-000000000301"
	const learnerB = "00000000-0000-0000-0000-000000000302"
	const requestKey = "00000000-0000-0000-0000-000000000701"
	allowed := org.SchoolContext{
		SchoolID: school, Role: identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolAssessmentsManage},
		Modules:     []string{string(org.ModuleSchoolAssessments)},
	}
	valid := org.DirectorAssessmentCreate{
		Title: "اختبار رياضيات", TargetScope: "class", ClassID: classroom,
		PathID: path, SubjectID: subject, QuestionIDs: []string{question, question, other}, RequestKey: requestKey,
	}
	tests := []struct {
		name    string
		input   org.DirectorAssessmentCreate
		actor   identity.User
		context []org.SchoolContext
		school  string
		want    error
		called  bool
	}{
		{name: "normalized duplicate IDs", input: valid, actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, called: true},
		{name: "selected classes and learners with canonical IDs", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "selected"
			i.ClassID = ""
			i.ClassIDs = []string{otherClassroom, classroom, otherClassroom}
			i.StudentIDs = []string{learnerB, learnerA, learnerB}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, called: true},
		{name: "selected learner without class", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "selected"
			i.ClassID = ""
			i.StudentIDs = []string{learnerA}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, called: true},
		{name: "selected audience cannot be empty", input: func() org.DirectorAssessmentCreate { i := valid; i.TargetScope = "selected"; i.ClassID = ""; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "selected audience rejects singular class ID", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "selected"
			i.StudentIDs = []string{learnerA}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "selected audience rejects malformed learner ID", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "selected"
			i.ClassID = ""
			i.StudentIDs = []string{learnerA, "not-uuid"}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "whole school rejects student selection", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "school"
			i.ClassID = ""
			i.StudentIDs = []string{learnerA}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "whole school with no class", input: func() org.DirectorAssessmentCreate { i := valid; i.TargetScope = "school"; i.ClassID = ""; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, called: true},
		{name: "central exam to several classrooms", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "classes"
			i.ClassID = ""
			i.ClassIDs = []string{otherClassroom, classroom, otherClassroom}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, called: true},
		{name: "central exam needs two distinct classrooms", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "classes"
			i.ClassID = ""
			i.ClassIDs = []string{classroom, classroom}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "central exam rejects malformed classroom", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "classes"
			i.ClassID = ""
			i.ClassIDs = []string{classroom, "not-uuid"}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "central exam rejects conflicting singular classroom", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.TargetScope = "classes"
			i.ClassIDs = []string{classroom, otherClassroom}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "single classroom rejects group list", input: func() org.DirectorAssessmentCreate {
			i := valid
			i.ClassIDs = []string{classroom, otherClassroom}
			return i
		}(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "blank title", input: func() org.DirectorAssessmentCreate { i := valid; i.Title = " "; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "class mode needs class", input: func() org.DirectorAssessmentCreate { i := valid; i.ClassID = ""; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "unknown target", input: func() org.DirectorAssessmentCreate { i := valid; i.TargetScope = "public"; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "no questions", input: func() org.DirectorAssessmentCreate { i := valid; i.QuestionIDs = nil; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "invalid question ID", input: func() org.DirectorAssessmentCreate { i := valid; i.QuestionIDs = []string{"not-uuid"}; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "missing path", input: func() org.DirectorAssessmentCreate { i := valid; i.PathID = ""; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "missing subject", input: func() org.DirectorAssessmentCreate { i := valid; i.SubjectID = ""; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "invalid request key", input: func() org.DirectorAssessmentCreate { i := valid; i.RequestKey = "bad"; return i }(), actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: school, want: ErrInvalidInput},
		{name: "wrong actor role", input: valid, actor: actor("teacher-1", identity.RoleTeacher), context: []org.SchoolContext{allowed}, school: school, want: ErrForbidden},
		{name: "wrong school", input: valid, actor: schoolAdminActor(), context: []org.SchoolContext{allowed}, school: "00000000-0000-0000-0000-000000000102", want: ErrForbidden},
		{name: "missing contract", input: valid, actor: schoolAdminActor(), context: []org.SchoolContext{{SchoolID: school, Role: identity.RoleSchoolAdmin, Permissions: allowed.Permissions}}, school: school, want: ErrForbidden},
		{name: "missing school permission", input: valid, actor: schoolAdminActor(), context: []org.SchoolContext{{SchoolID: school, Role: identity.RoleSchoolAdmin, Modules: allowed.Modules}}, school: school, want: ErrForbidden},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			repo := &repositoryMock{contexts: tt.context}
			service := NewService(repo, repo)
			got, err := service.DirectorCreateAssessment(context.Background(), tt.actor, tt.school, tt.input)
			if !errors.Is(err, tt.want) {
				t.Fatalf("expected %v, got %v", tt.want, err)
			}
			if (repo.lastDirectorAssessmentCreate != nil) != tt.called {
				t.Fatalf("unexpected database call: %+v", repo.lastDirectorAssessmentCreate)
			}
			if tt.called {
				if got.AssessmentID == "" || repo.lastDirectorAssessmentSchool != school || repo.lastDirectorAssessmentCreate.Title != valid.Title {
					t.Fatalf("unexpected authorized result: %+v and input %+v", got, repo.lastDirectorAssessmentCreate)
				}
				if tt.input.TargetScope == "class" && (len(repo.lastDirectorAssessmentCreate.QuestionIDs) != 2 || repo.lastDirectorAssessmentCreate.QuestionIDs[0] != question || repo.lastDirectorAssessmentCreate.QuestionIDs[1] != other) {
					t.Fatalf("question IDs not deduplicated in stable order: %+v", repo.lastDirectorAssessmentCreate.QuestionIDs)
				}
				if tt.input.TargetScope == "classes" && (len(repo.lastDirectorAssessmentCreate.ClassIDs) != 2 || repo.lastDirectorAssessmentCreate.ClassIDs[0] != classroom || repo.lastDirectorAssessmentCreate.ClassIDs[1] != otherClassroom) {
					t.Fatalf("class IDs not sorted/deduplicated: %+v", repo.lastDirectorAssessmentCreate.ClassIDs)
				}
				if tt.input.TargetScope == "selected" && len(tt.input.StudentIDs) > 1 {
					got := repo.lastDirectorAssessmentCreate
					if len(got.StudentIDs) != 2 || got.StudentIDs[0] != learnerA || got.StudentIDs[1] != learnerB || len(got.ClassIDs) != 2 || got.ClassIDs[0] != classroom || got.ClassIDs[1] != otherClassroom {
						t.Fatalf("selected audience not canonical: students=%+v classes=%+v", got.StudentIDs, got.ClassIDs)
					}
				}
			}
		})
	}
}
