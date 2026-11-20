package postgres

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/redis/go-redis/v9"

	"github.com/nasef6464/almeaago/internal/platform/cache"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
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

func TestTaxonomyBootstrapCacheConstants(t *testing.T) {
	if taxonomyBootstrapFullKey != "almeaa:cache:taxonomy:bootstrap:v1:full" {
		t.Errorf("unexpected full key: %s", taxonomyBootstrapFullKey)
	}
	if taxonomyBootstrapCoreKey != "almeaa:cache:taxonomy:bootstrap:v1:core" {
		t.Errorf("unexpected core key: %s", taxonomyBootstrapCoreKey)
	}
	if taxonomyCacheTTL != 15*time.Minute {
		t.Errorf("unexpected TTL: %v", taxonomyCacheTTL)
	}
}

func TestTaxonomyBootstrapNilRedisFallback(t *testing.T) {
	ctx := context.Background()

	// Repository with no Redis client
	repo := New(nil)
	if repo.redis != nil || repo.cache != nil {
		t.Fatal("expected nil redis and cache in repo")
	}

	// Should not panic on eviction
	repo.invalidateBootstrapCache(ctx)

	// Should return DB uninitialized error without panicking
	_, err := repo.PublicBootstrap(ctx, true)
	if err == nil || err.Error() != "postgres pool is not initialized" {
		t.Fatalf("expected postgres pool is not initialized error, got: %v", err)
	}

	_, err = repo.PublicBootstrap(ctx, false)
	if err == nil || err.Error() != "postgres pool is not initialized" {
		t.Fatalf("expected postgres pool is not initialized error, got: %v", err)
	}
}

func TestTaxonomyBootstrapUnreachableRedisFallback(t *testing.T) {
	ctx := context.Background()

	// Connect to closed/unreachable client
	opts, err := redis.ParseURL("redis://127.0.0.1:65530/0")
	if err != nil {
		t.Fatal(err)
	}
	opts.DialTimeout = 100 * time.Millisecond
	opts.ReadTimeout = 100 * time.Millisecond
	opts.WriteTimeout = 100 * time.Millisecond
	badClient := redis.NewClient(opts)
	defer badClient.Close()

	repo := New(nil, badClient)
	if repo.cache == nil {
		t.Fatal("expected non-nil cache")
	}

	// Eviction should not block or panic even if redis fails
	repo.invalidateBootstrapCache(ctx)

	// PublicBootstrap should fail at DB check rather than hanging on bad redis
	_, err = repo.PublicBootstrap(ctx, true)
	if err == nil || err.Error() != "postgres pool is not initialized" {
		t.Fatalf("expected postgres pool error, got: %v", err)
	}
}

