package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository {
	return &Repository{db: db, audit: audit}
}

type scanner interface {
	Scan(...any) error
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return ai.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23514", "23503", "22P02":
			return ai.ErrConflict
		}
	}
	return err
}

func scanSetting(row scanner) (ai.ProviderSetting, error) {
	var out ai.ProviderSetting
	var healthProvider *ai.Provider
	var failures *int
	var lastError *string
	var healthUpdatedAt *time.Time
	err := row.Scan(
		&out.Provider,
		&out.Enabled,
		&out.Model,
		&out.BaseURL,
		&out.Priority,
		&out.MaxOutputTokens,
		&out.Revision,
		&out.CreatedAt,
		&out.UpdatedAt,
		&healthProvider,
		&failures,
		&out.Health.OpenUntil,
		&lastError,
		&out.Health.LastSuccessAt,
		&out.Health.LastFailureAt,
		&healthUpdatedAt,
	)
	if err != nil {
		return ai.ProviderSetting{}, err
	}
	out.Health.Provider = out.Provider
	if healthProvider != nil {
		out.Health.Provider = *healthProvider
	}
	if failures != nil {
		out.Health.ConsecutiveFailures = *failures
	}
	if lastError != nil {
		out.Health.LastError = *lastError
	}
	if healthUpdatedAt != nil {
		out.Health.UpdatedAt = *healthUpdatedAt
	}
	return out, nil
}

const settingsSelect = `
	SELECT
		s.provider,s.enabled,s.model,s.base_url,s.priority,s.max_output_tokens,s.revision,
		s.created_at,s.updated_at,
		h.provider,h.consecutive_failures,h.open_until,h.last_error,
		h.last_success_at,h.last_failure_at,h.updated_at
	FROM ai_provider_settings s
	LEFT JOIN ai_provider_health h ON h.provider=s.provider
`

