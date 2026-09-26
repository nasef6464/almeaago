package application

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	ErrForbidden          = errors.New("commerce action forbidden")
	ErrInvalidInput       = errors.New("invalid commerce input")
	ErrProviderUnavailable = errors.New("commerce provider unavailable")
)

var codePattern = regexp.MustCompile(`^[A-Z0-9][A-Z0-9_-]{1,79}$`)

type Repository interface {
	ListProducts(context.Context, int, int, commerce.ProductType, commerce.ProductStatus, string) (commerce.ProductPage, error)
	GetProduct(context.Context, string) (commerce.Product, error)
	CreateProduct(context.Context, string, commerce.ProductWrite) (commerce.Product, error)
	UpdateProduct(context.Context, string, string, int, commerce.ProductWrite) (commerce.Product, error)
	ListEntitlements(context.Context, int, int, commerce.SubjectType, string) (commerce.EntitlementPage, error)
	GrantEntitlement(context.Context, string, commerce.EntitlementGrant) (commerce.Entitlement, error)
	RevokeEntitlement(context.Context, string, string, int, string) (commerce.Entitlement, error)
	ResolveCourseAccess(context.Context, string, []string, string, string, string) (commerce.AccessDecision, error)
}

type CatalogResolver interface {
	CourseCommerceScope(ctx context.Context, courseID string) (pathID string, subjectID string, eligible bool, err error)
}

type TaxonomyResolver interface {
	ValidCommerceScope(ctx context.Context, pathID, subjectID string) (bool, error)
}

type SchoolMembershipResolver interface {
	ActiveSchoolIDsForUser(ctx context.Context, userID string) ([]string, error)
}

type ServiceOptions struct {
	WebhookSecret string
}

type Service struct {
	repo          Repository
	payments      PaymentRepository
	catalog       CatalogResolver
	taxonomy      TaxonomyResolver
	schools       SchoolMembershipResolver
	webhookSecret string
}

func NewService(repo Repository, catalog CatalogResolver, taxonomy TaxonomyResolver, schools SchoolMembershipResolver) *Service {
	return NewServiceWithOptions(repo, catalog, taxonomy, schools, ServiceOptions{})
}

func NewServiceWithOptions(repo Repository, catalog CatalogResolver, taxonomy TaxonomyResolver, schools SchoolMembershipResolver, opts ServiceOptions) *Service {
	var payments PaymentRepository
	if candidate, ok := repo.(PaymentRepository); ok {
		payments = candidate
	}
	return &Service{
		repo: repo, payments: payments, catalog: catalog, taxonomy: taxonomy, schools: schools,
		webhookSecret: strings.TrimSpace(opts.WebhookSecret),
	}
}

func normalizePage(page, limit int, defaultLimit int) (int, int, error) {
	if page == 0 {
		page = 1
	}
	if limit == 0 {
		limit = defaultLimit
	}
	if page < 1 || page > 10000 || limit < 1 || limit > 100 {
		return 0, 0, ErrInvalidInput
	}
	return page, limit, nil
}

func normalizeProductWrite(w *commerce.ProductWrite) error {
	w.Code = strings.ToUpper(strings.TrimSpace(w.Code))
	w.Name = strings.TrimSpace(w.Name)
	w.Description = strings.TrimSpace(w.Description)
	w.Currency = strings.ToUpper(strings.TrimSpace(w.Currency))
	w.CourseID = strings.TrimSpace(w.CourseID)
	if !codePattern.MatchString(w.Code) || w.Name == "" || len(w.Name) > 200 || len(w.Description) > 12000 ||
		!commerce.ValidProductType(w.ProductType) || !commerce.ValidProductStatus(w.Status) ||
		!commerce.ValidAccessMode(w.AccessMode) || len(w.Currency) != 3 || w.PriceMinor < 0 {
		return ErrInvalidInput
	}
	if w.AccessMode == commerce.AccessFree && w.PriceMinor != 0 {
		return ErrInvalidInput
	}
	if w.ProductType == commerce.ProductCourse {
		if w.CourseID == "" || w.Package != nil {
			return ErrInvalidInput
		}
		return nil
	}
	if w.CourseID != "" || w.Package == nil || !commerce.ValidPackageKind(w.Package.PackageKind) || len(w.Package.Items) == 0 || len(w.Package.Items) > 200 {
		return ErrInvalidInput
	}
	if w.Package.SeatCapacity != nil && *w.Package.SeatCapacity < 1 {
		return ErrInvalidInput
	}
	if w.Package.ValidityDays != nil && (*w.Package.ValidityDays < 1 || *w.Package.ValidityDays > 3650) {
		return ErrInvalidInput
	}
	return nil
}

