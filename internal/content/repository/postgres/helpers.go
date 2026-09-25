package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) setWorkflow(ctx context.Context, actorUserID, table, resourceType, id string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) error {
	if table != "courses" && table != "lessons" && table != "library_items" {
		return fmt.Errorf("unsupported content workflow table")
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	query := fmt.Sprintf(`
		UPDATE %s SET workflow_status=$3,reviewer_notes=$4,
			approved_by=CASE WHEN $3='approved' THEN $5::uuid ELSE NULL END,
			approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END,
			revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2
		RETURNING id::text
	`, table)
	var updatedID string
	if err := tx.QueryRow(ctx, query, id, expectedRevision, string(status), reviewerNotes, actorUserID).Scan(&updatedID); err != nil {
		return mapUpdateError(ctx, tx, table, id, expectedRevision, err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content." + resourceType + ".workflow", ResourceType: resourceType, ResourceID: id,
		Metadata: map[string]any{"status": status},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) validateContentRefsTx(ctx context.Context, tx pgx.Tx, pathID, subjectID string, skillIDs, assetIDs []string) error {
	var taxonomyOK bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM subjects s JOIN paths p ON p.id=s.path_id
			WHERE p.id=$1::uuid AND s.id=$2::uuid AND p.status='active' AND s.status='active'
		)
	`, pathID, subjectID).Scan(&taxonomyOK); err != nil {
		return err
	}
	if !taxonomyOK {
		return content.ErrInvalidTaxonomy
	}
	for _, skillID := range skillIDs {
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skills WHERE id=$1::uuid AND subject_id=$2::uuid AND status='active')`, skillID, subjectID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrInvalidTaxonomy
		}
	}
	for _, assetID := range assetIDs {
		if assetID == "" {
			continue
		}
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assets WHERE id=$1::uuid AND status='active')`, assetID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrInvalidAsset
		}
	}
	return nil
}

func validateOwnerTx(ctx context.Context, tx pgx.Tx, ownerType content.OwnerType, ownerUserID, ownerSchoolID, assignedTeacherID string) error {
	if ownerType == content.OwnerTeacher {
		if err := validateTeacherTx(ctx, tx, ownerUserID); err != nil {
			return err
		}
	}
	if assignedTeacherID != "" {
		if err := validateTeacherTx(ctx, tx, assignedTeacherID); err != nil {
			return err
		}
	}
	if ownerType == content.OwnerSchool {
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schools WHERE id=$1::uuid AND status='active')`, ownerSchoolID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return content.ErrConflict
		}
	}
	return nil
}

func validateTeacherTx(ctx context.Context, tx pgx.Tx, userID string) error {
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id
			WHERE u.id=$1::uuid AND u.status='active' AND ur.role='teacher'
		)
	`, userID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return content.ErrConflict
	}
	return nil
}

func validateTopicParentTx(ctx context.Context, tx pgx.Tx, topicID, parentID, pathID, subjectID string) error {
	if parentID == "" {
		return nil
	}
	if topicID != "" && parentID == topicID {
		return content.ErrConflict
	}
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM foundation_topics
			WHERE id=$1::uuid AND path_id=$2::uuid AND subject_id=$3::uuid AND status<>'archived'
		)
	`, parentID, pathID, subjectID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return content.ErrConflict
	}
	return nil
}

