package domain

import (
	"strings"
	"testing"
)

func TestFontPatchSourceContract(t *testing.T) {
	patch, err := ParseFontPatch(map[string]any{"bodySize": "16px", "key": "ignored"})
	if err != nil || patch["bodyFont"] != "tajawal" || patch["buttonFont"] != "tajawal" || patch["bodySize"] != "16px" {
		t.Fatalf("defaults: %#v %v", patch, err)
	}
	if _, exists := patch["headingSize"]; exists {
		t.Fatal("omission must remain omitted")
	}
	if _, exists := patch["key"]; exists {
		t.Fatal("source strips metadata")
	}
	patch, err = ParseFontPatch(map[string]any{"bodyColor": "", "bodyCustomFont": map[string]any{"dataUrl": "data:font/woff2;base64,AAAA"}})
	if err != nil || patch["bodyColor"] != "" {
		t.Fatalf("clear/upload: %#v %v", patch, err)
	}
	upload := patch["bodyCustomFont"].(map[string]any)
	if upload["name"] != "" || upload["size"] != float64(0) {
		t.Fatalf("nested defaults: %#v", upload)
	}
	for _, input := range []map[string]any{
		{"bodyFont": "serif"}, {"bodyFont": nil}, {"headingSize": "100px"}, {"bodySize": "16px;display:none"},
		{"buttonWeight": "100"}, {"bodyColor": "red"}, {"headingColor": nil}, {"bodyCustomFont": nil},
		{"bodyCustomFont": map[string]any{"size": float64(500001)}},
		{"bodyCustomFont": map[string]any{"dataUrl": "data:text/html;base64,AAAA"}},
		{"bodyCustomFont": map[string]any{"dataUrl": "data:font/woff;base64," + strings.Repeat("A", 700000)}},
	} {
		if _, err := ParseFontPatch(input); err == nil {
			t.Fatalf("invalid input accepted: %#v", input)
		}
	}
}
