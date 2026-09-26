package application

import (
	"context"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type AccessRepository interface {
	ListAccessCodes(context.Context, int, int) (commerce.AccessCodePage, error)
	CreateAccessCode(context.Context, string, commerce.AccessCodeCreate) (commerce.AccessCode, error)
	UpdateAccessCodeStatus(context.Context, string, string, int, commerce.AccessCodeStatus) (commerce.AccessCode, error)
	RedeemAccessCode(context.Context, string, []string, string) (commerce.AccessCodeRedemption, error)
	ListSchoolSeats(context.Context, string, int, int) (commerce.SchoolSeatPage, error)
	AssignSchoolSeat(context.Context, string, string, string, []string) (commerce.SchoolSeatAssignment, error)
	RevokeSchoolSeat(context.Context, string, string, int, string) (commerce.SchoolSeatAssignment, error)
}

type ProductReader interface {\n\tGetProduct(context.Context, string) (commerce.Product, error)\n}\n\ntype AccessService struct {
	repo     AccessRepository
	products ProductReader
	schools  SchoolMembershipResolver
}

func NewAccessService(repo AccessRepository, products ProductReader, schools SchoolMembershipResolver) *AccessService {
	return &AccessService{repo: repo, products: products, schools: schools}
}

func (s *AccessService) ListAccessCodes(ctx context.Context, actor identity.User, page, limit int) (commerce.AccessCodePage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCodePage{}, ErrForbidden
	}
	page, limit, err := normalizePage(page, limit, 50)
	if err != nil {
		return commerce.AccessCodePage{}, err
	}
	return s.repo.ListAccessCodes(ctx, page, limit)
}

func (s *AccessService) CreateAccessCode(ctx context.Context, actor identity.User, in commerce.AccessCodeCreate) (commerce.AccessCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCode{}, ErrForbidden
	}
	in.Code = strings.ToUpper(strings.TrimSpace(in.Code))
	in.ProductID = strings.TrimSpace(in.ProductID)
	in.SchoolID = strings.TrimSpace(in.SchoolID)
	if !codePattern.MatchString(in.Code) || len(in.Code) < 4 || in.ProductID == "" || in.MaxUses < 1 || in.MaxUses > 100000 {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	now := time.Now().UTC()
	if in.StartsAt == nil {
		in.StartsAt = &now
	}
	if !in.ExpiresAt.After(*in.StartsAt) || in.ExpiresAt.After(in.StartsAt.AddDate(10, 0, 0)) {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	product, err := s.products.GetProduct(ctx, in.ProductID)
	if err != nil {
		return commerce.AccessCode{}, err
	}
	if product.Status != commerce.ProductActive || product.AccessMode != commerce.AccessPaid || product.Package == nil {
		return commerce.AccessCode{}, commerce.ErrConflict
	}
	return s.repo.CreateAccessCode(ctx, actor.ID, in)
}

func (s *AccessService) SetAccessCodeStatus(ctx context.Context, actor identity.User, id string, expected int, status commerce.AccessCodeStatus) (commerce.AccessCode, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.AccessCode{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || expected < 1 || !commerce.ValidAccessCodeStatus(status) {
		return commerce.AccessCode{}, ErrInvalidInput
	}
	return s.repo.UpdateAccessCodeStatus(ctx, actor.ID, id, expected, status)
}

func (s *AccessService) Redeem(ctx context.Context, actor identity.User, code string) (commerce.AccessCodeRedemption, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.AccessCodeRedemption{}, ErrForbidden
	}
	code = strings.ToUpper(strings.TrimSpace(code))
	if !codePattern.MatchString(code) || len(code) < 4 {
		return commerce.AccessCodeRedemption{}, ErrInvalidInput
	}
	var schoolIDs []string
	var err error
	if s.schools != nil {
		schoolIDs, err = s.schools.ActiveSchoolIDsForUser(ctx, actor.ID)
		if err != nil {
			return commerce.AccessCodeRedemption{}, err
		}
	}
	return s.repo.RedeemAccessCode(ctx, actor.ID, schoolIDs, code)
}

func (s *AccessService) ListSchoolSeats(ctx context.Context, actor identity.User, schoolEntitlementID string, page, limit int) (commerce.SchoolSeatPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolSeatPage{}, ErrForbidden
	}
	schoolEntitlementID = strings.TrimSpace(schoolEntitlementID)
	if schoolEntitlementID == "" {
		return commerce.SchoolSeatPage{}, ErrInvalidInput
	}
	page, limit, err := normalizePage(page, limit, 50)
	if err != nil {
		return commerce.SchoolSeatPage{}, err
	}
	return s.repo.ListSchoolSeats(ctx, schoolEntitlementID, page, limit)
}

func (s *AccessService) AssignSchoolSeat(ctx context.Context, actor identity.User, schoolEntitlementID, userID string) (commerce.SchoolSeatAssignment, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolSeatAssignment{}, ErrForbidden
	}
	schoolEntitlementID = strings.TrimSpace(schoolEntitlementID)
	userID = strings.TrimSpace(userID)
	if schoolEntitlementID == "" || userID == "" {
		return commerce.SchoolSeatAssignment{}, ErrInvalidInput
	}
	if s.schools == nil {
		return commerce.SchoolSeatAssignment{}, commerce.ErrConflict
	}
	schoolIDs, err := s.schools.ActiveSchoolIDsForUser(ctx, userID)
	if err != nil {
		return commerce.SchoolSeatAssignment{}, err
	}
	if len(schoolIDs) == 0 {
		return commerce.SchoolSeatAssignment{}, commerce.ErrConflict
	}
	return s.repo.AssignSchoolSeat(ctx, actor.ID, schoolEntitlementID, userID, schoolIDs)
}

func (s *AccessService) RevokeSchoolSeat(ctx context.Context, actor identity.User, id string, expected int, reason string) (commerce.SchoolSeatAssignment, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolSeatAssignment{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	reason = strings.TrimSpace(reason)
	if id == "" || expected < 1 || reason == "" || len(reason) > 1000 {
		return commerce.SchoolSeatAssignment{}, ErrInvalidInput
	}
	return s.repo.RevokeSchoolSeat(ctx, actor.ID, id, expected, reason)
}
