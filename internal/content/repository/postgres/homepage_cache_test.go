package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	"github.com/nasef6464/almeaago/internal/platform/cache"
)

func getTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	url := os.Getenv("REDIS_URL")
	if url == "" {
		url = "redis://localhost:6379/0"
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	client, err := cache.Open(ctx, url)
	if err != nil {
		t.Skipf("skipping Redis live test: %v", err)
	}
	return client
}

func TestHomepageSettingsCacheConstants(t *testing.T) {
	if homepageSettingsCacheKey != "almeaa:cache:content:homepage-settings:v1" {
		t.Errorf("unexpected cache key: %s", homepageSettingsCacheKey)
	}
	if homepageCacheTTL != 15*time.Minute {
		t.Errorf("unexpected TTL: %v", homepageCacheTTL)
	}
}

func TestHomepageSettingsNilRedisFallback(t *testing.T) {
	ctx := context.Background()

	repo := New(nil, nil)
	if repo.redis != nil || repo.cache != nil {
		t.Fatal("expected nil redis and cache in repo")
	}

	_, err := repo.GetHomepageSettings(ctx)
	if err == nil || err.Error() != "postgres pool is not initialized" {
		t.Fatalf("expected postgres pool is not initialized error, got: %v", err)
	}
}

func TestHomepageSettingsUnreachableRedisFallback(t *testing.T) {
	ctx := context.Background()

	opts, err := redis.ParseURL("redis://127.0.0.1:65530/0")
	if err != nil {
		t.Fatal(err)
	}
	opts.DialTimeout = 100 * time.Millisecond
	opts.ReadTimeout = 100 * time.Millisecond
	opts.WriteTimeout = 100 * time.Millisecond
	badClient := redis.NewClient(opts)
	defer badClient.Close()

	repo := New(nil, nil, badClient)
	if repo.cache == nil {
		t.Fatal("expected non-nil cache")
	}

	_, err = repo.GetHomepageSettings(ctx)
	if err == nil || err.Error() != "postgres pool is not initialized" {
		t.Fatalf("expected postgres pool error, got: %v", err)
	}
}

func TestHomepageSettingsCacheHitBypassesPostgres(t *testing.T) {
	client := getTestRedis(t)
	ctx := context.Background()

	store := cache.NewStore(client)

	mockSettings := content.HomepageSettings{
		"key":                      "default",
		"heroTitle":                "منصة علمعاء التعليمية",
		"heroSubtitle":             "المحتوى المعتمد والمخزن مؤقتاً",
		"featuredPathIds":          []any{"path-1", "path-2"},
		"featuredCourseIds":        []any{"course-101"},
		"featuredArticleLessonIds": []any{},
		"updatedAt":                "2026-11-20T20:00:00Z",
	}

	if err := store.SetJSON(ctx, homepageSettingsCacheKey, mockSettings, homepageCacheTTL); err != nil {
		t.Fatalf("failed to set homepage cache: %v", err)
	}
	defer func() { _ = store.Delete(ctx, homepageSettingsCacheKey) }()

	// Create repository with NIL DB and active Redis
	repo := New(nil, nil, client)

	// GetHomepageSettings should hit Redis and not call DB
	got, err := repo.GetHomepageSettings(ctx)
	if err != nil {
		t.Fatalf("unexpected error on cache hit: %v", err)
	}
	if got == nil {
		t.Fatal("expected cached settings, got nil")
	}
	if got["heroTitle"] != "منصة علمعاء التعليمية" {
		t.Fatalf("unexpected heroTitle: %v", got["heroTitle"])
	}
	if got["updatedAt"] != "2026-11-20T20:00:00Z" {
		t.Fatalf("unexpected updatedAt: %v", got["updatedAt"])
	}
}

func TestHomepageSettingsCacheInvalidation(t *testing.T) {
	client := getTestRedis(t)
	ctx := context.Background()

	store := cache.NewStore(client)

	// Pre-populate key
	_ = store.SetJSON(ctx, homepageSettingsCacheKey, map[string]string{"key": "default"}, 1*time.Minute)

	if exists := client.Exists(ctx, homepageSettingsCacheKey).Val(); exists != 1 {
		t.Fatalf("expected key %s to exist in Redis", homepageSettingsCacheKey)
	}

	repo := New(nil, nil, client)
	if err := repo.cache.Delete(ctx, homepageSettingsCacheKey); err != nil {
		t.Fatalf("failed to delete key: %v", err)
	}

	if exists := client.Exists(ctx, homepageSettingsCacheKey).Val(); exists != 0 {
		t.Fatalf("expected key %s to be evicted, but still exists", homepageSettingsCacheKey)
	}
}
