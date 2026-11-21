package application

import (
	"context"
	"testing"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

type scopedPublicTaxonomy struct{}

func (scopedPublicTaxonomy) ValidCommerceScope(_ context.Context, _, _ string) (bool, error) {
	return true, nil
}
func (scopedPublicTaxonomy) PublicCommerceScopeVisible(_ context.Context, path, subject string) (bool, error) {
	return path == "path-a" && (subject == "" || subject == "subject-a"), nil
}

func TestPublicPackageMatchesExactScopeAndContent(t *testing.T) {
	s := NewService(nil, nil, scopedPublicTaxonomy{}, nil)
	tests := []struct {
		name    string
		items   []commerce.PackageItem
		subject string
		kind    commerce.ContentType
		want    bool
	}{
		{"subject and content match", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-a", ContentType: commerce.ContentBanks}}, "subject-a", commerce.ContentBanks, true},
		{"other subject excluded", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-b", ContentType: commerce.ContentBanks}}, "subject-a", commerce.ContentBanks, false},
		{"other content excluded", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-a", ContentType: commerce.ContentTests}}, "subject-a", commerce.ContentBanks, false},
		{"different items cannot combine", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-a", ContentType: commerce.ContentTests}, {ScopeType: commerce.ScopeSubject, SubjectID: "subject-b", ContentType: commerce.ContentBanks}}, "subject-a", commerce.ContentBanks, false},
		{"path all content", []commerce.PackageItem{{ScopeType: commerce.ScopePath, PathID: "path-a", ContentType: commerce.ContentAll}}, "subject-a", commerce.ContentBanks, true},
		{"other path excluded", []commerce.PackageItem{{ScopeType: commerce.ScopePath, PathID: "path-b", ContentType: commerce.ContentAll}}, "subject-a", commerce.ContentBanks, false},
		{"global membership", []commerce.PackageItem{{ScopeType: commerce.ScopeAll}}, "subject-a", commerce.ContentBanks, true},
		{"global matching content", []commerce.PackageItem{{ScopeType: commerce.ScopeContentType, ContentType: commerce.ContentFoundation}}, "subject-a", commerce.ContentFoundation, true},
		{"global different content", []commerce.PackageItem{{ScopeType: commerce.ScopeContentType, ContentType: commerce.ContentFoundation}}, "subject-a", commerce.ContentBanks, false},
		{"single course is not full subject", []commerce.PackageItem{{ScopeType: commerce.ScopeCourse, CourseID: "course-a"}}, "subject-a", commerce.ContentCourses, false},
		{"path only content filter subject belongs", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-a", ContentType: commerce.ContentBanks}}, "", commerce.ContentBanks, true},
		{"path only content filter other subject", []commerce.PackageItem{{ScopeType: commerce.ScopeSubject, SubjectID: "subject-b", ContentType: commerce.ContentBanks}}, "", commerce.ContentBanks, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			product := commerce.Product{ProductType: commerce.ProductPackage, Package: &commerce.Package{Items: tc.items}}
			got, err := s.publicPackageMatchesScope(context.Background(), product, "path-a", tc.subject, tc.kind)
			if err != nil || got != tc.want {
				t.Fatalf("got=%v error=%v want=%v", got, err, tc.want)
			}
		})
	}
}
