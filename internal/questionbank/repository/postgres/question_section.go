package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) GetQuestionSection(ctx context.Context, id string) (string, error) {
	var section string
	err := r.db.QueryRow(ctx, `SELECT COALESCE(section_id::text,'') FROM questions WHERE id=$1::uuid`, id).Scan(&section)
	return section, mapError(err)
}

func (r *Repository) SetQuestionSection(ctx context.Context, actor, id, sectionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var subject *string
	if err = tx.QueryRow(ctx, `SELECT subject_id::text FROM questions WHERE id=$1::uuid FOR UPDATE`, id).Scan(&subject); err != nil {
		return mapError(err)
	}
	if sectionID != "" {
		if subject == nil {
			return question.ErrInvalidTaxonomy
		}
		var section string
		err = tx.QueryRow(ctx, `SELECT id::text FROM taxonomy_skill_sections WHERE id=$1::uuid AND subject_id=$2::uuid AND status='active' FOR SHARE`, sectionID, *subject).Scan(&section)
		if errors.Is(err, pgx.ErrNoRows) {
			return question.ErrInvalidTaxonomy
		}
		if err != nil {
			return err
		}
	}
	if _, err = tx.Exec(ctx, `UPDATE questions SET section_id=NULLIF($2,'')::uuid,updated_at=now() WHERE id=$1::uuid`, id, sectionID); err != nil {
		return mapError(err)
	}
	if err = r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "question.section.update", ResourceType: "question", ResourceID: id, Metadata: map[string]any{"sectionId": sectionID}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
