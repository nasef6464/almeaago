package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

// Read scalars and all ordered references in one statement/snapshot. The public
// document is presentation, never an entitlement or publication grant.
const selectHomepageSettings = `SELECT settings || jsonb_build_object(
 'key',s.key,
 'featuredPathIds',COALESCE((SELECT jsonb_agg(path_id::text ORDER BY position) FROM content_homepage_featured_paths WHERE settings_key=s.key),'[]'::jsonb),
 'featuredCourseIds',COALESCE((SELECT jsonb_agg(course_id::text ORDER BY position) FROM content_homepage_featured_courses WHERE settings_key=s.key),'[]'::jsonb),
 'featuredArticleLessonIds',COALESCE((SELECT jsonb_agg(lesson_id::text ORDER BY position) FROM content_homepage_featured_lessons WHERE settings_key=s.key),'[]'::jsonb)
 ),updated_at FROM content_homepage_settings s WHERE key='default'`

func decodeHomepageSettings(row pgx.Row) (content.HomepageSettings, error) {
	var raw []byte
	var updated time.Time
	if err := row.Scan(&raw, &updated); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	var settings content.HomepageSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, err
	}
	settings["updatedAt"] = updated.UTC().Format(time.RFC3339Nano)
	return settings, nil
}
func (r *Repository) GetHomepageSettings(ctx context.Context) (content.HomepageSettings, error) {
	return decodeHomepageSettings(r.db.QueryRow(ctx, selectHomepageSettings))
}

type homepageReference struct{ key, table, column string }

var homepageReferences = []homepageReference{
	{"featuredPathIds", "content_homepage_featured_paths", "path_id"},
	{"featuredCourseIds", "content_homepage_featured_courses", "course_id"},
	{"featuredArticleLessonIds", "content_homepage_featured_lessons", "lesson_id"},
}

func homepageScalarJSON(settings content.HomepageSettings) ([]byte, error) {
	scalars := content.HomepageSettings{}
	for key, value := range settings {
		if key != "featuredPathIds" && key != "featuredCourseIds" && key != "featuredArticleLessonIds" && key != "key" && key != "updatedAt" {
			scalars[key] = value
		}
	}
	return json.Marshal(scalars)
}
func homepageStorageError(err error) error {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) && (pgErr.Code == "23503" || pgErr.Code == "22P02") {
		return content.ErrInvalidTaxonomy
	}
	return err
}
func (r *Repository) PatchHomepageSettings(ctx context.Context, actorID string, patch content.HomepageSettings) (content.HomepageSettings, error) {
	normalized, err := content.HomepageSubdocumentDefaults(patch)
	if err != nil {
		return nil, err
	}
	scalarPatch, err := homepageScalarJSON(normalized)
	if err != nil {
		return nil, err
	}
	defaults, err := homepageScalarJSON(content.DefaultHomepageSettings())
	if err != nil {
		return nil, err
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return nil, err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `INSERT INTO content_homepage_settings(key,settings) VALUES ('default',$1::jsonb) ON CONFLICT (key) DO NOTHING`, defaults); err != nil {
		return nil, err
	}
	// UPDATE serializes the entire document+reference change, including on first
	// concurrent insert. Disjoint patches cannot lose an earlier committed field.
	if _, err = tx.Exec(ctx, `UPDATE content_homepage_settings SET settings=settings || $1::jsonb,updated_at=clock_timestamp() WHERE key='default'`, scalarPatch); err != nil {
		return nil, err
	}
	for _, ref := range homepageReferences {
		value, exists := normalized[ref.key]
		if !exists {
			continue
		}
		raw, err := json.Marshal(value)
		if err != nil {
			return nil, err
		}
		// SQL identifiers below come only from the fixed internal table mapping.
		if _, err = tx.Exec(ctx, `DELETE FROM `+ref.table+` WHERE settings_key='default'`); err != nil {
			return nil, err
		}
		if _, err = tx.Exec(ctx, `INSERT INTO `+ref.table+`(settings_key,position,`+ref.column+`) SELECT 'default',(ordinality-1)::integer,value::uuid FROM jsonb_array_elements_text($1::jsonb) WITH ORDINALITY AS items(value,ordinality)`, raw); err != nil {
			return nil, homepageStorageError(err)
		}
	}
	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{ActorUserID: actorID, Action: "content.homepage.updated", ResourceType: "homepage_settings", ResourceID: "default", Status: "success"}); err != nil {
			return nil, err
		}
	}
	saved, err := decodeHomepageSettings(tx.QueryRow(ctx, selectHomepageSettings))
	if err != nil {
		return nil, err
	}
	if err = tx.Commit(ctx); err != nil {
		return nil, err
	}
	return saved, nil
}
