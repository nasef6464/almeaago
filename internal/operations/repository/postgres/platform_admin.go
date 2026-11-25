package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *ReadRepository) GetIntegrationSettings(ctx context.Context) (operations.PlatformIntegrationState, error) {
	defaults := operations.DefaultPlatformIntegrationSettings()
	var raw []byte
	var revision int
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		SELECT settings, revision, updated_at
		FROM platform_integration_settings
		WHERE key = 'default'
	`).Scan(&raw, &revision, &updatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return operations.PlatformIntegrationState{
			Settings:  defaults,
			Revision:  1,
			UpdatedAt: time.Now().UTC(),
		}, nil
	}
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	settings := mergeIntegrationSettings(defaults, raw)

	// Authoritative sync check with content_platform_contact_settings
	var contactRaw []byte
	if cErr := r.db.QueryRow(ctx, `SELECT settings FROM content_platform_contact_settings WHERE key = 'default'`).Scan(&contactRaw); cErr == nil && len(contactRaw) > 0 {
		var cw operations.PlatformContactWidgetSettings
		if json.Unmarshal(contactRaw, &cw) == nil {
			settings.ContactWidget = cw
		}
	}

	return operations.PlatformIntegrationState{
		Settings:  settings,
		Revision:  revision,
		UpdatedAt: updatedAt.UTC(),
	}, nil
}

func mergeIntegrationSettings(base operations.PlatformIntegrationSettings, raw []byte) operations.PlatformIntegrationSettings {
	out := base
	var parsed operations.PlatformIntegrationSettings
	if err := json.Unmarshal(raw, &parsed); err != nil {
		return out
	}
	// Copy providers map cleanly preserving defaults for missing keys
	mergedProviders := make(map[string]operations.PlatformProviderSetting, len(base.Providers))
	for k, v := range base.Providers {
		mergedProviders[k] = v
	}
	for k, v := range parsed.Providers {
		if _, known := mergedProviders[k]; known {
			mergedProviders[k] = v
		}
	}
	parsed.Providers = mergedProviders
	if parsed.Auth.DefaultRole == "" {
		parsed.Auth.DefaultRole = base.Auth.DefaultRole
	}
	if parsed.Auth.MaxAccountsPerDevice < 1 {
		parsed.Auth.MaxAccountsPerDevice = base.Auth.MaxAccountsPerDevice
	}
	if parsed.ContactWidget.Channel == "" {
		parsed.ContactWidget.Channel = base.ContactWidget.Channel
	}
	return parsed
}

func (r *ReadRepository) UpdateIntegrationSettings(
	ctx context.Context,
	actorID string,
	next operations.PlatformIntegrationSettings,
	expectedRevision int,
) (operations.PlatformIntegrationState, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	defaultsJSON, err := json.Marshal(operations.DefaultPlatformIntegrationSettings())
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO platform_integration_settings (key, settings, revision)
		VALUES ('default', $1::jsonb, 1)
		ON CONFLICT (key) DO NOTHING
	`, string(defaultsJSON)); err != nil {
		return operations.PlatformIntegrationState{}, err
	}

	var currentRevision int
	if err = tx.QueryRow(ctx, `
		SELECT revision
		FROM platform_integration_settings
		WHERE key = 'default'
		FOR UPDATE
	`).Scan(&currentRevision); err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	if expectedRevision > 0 && currentRevision != expectedRevision {
		return operations.PlatformIntegrationState{}, operations.ErrConflict
	}

	settingsJSON, err := json.Marshal(next)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	var updatedAt time.Time
	var savedRevision int
	if err = tx.QueryRow(ctx, `
		UPDATE platform_integration_settings
		SET settings = $1::jsonb,
		    revision = revision + 1,
		    updated_by = NULLIF($2, '')::uuid,
		    updated_at = now()
		WHERE key = 'default'
		RETURNING revision, updated_at
	`, string(settingsJSON), actorID).Scan(&savedRevision, &updatedAt); err != nil {
		return operations.PlatformIntegrationState{}, err
	}

	contactJSON, err := json.Marshal(next.ContactWidget)
	if err != nil {
		return operations.PlatformIntegrationState{}, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO content_platform_contact_settings (key, settings, updated_at)
		VALUES ('default', $1::jsonb, now())
		ON CONFLICT (key) DO UPDATE
		SET settings = EXCLUDED.settings,
		    updated_at = now()
	`, string(contactJSON)); err != nil {
		return operations.PlatformIntegrationState{}, err
	}

	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorID,
			Action:       "operations.integrations.update",
			ResourceType: "platform_integrations",
			ResourceID:   "default",
			Status:       "success",
			Metadata: map[string]any{
				"revision": savedRevision,
			},
		}); err != nil {
			return operations.PlatformIntegrationState{}, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return operations.PlatformIntegrationState{}, err
	}

	return operations.PlatformIntegrationState{
		Settings:  next,
		Revision:  savedRevision,
		UpdatedAt: updatedAt.UTC(),
	}, nil
}

func (r *ReadRepository) ListBackupExports(ctx context.Context, limit int) ([]operations.BackupExportRecord, error) {
	if limit < 1 || limit > 100 {
		limit = 50
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			id::text,
			title,
			scope,
			schema_version,
			summary,
			total_records,
			COALESCE(created_by::text, ''),
			created_by_email,
			created_at
		FROM operations_backup_exports
		ORDER BY created_at DESC, id DESC
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := []operations.BackupExportRecord{}
	for rows.Next() {
		var rec operations.BackupExportRecord
		var summaryRaw []byte
		if scanErr := rows.Scan(
			&rec.ID,
			&rec.Title,
			&rec.Scope,
			&rec.SchemaVersion,
			&summaryRaw,
			&rec.TotalRecords,
			&rec.CreatedBy,
			&rec.CreatedByEmail,
			&rec.CreatedAt,
		); scanErr != nil {
			return nil, scanErr
		}
		rec.Summary = map[string]int{}
		if len(summaryRaw) > 0 {
			_ = json.Unmarshal(summaryRaw, &rec.Summary)
		}
		rec.CreatedAt = rec.CreatedAt.UTC()
		items = append(items, rec)
	}
	return items, rows.Err()
}

func (r *ReadRepository) CreateBackupExport(
	ctx context.Context,
	actorID string,
	actorEmail string,
) (operations.BackupExportResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return operations.BackupExportResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Explicit non-secret read-only queries across all 10 platform collections.
	queries := []struct {
		key string
		sql string
	}{
		{
			key: "paths",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, code, name, status, parent_path_id::text, description, sort_order, presentation, created_at, updated_at
				FROM paths ORDER BY sort_order, id LIMIT 10000
			) t`,
		},
		{
			key: "levels",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, path_id::text, code, name, sort_order, status, presentation, created_at, updated_at
				FROM levels ORDER BY sort_order, id LIMIT 10000
			) t`,
		},
		{
			key: "subjects",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, path_id::text, level_id::text, code, name, status, sort_order, presentation, created_at, updated_at
				FROM subjects ORDER BY sort_order, id LIMIT 10000
			) t`,
		},
		{
			key: "skills",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, subject_id::text, parent_skill_id::text, section_id::text, code, name, kind, description, status, sort_order, created_at, updated_at
				FROM skills ORDER BY sort_order, id LIMIT 10000
			) t`,
		},
		{
			key: "courses",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, path_id::text, subject_id::text, title, description, instructor_name, duration_minutes, level, owner_type, owner_user_id::text, owner_school_id::text, workflow_status, is_visible, is_published, revision, created_at, updated_at
				FROM courses ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
		{
			key: "lessons",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, path_id::text, subject_id::text, title, description, lesson_type, duration_seconds, video_source, owner_type, owner_user_id::text, owner_school_id::text, workflow_status, is_visible, is_locked, revision, created_at, updated_at
				FROM lessons ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
		{
			key: "questions",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, question_code, current_version, workflow_status, owner_type, owner_id::text, path_id::text, subject_id::text, section_id::text, created_at, updated_at
				FROM questions ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
		{
			key: "quizzes",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, assessment_code, owner_type, owner_user_id::text, owner_school_id::text, workflow_status, current_version, published_version, is_published, is_visible, is_school_central_draft, revision, created_at, updated_at
				FROM assessments ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
		{
			key: "library",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, path_id::text, subject_id::text, title, description, item_type, external_url, owner_type, owner_user_id::text, owner_school_id::text, workflow_status, is_visible, is_locked, revision, created_at, updated_at
				FROM library_items ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
		{
			key: "schools",
			sql: `SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
				SELECT id::text, code, name, status, metadata, created_at, updated_at
				FROM schools ORDER BY created_at DESC, id LIMIT 10000
			) t`,
		},
	}

	summary := make(map[string]int, len(queries))
	collections := make(map[string][]any, len(queries))
	totalRecords := 0

	for _, q := range queries {
		var raw []byte
		if qErr := tx.QueryRow(ctx, q.sql).Scan(&raw); qErr != nil {
			return operations.BackupExportResult{}, fmt.Errorf("backup export %s: %w", q.key, qErr)
		}
		var rows []any
		if uErr := json.Unmarshal(raw, &rows); uErr != nil {
			return operations.BackupExportResult{}, fmt.Errorf("backup unmarshal %s: %w", q.key, uErr)
		}
		if rows == nil {
			rows = []any{}
		}
		summary[q.key] = len(rows)
		collections[q.key] = rows
		totalRecords += len(rows)
	}

	summaryJSON, err := json.Marshal(summary)
	if err != nil {
		return operations.BackupExportResult{}, err
	}
	title := fmt.Sprintf("تصدير كامل للمنصة (%d عنصر)", totalRecords)
	var rec operations.BackupExportRecord
	var savedSummaryRaw []byte
	if err = tx.QueryRow(ctx, `
		INSERT INTO operations_backup_exports (title, scope, schema_version, summary, total_records, created_by, created_by_email)
		VALUES ($1, 'full', 1, $2::jsonb, $3, NULLIF($4, '')::uuid, $5)
		RETURNING id::text, title, scope, schema_version, summary, total_records, COALESCE(created_by::text, ''), created_by_email, created_at
	`, title, string(summaryJSON), totalRecords, actorID, actorEmail).Scan(
		&rec.ID,
		&rec.Title,
		&rec.Scope,
		&rec.SchemaVersion,
		&savedSummaryRaw,
		&rec.TotalRecords,
		&rec.CreatedBy,
		&rec.CreatedByEmail,
		&rec.CreatedAt,
	); err != nil {
		return operations.BackupExportResult{}, err
	}
	rec.Summary = summary
	rec.CreatedAt = rec.CreatedAt.UTC()

	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorID,
			Action:       "operations.backup.export",
			ResourceType: "learning_backup",
			ResourceID:   rec.ID,
			Status:       "success",
			Metadata: map[string]any{
				"totalRecords": totalRecords,
				"summary":      summary,
			},
		}); err != nil {
			return operations.BackupExportResult{}, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return operations.BackupExportResult{}, err
	}

	return operations.BackupExportResult{
		ExportRecord: rec,
		Payload: operations.BackupExportPayload{
			Kind:          "almeaa-platform-backup",
			SchemaVersion: 1,
			CreatedAt:     rec.CreatedAt,
			Summary:       summary,
			Collections:   collections,
		},
	}, nil
}

func (r *ReadRepository) RecordBackupValidation(
	ctx context.Context,
	actorID string,
	summary map[string]int,
	totalRecords int,
) error {
	if r.audit == nil {
		return nil
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "operations.backup.validate",
		ResourceType: "learning_backup",
		ResourceID:   "schema-v1",
		Status:       "success",
		Metadata: map[string]any{
			"totalRecords": totalRecords,
			"summary":      summary,
		},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
