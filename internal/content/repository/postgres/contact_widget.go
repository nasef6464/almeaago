package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func (r *Repository) GetContactWidgetSettings(ctx context.Context) (content.PublicContactWidgetSettings, error) {
	var raw []byte
	err := r.db.QueryRow(ctx, `SELECT settings FROM content_platform_contact_settings WHERE key='default'`).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) || err != nil {
		return content.DefaultContactWidgetSettings(), nil
	}
	var settings content.PublicContactWidgetSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return content.DefaultContactWidgetSettings(), nil
	}
	return settings, nil
}
