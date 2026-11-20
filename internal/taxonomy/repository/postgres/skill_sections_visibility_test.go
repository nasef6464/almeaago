package postgres

import (
	"testing"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func TestSkillSectionsFollowSubjectVisibility(t *testing.T) {
	hidden := false
	result := filterPublicVisibility(taxonomy.Bootstrap{
		Paths:    []taxonomy.Path{{ID: "p"}},
		Subjects: []taxonomy.Subject{{ID: "visible", PathID: "p"}, {ID: "hidden", PathID: "p", IsVisible: &hidden}},
		Sections: []taxonomy.SkillSection{{ID: "a", SubjectID: "visible"}, {ID: "b", SubjectID: "hidden"}},
	})
	if len(result.Sections) != 1 || result.Sections[0].ID != "a" {
		t.Fatalf("hidden subject section leaked: %+v", result.Sections)
	}
}
