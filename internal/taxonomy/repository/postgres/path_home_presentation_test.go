package postgres

import (
	"encoding/json"
	"testing"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func TestPathHomePresentationPreservesExplicitFalseAndOmission(t *testing.T) {
	hidden, shown := false, true
	for _, value := range []*bool{nil, &hidden, &shown} {
		for _, tc := range []struct {
			name string
			raw  []byte
		}{
			{"create", buildPathPresMap(taxonomy.PathWrite{ShowInHome: value})},
			{"patch", buildPathPatchPresMap(taxonomy.PathPatch{ShowInHome: value})},
		} {
			var fields map[string]any
			if err := json.Unmarshal(tc.raw, &fields); err != nil {
				t.Fatal(err)
			}
			got, present := fields["showInHome"]
			if present != (value != nil) || (value != nil && got != *value) {
				t.Fatalf("%s lost nullable showInHome: input=%v output=%s", tc.name, value, tc.raw)
			}
		}
		if hasPathPresPatch(taxonomy.PathPatch{ShowInHome: value}) != (value != nil) {
			t.Fatalf("home-only patch detection: input=%v", value)
		}
	}
}
