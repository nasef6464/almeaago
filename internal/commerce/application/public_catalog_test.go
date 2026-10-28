package application

import (
	"context"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	"testing"
)

type publicRepoStub struct {
	repoStub
	called bool
}

func (r *publicRepoStub) ListPublicCatalog(context.Context, int, int, string) (commerce.PublicCatalogPage, error) {
	r.called = true
	return commerce.PublicCatalogPage{Items: []commerce.PublicProduct{}}, nil
}
func TestPublicCatalogDoesNotRequireStaffAndValidatesPagination(t *testing.T) {
	r := &publicRepoStub{}
	s := NewService(r, nil, nil, nil)
	if _, err := s.PublicCatalog(context.Background(), 1, 50); err != nil || !r.called {
		t.Fatalf("guest catalog: %v", err)
	}
	r.called = false
	if _, err := s.PublicCatalog(context.Background(), -1, 50); err != ErrInvalidInput || r.called {
		t.Fatalf("invalid pagination reached repository: %v", err)
	}
}

// The public endpoint is independent of staff listing authorization.
func TestPublicCatalogReusesContentOwnerEligibility(t *testing.T) {
	r := &publicEligibilityRepo{repoStub: repoStub{product: commerce.Product{ID: "p", ProductType: commerce.ProductCourse, Status: commerce.ProductActive, IsVisible: true, AccessMode: commerce.AccessPaid, PriceMinor: 15000, CourseID: "course"}}}
	s := NewService(r, catalogStub{eligible: false, pathID: "path", subjectID: "subject"}, publicTaxonomyStub{taxonomyStub: taxonomyStub{ok: true}, visible: true}, nil)
	out, err := s.PublicCatalog(context.Background(), 1, 50)
	if err != nil || len(out.Items) != 0 {
		t.Fatalf("ineligible course leaked: %#v %v", out, err)
	}
	s.catalog = catalogStub{eligible: true, pathID: "path", subjectID: "subject"}
	out, err = s.PublicCatalog(context.Background(), 1, 50)
	if err != nil || len(out.Items) != 1 {
		t.Fatalf("eligible course missing: %#v %v", out, err)
	}
}

type publicEligibilityRepo struct{ repoStub }

func (r *publicEligibilityRepo) ListPublicCatalog(context.Context, int, int, string) (commerce.PublicCatalogPage, error) {
	return commerce.PublicCatalogPage{Items: []commerce.PublicProduct{{ID: "p"}}}, nil
}

func TestPublicCatalogPathFilterUsesCanonicalTargets(t *testing.T) {
	const pathA = "00000000-0000-0000-0000-00000000000a"
	const pathB = "00000000-0000-0000-0000-00000000000b"
	r := &publicEligibilityRepo{repoStub: repoStub{product: commerce.Product{ID: "p", ProductType: commerce.ProductPackage, Status: commerce.ProductActive, IsVisible: true, AccessMode: commerce.AccessPaid, PriceMinor: 15000, Package: &commerce.Package{PackageKind: commerce.PackageBundle, Items: []commerce.PackageItem{{ScopeType: commerce.ScopePath, PathID: pathA}}}}}}
	s := NewService(r, nil, publicTaxonomyStub{taxonomyStub: taxonomyStub{ok: true}, visible: true}, nil)
	out, err := s.PublicCatalog(context.Background(), 1, 50, pathA)
	if err != nil || len(out.Items) != 1 {
		t.Fatalf("path A missing: %#v %v", out, err)
	}
	out, err = s.PublicCatalog(context.Background(), 1, 50, pathB)
	if err != nil || len(out.Items) != 0 {
		t.Fatalf("path A offer leaked into B: %#v %v", out, err)
	}
	r.product.Package.Items = []commerce.PackageItem{{ScopeType: commerce.ScopeAll}}
	out, err = s.PublicCatalog(context.Background(), 1, 50, pathA)
	if err != nil || len(out.Items) != 0 {
		t.Fatalf("global offer substituted for path: %#v %v", out, err)
	}
	s.taxonomy = publicTaxonomyStub{taxonomyStub: taxonomyStub{ok: false}, visible: false}
	if _, err = s.PublicCatalog(context.Background(), 1, 50, pathA); err != commerce.ErrNotFound {
		t.Fatalf("inactive path not denied: %v", err)
	}
	if _, err = s.PublicCatalog(context.Background(), 1, 50, "path-code"); err != ErrInvalidInput {
		t.Fatalf("noncanonical path accepted: %v", err)
	}
}

