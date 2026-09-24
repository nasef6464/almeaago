package security

import (
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"math/big"
)

func NewNumericCode(digits int) (string, error) {
	if digits < 4 || digits > 10 {
		return "", fmt.Errorf("otp digits must be between 4 and 10")
	}

	limit := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(digits)), nil)
	value, err := rand.Int(rand.Reader, limit)
	if err != nil {
		return "", fmt.Errorf("generate otp: %w", err)
	}

	return fmt.Sprintf("%0*d", digits, value.Int64()), nil
}

func DigestOTP(pepper, phone, code string) (string, error) {
	if len(pepper) < 32 {
		return "", fmt.Errorf("otp pepper must be at least 32 bytes")
	}

	mac := hmac.New(sha256.New, []byte(pepper))
	_, _ = mac.Write([]byte(phone))
	_, _ = mac.Write([]byte{0})
	_, _ = mac.Write([]byte(code))
	return hex.EncodeToString(mac.Sum(nil)), nil
}

func VerifyOTPDigest(pepper, phone, code, expected string) bool {
	actual, err := DigestOTP(pepper, phone, code)
	if err != nil {
		return false
	}
	expectedBytes, err := hex.DecodeString(expected)
	if err != nil {
		return false
	}
	actualBytes, err := hex.DecodeString(actual)
	if err != nil {
		return false
	}
	return hmac.Equal(actualBytes, expectedBytes)
}
