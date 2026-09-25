package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	media "github.com/nasef6464/almeaago/internal/media/domain"
)

type AuditWriter interface {
	WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error
}

type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository {
	return &Repository{db: db, audit: audit}
}

func (r *Repository) FindLiveBySHA(ctx context.Context, sha256 string) (media.Asset, error) {
	row := r.db.QueryRow(ctx, `
		SELECT
			id::text, object_key, COALESCE(public_url,''), mime_type, size_bytes,
			COALESCE(sha256,''), version, status, COALESCE(created_by::text,''),
			upload_expires_at, verified_at, created_at
		FROM assets
		WHERE sha256=$1
		  AND status IN ('pending_upload','active')
		ORDER BY CASE status WHEN 'active' THEN 0 ELSE 1 END, created_at
		LIMIT 1
	`, sha256)
	return scanAsset(row)
}

func (r *Repository) Reserve(ctx context.Context, actorUserID string, request media.ReserveRequest) (media.Asset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return media.Asset{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `
		INSERT INTO assets (
			object_key, public_url, mime_type, size_bytes, sha256, version, status,
			created_by, upload_expires_at
		)
		VALUES ($1,NULLIF($2,''),$3,$4,$5,1,'pending_upload',$6::uuid,$7)
		RETURNING
			id::text, object_key, COALESCE(public_url,''), mime_type, size_bytes,
			COALESCE(sha256,''), version, status, COALESCE(created_by::text,''),
			upload_expires_at, verified_at, created_at
	`, request.ObjectKey, request.PublicURL, request.MimeType, request.SizeBytes, request.SHA256, actorUserID, request.UploadExpiresAt)
	asset, err := scanAsset(row)
	if err != nil {
		return media.Asset{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID,
		Action:      "media.upload.reserve",
		ResourceType:"asset",
		ResourceID:  asset.ID,
		Metadata: map[string]any{
			"objectKey": request.ObjectKey,
			"mimeType":  request.MimeType,
			"sizeBytes": request.SizeBytes,
			"sha256":    request.SHA256,
		},
	}); err != nil {
		return media.Asset{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return media.Asset{}, err
	}
	return asset, nil
}

func (r *Repository) RefreshPending(ctx context.Context, actorUserID, assetID string, expiresAt time.Time) (media.Asset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return media.Asset{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `
		UPDATE assets
		SET upload_expires_at=$2
		WHERE id=$1::uuid
		  AND status='pending_upload'
		RETURNING
			id::text, object_key, COALESCE(public_url,''), mime_type, size_bytes,
			COALESCE(sha256,''), version, status, COALESCE(created_by::text,''),
			upload_expires_at, verified_at, created_at
	`, assetID, expiresAt)
	asset, err := scanAsset(row)
	if err != nil {
		return media.Asset{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID,
		Action:      "media.upload.refresh",
		ResourceType:"asset",
		ResourceID:  asset.ID,
		Metadata:    map[string]any{"uploadExpiresAt": expiresAt},
	}); err != nil {
		return media.Asset{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return media.Asset{}, err
	}
	return asset, nil
}

func (r *Repository) Get(ctx context.Context, assetID string) (media.Asset, error) {
	return scanAsset(r.db.QueryRow(ctx, `
		SELECT
			id::text, object_key, COALESCE(public_url,''), mime_type, size_bytes,
			COALESCE(sha256,''), version, status, COALESCE(created_by::text,''),
			upload_expires_at, verified_at, created_at
		FROM assets
		WHERE id=$1::uuid
	`, assetID))
}

func (r *Repository) Activate(ctx context.Context, actorUserID, assetID string, info media.ObjectInfo) (media.Asset, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return media.Asset{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	row := tx.QueryRow(ctx, `
		UPDATE assets
		SET status='active', verified_at=now(), upload_expires_at=NULL
		WHERE id=$1::uuid
		  AND status='pending_upload'
		  AND size_bytes=$2
		  AND mime_type=$3
		  AND sha256=$4
		RETURNING
			id::text, object_key, COALESCE(public_url,''), mime_type, size_bytes,
			COALESCE(sha256,''), version, status, COALESCE(created_by::text,''),
			upload_expires_at, verified_at, created_at
	`, assetID, info.SizeBytes, info.MimeType, info.SHA256)
	asset, err := scanAsset(row)
	if err != nil {
		return media.Asset{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID,
		Action:      "media.upload.complete",
		ResourceType:"asset",
		ResourceID:  asset.ID,
		Metadata: map[string]any{
			"sizeBytes": info.SizeBytes,
			"mimeType":  info.MimeType,
			"sha256":    info.SHA256,
		},
	}); err != nil {
		return media.Asset{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return media.Asset{}, err
	}
	return asset, nil
}

type scanner interface {
	Scan(dest ...any) error
}

func scanAsset(row scanner) (media.Asset, error) {
	var asset media.Asset
	err := row.Scan(
		&asset.ID,
		&asset.ObjectKey,
		&asset.PublicURL,
		&asset.MimeType,
		&asset.SizeBytes,
		&asset.SHA256,
		&asset.Version,
		&asset.Status,
		&asset.CreatedBy,
		&asset.UploadExpiresAt,
		&asset.VerifiedAt,
		&asset.CreatedAt,
	)
	if err != nil {
		return media.Asset{}, mapError(err)
	}
	return asset, nil
}

func (r *Repository) writeAudit(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return errors.New("media audit writer is not configured")
	}
	return r.audit.WriteTx(ctx, tx, event)
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return media.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514", "22P02":
			return media.ErrConflict
		}
	}
	return err
}
