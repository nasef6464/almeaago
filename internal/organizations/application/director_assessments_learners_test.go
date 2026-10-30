package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestDirectorAssessmentLearnersRequiresDetailedPermissionAndIntelligenceContract(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const otherSchool = "00000000-0000-0000-0000-000000000102"
	const assessment = "00000000-0000-0000-0000-000000000103"
	base := org.SchoolContext{SchoolID: school, Role: identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolReportsDetailedView},
		Modules:     []string{string(org.ModuleSchoolAssessments), string(org.ModuleSchoolIntelligence)}}
	for _, tc := range []struct {
		name         string
		actor        identity.User
		ctx          org.SchoolContext
		schoolID     string
		assessmentID string
		query        org.DirectorAssessmentLearnerQuery
		want         error
	}{
		{name: "valid", actor: schoolAdminActor(), ctx: base, schoolID: school, assessmentID: assessment, query: org.DirectorAssessmentLearnerQuery{Page: 1, Limit: 12}},
		{name: "aggregate only", actor: schoolAdminActor(), ctx: func() org.SchoolContext {
			c := base
			c.Permissions = []string{org.PermissionSchoolReportsAggregateView}
			return c
		}(), schoolID: school, assessmentID: assessment, want: ErrForbidden},
		{name: "no intelligence", actor: schoolAdminActor(), ctx: func() org.SchoolContext {
			c := base
			c.Modules = []string{string(org.ModuleSchoolAssessments)}
			return c
		}(), schoolID: school, assessmentID: assessment, want: ErrForbidden},
		{name: "no assessment contract", actor: schoolAdminActor(), ctx: func() org.SchoolContext {
			c := base
			c.Modules = []string{string(org.ModuleSchoolIntelligence)}
			return c
		}(), schoolID: school, assessmentID: assessment, want: ErrForbidden},
		{name: "foreign school", actor: schoolAdminActor(), ctx: base, schoolID: otherSchool, assessmentID: assessment, want: ErrForbidden},
		{name: "teacher cannot see names", actor: identity.User{ID: "teacher", Status: "active", Roles: []identity.Role{identity.RoleTeacher}}, ctx: base, schoolID: school, assessmentID: assessment, want: ErrForbidden},
		{name: "invalid status", actor: schoolAdminActor(), ctx: base, schoolID: school, assessmentID: assessment, query: org.DirectorAssessmentLearnerQuery{Status: "missing"}, want: ErrInvalidInput},
		{name: "oversized page", actor: schoolAdminActor(), ctx: base, schoolID: school, assessmentID: assessment, query: org.DirectorAssessmentLearnerQuery{Page: 100001}, want: ErrInvalidInput},
		{name: "oversized limit", actor: schoolAdminActor(), ctx: base, schoolID: school, assessmentID: assessment, query: org.DirectorAssessmentLearnerQuery{Limit: 101}, want: ErrInvalidInput},
		{name: "bad UUID", actor: schoolAdminActor(), ctx: base, schoolID: school, assessmentID: "bad", want: ErrInvalidInput},
	} {
		t.Run(tc.name, func(t *testing.T) {
			repo := &repositoryMock{contexts: []org.SchoolContext{tc.ctx}}
			page, err := NewService(repo).DirectorAssessmentLearners(context.Background(), tc.actor, tc.schoolID, tc.assessmentID, tc.query)
			if tc.want != nil {
				if !errors.Is(err, tc.want) {
					t.Fatalf("wanted %v, got %v", tc.want, err)
				}
				if repo.learnerListCalls != 0 {
					t.Fatalf("denied call reached DB")
				}
				return
			}
			if err != nil || page.Learners == nil || repo.learnerListCalls != 1 {
				t.Fatalf("authorized list failed: %+v err=%v count=%d", page, err, repo.learnerListCalls)
			}
		})
	}
}

func TestDirectorAssessmentLearnerDetailRequiresDualCapabilityAndValidID(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	const assessment = "00000000-0000-0000-0000-000000000103"
	const attempt = "00000000-0000-0000-0000-000000000104"
	ctx := org.SchoolContext{SchoolID: school, Role: identity.RoleSchoolAdmin,
		Permissions: []string{org.PermissionSchoolReportsDetailedView},
		Modules:     []string{string(org.ModuleSchoolAssessments), string(org.ModuleSchoolIntelligence)}}
	repo := &repositoryMock{contexts: []org.SchoolContext{ctx}}
	svc := NewService(repo)
	result, err := svc.DirectorAssessmentLearnerResult(context.Background(), schoolAdminActor(), school, assessment, attempt)
	if err != nil || result.Result.ID != attempt || repo.learnerDetailCalls != 1 {
		t.Fatalf("missing authorized learner detail: %+v err=%v", result, err)
	}
	if _, err = svc.DirectorAssessmentLearnerResult(context.Background(), schoolAdminActor(), school, assessment, "bad"); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("invalid detail ID accepted: %v", err)
	}
	repo.contexts[0].Permissions = []string{org.PermissionSchoolAssessmentsManage}
	if _, err = svc.DirectorAssessmentLearnerResult(context.Background(), schoolAdminActor(), school, assessment, attempt); !errors.Is(err, ErrForbidden) {
		t.Fatalf("manage-only actor read private detail: %v", err)
	}
	if repo.learnerDetailCalls != 1 {
		t.Fatalf("denied detail reached DB")
	}
}
