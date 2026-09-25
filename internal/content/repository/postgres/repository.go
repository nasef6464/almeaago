package postgres

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error
}

type Repository struct {
	db *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, audit AuditWriter) *Repository {
	return &Repository{db: db, audit: audit}
}

func (r *Repository) CanManageSchool(ctx context.Context, userID, schoolID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM school_memberships sm
			JOIN schools s ON s.id=sm.school_id
			WHERE sm.user_id=$1::uuid
			  AND sm.school_id=$2::uuid
			  AND sm.role='school_admin'
			  AND sm.status='active'
			  AND s.status='active'
		)
	`, userID, schoolID).Scan(&ok)
	return ok, mapError(err)
}

func (r *Repository) validateTaxonomyTx(ctx context.Context, tx pgx.Tx, pathID, subjectID string, links []content.SkillLink) error {
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM subjects s
			JOIN paths p ON p.id=s.path_id
			WHERE s.id=$1::uuid
			  AND p.id=$2::uuid
			  AND s.status='active'
			  AND p.status='active'
		)
	`, subjectID, pathID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return content.ErrInvalidTaxonomy
	}
	for _, link := range links {
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM skills
				WHERE id=$1::uuid
				  AND subject_id=$2::uuid
				  AND status='active'
			)
		`, link.SkillID, subjectID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrInvalidTaxonomy
		}
	}
	return nil
}

func (r *Repository) validateAssetsTx(ctx context.Context, tx pgx.Tx, ids []string) error {
	for _, id := range ids {
		if id == "" {
			continue
		}
		var ok bool
		if err := tx.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM assets
				WHERE id=$1::uuid AND status='active'
			)
		`, id).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrConflict
		}
	}
	return nil
}

func (r *Repository) validateTeacherTx(ctx context.Context, tx pgx.Tx, userID string) error {
	if userID == "" {
		return nil
	}
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM users u
			JOIN user_roles ur ON ur.user_id=u.id
			WHERE u.id=$1::uuid
			  AND u.status='active'
			  AND ur.role='teacher'
		)
	`, userID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return content.ErrConflict
	}
	return nil
}

func (r *Repository) validateOwnerTx(ctx context.Context, tx pgx.Tx, ownerType content.OwnerType, ownerUserID, ownerSchoolID, assignedTeacherID string) error {
	switch ownerType {
	case content.OwnerPlatform:
		if ownerUserID != "" || ownerSchoolID != "" {
			return content.ErrConflict
		}
	case content.OwnerTeacher:
		if ownerUserID == "" || ownerSchoolID != "" {
			return content.ErrConflict
		}
		if err := r.validateTeacherTx(ctx, tx, ownerUserID); err != nil {
			return err
		}
	case content.OwnerSchool:
		if ownerSchoolID == "" || ownerUserID != "" {
			return content.ErrConflict
		}
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schools WHERE id=$1::uuid AND status='active')`, ownerSchoolID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrConflict
		}
	default:
		return content.ErrConflict
	}
	return r.validateTeacherTx(ctx, tx, assignedTeacherID)
}

func (r *Repository) writeAudit(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return fmt.Errorf("content audit writer is not configured")
	}
	return r.audit.WriteTx(ctx, tx, event)
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return content.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514", "22P02":
			return content.ErrConflict
		}
	}
	return err
}