func (r *Repository) ListProviderSettings(ctx context.Context) ([]ai.ProviderSetting, error) {
	rows, err := r.db.Query(ctx, settingsSelect+` ORDER BY s.priority,s.provider`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ai.ProviderSetting{}
	for rows.Next() {
		item, scanErr := scanSetting(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) ProviderSetting(ctx context.Context, provider ai.Provider) (ai.ProviderSetting, error) {
	out, err := scanSetting(r.db.QueryRow(ctx, settingsSelect+` WHERE s.provider=$1`, provider))
	return out, mapError(err)
}

func (r *Repository) UpdateProviderSetting(
	ctx context.Context,
	actorID string,
	provider ai.Provider,
	write ai.ProviderSettingWrite,
) (ai.ProviderSetting, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ai.ProviderSetting{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var currentRevision int
	if err = tx.QueryRow(ctx, `
		SELECT revision
		FROM ai_provider_settings
		WHERE provider=$1
		FOR UPDATE
	`, provider).Scan(&currentRevision); err != nil {
		return ai.ProviderSetting{}, mapError(err)
	}
	if currentRevision != write.ExpectedRevision {
		return ai.ProviderSetting{}, ai.ErrConflict
	}
	if _, err = tx.Exec(ctx, `
		UPDATE ai_provider_settings
		SET enabled=$2,model=$3,base_url=$4,priority=$5,max_output_tokens=$6,
		    revision=revision+1,updated_by=$7::uuid,updated_at=now()
		WHERE provider=$1
	`,
		provider,
		write.Enabled,
		write.Model,
		write.BaseURL,
		write.Priority,
		write.MaxOutputTokens,
		actorID,
	); err != nil {
		return ai.ProviderSetting{}, mapError(err)
	}
	if r.audit == nil {
		return ai.ProviderSetting{}, errors.New("ai audit writer is not configured")
	}
	if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID: actorID,
		Action:      "ai.provider.update",
		ResourceType:"ai_provider",
		ResourceID:  string(provider),
		Metadata: map[string]any{
			"enabled": write.Enabled,
			"model": write.Model,
			"baseUrl": write.BaseURL,
			"priority": write.Priority,
			"maxOutputTokens": write.MaxOutputTokens,
			"revision": currentRevision + 1,
		},
	}); err != nil {
		return ai.ProviderSetting{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ai.ProviderSetting{}, err
	}
	return r.ProviderSetting(ctx, provider)
}

func (r *Repository) RecordProviderSuccess(
	ctx context.Context,
	provider ai.Provider,
	now time.Time,
) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_provider_health(
			provider,consecutive_failures,open_until,last_error,last_success_at,updated_at
		) VALUES($1,0,NULL,'',$2,$2)
		ON CONFLICT(provider) DO UPDATE SET
			consecutive_failures=0,
			open_until=NULL,
			last_error='',
			last_success_at=EXCLUDED.last_success_at,
			updated_at=EXCLUDED.updated_at
	`, provider, now)
	return err
}

func (r *Repository) RecordProviderFailure(
	ctx context.Context,
	provider ai.Provider,
	errorCategory string,
	openUntil *time.Time,
	now time.Time,
) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_provider_health(
			provider,consecutive_failures,open_until,last_error,last_failure_at,updated_at
		) VALUES($1,1,$2,$3,$4,$4)
		ON CONFLICT(provider) DO UPDATE SET
			consecutive_failures=ai_provider_health.consecutive_failures+1,
			open_until=$2,
			last_error=$3,
			last_failure_at=$4,
			updated_at=$4
	`, provider, openUntil, errorCategory, now)
	return err
}

func (r *Repository) CacheEntry(
	ctx context.Context,
	cacheKey string,
	now time.Time,
) (ai.CacheEntry, error) {
	var out ai.CacheEntry
	err := r.db.QueryRow(ctx, `
		SELECT
			cache_key,user_id::text,review_card_id::text,question_id::text,question_version,
			help_level,prompt_version,response_text,provider,model,expires_at,created_at,updated_at
		FROM ai_question_assist_cache
		WHERE cache_key=$1 AND expires_at>$2
	`, cacheKey, now).Scan(
		&out.CacheKey,
		&out.UserID,
		&out.ReviewCardID,
		&out.QuestionID,
		&out.QuestionVersion,
		&out.HelpLevel,
		&out.PromptVersion,
		&out.ResponseText,
		&out.Provider,
		&out.Model,
		&out.ExpiresAt,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	return out, mapError(err)
}

func (r *Repository) PutCacheEntry(ctx context.Context, entry ai.CacheEntry) error {
	_, err := r.db.Exec(ctx, `
		INSERT INTO ai_question_assist_cache(
			cache_key,user_id,review_card_id,question_id,question_version,help_level,
			prompt_version,response_text,provider,model,expires_at
		) VALUES(
			$1,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9,$10,$11
		)
		ON CONFLICT(cache_key) DO UPDATE SET
			response_text=EXCLUDED.response_text,
			provider=EXCLUDED.provider,
			model=EXCLUDED.model,
			expires_at=EXCLUDED.expires_at,
			updated_at=now()
	`,
		entry.CacheKey,
		entry.UserID,
		entry.ReviewCardID,
		entry.QuestionID,
		entry.QuestionVersion,
		entry.HelpLevel,
		entry.PromptVersion,
		entry.ResponseText,
		entry.Provider,
		entry.Model,
		entry.ExpiresAt,
	)
	return mapError(err)
}

func (r *Repository) InsertInteraction(ctx context.Context, item ai.Interaction) error {
	metadata, err := json.Marshal(item.Metadata)
	if err != nil {
		return err
	}
	_, err = r.db.Exec(ctx, `
		INSERT INTO ai_interactions(
			user_id,audience,endpoint,capability,provider,model,status,used_fallback,cache_hit,
			question_id,question_version,review_card_id,prompt_version,latency_ms,
			input_tokens,output_tokens,total_tokens,usage_estimated,response_length,
			error_category,metadata,retention_until
		) VALUES(
			NULLIF($1,'')::uuid,$2,$3,$4,$5,$6,$7,$8,$9,
			NULLIF($10,'')::uuid,$11,NULLIF($12,'')::uuid,$13,$14,
			$15,$16,$17,$18,$19,$20,$21::jsonb,$22
		)
	`,
		item.UserID,
		item.Audience,
		item.Endpoint,
		item.Capability,
		item.Provider,
		item.Model,
		item.Status,
		item.UsedFallback,
		item.CacheHit,
		item.QuestionID,
		nullableVersion(item.QuestionID, item.QuestionVersion),
		item.ReviewCardID,
		item.PromptVersion,
		item.LatencyMS,
		item.InputTokens,
		item.OutputTokens,
		item.TotalTokens,
		item.UsageEstimated,
		item.ResponseLength,
		item.ErrorCategory,
		metadata,
		item.RetentionUntil,
	)
	return mapError(err)
}

func nullableVersion(questionID string, version int) any {
	if questionID == "" {
		return nil
	}
	return version
}

func scanInteraction(row scanner) (ai.Interaction, error) {
	var out ai.Interaction
	var metadata []byte
	err := row.Scan(
		&out.ID,
		&out.UserID,
		&out.Audience,
		&out.Endpoint,
		&out.Capability,
		&out.Provider,
		&out.Model,
		&out.Status,
		&out.UsedFallback,
		&out.CacheHit,
		&out.QuestionID,
		&out.QuestionVersion,
		&out.ReviewCardID,
		&out.PromptVersion,
		&out.LatencyMS,
		&out.InputTokens,
		&out.OutputTokens,
		&out.TotalTokens,
		&out.UsageEstimated,
		&out.ResponseLength,
		&out.ErrorCategory,
		&metadata,
		&out.RetentionUntil,
		&out.CreatedAt,
	)
	if err != nil {
		return ai.Interaction{}, err
	}
	out.Metadata = map[string]any{}
	if len(metadata) > 0 {
		if err = json.Unmarshal(metadata, &out.Metadata); err != nil {
			return ai.Interaction{}, err
		}
	}
	return out, nil
}

func (r *Repository) ListInteractions(
	ctx context.Context,
	page, limit int,
) (ai.InteractionPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id::text,COALESCE(user_id::text,''),audience,endpoint,capability,provider,model,status,
			used_fallback,cache_hit,COALESCE(question_id::text,''),COALESCE(question_version,0),
			COALESCE(review_card_id::text,''),prompt_version,latency_ms,input_tokens,output_tokens,
			total_tokens,usage_estimated,response_length,error_category,metadata,retention_until,created_at
		FROM ai_interactions
		ORDER BY created_at DESC,id DESC
		LIMIT $1 OFFSET $2
	`, limit+1, (page-1)*limit)
	if err != nil {
		return ai.InteractionPage{}, err
	}
	defer rows.Close()

	out := ai.InteractionPage{Items: []ai.Interaction{}, Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanInteraction(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}


func (r *Repository) CountQuestionAssistSince(
	ctx context.Context,
	userID string,
	since time.Time,
) (int, error) {
	var count int
	err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM ai_interactions
		WHERE user_id=$1::uuid
		  AND capability='question_tutor'
		  AND cache_hit=false
		  AND created_at >= $2
	`, userID, since).Scan(&count)
	return count, err
}