func replaceCourseSkillsTx(ctx context.Context, tx pgx.Tx, courseID string, skillIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM course_skill_links WHERE course_id=$1::uuid`, courseID); err != nil {
		return err
	}
	for _, skillID := range skillIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO course_skill_links(course_id,skill_id,relation_type) VALUES($1::uuid,$2::uuid,'target')`, courseID, skillID); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func replaceLessonLinksTx(ctx context.Context, tx pgx.Tx, lessonID string, skillIDs, assetIDs []string, lessonType content.LessonType) error {
	if _, err := tx.Exec(ctx, `DELETE FROM lesson_skill_links WHERE lesson_id=$1::uuid`, lessonID); err != nil {
		return err
	}
	for _, skillID := range skillIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO lesson_skill_links(lesson_id,skill_id,relation_type) VALUES($1::uuid,$2::uuid,'target')`, lessonID, skillID); err != nil {
			return mapError(err)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM lesson_assets WHERE lesson_id=$1::uuid`, lessonID); err != nil {
		return err
	}
	purpose := "attachment"
	if lessonType == content.LessonVideo {
		purpose = "video"
	} else if lessonType == content.LessonFile {
		purpose = "file"
	}
	for index, assetID := range assetIDs {
		if _, err := tx.Exec(ctx, `INSERT INTO lesson_assets(lesson_id,asset_id,purpose,sort_order) VALUES($1::uuid,$2::uuid,$3,$4)`, lessonID, assetID, purpose, index); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func replaceLibraryLinksTx(ctx context.Context, tx pgx.Tx, itemID string, skillIDs []string, primaryAssetID string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM library_skill_links WHERE library_item_id=$1::uuid`, itemID); err != nil {
		return err
	}
	for index, skillID := range skillIDs {
		relation := "secondary"
		if index == 0 {
			relation = "target"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO library_skill_links(library_item_id,skill_id,relation_type) VALUES($1::uuid,$2::uuid,$3)`, itemID, skillID, relation); err != nil {
			return mapError(err)
		}
	}
	if _, err := tx.Exec(ctx, `DELETE FROM library_item_assets WHERE library_item_id=$1::uuid`, itemID); err != nil {
		return err
	}
	if primaryAssetID != "" {
		if _, err := tx.Exec(ctx, `INSERT INTO library_item_assets(library_item_id,asset_id,purpose,sort_order) VALUES($1::uuid,$2::uuid,'primary',0)`, itemID, primaryAssetID); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func replaceTopicSkillsTx(ctx context.Context, tx pgx.Tx, topicID string, skillIDs []string) error {
	if _, err := tx.Exec(ctx, `DELETE FROM topic_skill_links WHERE topic_id=$1::uuid`, topicID); err != nil {
		return err
	}
	for index, skillID := range skillIDs {
		relation := "secondary"
		if index == 0 {
			relation = "primary"
		}
		if _, err := tx.Exec(ctx, `INSERT INTO topic_skill_links(topic_id,skill_id,relation_type) VALUES($1::uuid,$2::uuid,$3)`, topicID, skillID, relation); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) loadIDs(ctx context.Context, query, id string) ([]string, error) {
	rows, err := r.db.Query(ctx, query, id)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []string{}
	for rows.Next() {
		var value string
		if err := rows.Scan(&value); err != nil {
			return nil, err
		}
		result = append(result, value)
	}
	return result, rows.Err()
}

func buildListWhere(query content.ListQuery, alias string) (string, []any) {
	parts := []string{"1=1"}
	args := []any{}
	add := func(expr string, value any) {
		args = append(args, value)
		parts = append(parts, fmt.Sprintf(expr, len(args)))
	}
	if query.PathID != "" {
		add(alias+".path_id=$%d::uuid", query.PathID)
	}
	if query.SubjectID != "" {
		add(alias+".subject_id=$%d::uuid", query.SubjectID)
	}
	if query.Search != "" {
		add(alias+".title ILIKE '%%' || $%d || '%%'", query.Search)
	}
	if query.WorkflowStatus != "" {
		add(alias+".workflow_status=$%d", string(query.WorkflowStatus))
	}
	if query.TeacherScopeUserID != "" {
		args = append(args, query.TeacherScopeUserID)
		index := len(args)
		parts = append(parts, fmt.Sprintf("(%s.owner_user_id=$%d::uuid OR %s.assigned_teacher_id=$%d::uuid)", alias, index, alias, index))
	}
	return strings.Join(parts, " AND "), args
}

func mapUpdateError(ctx context.Context, tx pgx.Tx, table, id string, expectedRevision int, err error) error {
	if !errors.Is(err, pgx.ErrNoRows) {
		return mapError(err)
	}
	query := fmt.Sprintf(`SELECT revision FROM %s WHERE id=$1::uuid`, table)
	var revision int
	if scanErr := tx.QueryRow(ctx, query, id).Scan(&revision); errors.Is(scanErr, pgx.ErrNoRows) {
		return content.ErrNotFound
	} else if scanErr != nil {
		return scanErr
	}
	if revision != expectedRevision {
		return content.ErrVersionConflict
	}
	return content.ErrConflict
}

func (r *Repository) writeAudit(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return errors.New("content audit writer is not configured")
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
