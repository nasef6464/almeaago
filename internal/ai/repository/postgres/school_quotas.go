package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) ResetCircuitBreakers(ctx context.Context, actorID string) ([]ai.ProviderSetting, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if _, err = tx.Exec(ctx, `
		INSERT INTO ai_provider_health (provider, consecutive_failures, open_until, last_error, updated_at)
		SELECT provider, 0, NULL, '', now()
		FROM ai_provider_settings
		ON CONFLICT (provider) DO UPDATE SET
			consecutive_failures = 0,
			open_until = NULL,
			last_error = '',
			updated_at = now()
	`); err != nil {
		return nil, err
	}

	if r.audit == nil {
		return nil, errors.New("ai audit writer is not configured")
	}
	if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "ai.circuit_breaker.reset",
		ResourceType: "ai_provider",
		ResourceID:   "all",
		Metadata:     map[string]any{"scope": "all"},
	}); err != nil {
		return nil, err
	}

	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return r.ListProviderSettings(ctx)
}

func (r *Repository) ListSchoolQuotas(ctx context.Context) ([]ai.SchoolQuota, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			s.id::text,
			s.name,
			COALESCE(q.tier, 'basic'),
			COALESCE(q.token_limit, 75000),
			COALESCE(q.tokens_used, 0),
			COALESCE(q.pdf_exam_limit, 30),
			COALESCE(q.pdf_exams_used, 0),
			COALESCE(q.voice_minutes_limit, 40),
			COALESCE(q.voice_minutes_used, 0),
			COALESCE(q.whiteboard_enabled, false),
			q.last_reset_at,
			COALESCE(q.updated_at, s.updated_at)
		FROM schools s
		LEFT JOIN ai_school_quotas q ON q.school_id = s.id
		WHERE s.status <> 'archived'
		ORDER BY s.created_at DESC, s.id DESC
		LIMIT 100
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ai.SchoolQuota{}
	for rows.Next() {
		var item ai.SchoolQuota
		if scanErr := rows.Scan(
			&item.ID,
			&item.Name,
			&item.Tier,
			&item.TokenLimit,
			&item.TokensUsed,
			&item.PDFExamLimit,
			&item.PDFExamsUsed,
			&item.VoiceMinutesLimit,
			&item.VoiceMinutesUsed,
			&item.WhiteboardEnabled,
			&item.LastResetAt,
			&item.UpdatedAt,
		); scanErr != nil {
			return nil, scanErr
		}
		item.UpdatedAt = item.UpdatedAt.UTC()
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) getSchoolQuotaTx(ctx context.Context, tx pgx.Tx, schoolID string) (ai.SchoolQuota, error) {
	var item ai.SchoolQuota
	err := tx.QueryRow(ctx, `
		SELECT
			s.id::text,
			s.name,
			COALESCE(q.tier, 'basic'),
			COALESCE(q.token_limit, 75000),
			COALESCE(q.tokens_used, 0),
			COALESCE(q.pdf_exam_limit, 30),
			COALESCE(q.pdf_exams_used, 0),
			COALESCE(q.voice_minutes_limit, 40),
			COALESCE(q.voice_minutes_used, 0),
			COALESCE(q.whiteboard_enabled, false),
			q.last_reset_at,
			COALESCE(q.updated_at, s.updated_at)
		FROM schools s
		LEFT JOIN ai_school_quotas q ON q.school_id = s.id
		WHERE s.id = $1::uuid AND s.status <> 'archived'
	`, schoolID).Scan(
		&item.ID,
		&item.Name,
		&item.Tier,
		&item.TokenLimit,
		&item.TokensUsed,
		&item.PDFExamLimit,
		&item.PDFExamsUsed,
		&item.VoiceMinutesLimit,
		&item.VoiceMinutesUsed,
		&item.WhiteboardEnabled,
		&item.LastResetAt,
		&item.UpdatedAt,
	)
	if err != nil {
		return ai.SchoolQuota{}, mapError(err)
	}
	item.UpdatedAt = item.UpdatedAt.UTC()
	return item, nil
}

func (r *Repository) ResetSchoolQuota(ctx context.Context, actorID, schoolID string) (ai.SchoolQuota, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ai.SchoolQuota{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists bool
	if err = tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM schools WHERE id = $1::uuid AND status <> 'archived')
	`, schoolID).Scan(&exists); err != nil {
		return ai.SchoolQuota{}, mapError(err)
	}
	if !exists {
		return ai.SchoolQuota{}, ai.ErrNotFound
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO ai_school_quotas (
			school_id, tokens_used, pdf_exams_used, voice_minutes_used, last_reset_at, updated_by, updated_at
		) VALUES ($1::uuid, 0, 0, 0, now(), NULLIF($2, '')::uuid, now())
		ON CONFLICT (school_id) DO UPDATE SET
			tokens_used = 0,
			pdf_exams_used = 0,
			voice_minutes_used = 0,
			last_reset_at = now(),
			updated_by = NULLIF($2, '')::uuid,
			updated_at = now()
	`, schoolID, actorID); err != nil {
		return ai.SchoolQuota{}, mapError(err)
	}

	if r.audit == nil {
		return ai.SchoolQuota{}, errors.New("ai audit writer is not configured")
	}
	if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "ai.school_quota.reset",
		ResourceType: "ai_school_quota",
		ResourceID:   schoolID,
		Metadata:     map[string]any{"schoolId": schoolID},
	}); err != nil {
		return ai.SchoolQuota{}, err
	}

	item, err := r.getSchoolQuotaTx(ctx, tx, schoolID)
	if err != nil {
		return ai.SchoolQuota{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ai.SchoolQuota{}, err
	}
	return item, nil
}

