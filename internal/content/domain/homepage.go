package domain

import (
	_ "embed"
	"encoding/json"
	"errors"
	"math"
	"unicode/utf16"
)

// HomepageSettings is a presentation document. Entity references are stored in
// relational tables, never as a second authoritative copy of content/taxonomy.
type HomepageSettings map[string]any

var ErrInvalidHomepageSettings = errors.New("invalid homepage settings")

//go:embed homepage_defaults.json
var homepageDefaultsJSON []byte

func DefaultHomepageSettings() HomepageSettings {
	var result HomepageSettings
	// The embedded document is checked by tests and is never request data.
	if err := json.Unmarshal(homepageDefaultsJSON, &result); err != nil {
		panic(err)
	}
	return result
}

type homepageRule func(any) (any, bool)

func homepageString(v any) (any, bool) { s, ok := v.(string); return s, ok }
func homepageBool(v any) (any, bool)   { b, ok := v.(bool); return b, ok }
func homepageNumber(v any) (any, bool) {
	n, ok := v.(float64)
	return n, ok && !math.IsNaN(n) && !math.IsInf(n, 0)
}
func homepageEnum(values ...string) homepageRule {
	return func(v any) (any, bool) {
		s, ok := v.(string)
		if ok {
			for _, x := range values {
				if s == x {
					return s, true
				}
			}
		}
		return nil, false
	}
}
func homepageRequiredString(v any) (any, bool) { s, ok := v.(string); return s, ok && len(s) > 0 }
func homepageArray(rule homepageRule, limit int) homepageRule {
	return func(v any) (any, bool) {
		items, ok := v.([]any)
		if !ok || (limit > 0 && len(items) > limit) {
			return nil, false
		}
		result := make([]any, 0, len(items))
		for _, item := range items {
			value, ok := rule(item)
			if !ok {
				return nil, false
			}
			result = append(result, value)
		}
		return result, true
	}
}
func homepageObject(fields map[string]homepageRule, required []string, defaults map[string]any) homepageRule {
	return func(v any) (any, bool) {
		input, ok := v.(map[string]any)
		if !ok || input == nil {
			return nil, false
		}
		result := map[string]any{}
		for k, x := range defaults {
			result[k] = x
		}
		for _, k := range required {
			if _, ok := input[k]; !ok {
				return nil, false
			}
		}
		for k, rule := range fields {
			if raw, exists := input[k]; exists {
				value, ok := rule(raw)
				if !ok {
					return nil, false
				}
				result[k] = value
			}
		}
		return result, true
	}
}
func homepageStrings(names ...string) map[string]homepageRule {
	fields := map[string]homepageRule{}
	for _, name := range names {
		fields[name] = homepageString
	}
	return fields
}

