package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) Create(ctx context.Context, actorUserID string, command question.CreateCommand) (question.Question, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.Question{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return question.Question{}, err
	}
	if err := r.validateAssetsTx(ctx, tx, command.Version); err != nil {
		return question.Question{}, err
	}
	if command.OwnerType == question.OwnerTeacher {
		if err := validateTeacherTx(ctx, tx, command.OwnerID); err != nil {
			return question.Question{}, err
		}
	}
	if command.AssignedTeacherID != "" {
		if err := validateTeacherTx(ctx, tx, command.AssignedTeacherID); err != nil {
			return question.Question{}, err
		}
	}

	var questionID string
	err = tx.QueryRow(ctx, `
		INSERT INTO questions (
			question_code, current_version, workflow_status, owner_type, owner_id,
			created_by, path_id, subject_id, assigned_teacher_id
		)
		VALUES ($1, 1, 'draft', $2, NULLIF($3, '')::uuid, $4::uuid, $5::uuid, $6::uuid, NULLIF($7, '')::uuid)
		RETURNING id::text
	`, command.QuestionCode, string(command.OwnerType), command.OwnerID, actorUserID, command.PathID, command.SubjectID, command.AssignedTeacherID).Scan(&questionID)
	if err != nil {
		return question.Question{}, mapError(err)
	}

	if err := insertVersionTx(ctx, tx, questionID, 1, actorUserID, command.Version); err != nil {
		return question.Question{}, err
	}
	if err := replaceSkillLinksTx(ctx, tx, questionID, command.SkillLinks); err != nil {
		return question.Question{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "questionbank.question.create", ResourceType: "question", ResourceID: questionID,
		Metadata: map[string]any{"questionCode": command.QuestionCode, "version": 1},
	}); err != nil {
		return question.Question{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return question.Question{}, err
	}
	return r.Get(ctx, questionID)
}

func (r *Repository) AppendVersion(ctx context.Context, actorUserID, questionID string, expectedCurrentVersion int, command question.VersionCommand) (question.Question, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.Question{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	if err := tx.QueryRow(ctx, `SELECT current_version FROM questions WHERE id=$1::uuid FOR UPDATE`, questionID).Scan(&current); err != nil {
		return question.Question{}, mapError(err)
	}
	if current != expectedCurrentVersion {
		return question.Question{}, question.ErrVersionConflict
	}
	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return question.Question{}, err
	}
	if err := r.validateAssetsTx(ctx, tx, command); err != nil {
		return question.Question{}, err
	}

	next := current + 1
	if err := insertVersionTx(ctx, tx, questionID, next, actorUserID, command); err != nil {
		return question.Question{}, err
	}
	if err := replaceSkillLinksTx(ctx, tx, questionID, command.SkillLinks); err != nil {
		return question.Question{}, err
	}
	if _, err := tx.Exec(ctx, `
		UPDATE questions
		SET current_version=$2, path_id=$3::uuid, subject_id=$4::uuid, updated_at=now()
		WHERE id=$1::uuid
	`, questionID, next, command.PathID, command.SubjectID); err != nil {
		return question.Question{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "questionbank.question.version.create", ResourceType: "question", ResourceID: questionID,
		Metadata: map[string]any{"fromVersion": current, "toVersion": next},
	}); err != nil {
		return question.Question{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return question.Question{}, err
	}
	return r.Get(ctx, questionID)
}

func (r *Repository) SetWorkflow(ctx context.Context, actorUserID, questionID string, expectedCurrentVersion int, status question.WorkflowStatus, reviewerNotes string) (question.Question, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.Question{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	if err := tx.QueryRow(ctx, `SELECT current_version FROM questions WHERE id=$1::uuid FOR UPDATE`, questionID).Scan(&current); err != nil {
		return question.Question{}, mapError(err)
	}
	if current != expectedCurrentVersion {
		return question.Question{}, question.ErrVersionConflict
	}

	_, err = tx.Exec(ctx, `
		UPDATE questions
		SET workflow_status=$2,
			reviewer_notes=$3,
			approved_by=CASE
				WHEN $2='approved' THEN $4::uuid
				WHEN $2 IN ('draft','pending_review','rejected') THEN NULL
				ELSE approved_by
			END,
			approved_at=CASE
				WHEN $2='approved' THEN now()
				WHEN $2 IN ('draft','pending_review','rejected') THEN NULL
				ELSE approved_at
			END,
			updated_at=now()
		WHERE id=$1::uuid
	`, questionID, string(status), reviewerNotes, actorUserID)
	if err != nil {
		return question.Question{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "questionbank.question.workflow", ResourceType: "question", ResourceID: questionID,
		Metadata: map[string]any{"status": status, "version": current},
	}); err != nil {
		return question.Question{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return question.Question{}, err
	}
	return r.Get(ctx, questionID)
}

func (r *Repository) Get(ctx context.Context, questionID string) (question.Question, error) {
	var row question.Question
	var ownerID, createdBy, assignedTeacherID, approvedBy string
	var revenue float64
	var sourceMeta, aiContext, voiceExplanation []byte
	var approvedAt *time.Time
	var correctOptionIndex *int
	var sourceYear *int

	err := r.db.QueryRow(ctx, `
		SELECT
			q.id::text, q.question_code, q.current_version, q.workflow_status, q.owner_type,
			COALESCE(q.owner_id::text,''), q.path_id::text, q.subject_id::text,
			COALESCE(q.created_by::text,''), COALESCE(q.assigned_teacher_id::text,''),
			COALESCE(q.approved_by::text,''), q.approved_at, q.reviewer_notes,
			COALESCE(q.revenue_share_percentage::float8,-1), q.created_at, q.updated_at,
			qv.version, qv.question_type, qv.text_content, COALESCE(qv.image_asset_id::text,''),
			qv.image_alt, qv.options_embedded_in_image, qv.correct_option_index,
			qv.explanation, qv.hint, qv.solving_strategy, COALESCE(qv.video_url,''),
			qv.source_meta, qv.ai_context, qv.voice_explanation, COALESCE(qv.difficulty,''),
			COALESCE(qv.exam_type,''), COALESCE(qv.source,''), qv.source_year,
			COALESCE(qv.created_by::text,''), qv.revision_note, qv.created_at
		FROM questions q
		JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version
		WHERE q.id=$1::uuid
	`, questionID).Scan(
		&row.ID, &row.QuestionCode, &row.CurrentVersion, &row.WorkflowStatus, &row.OwnerType,
		&ownerID, &row.PathID, &row.SubjectID, &createdBy, &assignedTeacherID,
		&approvedBy, &approvedAt, &row.ReviewerNotes, &revenue, &row.CreatedAt, &row.UpdatedAt,
		&row.Version.Version, &row.Version.QuestionType, &row.Version.TextContent, &row.Version.ImageAssetID,
		&row.Version.ImageAlt, &row.Version.OptionsEmbeddedInImage, &correctOptionIndex,
		&row.Version.Explanation, &row.Version.Hint, &row.Version.SolvingStrategy, &row.Version.VideoURL,
		&sourceMeta, &aiContext, &voiceExplanation, &row.Version.Difficulty,
		&row.Version.ExamType, &row.Version.Source, &sourceYear, &row.Version.CreatedBy,
		&row.Version.RevisionNote, &row.Version.CreatedAt,
	)
	if err != nil {
		return question.Question{}, mapError(err)
	}
	row.OwnerID = ownerID
	row.CreatedBy = createdBy
	row.AssignedTeacherID = assignedTeacherID
	row.ApprovedBy = approvedBy
	row.ApprovedAt = approvedAt
	if revenue >= 0 {
		row.RevenueSharePercentage = &revenue
	}
	row.Version.CorrectOptionIndex = correctOptionIndex
	row.Version.SourceYear = sourceYear
	row.Version.SourceMeta = json.RawMessage(sourceMeta)
	row.Version.AIContext = json.RawMessage(aiContext)
	row.Version.VoiceExplanation = json.RawMessage(voiceExplanation)

	options, err := r.loadOptions(ctx, questionID, row.CurrentVersion)
	if err != nil {
		return question.Question{}, err
	}
	links, err := r.loadSkillLinks(ctx, questionID)
	if err != nil {
		return question.Question{}, err
	}
	row.Options = options
	row.SkillLinks = links
	return row, nil
}

func insertVersionTx(ctx context.Context, tx pgx.Tx, questionID string, version int, actorUserID string, command question.VersionCommand) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO question_versions (
			question_id, version, question_type, text_content, image_asset_id, image_alt,
			options_embedded_in_image, correct_option_index, explanation, hint, solving_strategy,
			video_url, source_meta, ai_context, voice_explanation, difficulty, exam_type, source,
			source_year, created_by, revision_note
		)
		VALUES ($1::uuid,$2,$3,$4,NULLIF($5,'')::uuid,$6,$7,$8,$9,$10,$11,NULLIF($12,''),$13::jsonb,$14::jsonb,$15::jsonb,NULLIF($16,''),NULLIF($17,''),NULLIF($18,''),$19,$20::uuid,$21)
	`, questionID, version, string(command.QuestionType), command.TextContent, command.ImageAssetID, command.ImageAlt,
		command.OptionsEmbeddedInImage, command.CorrectOptionIndex, command.Explanation, command.Hint, command.SolvingStrategy,
		command.VideoURL, string(command.SourceMeta), string(command.AIContext), string(command.VoiceExplanation), command.Difficulty,
		command.ExamType, command.Source, command.SourceYear, actorUserID, command.RevisionNote)
	if err != nil {
		return mapError(err)
	}
	for _, option := range command.Options {
		if _, err := tx.Exec(ctx, `
			INSERT INTO question_options(question_id,version,option_index,option_text,asset_id)
			VALUES($1::uuid,$2,$3,$4,NULLIF($5,'')::uuid)
		`, questionID, version, option.Index, option.Text, option.AssetID); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func replaceSkillLinksTx(ctx context.Context, tx pgx.Tx, questionID string, links []question.SkillLink) error {
	if _, err := tx.Exec(ctx, `DELETE FROM question_skill_links WHERE question_id=$1::uuid`, questionID); err != nil {
		return err
	}
	for _, link := range links {
		if _, err := tx.Exec(ctx, `
			INSERT INTO question_skill_links(question_id,skill_id,relation_type)
			VALUES($1::uuid,$2::uuid,$3)
		`, questionID, link.SkillID, string(link.RelationType)); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) validateTaxonomyTx(ctx context.Context, tx pgx.Tx, pathID, subjectID string, links []question.SkillLink) error {
	var subjectOK bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM subjects s JOIN paths p ON p.id=s.path_id
			WHERE s.id=$1::uuid AND p.id=$2::uuid AND s.status='active' AND p.status='active'
		)
	`, subjectID, pathID).Scan(&subjectOK); err != nil {
		return err
	}
	if !subjectOK {
		return question.ErrInvalidTaxonomy
	}

	mainID := ""
	subCount := 0
	for _, link := range links {
		if link.RelationType == question.RelationMain {
			mainID = link.SkillID
		}
		if link.RelationType == question.RelationSub {
			subCount++
		}
	}
	if mainID == "" {
		return question.ErrInvalidTaxonomy
	}
	var mainOK bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skills WHERE id=$1::uuid AND subject_id=$2::uuid AND kind='main' AND status='active')`, mainID, subjectID).Scan(&mainOK); err != nil {
		return err
	}
	if !mainOK {
		return question.ErrInvalidTaxonomy
	}
	for _, link := range links {
		var ok bool
		switch link.RelationType {
		case question.RelationMain:
			continue
		case question.RelationSub:
			err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skills WHERE id=$1::uuid AND subject_id=$2::uuid AND parent_skill_id=$3::uuid AND kind='sub' AND status='active')`, link.SkillID, subjectID, mainID).Scan(&ok)
			if err != nil {
				return err
			}
		case question.RelationSecondary:
			err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skills WHERE id=$1::uuid AND subject_id=$2::uuid AND status='active')`, link.SkillID, subjectID).Scan(&ok)
			if err != nil {
				return err
			}
		}
		if !ok {
			return question.ErrInvalidTaxonomy
		}
	}
	var hasSubskills bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM skills WHERE parent_skill_id=$1::uuid AND kind='sub' AND status='active')`, mainID).Scan(&hasSubskills); err != nil {
		return err
	}
	if hasSubskills && subCount == 0 {
		return question.ErrInvalidTaxonomy
	}
	return nil
}

