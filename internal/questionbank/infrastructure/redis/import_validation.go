package redisstore

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

type ImportValidationStore struct {
	client *redis.Client
}

func NewImportValidationStore(client *redis.Client) *ImportValidationStore {
	return &ImportValidationStore{client: client}
}

func (s *ImportValidationStore) Put(ctx context.Context, batchID, digest string, ttl time.Duration) error {
	return s.client.Set(ctx, s.key(batchID), digest, ttl).Err()
}

func (s *ImportValidationStore) Consume(ctx context.Context, batchID, digest string) (bool, error) {
	const script = `
		local current = redis.call("GET", KEYS[1])
		if current == ARGV[1] then
			redis.call("DEL", KEYS[1])
			return 1
		end
		return 0
	`
	value, err := s.client.Eval(ctx, script, []string{s.key(batchID)}, digest).Int()
	if err != nil {
		return false, err
	}
	return value == 1, nil
}

func (s *ImportValidationStore) key(batchID string) string {
	return "questionbank:import:validated:" + batchID
}
