package config

import "testing"

func baseEnv(t *testing.T) {
	t.Helper()
	t.Setenv("DATABASE_URL", "postgres://test")
	t.Setenv("REDIS_URL", "redis://test")
	t.Setenv("CLASSROOM_PIN_SECRET", "test-secret")
	t.Setenv("OLLAMA_BASE_URL", "")
	t.Setenv("LMSTUDIO_BASE_URL", "")
}

func TestLoadDoesNotInferLocalAIProviderFromDefaults(t *testing.T) {
	baseEnv(t)
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.OllamaBaseURL != "" || cfg.LMStudioBaseURL != "" {
		t.Fatalf("local AI runtimes must require explicit endpoints: ollama=%q lmstudio=%q", cfg.OllamaBaseURL, cfg.LMStudioBaseURL)
	}
	if cfg.AIGlobalDailyLimit != 800 || cfg.AIUserDailyLimit != 80 {
		t.Fatalf("unexpected AI budget defaults global=%d user=%d", cfg.AIGlobalDailyLimit, cfg.AIUserDailyLimit)
	}
}

func TestLoadValidatesAIDailyBudgets(t *testing.T) {
	baseEnv(t)
	t.Setenv("AI_DAILY_LIMIT", "1200")
	t.Setenv("AI_PER_USER_DAILY_LIMIT", "120")
	cfg, err := Load()
	if err != nil {
		t.Fatal(err)
	}
	if cfg.AIGlobalDailyLimit != 1200 || cfg.AIUserDailyLimit != 120 {
		t.Fatalf("unexpected parsed limits %#v", cfg)
	}

	t.Setenv("AI_PER_USER_DAILY_LIMIT", "0")
	if _, err = Load(); err == nil {
		t.Fatal("expected invalid per-user budget to fail closed")
	}
}
