package application

import (
	"strings"
	"testing"
)

func TestPasswordPolicyMatchesLegacyContract(t *testing.T) {
	valid := []string{"Password1", "abc12345"}
	invalid := []string{"short1", "abcdefgh", "12345678", "", strings.Repeat("a", 159) + "A1"}

	for _, value := range valid {
		if !validPassword(value) {
			t.Fatalf("expected %q to be valid", value)
		}
	}
	for _, value := range invalid {
		if validPassword(value) {
			t.Fatalf("expected %q to be invalid", value)
		}
	}
}

func TestNationalIDPattern(t *testing.T) {
	if !nationalIDPattern.MatchString("1234567890") {
		t.Fatal("expected valid Saudi national ID shape")
	}
	if nationalIDPattern.MatchString("3234567890") {
		t.Fatal("national ID must start with 1 or 2")
	}
}