func (r *Repository) validateAssetsTx(ctx context.Context, tx pgx.Tx, command question.VersionCommand) error {
	ids := make([]string, 0, len(command.Options)+1)
	if command.ImageAssetID != "" {
		ids = append(ids, command.ImageAssetID)
	}
	for _, option := range command.Options {
		if option.AssetID != "" {
			ids = append(ids, option.AssetID)
		}
	}
	for _, id := range ids {
		var ok bool
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assets WHERE id=$1::uuid AND status='active')`, id).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return question.ErrConflict
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
		return question.ErrConflict
	}
	return nil
}

func validateTeacherScopeTx(ctx context.Context, tx pgx.Tx, userID, pathID, subjectID string) error {
	if err := validateTeacherTx(ctx, tx, userID); err != nil {
		return err
	}
	var ok bool
	if err := tx.QueryRow(ctx, `
		SELECT
			EXISTS(
				SELECT 1
				FROM content_trainer_path_scopes ps
				JOIN paths p ON p.id=ps.path_id
				WHERE ps.user_id=$1::uuid AND ps.path_id=$2::uuid AND p.status='active'
			)
			OR EXISTS(
				SELECT 1
				FROM content_trainer_subject_scopes ss
				JOIN subjects s ON s.id=ss.subject_id
				WHERE ss.user_id=$1::uuid AND ss.subject_id=$3::uuid
				  AND s.path_id=$2::uuid AND s.status='active'
			)
	`, userID, pathID, subjectID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return question.ErrConflict
	}
	return nil
}

func (r *Repository) loadOptions(ctx context.Context, questionID string, version int) ([]question.Option, error) {
	rows, err := r.db.Query(ctx, `
		SELECT option_index, option_text, COALESCE(asset_id::text,'')
		FROM question_options
		WHERE question_id=$1::uuid AND version=$2
		ORDER BY option_index
	`, questionID, version)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []question.Option{}
	for rows.Next() {
		var item question.Option
		if err := rows.Scan(&item.Index, &item.Text, &item.AssetID); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *Repository) loadSkillLinks(ctx context.Context, questionID string) ([]question.SkillLink, error) {
	rows, err := r.db.Query(ctx, `
		SELECT skill_id::text, relation_type
		FROM question_skill_links
		WHERE question_id=$1::uuid
		ORDER BY CASE relation_type WHEN 'main' THEN 0 WHEN 'sub' THEN 1 ELSE 2 END, skill_id
	`, questionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []question.SkillLink{}
	for rows.Next() {
		var item question.SkillLink
		if err := rows.Scan(&item.SkillID, &item.RelationType); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func (r *Repository) writeAudit(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	if r.audit == nil {
		return fmt.Errorf("questionbank audit writer is not configured")
	}
	return r.audit.WriteTx(ctx, tx, event)
}

func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return question.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514", "22P02":
			return question.ErrConflict
		}
	}
	return err
}
