package application

import (
	"context"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type guideCourseRepoStub struct {
	*repoStub
	guest      commerce.AccessDecision
	guestReads int
}

func (r *guideCourseRepoStub) ResolveGuestGuideCourseAccess(context.Context, string) (commerce.AccessDecision, error) {
	r.guestReads++
	return r.guest, nil
}

func TestGuideCourseAccessUsesGuestCatalogOrNormalStudentSchoolPolicy(t *testing.T) {
	repo := &guideCourseRepoStub{repoStub: &repoStub{decision: commerce.AccessDecision{Allowed: true, Configured: true, Reason: "school_entitlement"}}, guest: commerce.AccessDecision{Allowed: true, Configured: true, Reason: "free_product"}}
	s := NewService(repo, catalogStub{eligible: true, pathID: "path", subjectID: "subject"}, nil, schoolsStub{ids: []string{"school"}})
	guest, err := s.CheckGuideCourseAccess(context.Background(), "", "course")
	if err != nil || !guest.Allowed || guest.Reason != "free_product" || repo.guestReads != 1 || repo.lastUser != "" {
		t.Fatalf("guest=%+v err=%v", guest, err)
	}
	student, err := s.CheckGuideCourseAccess(context.Background(), "student", "course")
	if err != nil || !student.Allowed || student.Reason != "school_entitlement" || repo.lastUser != "student" || len(repo.lastSchools) != 1 || repo.lastSchools[0] != "school" {
		t.Fatalf("student=%+v repo=%+v err=%v", student, repo.repoStub, err)
	}
	repo.guest = commerce.AccessDecision{Allowed: false, Configured: true, Reason: "paid_required"}
	paid, err := s.CheckGuideCourseAccess(context.Background(), "", "course")
	if err != nil || paid.Allowed || !paid.Configured || paid.Reason != "paid_required" {
		t.Fatalf("guest paid=%+v err=%v", paid, err)
	}
	private := NewService(repo, catalogStub{eligible: false}, nil, nil)
	unknown, err := private.CheckGuideCourseAccess(context.Background(), "", "course")
	if err != nil || unknown.Configured || repo.guestReads != 2 {
		t.Fatalf("hidden course=%+v reads=%d err=%v", unknown, repo.guestReads, err)
	}
}
