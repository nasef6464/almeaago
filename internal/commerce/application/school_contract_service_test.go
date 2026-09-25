package application

import (
	"context"
	"errors"
	"testing"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type contractRepoStub struct {
	contract commerce.SchoolContract
	write    commerce.SchoolContractWrite
	schoolID string
	err      error
}

func (r *contractRepoStub) SchoolContractBySchool(
	context.Context,
	string,
) (commerce.SchoolContract, error) {
	if r.err != nil {
		return commerce.SchoolContract{}, r.err
	}
	return r.contract, nil
}

func (r *contractRepoStub) UpsertSchoolContract(
	_ context.Context,
	_ string,
	schoolID string,
	write commerce.SchoolContractWrite,
) (commerce.SchoolContract, error) {
	r.schoolID = schoolID
	r.write = write
	if r.err != nil {
		return commerce.SchoolContract{}, r.err
	}
	return commerce.SchoolContract{
		ID:         "contract-1",
		SchoolID:   schoolID,
		Status:     write.Status,
		Modules:    append([]commerce.SchoolModule(nil), write.Modules...),
		ValidFrom:  write.ValidFrom,
		ValidUntil: write.ValidUntil,
	}, nil
}

func commerceAdmin() identity.User {
	return identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}, Status: "active"}
}

func TestSchoolContractUpsertNormalizesModulesAndTimes(t *testing.T) {
	repo := &contractRepoStub{}
	service := NewSchoolContractService(repo)
	offset := time.FixedZone("plus-three", 3*60*60)
	from := time.Date(2026, 9, 25, 10, 0, 0, 0, offset)
	until := time.Date(2026, 10, 25, 10, 0, 0, 0, offset)

	_, err := service.Upsert(context.Background(), commerceAdmin(), " school-1 ", UpsertSchoolContractInput{
		Status: commerce.SchoolContractStatusActive,
		Modules: []commerce.SchoolModule{
			commerce.SchoolModuleCore,
			commerce.SchoolModuleCore,
			commerce.SchoolModuleSmartClassroom,
		},
		ValidFrom:  &from,
		ValidUntil: &until,
	})
	if err != nil {
		t.Fatal(err)
	}
	if repo.schoolID != "school-1" {
		t.Fatalf("unexpected school id %q", repo.schoolID)
	}
	if len(repo.write.Modules) != 2 {
		t.Fatalf("expected deduplicated modules, got %#v", repo.write.Modules)
	}
	if repo.write.ValidFrom == nil || repo.write.ValidFrom.Location() != time.UTC {
		t.Fatalf("validFrom must be normalized to UTC: %#v", repo.write.ValidFrom)
	}
	if repo.write.ValidUntil == nil || repo.write.ValidUntil.Location() != time.UTC {
		t.Fatalf("validUntil must be normalized to UTC: %#v", repo.write.ValidUntil)
	}
}

func TestSchoolContractMutationRequiresAdmin(t *testing.T) {
	service := NewSchoolContractService(&contractRepoStub{})
	teacher := identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}

	_, err := service.Upsert(context.Background(), teacher, "school-1", UpsertSchoolContractInput{
		Status:  commerce.SchoolContractStatusActive,
		Modules: []commerce.SchoolModule{commerce.SchoolModuleCore},
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden, got %v", err)
	}
	if _, err := service.Contract(context.Background(), teacher, "school-1"); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected forbidden contract read, got %v", err)
	}
}

func TestSchoolContractRejectsInvalidRangeAndModule(t *testing.T) {
	service := NewSchoolContractService(&contractRepoStub{})
	from := time.Date(2026, 10, 2, 0, 0, 0, 0, time.UTC)
	until := time.Date(2026, 10, 1, 0, 0, 0, 0, time.UTC)

	_, err := service.Upsert(context.Background(), commerceAdmin(), "school-1", UpsertSchoolContractInput{
		Status:     commerce.SchoolContractStatusActive,
		Modules:    []commerce.SchoolModule{commerce.SchoolModuleCore},
		ValidFrom:  &from,
		ValidUntil: &until,
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid date range, got %v", err)
	}

	_, err = service.Upsert(context.Background(), commerceAdmin(), "school-1", UpsertSchoolContractInput{
		Status:  commerce.SchoolContractStatusActive,
		Modules: []commerce.SchoolModule{"UNKNOWN"},
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid module, got %v", err)
	}
}

func TestResolveSchoolModuleMatchesLegacyCurrentWindow(t *testing.T) {
	now := time.Date(2026, 9, 25, 12, 0, 0, 0, time.UTC)
	from := now.Add(-time.Hour)
	until := now
	repo := &contractRepoStub{
		contract: commerce.SchoolContract{
			ID:         "contract-1",
			SchoolID:   "school-1",
			Status:     commerce.SchoolContractStatusActive,
			Modules:    []commerce.SchoolModule{commerce.SchoolModuleSmartClassroom},
			ValidFrom:  &from,
			ValidUntil: &until,
		},
	}
	service := NewSchoolContractService(repo)
	service.now = func() time.Time { return now }

	result, err := service.ResolveModule(context.Background(), "school-1", commerce.SchoolModuleSmartClassroom)
	if err != nil {
		t.Fatal(err)
	}
	if !result.Allowed {
		t.Fatal("legacy policy includes the validUntil boundary")
	}

	result, err = service.ResolveModule(context.Background(), "school-1", commerce.SchoolModuleQuestionBank)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed {
		t.Fatal("module missing from active contract must be denied")
	}
}

func TestResolveMissingContractReturnsDeniedWithoutError(t *testing.T) {
	repo := &contractRepoStub{err: commerce.ErrSchoolContractNotFound}
	service := NewSchoolContractService(repo)

	result, err := service.ResolveModule(context.Background(), "school-1", commerce.SchoolModuleCore)
	if err != nil {
		t.Fatal(err)
	}
	if result.Allowed || result.Contract != nil {
		t.Fatalf("unexpected result %#v", result)
	}
}