func normalizePackageItems(items []commerce.PackageItem) ([]commerce.PackageItem, error) {
	out := make([]commerce.PackageItem, 0, len(items))
	seen := map[string]struct{}{}
	for _, item := range items {
		item.CourseID = strings.TrimSpace(item.CourseID)
		item.PathID = strings.TrimSpace(item.PathID)
		item.SubjectID = strings.TrimSpace(item.SubjectID)
		if !commerce.ValidScopeType(item.ScopeType) {
			return nil, ErrInvalidInput
		}
		switch item.ScopeType {
		case commerce.ScopeCourse:
			if item.CourseID == "" || item.PathID != "" || item.SubjectID != "" || item.ContentType != "" {
				return nil, ErrInvalidInput
			}
		case commerce.ScopePath:
			if item.PathID == "" || item.CourseID != "" || item.SubjectID != "" || item.ContentType != "" {
				return nil, ErrInvalidInput
			}
		case commerce.ScopeSubject:
			if item.SubjectID == "" || item.CourseID != "" || item.PathID != "" || item.ContentType != "" {
				return nil, ErrInvalidInput
			}
		case commerce.ScopeContentType:
			if item.CourseID != "" || item.PathID != "" || item.SubjectID != "" || !commerce.ValidContentType(item.ContentType) {
				return nil, ErrInvalidInput
			}
		case commerce.ScopeAll:
			if item.CourseID != "" || item.PathID != "" || item.SubjectID != "" || item.ContentType != "" {
				return nil, ErrInvalidInput
			}
		}
		key := string(item.ScopeType) + "|" + item.CourseID + "|" + item.PathID + "|" + item.SubjectID + "|" + string(item.ContentType)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, item)
	}
	return out, nil
}

func (s *Service) validateProductTargets(ctx context.Context, w *commerce.ProductWrite) error {
	if w.ProductType == commerce.ProductCourse {
		if s.catalog == nil {
			return commerce.ErrConflict
		}
		_, _, eligible, err := s.catalog.CourseCommerceScope(ctx, w.CourseID)
		if err != nil {
			return err
		}
		if !eligible {
			return commerce.ErrConflict
		}
		return nil
	}
	items, err := normalizePackageItems(w.Package.Items)
	if err != nil {
		return err
	}
	for _, item := range items {
		switch item.ScopeType {
		case commerce.ScopeCourse:
			if s.catalog == nil {
				return commerce.ErrConflict
			}
			_, _, eligible, e := s.catalog.CourseCommerceScope(ctx, item.CourseID)
			if e != nil {
				return e
			}
			if !eligible {
				return commerce.ErrConflict
			}
		case commerce.ScopePath:
			if s.taxonomy == nil {
				return commerce.ErrConflict
			}
			ok, e := s.taxonomy.ValidCommerceScope(ctx, item.PathID, "")
			if e != nil {
				return e
			}
			if !ok {
				return commerce.ErrConflict
			}
		case commerce.ScopeSubject:
			if s.taxonomy == nil {
				return commerce.ErrConflict
			}
			ok, e := s.taxonomy.ValidCommerceScope(ctx, "", item.SubjectID)
			if e != nil {
				return e
			}
			if !ok {
				return commerce.ErrConflict
			}
		}
	}
	w.Package.Items = items
	return nil
}

func (s *Service) ListProducts(ctx context.Context, actor identity.User, page, limit int, kind commerce.ProductType, status commerce.ProductStatus, search string) (commerce.ProductPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.ProductPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.ProductPage{}, err
	}
	search = strings.TrimSpace(search)
	if len(search) > 160 {
		return commerce.ProductPage{}, ErrInvalidInput
	}
	if kind != "" && !commerce.ValidProductType(kind) {
		return commerce.ProductPage{}, ErrInvalidInput
	}
	if status != "" && !commerce.ValidProductStatus(status) {
		return commerce.ProductPage{}, ErrInvalidInput
	}
	return s.repo.ListProducts(ctx, page, limit, kind, status, search)
}

func (s *Service) Product(ctx context.Context, actor identity.User, id string) (commerce.Product, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.Product{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return commerce.Product{}, ErrInvalidInput
	}
	return s.repo.GetProduct(ctx, id)
}

func (s *Service) CreateProduct(ctx context.Context, actor identity.User, w commerce.ProductWrite) (commerce.Product, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.Product{}, ErrForbidden
	}
	if err := normalizeProductWrite(&w); err != nil {
		return commerce.Product{}, err
	}
	if err := s.validateProductTargets(ctx, &w); err != nil {
		return commerce.Product{}, err
	}
	return s.repo.CreateProduct(ctx, actor.ID, w)
}

