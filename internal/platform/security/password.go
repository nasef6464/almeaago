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

const (
	passwordAlgorithm   = "argon2id"
	passwordMemoryKiB   = 19 * 1024
	passwordIterations  = 2
	passwordParallelism = 1
	passwordSaltBytes   = 16
	passwordKeyBytes    = 32
)

type argon2Parameters struct {
	MemoryKiB   uint32
	Iterations  uint32
	Parallelism uint8
	KeyBytes    uint32
}

func HashPassword(password string) (string, error) {
	salt := make([]byte, passwordSaltBytes)
	if _, err := rand.Read(salt); err != nil {
		return "", fmt.Errorf("generate password salt: %w", err)
	}

	hash := argon2.IDKey(
		[]byte(password),
		salt,
		passwordIterations,
		passwordMemoryKiB,
		passwordParallelism,
		passwordKeyBytes,
	)

	return fmt.Sprintf(
		"$%s$v=%d$m=%d,t=%d,p=%d$%s$%s",
		passwordAlgorithm,
		argon2.Version,
		passwordMemoryKiB,
		passwordIterations,
		passwordParallelism,
		base64.RawStdEncoding.EncodeToString(salt),
		base64.RawStdEncoding.EncodeToString(hash),
	), nil
}

func VerifyPassword(encoded, password string) bool {
	params, salt, expected, err := decodePasswordHash(encoded)
	if err != nil {
		return false
	}

	actual := argon2.IDKey(
		[]byte(password),
		salt,
		params.Iterations,
		params.MemoryKiB,
		params.Parallelism,
		params.KeyBytes,
	)

	return subtle.ConstantTimeCompare(actual, expected) == 1
}

func PasswordHashNeedsUpgrade(encoded string) bool {
	params, _, _, err := decodePasswordHash(encoded)
	if err != nil {
		return true
	}

	return params.MemoryKiB != passwordMemoryKiB ||
		params.Iterations != passwordIterations ||
		params.Parallelism != passwordParallelism ||
		params.KeyBytes != passwordKeyBytes
}

func decodePasswordHash(encoded string) (argon2Parameters, []byte, []byte, error) {
	parts := strings.Split(encoded, "$")
	if len(parts) != 6 || parts[0] != "" || parts[1] != passwordAlgorithm {
		return argon2Parameters{}, nil, nil, errors.New("invalid password hash format")
	}

	versionText := strings.TrimPrefix(parts[2], "v=")
	version, err := strconv.Atoi(versionText)
	if err != nil || version != argon2.Version {
		return argon2Parameters{}, nil, nil, errors.New("unsupported argon2 version")
	}

	var memory uint64
	var iterations uint64
	var parallelism uint64
	for _, item := range strings.Split(parts[3], ",") {
		key, value, found := strings.Cut(item, "=")
		if !found {
			return argon2Parameters{}, nil, nil, errors.New("invalid argon2 parameters")
		}
		parsed, err := strconv.ParseUint(value, 10, 32)
		if err != nil {
			return argon2Parameters{}, nil, nil, errors.New("invalid argon2 parameter value")
		}
		switch key {
		case "m":
			memory = parsed
		case "t":
			iterations = parsed
		case "p":
			parallelism = parsed
		default:
			return argon2Parameters{}, nil, nil, errors.New("unknown argon2 parameter")
		}
	}

	if memory < 7*1024 ||
		iterations < 1 ||
		parallelism < 1 ||
		parallelism > 32 {
		return argon2Parameters{}, nil, nil, errors.New("unsafe argon2 parameters")
	}

	salt, err := base64.RawStdEncoding.DecodeString(parts[4])
	if err != nil || len(salt) < 16 {
		return argon2Parameters{}, nil, nil, errors.New("invalid argon2 salt")
	}

	expected, err := base64.RawStdEncoding.DecodeString(parts[5])
	if err != nil || len(expected) < 16 || len(expected) > 64 {
		return argon2Parameters{}, nil, nil, errors.New("invalid argon2 hash")
	}

	return argon2Parameters{
		MemoryKiB:   uint32(memory),
		Iterations:  uint32(iterations),
		Parallelism: uint8(parallelism),
		KeyBytes:    uint32(len(expected)),
	}, salt, expected, nil
}