func (r *Repository) UpdateSchoolQuota(ctx context.Context, actorID, schoolID string, write ai.SchoolQuotaWrite) (ai.SchoolQuota, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return ai.SchoolQuota{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var exists bool
	if err = tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM schools WHERE id = $1::uuid AND status <> 'archived')
	`, schoolID).Scan(&exists); err != nil {
		return ai.SchoolQuota{}, mapError(err)
	}
	if !exists {
		return ai.SchoolQuota{}, ai.ErrNotFound
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO ai_school_quotas (
			school_id, tier, token_limit, pdf_exam_limit, voice_minutes_limit, whiteboard_enabled, updated_by, updated_at
		) VALUES ($1::uuid, $2, $3, $4, $5, $6, NULLIF($7, '')::uuid, now())
		ON CONFLICT (school_id) DO UPDATE SET
			tier = EXCLUDED.tier,
			token_limit = EXCLUDED.token_limit,
			pdf_exam_limit = EXCLUDED.pdf_exam_limit,
			voice_minutes_limit = EXCLUDED.voice_minutes_limit,
			whiteboard_enabled = EXCLUDED.whiteboard_enabled,
			updated_by = EXCLUDED.updated_by,
			updated_at = now()
	`, schoolID, write.Tier, write.TokenLimit, write.PDFExamLimit, write.VoiceMinutesLimit, write.WhiteboardEnabled, actorID); err != nil {
		return ai.SchoolQuota{}, mapError(err)
	}

	if r.audit == nil {
		return ai.SchoolQuota{}, errors.New("ai audit writer is not configured")
	}
	if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "ai.school_quota.update",
		ResourceType: "ai_school_quota",
		ResourceID:   schoolID,
		Metadata: map[string]any{
			"tier":              write.Tier,
			"tokenLimit":        write.TokenLimit,
			"pdfExamLimit":      write.PDFExamLimit,
			"voiceMinutesLimit": write.VoiceMinutesLimit,
			"whiteboardEnabled": write.WhiteboardEnabled,
		},
	}); err != nil {
		return ai.SchoolQuota{}, err
	}

	item, err := r.getSchoolQuotaTx(ctx, tx, schoolID)
	if err != nil {
		return ai.SchoolQuota{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return ai.SchoolQuota{}, err
	}
	return item, nil
}