type packageScopeTaxonomy struct{ path, subject string }

func (r packageScopeTaxonomy) ValidCommerceScope(_ context.Context, path, subject string) (bool, error) {
	if path != "" && subject != "" {
		return path == r.path && subject == r.subject, nil
	}
	return path == r.path || subject == r.subject, nil
}
func TestPublicCatalogPathFilterCourseAndSubjectTargets(t *testing.T) {
	const a = "00000000-0000-0000-0000-00000000000a"
	const b = "00000000-0000-0000-0000-00000000000b"
	for _, target := range []commerce.PackageItem{{ScopeType: commerce.ScopeCourse, CourseID: "course"}, {ScopeType: commerce.ScopeSubject, SubjectID: "subject"}} {
		t.Run(string(target.ScopeType), func(t *testing.T) {
			r := &publicEligibilityRepo{repoStub: repoStub{product: commerce.Product{ID: "p", ProductType: commerce.ProductPackage, Status: commerce.ProductActive, IsVisible: true, AccessMode: commerce.AccessPaid, PriceMinor: 1, Package: &commerce.Package{PackageKind: commerce.PackageBundle, Items: []commerce.PackageItem{target}}}}}
			s := NewService(r, catalogStub{eligible: true, pathID: a}, packageScopeTaxonomy{path: a, subject: "subject"}, nil)
			out, err := s.PublicCatalog(context.Background(), 1, 50, a)
			if err != nil || len(out.Items) != 1 {
				t.Fatalf("own target missing: %#v %v", out, err)
			}
			// b must be active for the test to exercise the target relationship denial.
			s.taxonomy = twoPathTaxonomy{a: a, b: b, subject: "subject"}
			out, err = s.PublicCatalog(context.Background(), 1, 50, b)
			if err != nil || len(out.Items) != 0 {
				t.Fatalf("foreign target leaked: %#v %v", out, err)
			}
		})
	}
}

type twoPathTaxonomy struct{ a, b, subject string }

func (r twoPathTaxonomy) ValidCommerceScope(_ context.Context, path, subject string) (bool, error) {
	if subject == "" {
		return path == r.a || path == r.b, nil
	}
	return subject == r.subject && (path == "" || path == r.a), nil
}

type publicTaxonomyStub struct {
	taxonomyStub
	visible bool
}

func (r publicTaxonomyStub) PublicCommerceScopeVisible(context.Context, string, string) (bool, error) {
	return r.visible, nil
}
func TestPublicCatalogRejectsArchivedTaxonomyWhileCourseRemainsVisible(t *testing.T) {
	for _, kind := range []string{"course", "package-path", "package-subject", "package-course"} {
		t.Run(kind, func(t *testing.T) {
			p := commerce.Product{ID: "p", ProductType: commerce.ProductCourse, CourseID: "course", Status: commerce.ProductActive, IsVisible: true, AccessMode: commerce.AccessPaid, PriceMinor: 100}
			if kind != "course" {
				p.ProductType = commerce.ProductPackage
				p.CourseID = ""
				target := commerce.PackageItem{ScopeType: commerce.ScopePath, PathID: "path"}
				if kind == "package-subject" {
					target = commerce.PackageItem{ScopeType: commerce.ScopeSubject, SubjectID: "subject"}
				}
				if kind == "package-course" {
					target = commerce.PackageItem{ScopeType: commerce.ScopeCourse, CourseID: "course"}
				}
				p.Package = &commerce.Package{PackageKind: commerce.PackageBundle, Items: []commerce.PackageItem{target}}
			}
			r := &publicEligibilityRepo{repoStub: repoStub{product: p}}
			s := NewService(r, catalogStub{eligible: true, pathID: "path", subjectID: "subject"}, publicTaxonomyStub{taxonomyStub: taxonomyStub{ok: true}, visible: false}, nil)
			out, err := s.PublicCatalog(context.Background(), 1, 50)
			if err != nil || len(out.Items) != 0 {
				t.Fatalf("archived taxonomy offer leaked although course is visible: %#v %v", out, err)
			}
		})
	}
}

func (r packageScopeTaxonomy) PublicCommerceScopeVisible(ctx context.Context, path, subject string) (bool, error) {
	return r.ValidCommerceScope(ctx, path, subject)
}
func (r twoPathTaxonomy) PublicCommerceScopeVisible(ctx context.Context, path, subject string) (bool, error) {
	return r.ValidCommerceScope(ctx, path, subject)
}
