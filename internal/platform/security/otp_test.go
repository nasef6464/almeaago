package security

import (
	"regexp"
	"testing"
)

func TestNumericCode(t *testing.T) {
	code, err := NewNumericCode(6)
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[0-9]{6}$`).MatchString(code) {
		t.Fatalf("unexpected code shape %q", code)
	}
}

func TestOTPDigestUsesPepperAndContext(t *testing.T) {
	pepper := "0123456789abcdef0123456789abcdef"
	first, err := DigestOTP(pepper, "966501234567", "123456")
	if err != nil {
		t.Fatal(err)
	}
	second, err := DigestOTP(pepper, "966501234568", "123456")
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("phone context must change OTP digest")
	}
	if !VerifyOTPDigest(pepper, "966501234567", "123456", first) {
		t.Fatal("expected OTP digest to verify")
	}
	if VerifyOTPDigest(pepper, "966501234567", "654321", first) {
		t.Fatal("wrong OTP must not verify")
	}
}
