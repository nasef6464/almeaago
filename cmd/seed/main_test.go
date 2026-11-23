package main

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

// TestValidateDatabaseURLSafety verifies in-memory security validation rules without network access.
func TestValidateDatabaseURLSafety(t *testing.T) {
	tests := []struct {
		name        string
		url         string
		appEnv      string
		allowSeed   string
		wantErr     bool
		errContains string
	}{
		{
			name:        "Blocked when ALLOW_SEED is empty",
			url:         "postgres://user:pass@localhost:5432/almeaa_test",
			allowSeed:   "",
			wantErr:     true,
			errContains: "ALLOW_SEED=true is not set",
		},
		{
			name:        "Blocked when ALLOW_SEED is false",
			url:         "postgres://user:pass@localhost:5432/almeaa_test",
			allowSeed:   "false",
			wantErr:     true,
			errContains: "ALLOW_SEED=true is not set",
		},
		{
			name:        "Blocked when APP_ENV is production",
			url:         "postgres://user:pass@localhost:5432/almeaa_test",
			appEnv:      "production",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "strictly prohibited in environment",
		},
		{
			name:        "Blocked when APP_ENV is prod",
			url:         "postgres://user:pass@localhost:5432/almeaa_test",
			appEnv:      "prod",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "strictly prohibited in environment",
		},
		{
			name:        "Blocked when APP_ENV is staging",
			url:         "postgres://user:pass@localhost:5432/almeaa_test",
			appEnv:      "staging",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "strictly prohibited in environment",
		},
		{
			name:        "Blocked with empty DATABASE_URL",
			url:         "",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "DATABASE_URL is required",
		},
		{
			name:        "Blocked against Neon production branch pattern in host",
			url:         "postgres://user:secret@br-damp-feather-b9lqdru1.neon.tech/almeaadb",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "br-damp-feather-b9lqdru1",
		},
		{
			name:        "Blocked against Neon production branch pattern in query",
			url:         "postgres://user:secret@localhost:5432/almeaa?branch=br-damp-feather-b9lqdru1",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "br-damp-feather-b9lqdru1",
		},
		{
			name:        "Blocked against Neon host even when test is in db name (Bypass test)",
			url:         "postgres://user:secret@ep-shiny-123.us-east-2.aws.neon.tech/test_db",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "prohibited for seeding",
		},
		{
			name:        "Blocked against Neon host even when test is in query string (Bypass test)",
			url:         "postgres://user:secret@ep-shiny-123.neon.tech/almeaa?test=1&allow=test",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "prohibited for seeding",
		},
		{
			name:        "Blocked against Neon preview branch (Preview blocked)",
			url:         "postgres://user:secret@ep-shiny-preview.neon.tech/almeaa",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "prohibited for seeding",
		},
		{
			name:        "Blocked against Render postgres host",
			url:         "postgres://user:secret@dpg-xxx.oregon-postgres.render.com/almeaa",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "prohibited for seeding",
		},
		{
			name:        "Blocked against AWS RDS host",
			url:         "postgres://user:secret@my-db.123456789.us-east-1.rds.amazonaws.com/almeaa",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "prohibited for seeding",
		},
		{
			name:        "Blocked against untrusted external IP",
			url:         "postgres://user:secret@192.168.1.50:5432/almeaa",
			allowSeed:   "true",
			wantErr:     true,
			errContains: "not an authorized local development host",
		},
		{
			name:        "Allowed for localhost with standard port and test db",
			url:         "postgres://user:secret@localhost:5432/almeaa_test",
			allowSeed:   "true",
			wantErr:     false,
		},
		{
			name:        "Allowed for 127.0.0.1",
			url:         "postgres://user:secret@127.0.0.1:5432/almeaa_dev",
			allowSeed:   "true",
			wantErr:     false,
		},
		{
			name:        "Allowed for Docker service 'postgres'",
			url:         "postgres://almeaa:almeaa@postgres:5432/almeaa",
			allowSeed:   "true",
			wantErr:     false,
		},
		{
			name:        "Allowed for Docker service 'db'",
			url:         "postgres://almeaa:almeaa@db:5432/almeaa",
			allowSeed:   "true",
			wantErr:     false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			safety, err := ValidateDatabaseURL(tt.url, tt.appEnv, tt.allowSeed)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("expected error for URL %q, got nil (safety=%+v)", tt.url, safety)
				}
				if tt.errContains != "" && !strings.Contains(err.Error(), tt.errContains) {
					t.Errorf("error %q does not contain expected substring %q", err.Error(), tt.errContains)
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error for URL %q: %v", tt.url, err)
				}
				if safety == nil {
					t.Fatal("expected non-nil SafetyVerification")
				}
				if strings.Contains(safety.SanitizedURL, "secret") {
					t.Errorf("sanitized URL leaked credentials: %s", safety.SanitizedURL)
				}
			}
		})
	}
}

// buildSeedBinary compiles the seed binary and returns its path.
func buildSeedBinary(t *testing.T) string {
	t.Helper()
	bin := filepath.Join(t.TempDir(), "seed_test_binary")
	if runtime.GOOS == "windows" {
		bin += ".exe"
	}

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
	cmd.Env = filterEnv(os.Environ(), "ALLOW_SEED", "DATABASE_URL", "APP_ENV")
	cmd.Env = append(cmd.Env, extraEnv...)
	out, err := cmd.CombinedOutput()
	return string(out), err
}

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

func TestSeedBlockedAgainstProductionNeonURL(t *testing.T) {
	bin := buildSeedBinary(t)

	productionURLs := []string{
		"postgres://user:pass@ep-xxx-yyy.us-east-2.aws.neon.tech/almeaadb",
		"postgres://user:pass@ep-abc.br-damp-feather-b9lqdru1.neon.tech/almeaadb",
		"postgresql://user:secret@somehost.neon.tech:5432/almeaadb?sslmode=require",
		"postgres://user:pass@ep-bypass.neon.tech/test_db?application_name=test", // Bypass attempt
	}

	for _, url := range productionURLs {
		url := url
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

func TestSeedBlockedWithNoDatabaseURL(t *testing.T) {
	bin := buildSeedBinary(t)
	_, err := runSeed(t, bin, "ALLOW_SEED=true")
	if err == nil {
		t.Fatal("expected exit non-zero with no DATABASE_URL")
	}
}

func TestSeedDoesNotLogPassword(t *testing.T) {
	bin := buildSeedBinary(t)
	output, _ := runSeed(t, bin,
		"ALLOW_SEED=true",
		"DATABASE_URL=postgres://user:secret123@localhost:5433/almeaa_no_such_db",
	)

	if strings.Contains(output, "secret123") {
		t.Errorf("SECURITY: plaintext password appeared in seed output:\n%s", output)
	}
}

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
