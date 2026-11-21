package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	"github.com/nasef6464/almeaago/internal/platform/cache"
)

type AuditWriter interface {
	WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
	redis *redis.Client
	cache *cache.Store
}

func New(db *pgxpool.Pool, audit AuditWriter, redisClient ...*redis.Client) *Repository {
	r := &Repository{db: db, audit: audit}
	if len(redisClient) > 0 && redisClient[0] != nil {
		r.redis = redisClient[0]
		r.cache = cache.NewStore(redisClient[0])
	}
	return r
}
