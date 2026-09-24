package security

import (
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"golang.org/x/crypto/argon2"
)

type Argon2id struct {
	Memory      uint32
	Iterations  uint32
	Parallelism uint8
	SaltLength  uint32
	KeyLength   uint32
}

func DefaultArgon2id() Argon2id {
	return Argon2id{
		Memory:      64 * 1024,
		Iterations:  3,
		Parallelism: 2,
		SaltLength:  16,
		KeyLength:   32,
	}
}

func (a Argon2id) Hash(password string) (string, error) {
	salt := make([]byte, a.SaltLength)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	hash := argon2.IDKey([]byte(password), salt, a.Iterations, a.Memory, a.Parallelism, a.KeyLength)
	return fmt.Sprintf(
		"$argon2id$v=%d$m=%d,t=%d,p=%d$%s$%s",
		argon2.Version,
		a.Memory,
		a.Iterations,
		a.Parallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

func (a Argon2id) Verify(encodedHash, password string) (bool, error) {
	params, salt, expected, err := decodeArgon2id(encodedHash)
	if err != nil {
		return false, err
	}
	actual := argon2.IDKey(
		[]byte(password),
		salt,
		params.Iterations,
		params.Memory,
		params.Parallelism,
		uint32(len(expected)),
	)
	return subtle.ConstantTimeCompare(actual, expected) == 1, nil
}

func decodeArgon2id(encoded string) (Argon2id, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[1] != "argon2id" {
		return Argon2id{}, nil, nil, errors.New("invalid argon2id hash")
	}

	var version int
	if _, err := fmt.Sscanf(parts[2], "v=%d", &version); err != nil || version != argon2.Version {
		return Argon2id{}, nil, nil, errors.New("unsupported argon2id version")
	}

	paramParts := strings.Split(parts[3], ",")
	if len(paramParts) != 3 {
		return Argon2id{}, nil, nil, errors.New("invalid argon2id parameters")
	}

	parsedMemory, err := strconv.ParseUint(strings.TrimPrefix(paramParts[0], "m="), 10, 32)
	if err != nil {
		return Argon2id{}, nil, nil, err
	}
	parsedIterations, err := strconv.ParseUint(strings.TrimPrefix(paramParts[1], "t="), 10, 32)
	if err != nil {
		return Argon2id{}, nil, nil, err
	}
	parsedParallelism, err := strconv.ParseUint(strings.TrimPrefix(paramParts[2], "p="), 10, 8)
	if err != nil {
		return Argon2id{}, nil, nil, err
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil {
		return Argon2id{}, nil, nil, err
	}
	hash, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil {
		return Argon2id{}, nil, nil, err
	}

	return Argon2id{
		Memory:      uint32(parsedMemory),
		Iterations:  uint32(parsedIterations),
		Parallelism: uint8(parsedParallelism),
		SaltLength:  uint32(len(salt)),
		KeyLength:   uint32(len(hash)),
	}, salt, hash, nil
}
