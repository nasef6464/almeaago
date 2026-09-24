package identityhttp

import (
	"encoding/json"
	"testing"
)

func TestNullableJSONStringDistinguishesNullAndString(t *testing.T) {
	value, ok := nullableJSONString(json.RawMessage(`"0501234567"`))
	if !ok || value == nil || *value != "0501234567" {
		t.Fatalf("unexpected string parse value=%v ok=%v", value, ok)
	}

	value, ok = nullableJSONString(json.RawMessage("null"))
	if !ok || value != nil {
		t.Fatalf("expected explicit null, value=%v ok=%v", value, ok)
	}
}

func TestNullableJSONStringRejectsNonString(t *testing.T) {
	if _, ok := nullableJSONString(json.RawMessage("123")); ok {
		t.Fatal("numeric identity value must be rejected")
	}
}
