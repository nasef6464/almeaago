package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"github.com/jackc/pgx/v5"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	"time"
)

func (r *Repository) GetFontSettings(ctx context.Context) (content.FontSettings, error) {
	var raw []byte
	var updated time.Time
	err := r.db.QueryRow(ctx, `SELECT settings,updated_at FROM content_platform_font_settings WHERE key='default'`).Scan(&raw, &updated)
	if errors.Is(err, pgx.ErrNoRows) {
		return content.FontSettings{}, nil
	}
	if err != nil {
		return nil, err
	}
	return decodeFontSettings(raw, updated)
}
func (r *Repository) PatchFontSettings(ctx context.Context, actorID string, patch content.FontSettings) (content.FontSettings, error) {
	raw, err := json.Marshal(patch)
	if err != nil {
		return nil, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	var saved []byte
	var updated time.Time
	err = tx.QueryRow(ctx, `INSERT INTO content_platform_font_settings(key,settings) VALUES ('default',$1::jsonb)
 ON CONFLICT (key) DO UPDATE SET settings=content_platform_font_settings.settings || EXCLUDED.settings,updated_at=now()
 RETURNING settings,updated_at`, raw).Scan(&saved, &updated)
	if err != nil {
		return nil, err
	}
	if r.audit != nil {
		err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{ActorUserID: actorID, Action: "content.platform_fonts.updated", ResourceType: "platform_font_settings", ResourceID: "default", Status: "success"})
		if err != nil {
			return nil, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return decodeFontSettings(saved, updated)
}
func decodeFontSettings(raw []byte, updated time.Time) (content.FontSettings, error) {
	var settings content.FontSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, err
	}
	settings["updatedAt"] = updated.UTC().Format(time.RFC3339Nano)
	return settings, nil
}