func (s *Service) UpdateProduct(ctx context.Context, actor identity.User, id string, expectedRevision int, w commerce.ProductWrite) (commerce.Product, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.Product{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || expectedRevision < 1 {
		return commerce.Product{}, ErrInvalidInput
	}
	current, err := s.repo.GetProduct(ctx, id)
	if err != nil {
		return commerce.Product{}, err
	}
	if err = normalizeProductWrite(&w); err != nil {
		return commerce.Product{}, err
	}
	if current.ProductType != w.ProductType || current.CourseID != w.CourseID {
		return commerce.Product{}, commerce.ErrConflict
	}
	if err = s.validateProductTargets(ctx, &w); err != nil {
		return commerce.Product{}, err
	}
	return s.repo.UpdateProduct(ctx, actor.ID, id, expectedRevision, w)
}

func (s *Service) ListEntitlements(ctx context.Context, actor identity.User, page, limit int, subjectType commerce.SubjectType, subjectID string) (commerce.EntitlementPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.EntitlementPage{}, ErrForbidden
	}
	var err error
	page, limit, err = normalizePage(page, limit, 50)
	if err != nil {
		return commerce.EntitlementPage{}, err
	}
	subjectID = strings.TrimSpace(subjectID)
	if subjectType != "" && !commerce.ValidSubjectType(subjectType) {
		return commerce.EntitlementPage{}, ErrInvalidInput
	}
	if subjectType != "" && subjectID == "" {
		return commerce.EntitlementPage{}, ErrInvalidInput
	}
	return s.repo.ListEntitlements(ctx, page, limit, subjectType, subjectID)
}

func (s *Service) GrantManual(ctx context.Context, actor identity.User, in commerce.EntitlementGrant) (commerce.Entitlement, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.Entitlement{}, ErrForbidden
	}
	in.UserID = strings.TrimSpace(in.UserID)
	in.SchoolID = strings.TrimSpace(in.SchoolID)
	in.ProductID = strings.TrimSpace(in.ProductID)
	in.IdempotencyKey = strings.TrimSpace(in.IdempotencyKey)
	if !commerce.ValidSubjectType(in.SubjectType) || in.ProductID == "" || in.IdempotencyKey == "" || len(in.IdempotencyKey) > 160 {
		return commerce.Entitlement{}, ErrInvalidInput
	}
	if (in.SubjectType == commerce.SubjectUser && (in.UserID == "" || in.SchoolID != "")) || (in.SubjectType == commerce.SubjectSchool && (in.SchoolID == "" || in.UserID != "")) {
		return commerce.Entitlement{}, ErrInvalidInput
	}
	if in.StartsAt == nil {
		now := time.Now().UTC()
		in.StartsAt = &now
	}
	if in.ExpiresAt != nil && !in.ExpiresAt.After(*in.StartsAt) {
		return commerce.Entitlement{}, ErrInvalidInput
	}
	product, err := s.repo.GetProduct(ctx, in.ProductID)
	if err != nil {
		return commerce.Entitlement{}, err
	}
	if product.Status != commerce.ProductActive {
		return commerce.Entitlement{}, commerce.ErrConflict
	}
	return s.repo.GrantEntitlement(ctx, actor.ID, in)
}

func (s *Service) Revoke(ctx context.Context, actor identity.User, id string, expectedRevision int, reason string) (commerce.Entitlement, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.Entitlement{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	reason = strings.TrimSpace(reason)
	if id == "" || expectedRevision < 1 || reason == "" || len(reason) > 1000 {
		return commerce.Entitlement{}, ErrInvalidInput
	}
	return s.repo.RevokeEntitlement(ctx, actor.ID, id, expectedRevision, reason)
}

func (s *Service) CheckCourseAccess(ctx context.Context, userID, courseID string) (bool, bool, string, string, error) {
	userID = strings.TrimSpace(userID)
	courseID = strings.TrimSpace(courseID)
	if userID == "" || courseID == "" {
		return false, false, "invalid", "", ErrInvalidInput
	}
	if s.catalog == nil {
		return false, false, "resolver_unavailable", "", commerce.ErrConflict
	}
	pathID, subjectID, eligible, err := s.catalog.CourseCommerceScope(ctx, courseID)
	if err != nil {
		return false, false, "", "", err
	}
	if !eligible {
		return false, true, "course_unavailable", "", nil
	}
	var schoolIDs []string
	if s.schools != nil {
		schoolIDs, err = s.schools.ActiveSchoolIDsForUser(ctx, userID)
		if err != nil {
			return false, false, "", "", err
		}
	}
	decision, err := s.repo.ResolveCourseAccess(ctx, userID, schoolIDs, courseID, pathID, subjectID)
	if err != nil {
		return false, false, "", err
	}
	return decision.Allowed, decision.Configured, decision.Reason, decision.ProductID, nil
}

func (s *Service) CourseAccess(ctx context.Context, actor identity.User, courseID string) (commerce.AccessDecision, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return commerce.AccessDecision{}, ErrForbidden
	}
	if s.catalog == nil {
		return commerce.AccessDecision{}, commerce.ErrConflict
	}
	pathID, subjectID, eligible, err := s.catalog.CourseCommerceScope(ctx, strings.TrimSpace(courseID))
	if err != nil {
		return commerce.AccessDecision{}, err
	}
	if !eligible {
		return commerce.AccessDecision{Configured: true, Allowed: false, Reason: "course_unavailable"}, nil
	}
	var schoolIDs []string
	if s.schools != nil {
		schoolIDs, err = s.schools.ActiveSchoolIDsForUser(ctx, actor.ID)
		if err != nil {
			return commerce.AccessDecision{}, err
		}
	}
	return s.repo.ResolveCourseAccess(ctx, actor.ID, schoolIDs, courseID, pathID, subjectID)
}
