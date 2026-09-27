package postgres

import (
	"context"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type ReadRepository struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewReadRepository(db *pgxpool.Pool, redisClient *redis.Client) *ReadRepository {
	return &ReadRepository{db: db, redis: redisClient}
}

func (r *ReadRepository) DependencyHealth(ctx context.Context) operations.DependencyHealth {
	health := operations.DependencyHealth{}
	dbCtx, dbCancel := context.WithTimeout(ctx, 1500*time.Millisecond)
	defer dbCancel()
	health.Postgres = r.db != nil && r.db.Ping(dbCtx) == nil

	if r.redis != nil {
		redisCtx, redisCancel := context.WithTimeout(ctx, 1500*time.Millisecond)
		defer redisCancel()
		health.Redis = r.redis.Ping(redisCtx).Err() == nil
	}
	return health
}

func (r *ReadRepository) ReadinessCounts(
	ctx context.Context,
) (operations.OperationalCounts, error) {
	var out operations.OperationalCounts
	err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*)::int FROM notification_deliveries WHERE status='pending'),
			(SELECT count(*)::int FROM notification_deliveries WHERE status='retrying'),
			(SELECT count(*)::int FROM notification_deliveries WHERE status='failed'),
			(SELECT count(*)::int FROM audit_logs WHERE status='blocked' AND created_at>=now()-interval '24 hours'),
			(SELECT count(*)::int FROM audit_logs WHERE status='failed' AND created_at>=now()-interval '24 hours'),
			(SELECT count(*)::int FROM classroom_sessions WHERE status='live'),
			(SELECT count(*)::int FROM ai_provider_settings WHERE enabled=true)
	`).Scan(
		&out.NotificationPending,
		&out.NotificationRetrying,
		&out.NotificationFailed,
		&out.AuditBlocked24h,
		&out.AuditFailed24h,
		&out.LiveClassrooms,
		&out.EnabledAIProviders,
	)
	return out, err
}

func (r *ReadRepository) ListAudit(
	ctx context.Context,
	query operations.AuditQuery,
) (operations.AuditPage, error) {
	clauses := []string{"1=1"}
	args := []any{}
	add := func(value any) string {
		args = append(args, value)
		return "$" + strconv.Itoa(len(args))
	}
	if query.Action != "" {
		clauses = append(clauses, "al.action="+add(query.Action))
	}
	if query.Status != "" {
		clauses = append(clauses, "al.status="+add(query.Status))
	}
	if query.ResourceType != "" {
		clauses = append(clauses, "al.resource_type="+add(query.ResourceType))
	}
	if query.ActorUserID != "" {
		clauses = append(clauses, "COALESCE(al.actor_user_id::text,'')="+add(query.ActorUserID))
	}
	where := " WHERE " + strings.Join(clauses, " AND ")

	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*)::int FROM audit_logs al"+where, args...).Scan(&total); err != nil {
		return operations.AuditPage{}, err
	}
	var blocked24h, failed24h int
	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*) FILTER(WHERE status='blocked' AND created_at>=now()-interval '24 hours')::int,
			count(*) FILTER(WHERE status='failed' AND created_at>=now()-interval '24 hours')::int
		FROM audit_logs
	`).Scan(&blocked24h, &failed24h); err != nil {
		return operations.AuditPage{}, err
	}

	limitParam := add(query.Limit)
	offsetParam := add((query.Page - 1) * query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT
			al.id::text,
			COALESCE(al.actor_user_id::text,''),
			COALESCE(u.name,''),
			al.action,
			al.resource_type,
			COALESCE(al.resource_id,''),
			al.status,
			al.metadata,
			al.created_at
		FROM audit_logs al
		LEFT JOIN users u ON u.id=al.actor_user_id
	`+where+`
		ORDER BY al.created_at DESC,al.id DESC
		LIMIT `+limitParam+` OFFSET `+offsetParam, args...)
	if err != nil {
		return operations.AuditPage{}, err
	}
	defer rows.Close()

	out := operations.AuditPage{
		Items: []operations.AuditRecord{}, Page: query.Page, Limit: query.Limit, Total: total,
		BlockedCount24h: blocked24h, FailedCount24h: failed24h,
	}
	for rows.Next() {
		var item operations.AuditRecord
		var metadataRaw []byte
		if err = rows.Scan(
			&item.ID,&item.ActorUserID,&item.ActorName,&item.Action,&item.ResourceType,
			&item.ResourceID,&item.Status,&metadataRaw,&item.CreatedAt,
		); err != nil {
			return out, err
		}
		item.Metadata = map[string]any{}
		if len(metadataRaw) > 0 {
			if err = json.Unmarshal(metadataRaw,&item.Metadata); err != nil {
				return out,err
			}
		}
		out.Items=append(out.Items,item)
	}
	if err=rows.Err();err!=nil{return out,err}
	out.HasMore=(query.Page-1)*query.Limit+len(out.Items)<total
	return out,nil
}
