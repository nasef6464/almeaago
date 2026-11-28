package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) CanTeachInSchool(ctx context.Context, teacherID, schoolID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM schools s
			JOIN school_memberships sm ON sm.school_id = s.id
			JOIN teaching_assignments ta
			  ON ta.school_id = sm.school_id
			 AND ta.teacher_id = sm.user_id
			 AND ta.status = 'active'
			WHERE s.id = $2::uuid
			  AND s.status = 'active'
			  AND sm.user_id = $1::uuid
			  AND sm.role = 'teacher'
			  AND sm.status = 'active'
		)
	`, teacherID, schoolID).Scan(&ok)
	return ok, err
}

func (r *Repository) ListClassroomTemplates(
	ctx context.Context,
	teacherID, schoolID string,
) ([]question.ClassroomPreparedTemplate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			id::text,
			school_id::text,
			teacher_id::text,
			title,
			ARRAY(SELECT unnest(question_ids)::text),
			ARRAY(SELECT unnest(challenge_ids)::text),
			created_at,
			updated_at
		FROM classroom_prepared_templates
		WHERE school_id = $1::uuid AND teacher_id = $2::uuid
		ORDER BY created_at DESC, id DESC
		LIMIT 100
	`, schoolID, teacherID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []question.ClassroomPreparedTemplate{}
	for rows.Next() {
		var item question.ClassroomPreparedTemplate
		if err = rows.Scan(
			&item.ID,
			&item.SchoolID,
			&item.TeacherID,
			&item.Title,
			&item.QuestionIDs,
			&item.ChallengeIDs,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			return nil, err
		}
		if item.QuestionIDs == nil {
			item.QuestionIDs = []string{}
		}
		if item.ChallengeIDs == nil {
			item.ChallengeIDs = []string{}
		}
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) CreateClassroomTemplate(
	ctx context.Context,
	cmd question.CreateClassroomTemplateCommand,
) (question.ClassroomPreparedTemplate, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.ClassroomPreparedTemplate{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var approvedCount int
	if err = tx.QueryRow(ctx, `
		SELECT count(*)::int
		FROM questions
		WHERE id = ANY($1::uuid[])
		  AND workflow_status = 'approved'
	`, cmd.QuestionIDs).Scan(&approvedCount); err != nil {
		return question.ClassroomPreparedTemplate{}, err
	}
	if approvedCount != len(cmd.QuestionIDs) {
		return question.ClassroomPreparedTemplate{}, question.ErrConflict
	}

	var out question.ClassroomPreparedTemplate
	err = tx.QueryRow(ctx, `
		INSERT INTO classroom_prepared_templates (
			school_id, teacher_id, title, question_ids, challenge_ids
		)
		VALUES ($1::uuid, $2::uuid, $3, $4::uuid[], $5::uuid[])
		RETURNING
			id::text,
			school_id::text,
			teacher_id::text,
			title,
			ARRAY(SELECT unnest(question_ids)::text),
			ARRAY(SELECT unnest(challenge_ids)::text),
			created_at,
			updated_at
	`, cmd.SchoolID, cmd.TeacherID, cmd.Title, cmd.QuestionIDs, cmd.ChallengeIDs).Scan(
		&out.ID,
		&out.SchoolID,
		&out.TeacherID,
		&out.Title,
		&out.QuestionIDs,
		&out.ChallengeIDs,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return question.ClassroomPreparedTemplate{}, mapError(err)
	}
	if out.QuestionIDs == nil {
		out.QuestionIDs = []string{}
	}
	if out.ChallengeIDs == nil {
		out.ChallengeIDs = []string{}
	}

	if err = r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  cmd.TeacherID,
		Action:       "questionbank.classroom_template.create",
		ResourceType: "classroom_prepared_template",
		ResourceID:   out.ID,
		Metadata:     map[string]any{"schoolId": cmd.SchoolID, "questionCount": len(cmd.QuestionIDs)},
	}); err != nil {
		return question.ClassroomPreparedTemplate{}, err
	}

	if err = tx.Commit(ctx); err != nil {
		return question.ClassroomPreparedTemplate{}, err
	}
	return out, nil
}

func (r *Repository) DeleteClassroomTemplate(ctx context.Context, teacherID, templateID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var schoolID string
	err = tx.QueryRow(ctx, `
		DELETE FROM classroom_prepared_templates t
		WHERE t.id = $1::uuid
		  AND t.teacher_id = $2::uuid
		  AND EXISTS (
			SELECT 1
			FROM school_memberships sm
			JOIN teaching_assignments ta
			  ON ta.school_id = sm.school_id
			 AND ta.teacher_id = sm.user_id
			 AND ta.status = 'active'
			WHERE sm.school_id = t.school_id
			  AND sm.user_id = $2::uuid
			  AND sm.role = 'teacher'
			  AND sm.status = 'active'
		  )
		RETURNING t.school_id::text
	`, templateID, teacherID).Scan(&schoolID)
	if errors.Is(err, pgx.ErrNoRows) {
		return question.ErrNotFound
	}
	if err != nil {
		return mapError(err)
	}

	if err = r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  teacherID,
		Action:       "questionbank.classroom_template.delete",
		ResourceType: "classroom_prepared_template",
		ResourceID:   templateID,
		Metadata:     map[string]any{"schoolId": schoolID},
	}); err != nil {
		return err
	}

	return tx.Commit(ctx)
}
