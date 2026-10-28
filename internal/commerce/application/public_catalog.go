package application

import (
	"context"
	"errors"
	"regexp"
	"strings"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

var publicPathIDPattern = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type PublicCatalogScopeResolver interface {
	PublicCommerceScopeVisible(context.Context, string, string) (bool, error)
}

func (s *Service) publicScopeVisible(ctx context.Context, pathID, subjectID string) (bool, error) {
	owner, ok := s.taxonomy.(PublicCatalogScopeResolver)
	if !ok {
		return false, nil
	}
	return owner.PublicCommerceScopeVisible(ctx, pathID, subjectID)
}

type PublicCatalogRepository interface {
	ListPublicCatalog(context.Context, int, int, string) (commerce.PublicCatalogPage, error)
}

func (s *Service) PublicCatalog(ctx context.Context, page, limit int, scope ...string) (commerce.PublicCatalogPage, error) {
	page, limit, err := normalizePage(page, limit, 50)
	if err != nil {
		return commerce.PublicCatalogPage{}, err
	}
	pathID := ""
	if len(scope) > 1 {
		return commerce.PublicCatalogPage{}, ErrInvalidInput
	}
	if len(scope) == 1 {
		pathID = strings.ToLower(strings.TrimSpace(scope[0]))
	}
	if pathID != "" {
		if !publicPathIDPattern.MatchString(pathID) {
			return commerce.PublicCatalogPage{}, ErrInvalidInput
		}
		if s.taxonomy == nil {
			return commerce.PublicCatalogPage{}, commerce.ErrNotFound
		}
		valid, e := s.publicScopeVisible(ctx, pathID, "")
		if e != nil {
			return commerce.PublicCatalogPage{}, e
		}
		if !valid {
			return commerce.PublicCatalogPage{}, commerce.ErrNotFound
		}
	}
	repo, ok := s.repo.(PublicCatalogRepository)
	if !ok {
		return commerce.PublicCatalogPage{}, ErrProviderUnavailable
	}
	out, err := repo.ListPublicCatalog(ctx, page, limit, pathID)
	if err != nil {
		return out, err
	}
	// Reuse the owning modules' reference rules. Products whose content or
	// taxonomy scope became unavailable must not become storefront offers.
	eligible := make([]commerce.PublicProduct, 0, len(out.Items))
	for _, row := range out.Items {
		p, e := s.repo.GetProduct(ctx, row.ID)
		if errors.Is(e, commerce.ErrNotFound) {
			continue
		}
		if e != nil {
			return commerce.PublicCatalogPage{}, e
		}
		if p.Status != commerce.ProductActive || !p.IsVisible || p.AccessMode != commerce.AccessPaid || p.PriceMinor < 1 {
			continue
		}
		w := commerce.ProductWrite{ProductType: p.ProductType, CourseID: p.CourseID}
		if p.ProductType != commerce.ProductCourse {
			if p.Package == nil || p.Package.PackageKind == commerce.PackageSchool {
				continue
			}
			w.Package = &commerce.PackageWrite{Items: p.Package.Items}
		}
		if e = s.validateProductTargets(ctx, &w); e != nil {
			if errors.Is(e, commerce.ErrConflict) || errors.Is(e, commerce.ErrNotFound) {
				continue
			}
			return commerce.PublicCatalogPage{}, e
		}
		publicVisible, e := s.publicTargetsVisible(ctx, p)
		if e != nil {
			return commerce.PublicCatalogPage{}, e
		}
		if !publicVisible {
			continue
		}
		if pathID != "" {
			matches, e := s.publicProductMatchesPath(ctx, p, pathID)
			if e != nil {
				return commerce.PublicCatalogPage{}, e
			}
			if !matches {
				continue
			}
		}
		membership := p.Package != nil && p.Package.PackageKind == commerce.PackageMembership && len(p.Package.Items) > 0
		if membership {
			for _, i := range p.Package.Items {
				if i.ScopeType != commerce.ScopeAll && i.ScopeType != commerce.ScopeContentType {
					membership = false
					break
				}
			}
		}
		eligible = append(eligible, commerce.PublicProduct{ID: p.ID, ProductType: p.ProductType, Name: p.Name, Description: p.Description, PriceMinor: p.PriceMinor, Currency: p.Currency, PublicMembership: membership, ContentTypes: publicContentTypes(p)})
	}
	out.Items = eligible
	return out, nil
}

type PublicPaymentOptions struct {
	Methods     []commerce.PaymentMethod `json:"methods"`
	GatewayMode commerce.GatewayMode     `json:"gatewayMode"`
}

func (s *CheckoutService) PublicPaymentOptions() PublicPaymentOptions {
	methods := []commerce.PaymentMethod{commerce.PaymentCard, commerce.PaymentTransfer, commerce.PaymentWallet}
	if s.policy.GatewayMode == commerce.GatewayPaymentLink {
		methods = []commerce.PaymentMethod{}
		if s.initiator != nil {
			methods = append(methods, commerce.PaymentCard)
		}
	}
	return PublicPaymentOptions{Methods: methods, GatewayMode: s.policy.GatewayMode}
}

// Match explicit canonical targets only. Unscoped all/content-type grants do
// not create a path targeting relationship.
func (s *Service) publicProductMatchesPath(ctx context.Context, p commerce.Product, pathID string) (bool, error) {
	if p.ProductType == commerce.ProductCourse {
		if s.catalog == nil {
			return false, nil
		}
		path, _, eligible, e := s.catalog.CourseCommerceScope(ctx, p.CourseID)
		return eligible && path == pathID, e
	}
	if p.Package == nil {
		return false, nil
	}
	for _, i := range p.Package.Items {
		switch i.ScopeType {
		case commerce.ScopePath:
			if i.PathID == pathID {
				return true, nil
			}
		case commerce.ScopeSubject:
			if s.taxonomy != nil {
				ok, e := s.publicScopeVisible(ctx, pathID, i.SubjectID)
				if e != nil {
					return false, e
				}
				if ok {
					return true, nil
				}
			}
		case commerce.ScopeCourse:
			if s.catalog != nil {
				path, _, eligible, e := s.catalog.CourseCommerceScope(ctx, i.CourseID)
				if e != nil {
					return false, e
				}
				if eligible && path == pathID {
					return true, nil
				}
			}
		}
	}
	return false, nil
}
func publicContentTypes(p commerce.Product) []commerce.ContentType {
	if p.ProductType == commerce.ProductCourse {
		return []commerce.ContentType{commerce.ContentCourses}
	}
	out := []commerce.ContentType{}
	seen := map[commerce.ContentType]bool{}
	if p.Package != nil {
		for _, i := range p.Package.Items {
			kind := i.ContentType
			if i.ScopeType == commerce.ScopeAll || i.ScopeType == commerce.ScopePath || i.ScopeType == commerce.ScopeSubject {
				return []commerce.ContentType{commerce.ContentAll}
			}
			if i.ScopeType == commerce.ScopeCourse {
				kind = commerce.ContentCourses
			}
			if kind != "" && !seen[kind] {
				seen[kind] = true
				out = append(out, kind)
			}
		}
	}
	return out
}

// Public visibility is a read-only projection rule, separate from the existing
// purchase/grant contracts. Taxonomy owns ancestor and subject lifecycle.
func (s *Service) publicTargetsVisible(ctx context.Context, p commerce.Product) (bool, error) {
	courseVisible := func(id string) (bool, error) {
		if s.catalog == nil {
			return false, nil
		}
		path, subject, eligible, e := s.catalog.CourseCommerceScope(ctx, id)
		if e != nil || !eligible {
			return false, e
		}
		return s.publicScopeVisible(ctx, path, subject)
	}
	if p.ProductType == commerce.ProductCourse {
		return courseVisible(p.CourseID)
	}
	if p.Package == nil {
		return false, nil
	}
	for _, i := range p.Package.Items {
		var visible bool
		var err error
		switch i.ScopeType {
		case commerce.ScopePath:
			visible, err = s.publicScopeVisible(ctx, i.PathID, "")
		case commerce.ScopeSubject:
			visible, err = s.publicScopeVisible(ctx, "", i.SubjectID)
		case commerce.ScopeCourse:
			visible, err = courseVisible(i.CourseID)
		default:
			continue
		}
		if err != nil || !visible {
			return false, err
		}
	}
	return true, nil
}
