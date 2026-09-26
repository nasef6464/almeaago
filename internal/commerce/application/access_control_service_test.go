package application

import (
	"context"
	"errors"
	"testing"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type accessRepoStub struct {
	repoStub
	code        commerce.AccessCode
	codePage    commerce.AccessCodePage
	redemption  commerce.AccessCodeRedemption
	seat        commerce.SchoolSeat
	seatPage    commerce.SchoolSeatPage
	entitlement commerce.Entitlement
	lastCode    commerce.AccessCodeWrite
	lastAssign  commerce.SchoolSeatAssign
}

func (r *accessRepoStub) ListAccessCodes(context.Context, int, int, string, string, commerce.AccessCodeStatus) (commerce.AccessCodePage, error) {
	return r.codePage, nil
}
func (r *accessRepoStub) CreateAccessCode(_ context.Context, _ string, in commerce.AccessCodeWrite) (commerce.AccessCode, error) {
	r.lastCode = in
	return r.code, nil
}
func (r *accessRepoStub) UpdateAccessCode(context.Context, string, string, commerce.AccessCodeUpdate) (commerce.AccessCode, error) {
	return r.code, nil
}
func (r *accessRepoStub) RedeemAccessCode(context.Context, string, string, []string) (commerce.AccessCodeRedemption, error) {
	return r.redemption, nil
}
func (r *accessRepoStub) ListSchoolSeats(context.Context, int, int, string, string, string) (commerce.SchoolSeatPage, error) {
	return r.seatPage, nil
}
func (r *accessRepoStub) AssignSchoolSeat(_ context.Context, _ string, in commerce.SchoolSeatAssign) (commerce.SchoolSeat, commerce.Entitlement, error) {
	r.lastAssign = in
	return r.seat, r.entitlement, nil
}

func schoolPackageProduct() commerce.Product {
	seats := 30
	days := 90
	return commerce.Product{
		ID:          "product-school",
		ProductType: commerce.ProductPackage,
		Status:      commerce.ProductActive,
		IsVisible:   true,
		Package: &commerce.Package{
			ID:           "package-school",
			ProductID:    "product-school",
			PackageKind:  commerce.PackageSchool,
			SeatCapacity: &seats,
			ValidityDays: &days,
		},
	}
}

func TestAccessCodeCreationRequiresSchoolPackage(t *testing.T) {
	expires := time.Now().UTC().Add(24 * time.Hour)
	r := &accessRepoStub{}
	r.product = commerce.Product{
		ID:          "bundle",
		ProductType: commerce.ProductPackage,
		Status:      commerce.ProductActive,
		IsVisible:   true,
		Package:     &commerce.Package{PackageKind: commerce.PackageBundle},
	}
	s := NewService(r, catalogStub{}, taxonomyStub{}, schoolsStub{})
	_, err := s.CreateAccessCode(context.Background(), adminActor(), commerce.AccessCodeWrite{
		Code: "SCHOOL-2026", SchoolID: "school-1", ProductID: "bundle", MaxUses: 10, ExpiresAt: expires,
	})
	if !errors.Is(err, commerce.ErrConflict) {
		t.Fatalf("expected school-package conflict, got %v", err)
	}

	r.product = schoolPackageProduct()
	r.code = commerce.AccessCode{ID: "code-1"}
	out, err := s.CreateAccessCode(context.Background(), adminActor(), commerce.AccessCodeWrite{
		Code: " school-2026 ", SchoolID: "school-1", ProductID: "product-school", MaxUses: 10, ExpiresAt: expires,
	})
	if err != nil || out.ID != "code-1" {
		t.Fatalf("valid access code failed: %#v %v", out, err)
	}
	if r.lastCode.Code != "SCHOOL-2026" || r.lastCode.MaxUses != 10 {
		t.Fatalf("unexpected normalized code: %#v", r.lastCode)
	}
}

func TestStudentRedeemRequiresActiveSchoolMembership(t *testing.T) {
	r := &accessRepoStub{redemption: commerce.AccessCodeRedemption{AccessCode: commerce.AccessCode{ID: "code-1"}}}
	s := NewService(r, catalogStub{}, taxonomyStub{}, schoolsStub{})
	_, err := s.RedeemAccessCode(context.Background(), studentActor(), "SCHOOL-2026")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected no-school redemption forbidden, got %v", err)
	}

	s = NewService(r, catalogStub{}, taxonomyStub{}, schoolsStub{ids: []string{"school-1"}})
	out, err := s.RedeemAccessCode(context.Background(), studentActor(), "school-2026")
	if err != nil || out.AccessCode.ID != "code-1" {
		t.Fatalf("member redemption failed: %#v %v", out, err)
	}
}

func TestAdminSchoolSeatRequiresTargetMembership(t *testing.T) {
	r := &accessRepoStub{seat: commerce.SchoolSeat{ID: "seat-1"}, entitlement: commerce.Entitlement{ID: "ent-1"}}
	r.product = schoolPackageProduct()
	s := NewService(r, catalogStub{}, taxonomyStub{}, schoolsStub{ids: []string{"school-2"}})
	_, _, err := s.AssignSchoolSeat(context.Background(), adminActor(), commerce.SchoolSeatAssign{
		SchoolID: "school-1", ProductID: "product-school", UserID: "student-1", IdempotencyKey: "seat-1",
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected cross-school assignment forbidden, got %v", err)
	}

	s = NewService(r, catalogStub{}, taxonomyStub{}, schoolsStub{ids: []string{"school-1"}})
	seat, entitlement, err := s.AssignSchoolSeat(context.Background(), adminActor(), commerce.SchoolSeatAssign{
		SchoolID: "school-1", ProductID: "product-school", UserID: "student-1", IdempotencyKey: "seat-1",
	})
	if err != nil || seat.ID != "seat-1" || entitlement.ID != "ent-1" {
		t.Fatalf("seat assignment failed: %#v %#v %v", seat, entitlement, err)
	}
	if r.lastAssign.UserID != "student-1" || r.lastAssign.SchoolID != "school-1" {
		t.Fatalf("unexpected seat assignment: %#v", r.lastAssign)
	}
}
