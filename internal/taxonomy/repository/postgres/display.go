package postgres

import (
	"encoding/json"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type pathDisplay struct {
	ShowInHome   *bool                 `json:"showInHome,omitempty"`
	ShowInNavbar *bool                 `json:"showInNavbar,omitempty"`
	Settings     taxonomy.PathSettings `json:"settings"`
}
type subjectDisplay struct {
	Icon  string `json:"icon"`
	Color string `json:"color"`
}

func pathPresentation(nav, home *bool, settings *taxonomy.PathSettings) []byte {
	v := map[string]any{}
	if home != nil {
		v["showInHome"] = *home
	}
	if nav != nil {
		v["showInNavbar"] = *nav
	}
	if settings.HasValues() {
		v["settings"] = settings
	}
	b, _ := json.Marshal(v)
	return b
}
func subjectPresentation(icon, color *string) []byte {
	v := map[string]any{}
	if icon != nil {
		v["icon"] = *icon
	}
	if color != nil {
		v["color"] = *color
	}
	b, _ := json.Marshal(v)
	return b
}
