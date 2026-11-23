package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// buildSeedBinary compiles the seed binary and returns its path.
// It uses the actual source directory of this test file.
func buildSeedBinary(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "seed_test_binary")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}

	// Get the directory containing this test file — that is cmd/seed/
	_, thisFile, _, ok := runtime.Caller(0)
	if !ok {
		t.Fatal("cannot determine test file path via runtime.Caller")
	}
	srcDir := filepath.Dir(thisFile)

	cmd := exec.Command("go", "build", "-o", bin, srcDir)
	out, err := cmd.CombinedOutput()
	if err != nil {
		t.Fatalf("could not build seed binary from %s: %v\n%s", srcDir, err, out)
	}
	return bin
}

// runSeed executes the seed binary with the given env overrides and returns combined output + error.
func runSeed(t *testing.T, bin string, extraEnv ...string) (string, error) {
	t.Helper()
	cmd := exec.Command(bin)
	// Start from clean env — remove ALLOW_SEED and DATABASE_URL to avoid interference
	cmd.Env = filterEnv(os.Environ(), "ALLOW_SEED", "DATABASE_URL")
	cmd.Env = append(cmd.Env, extraEnv...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

// TestSeedBlockedWithoutAllowSeed verifies the seed tool exits non-zero and prints
// the BLOCKED message when ALLOW_SEED is not set.
func TestSeedBlockedWithoutAllowSeed(t *testing.T) {
	bin := buildSeedBinary(t)
	output, err := runSeed(t, bin, "DATABASE_URL=postgres://localhost/almeaa_test")

	if err == nil {
		t.Fatalf("expected exit non-zero when ALLOW_SEED is not set\nOutput:\n%s", output)
	}
	if !strings.Contains(output, "BLOCKED") {
		t.Errorf("expected 'BLOCKED' in output, got:\n%s", output)
	}
	if !strings.Contains(output, "ALLOW_SEED") {
		t.Errorf("expected 'ALLOW_SEED' in output, got:\n%s", output)
	}
}

// TestSeedBlockedWhenAllowSeedIsFalse verifies ALLOW_SEED=false is treated as not set.
func TestSeedBlockedWhenAllowSeedIsFalse(t *testing.T) {
	bin := buildSeedBinary(t)
	output, err := runSeed(t, bin,
		"ALLOW_SEED=false",
		"DATABASE_URL=postgres://localhost/almeaa_test",
	)

	if err == nil {
		t.Fatalf("expected exit non-zero with ALLOW_SEED=false\nOutput:\n%s", output)
	}
	if !strings.Contains(output, "BLOCKED") {
		t.Errorf("expected BLOCKED message with ALLOW_SEED=false, got:\n%s", output)
	}
}

// TestSeedBlockedAgainstProductionNeonURL verifies the seed tool refuses production URLs.
func TestSeedBlockedAgainstProductionNeonURL(t *testing.T) {
	bin := buildSeedBinary(t)

	productionURLs := []string{
		"postgres://user:pass@ep-xxx-yyy.us-east-2.aws.neon.tech/almeaadb",
		"postgres://user:pass@ep-abc.br-damp-feather-b9lqdru1.neon.tech/almeaadb",
		"postgresql://user:secret@somehost.neon.tech:5432/almeaadb?sslmode=require",
	}

	for _, url := range productionURLs {
		url := url // capture
		name := url
		if len(name) > 50 {
			name = name[:50] + "..."
		}
		t.Run(name, func(t *testing.T) {
			output, err := runSeed(t, bin,
				"ALLOW_SEED=true",
				"DATABASE_URL="+url,
			)
			if err == nil {
				t.Fatalf("expected exit non-zero for production URL %q\nOutput:\n%s", url, output)
			}
			if !strings.Contains(output, "BLOCKED") {
				t.Errorf("expected BLOCKED message for production URL %q, got:\n%s", url, output)
			}
		})
	}
}

// TestSeedBlockedWithNoDatabaseURL verifies missing DATABASE_URL causes a clean exit.
func TestSeedBlockedWithNoDatabaseURL(t *testing.T) {
	bin := buildSeedBinary(t)
	_, err := runSeed(t, bin, "ALLOW_SEED=true")
	if err == nil {
		t.Fatal("expected exit non-zero with no DATABASE_URL")
	}
}

// TestSeedDoesNotLogPassword verifies the plaintext password never appears in output.
// We use a localhost URL that will fail to connect, allowing us to check early output.
func TestSeedDoesNotLogPassword(t *testing.T) {
	bin := buildSeedBinary(t)
	output, _ := runSeed(t, bin,
		"ALLOW_SEED=true",
		"DATABASE_URL=postgres://user:pass@localhost:5433/almeaa_no_such_db",
	)

	if strings.Contains(output, "Almeaa@2026") {
		t.Errorf("SECURITY: plaintext password appeared in seed output:\n%s", output)
	}
}

// TestSanitizeURL tests the URL sanitizer in isolation.
func TestSanitizeURL(t *testing.T) {
	cases := []struct {
		input    string
		wantHost string
	}{
		{
			input:    "postgres://alice:secret123@db.example.com:5432/mydb",
			wantHost: "db.example.com:5432/mydb",
		},
		{
			input:    "postgres://localhost/almeaa_test",
			wantHost: "localhost",
		},
		{
			input:    "postgresql://admin:hunter2@127.0.0.1:5432/testdb?sslmode=disable",
			wantHost: "127.0.0.1:5432/testdb",
		},
	}

	for _, c := range cases {
		got := sanitizeURL(c.input)
		if !strings.Contains(got, c.wantHost) {
			t.Errorf("sanitizeURL(%q) = %q; want host substring %q", c.input, got, c.wantHost)
		}
		if strings.Contains(got, "secret123") || strings.Contains(got, "hunter2") || strings.Contains(got, "alice") || strings.Contains(got, "admin") {
			t.Errorf("sanitizeURL(%q) = %q; must not contain credentials", c.input, got)
		}
	}
}

// filterEnv returns env without entries whose key matches any of keys.
func filterEnv(env []string, keys ...string) []string {
	result := make([]string, 0, len(env))
	for _, e := range env {
		skip := false
		for _, k := range keys {
			if strings.HasPrefix(e, k+"=") {
				skip = true
				break
			}
		}
		if !skip {
			result = append(result, e)
		}
	}
	return result
}
