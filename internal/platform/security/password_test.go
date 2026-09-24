package security

import (
	"strings"
	"testing"
)

func TestPasswordHashRoundTrip(t *testing.T) {
	hash, err := HashPassword("StrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	if !VerifyPassword(hash, "StrongPass123") {
		t.Fatal("expected password to verify")
	}
	if VerifyPassword(hash, "wrong-password") {
		t.Fatal("wrong password must not verify")
	}
	if PasswordHashNeedsUpgrade(hash) {
		t.Fatal("new hash should use current parameters")
	}
}

func TestPasswordHashesUseUniqueSalt(t *testing.T) {
	first, err := HashPassword("StrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	second, err := HashPassword("StrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	if first == second {
		t.Fatal("password hashes must differ because salts are unique")
	}
}

func TestMalformedPasswordHashFailsClosed(t *testing.T) {
	values := []string{
		"",
		"abc",
		"$argon2id$v=19$m=1,t=1,p=1$bad$bad",
		"$argon2id$v=18$m=19456,t=2,p=1$YWJjZGVmZ2hpamtsbW5vcA$YWJjZGVmZ2hpamtsbW5vcA",
	}
	for _, value := range values {
		if VerifyPassword(value, "StrongPass123") {
			t.Fatalf("malformed hash %q unexpectedly verified", value)
		}
	}
}

func TestPasswordHashIsSelfDescribing(t *testing.T) {
	hash, err := HashPassword("StrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasPrefix(hash, "$argon2id$v=19$m=19456,t=2,p=1$") {
		t.Fatalf("unexpected hash parameters: %s", hash)
	}
}

func BenchmarkHashPassword(b *testing.B) {
	for i := 0; i < b.N; i++ {
		if _, err := HashPassword("StrongPass123"); err != nil {
			b.Fatal(err)
		}
	}
}
