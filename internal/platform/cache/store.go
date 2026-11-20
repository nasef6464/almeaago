package cache

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
)

// Store provides high-level JSON caching utilities backed by Redis.
type Store struct {
	client *redis.Client
}

// NewStore initializes a new cache Store wrapping the given Redis client.
func NewStore(client *redis.Client) *Store {
	return &Store{client: client}
}

// Client returns the underlying Redis client, or nil if Store is nil.
func (s *Store) Client() *redis.Client {
	if s == nil {
		return nil
	}
	return s.client
}

// GetJSON retrieves a key from Redis and unmarshals its JSON content into dst.
// It returns (true, nil) on a cache hit.
// If the key does not exist or s/client is nil, it returns (false, nil).
// If a Redis error occurs or unmarshaling fails, it returns (false, err).
func (s *Store) GetJSON(ctx context.Context, key string, dst any) (bool, error) {
	if s == nil || s.client == nil {
		return false, nil
	}
	data, err := s.client.Get(ctx, key).Bytes()
	if err != nil {
		if errors.Is(err, redis.Nil) {
			return false, nil
		}
		return false, err
	}
	if err := json.Unmarshal(data, dst); err != nil {
		return false, err
	}
	return true, nil
}

// SetJSON serializes val to JSON and stores it under key with the given TTL.
// If s or s.client is nil, it returns nil immediately.
func (s *Store) SetJSON(ctx context.Context, key string, val any, ttl time.Duration) error {
	if s == nil || s.client == nil {
		return nil
	}
	data, err := json.Marshal(val)
	if err != nil {
		return err
	}
	return s.client.Set(ctx, key, data, ttl).Err()
}

// Delete evicts keys from Redis using a short bounded context timeout (2s).
// If s or s.client is nil or no keys are provided, it returns nil immediately.
func (s *Store) Delete(ctx context.Context, keys ...string) error {
	if s == nil || s.client == nil || len(keys) == 0 {
		return nil
	}
	evictCtx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	return s.client.Del(evictCtx, keys...).Err()
}

// GetJSON is a package-level helper wrapping Store.GetJSON.
func GetJSON(ctx context.Context, client *redis.Client, key string, dst any) (bool, error) {
	return NewStore(client).GetJSON(ctx, key, dst)
}

// SetJSON is a package-level helper wrapping Store.SetJSON.
func SetJSON(ctx context.Context, client *redis.Client, key string, val any, ttl time.Duration) error {
	return NewStore(client).SetJSON(ctx, key, val, ttl)
}

// Delete is a package-level helper wrapping Store.Delete.
func Delete(ctx context.Context, client *redis.Client, keys ...string) error {
	return NewStore(client).Delete(ctx, keys...)
}
