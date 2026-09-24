package security

import "testing"

func TestArgon2idHashAndVerify(t *testing.T) {
	hasher := DefaultArgon2id()

	encoded, err := hasher.Hash("SecurePass123")
	if err != nil {
		t.Fatal(err)
	}

	ok, err := hasher.Verify(encoded, "SecurePass123")
	if err != nil {
		t.Fatal(err)
	}
	if !ok {
		t.Fatal("expected password to verify")
	}

	ok, err = hasher.Verify(encoded, "WrongPass123")
	if err != nil {
		t.Fatal(err)
	}
	if ok {
		t.Fatal("wrong password verified")
	}
}
