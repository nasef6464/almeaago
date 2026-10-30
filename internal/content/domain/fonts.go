package domain

import (
	"errors"
	"regexp"
	"unicode/utf16"
)

type FontSettings map[string]any

var ErrInvalidFontSettings = errors.New("invalid platform font settings")
var fontSizePattern = regexp.MustCompile(`^\d{1,2}(\.\d)?(px|rem)$`)
var fontColorPattern = regexp.MustCompile(`^#[0-9a-fA-F]{6}$`)
var fontDataPattern = regexp.MustCompile(`^data:font/(woff2?|ttf|otf);base64,[A-Za-z0-9+/=]+$`)

func DefaultFontSettings() FontSettings {
	result := FontSettings{"key": "default", "bodyCustomFont": map[string]any{}, "headingCustomFont": map[string]any{}}
	for _, target := range []string{"body", "heading", "navigation", "button"} {
		result[target+"Font"] = "tajawal"
		for _, field := range []string{"Size", "Weight", "Color"} {
			result[target+field] = ""
		}
	}
	return result
}

// Matches the approved source's Zod defaults and omission-preserving PATCH.
// Unknown document metadata is stripped, not persisted or reflected into CSS.
func ParseFontPatch(input map[string]any) (FontSettings, error) {
	if input == nil {
		return nil, ErrInvalidFontSettings
	}
	result := FontSettings{}
	for _, target := range []string{"body", "heading", "navigation", "button"} {
		key := target + "Font"
		result[key] = "tajawal"
		if v, ok := input[key]; ok {
			s, valid := v.(string)
			if !valid || !oneOf(s, "tajawal", "cairo", "almarai", "readex-pro", "ibm-plex-sans-arabic", "noto-naskh-arabic", "noto-kufi-arabic", "system", "custom") {
				return nil, ErrInvalidFontSettings
			}
			result[key] = s
		}
		for _, kind := range []string{"Size", "Weight", "Color"} {
			key = target + kind
			if v, ok := input[key]; ok {
				s, valid := v.(string)
				if !valid {
					return nil, ErrInvalidFontSettings
				}
				if s != "" && ((kind == "Size" && !fontSizePattern.MatchString(s)) || (kind == "Color" && !fontColorPattern.MatchString(s)) || (kind == "Weight" && !oneOf(s, "300", "400", "500", "600", "700", "800", "900", "normal", "bold"))) {
					return nil, ErrInvalidFontSettings
				}
				result[key] = s
			}
		}
	}
	for _, key := range []string{"bodyCustomFont", "headingCustomFont"} {
		if v, ok := input[key]; ok {
			upload, valid := v.(map[string]any)
			if !valid {
				return nil, ErrInvalidFontSettings
			}
			clean := map[string]any{"name": "", "fileName": "", "mimeType": "", "size": float64(0)}
			for field, max := range map[string]int{"name": 80, "fileName": 160, "mimeType": 80, "dataUrl": 700000} {
				if value, exists := upload[field]; exists {
					s, valid := value.(string)
					if !valid || len(utf16.Encode([]rune(s))) > max {
						return nil, ErrInvalidFontSettings
					}
					if field == "dataUrl" && s != "" && !fontDataPattern.MatchString(s) {
						return nil, ErrInvalidFontSettings
					}
					clean[field] = s
				}
			}
			if value, exists := upload["size"]; exists {
				size, valid := value.(float64)
				if !valid || size < 0 || size > 500000 {
					return nil, ErrInvalidFontSettings
				}
				clean["size"] = size
			}
			result[key] = clean
		}
	}
	return result, nil
}

func oneOf(value string, allowed ...string) bool {
	for _, item := range allowed {
		if value == item {
			return true
		}
	}
	return false
}