func TestTaxonomyBootstrapCacheHitBypassesPostgres(t *testing.T) {
	client := getTestRedis(t)
	ctx := context.Background()

	store := cache.NewStore(client)

	// Pre-populate cache with mock data
	mockFull := taxonomy.Bootstrap{
		Paths: []taxonomy.Path{
			{
				ID:        "path-cached-full-1",
				Code:      "CACHED_FULL",
				Name:      "مسار تجريبي مخزن",
				SortOrder: 1,
				Status:    taxonomy.StatusActive,
			},
		},
		Levels: []taxonomy.Level{
			{
				ID:        "lvl-cached-1",
				PathID:    "path-cached-full-1",
				Code:      "LVL1",
				Name:      "مستوى تجريبي",
				SortOrder: 1,
				Status:    taxonomy.StatusActive,
			},
		},
		Subjects: []taxonomy.Subject{
			{
				ID:        "subj-cached-1",
				PathID:    "path-cached-full-1",
				LevelID:   "lvl-cached-1",
				Code:      "SUBJ1",
				Name:      "مادة تجريبية",
				SortOrder: 1,
				Status:    taxonomy.StatusActive,
			},
		},
		Skills: []taxonomy.Skill{
			{
				ID:        "skill-cached-1",
				SubjectID: "subj-cached-1",
				Code:      "SKILL1",
				Name:      "مهارة تجريبية",
				Kind:      "main",
				SortOrder: 1,
				Status:    taxonomy.StatusActive,
			},
		},
	}

	mockCore := taxonomy.Bootstrap{
		Paths: []taxonomy.Path{
			{
				ID:        "path-cached-core-1",
				Code:      "CACHED_CORE",
				Name:      "مسار نواة مخزن",
				SortOrder: 1,
				Status:    taxonomy.StatusActive,
			},
		},
		Levels:   []taxonomy.Level{},
		Subjects: []taxonomy.Subject{},
		Skills:   []taxonomy.Skill{},
	}

	// Set in Redis
	if err := store.SetJSON(ctx, taxonomyBootstrapFullKey, mockFull, taxonomyCacheTTL); err != nil {
		t.Fatalf("failed to set full cache: %v", err)
	}
	defer func() { _ = store.Delete(ctx, taxonomyBootstrapFullKey, taxonomyBootstrapCoreKey) }()

	if err := store.SetJSON(ctx, taxonomyBootstrapCoreKey, mockCore, taxonomyCacheTTL); err != nil {
		t.Fatalf("failed to set core cache: %v", err)
	}

	// Instantiate repository with NIL DB and active Redis
	repo := New(nil, client)

	// Call PublicBootstrap(ctx, true) -> MUST return cached mockFull without error
	gotFull, err := repo.PublicBootstrap(ctx, true)
	if err != nil {
		t.Fatalf("PublicBootstrap full failed: %v", err)
	}
	if len(gotFull.Paths) != 1 || gotFull.Paths[0].ID != "path-cached-full-1" {
		t.Fatalf("unexpected cached full paths: %+v", gotFull.Paths)
	}
	if len(gotFull.Skills) != 1 || gotFull.Skills[0].ID != "skill-cached-1" {
		t.Fatalf("unexpected cached full skills: %+v", gotFull.Skills)
	}

	// Call PublicBootstrap(ctx, false) -> MUST return cached mockCore without error
	gotCore, err := repo.PublicBootstrap(ctx, false)
	if err != nil {
		t.Fatalf("PublicBootstrap core failed: %v", err)
	}
	if len(gotCore.Paths) != 1 || gotCore.Paths[0].ID != "path-cached-core-1" {
		t.Fatalf("unexpected cached core paths: %+v", gotCore.Paths)
	}
	if len(gotCore.Skills) != 0 {
		t.Fatalf("expected 0 skills for core bootstrap, got: %d", len(gotCore.Skills))
	}
}

func TestTaxonomyBootstrapInvalidationEvictsKeys(t *testing.T) {
	client := getTestRedis(t)
	ctx := context.Background()

	store := cache.NewStore(client)

	// Pre-populate both keys
	_ = store.SetJSON(ctx, taxonomyBootstrapFullKey, "test-data-full", 1*time.Minute)
	_ = store.SetJSON(ctx, taxonomyBootstrapCoreKey, "test-data-core", 1*time.Minute)

	// Verify keys exist
	if exists := client.Exists(ctx, taxonomyBootstrapFullKey).Val(); exists != 1 {
		t.Fatalf("expected key %s to exist in Redis", taxonomyBootstrapFullKey)
	}
	if exists := client.Exists(ctx, taxonomyBootstrapCoreKey).Val(); exists != 1 {
		t.Fatalf("expected key %s to exist in Redis", taxonomyBootstrapCoreKey)
	}

	// Trigger invalidation
	repo := New(nil, client)
	repo.invalidateBootstrapCache(ctx)

	// Verify keys are now removed
	if exists := client.Exists(ctx, taxonomyBootstrapFullKey).Val(); exists != 0 {
		t.Fatalf("expected key %s to be evicted, but still exists", taxonomyBootstrapFullKey)
	}
	if exists := client.Exists(ctx, taxonomyBootstrapCoreKey).Val(); exists != 0 {
		t.Fatalf("expected key %s to be evicted, but still exists", taxonomyBootstrapCoreKey)
	}
}