// ParseHomepagePatch matches the source Zod contract: unknown keys are
// stripped, omitted top-level fields stay omitted, and false/empty/zero survive.
// Defaults here are only the defaults in platformPresentationSchemas.ts;
// persistence fills Mongoose subdocument defaults separately.
func ParseHomepagePatch(input map[string]any) (HomepageSettings, error) {
	hero := homepageStrings("badgeText", "titlePrefix", "titleHighlight", "titleSuffix", "description", "primaryCtaLabel", "primaryCtaLink", "secondaryCtaLabel", "secondaryCtaLink", "tertiaryCtaLabel", "tertiaryCtaLink", "badgeTextColor", "titlePrefixColor", "titleHighlightColor", "titleSuffixColor", "descriptionColor", "primaryCtaColor", "secondaryCtaColor", "tertiaryCtaColor", "imageUrl", "imageAlt", "floatingCardTitle", "floatingCardSubtitle", "floatingCardProgressLabel", "floatingCardProgressValue")
	hero["autoRotateImages"] = homepageBool
	hero["rotateIntervalSeconds"] = func(v any) (any, bool) {
		n, ok := homepageNumber(v)
		if !ok {
			return nil, false
		}
		return n, n.(float64) >= 3 && n.(float64) <= 60
	}
	hero["galleryImages"] = homepageArray(func(v any) (any, bool) { s, ok := v.(string); return s, ok && len(utf16.Encode([]rune(s))) <= 1500000 }, 10)
	stat := map[string]homepageRule{"id": homepageRequiredString, "label": homepageRequiredString, "mode": homepageEnum("dynamic", "manual"), "source": homepageEnum("students", "courses", "assets", "rating"), "manualValue": homepageString}
	testimonial := homepageStrings("degree", "image")
	for _, k := range []string{"id", "name", "text"} {
		testimonial[k] = homepageRequiredString
	}
	navItem := map[string]homepageRule{"id": homepageString, "label": homepageString, "visible": homepageBool, "order": homepageNumber}
	object := homepageObject(map[string]homepageRule{
		"studentExperience": homepageObject(map[string]homepageRule{"visibilityMode": homepageEnum("all", "enrolled"), "promptEnrollment": homepageBool}, []string{"visibilityMode", "promptEnrollment"}, nil),
		"brand":             homepageObject(homepageStrings("logoUrl", "logoAlt", "logoText", "logoAccentText"), nil, nil),
		"hero":              homepageObject(hero, nil, nil),
		"sections":          homepageObject(homepageStrings("featuredCoursesTitle", "featuredCoursesSubtitle", "featuredArticlesTitle", "featuredArticlesSubtitle", "whyChooseTitle", "whyChooseDescription", "testimonialsTitle", "testimonialsSubtitle"), nil, nil),
		"typography":        homepageObject(map[string]homepageRule{"headingFont": homepageEnum("tajawal", "system", "serif"), "bodyFont": homepageEnum("tajawal", "system", "serif"), "headingWeight": homepageEnum("bold", "black")}, nil, nil),
		"navigation":        homepageObject(map[string]homepageRule{"showAutoPaths": homepageBool, "moreLabel": homepageString, "items": homepageArray(homepageObject(navItem, []string{"id"}, nil), 0)}, nil, nil),
		"stats":             homepageArray(homepageObject(stat, []string{"id", "label"}, map[string]any{"mode": "dynamic", "source": "students"}), 0),
		"testimonials":      homepageArray(homepageObject(testimonial, []string{"id", "name", "text"}, nil), 0),
		"featuredPathIds":   homepageArray(homepageString, 0), "featuredCourseIds": homepageArray(homepageString, 0), "featuredArticleLessonIds": homepageArray(homepageString, 0),
	}, nil, nil)
	result, ok := object(input)
	if !ok {
		return nil, ErrInvalidHomepageSettings
	}
	return HomepageSettings(result.(map[string]any)), nil
}

// HomepageSubdocumentDefaults reproduces the source Mongoose subdocument
// defaults after Zod parsing. A supplied nested object replaces its previous
// value; omitted top-level fields are left for the repository's atomic merge.
func HomepageSubdocumentDefaults(patch HomepageSettings) (HomepageSettings, error) {
	raw, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}
	var result HomepageSettings
	if err = json.Unmarshal(raw, &result); err != nil {
		return nil, err
	}
	defaults := DefaultHomepageSettings()
	for _, key := range []string{"brand", "hero", "sections", "typography", "navigation"} {
		supplied, ok := result[key].(map[string]any)
		if !ok {
			continue
		}
		base := defaults[key].(map[string]any)
		if key == "brand" || key == "hero" || key == "sections" {
			for name, value := range base {
				if _, ok := value.(string); ok {
					base[name] = ""
				}
			}
		}
		if key == "navigation" {
			base["items"] = []any{}
		}
		for name, value := range supplied {
			base[name] = value
		}
		result[key] = base
	}
	for _, spec := range []struct {
		key    string
		fields map[string]any
	}{
		{"stats", map[string]any{"manualValue": ""}},
		{"testimonials", map[string]any{"degree": "", "image": ""}},
	} {
		if items, ok := result[spec.key].([]any); ok {
			for _, item := range items {
				fields := item.(map[string]any)
				for name, value := range spec.fields {
					if _, exists := fields[name]; !exists {
						fields[name] = value
					}
				}
			}
		}
	}
	if nav, ok := result["navigation"].(map[string]any); ok {
		for _, item := range nav["items"].([]any) {
			fields := item.(map[string]any)
			for name, value := range map[string]any{"label": "", "visible": true, "order": float64(0)} {
				if _, exists := fields[name]; !exists {
					fields[name] = value
				}
			}
		}
	}
	return result, nil
}
