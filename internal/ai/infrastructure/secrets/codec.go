package secrets

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"io"
	"strings"
)

var ErrUnavailable = errors.New("ai secret encryption is not configured")

type Codec struct {
	aead cipher.AEAD
}

func New(base64Key string) (*Codec, error) {
	raw := strings.TrimSpace(base64Key)
	if raw == "" {
		return &Codec{}, nil
	}
	key, err := base64.StdEncoding.DecodeString(raw)
	if err != nil || len(key) != 32 {
		return nil, errors.New("AI_CONFIG_ENCRYPTION_KEY must be base64-encoded 32 bytes")
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	return &Codec{aead: aead}, nil
}

func (c *Codec) Available() bool {
	return c != nil && c.aead != nil
}

func (c *Codec) Encrypt(plain string) ([]byte, []byte, error) {
	if !c.Available() {
		return nil, nil, ErrUnavailable
	}
	nonce := make([]byte, c.aead.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return nil, nil, err
	}
	ciphertext := c.aead.Seal(nil, nonce, []byte(plain), nil)
	return ciphertext, nonce, nil
}

func (c *Codec) Decrypt(ciphertext, nonce []byte) (string, error) {
	if !c.Available() {
		return "", ErrUnavailable
	}
	plain, err := c.aead.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return "", err
	}
	return string(plain), nil
}
