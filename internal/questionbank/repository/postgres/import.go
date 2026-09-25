package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) ImportConflicts(
	ctx context.Context,
	questionCodes, sourceItemIDs, imageHashes []string,
) ([]question.ImportConflict, error) {
	return importConflicts(ctx, r.db, questionCodes, sourceItemIDs, imageHashes)
}

func (r *Repository) ValidateImportBatch(
	ctx context.Context,
	commands []question.ImportCommand,
) ([]question.ImportIssue, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{AccessMode: pgx.ReadOnly})
	if err != nil {
		return nil, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	issues := []question.ImportIssue{}
	for index, command := range commands {
		err := r.validateTaxonomyTx(
			ctx,
			tx,
			command.Create.PathID,
			command.Create.SubjectID,
			command.Create.SkillLinks,
		)
		if errors.Is(err, question.ErrInvalidTaxonomy) {
			issues = append(issues, question.ImportIssue{
				Index:        index,
				QuestionCode: command.Create.QuestionCode,
				Code:         "INVALID_TAXONOMY",
				Message:      "question taxonomy or skill hierarchy is invalid",
			})
			continue
		}
		if err != nil {
			return nil, err
		}
	}
	return issues, nil
}

func (r *Repository) WriteImportBatch(
	ctx context.Context,
	actorUserID, batchID string,
	commands []question.ImportCommand,
) (question.ImportBatch, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.ImportBatch{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	codes, sourceIDs, hashes := importIdentityLists(commands)
	conflicts, err := importConflicts(ctx, tx, codes, sourceIDs, hashes)
	if err != nil {
		return question.ImportBatch{}, err
	}
	if len(conflicts) > 0 {
		return question.ImportBatch{}, question.ErrConflict
	}

	imported := make([]question.ImportedQuestion, 0, len(commands))
	for _, command := range commands {
		if err := r.validateTaxonomyTx(
			ctx,
			tx,
			command.Create.PathID,
			command.Create.SubjectID,
			command.Create.SkillLinks,
		); err != nil {
			return question.ImportBatch{}, err
		}

		var questionID string
		err := tx.QueryRow(ctx, `
			INSERT INTO questions (
				question_code, current_version, workflow_status, owner_type, owner_id,
				created_by, path_id, subject_id, assigned_teacher_id,
				source_item_id, import_batch_id, image_hash, source_document_code,
				source_pdf_page_index, source_printed_page_number, source_printed_question_number
			)
			VALUES (
				$1,1,'draft','platform',NULL,$2::uuid,$3::uuid,$4::uuid,NULL,
				$5,$6,$7,$8,$9,$10,$11
			)
			RETURNING id::text
		`,
			command.Create.QuestionCode,
			actorUserID,
			command.Create.PathID,
			command.Create.SubjectID,
			command.Provenance.SourceItemID,
			batchID,
			command.Provenance.ImageHash,
			command.Provenance.DocumentCode,
			command.Provenance.PDFPageIndex,
			command.Provenance.PrintedPageNumber,
			command.Provenance.PrintedQuestionNumber,
		).Scan(&questionID)
		if err != nil {
			return question.ImportBatch{}, mapError(err)
		}

		if err := insertVersionTx(ctx, tx, questionID, 1, actorUserID, command.Create.Version); err != nil {
			return question.ImportBatch{}, err
		}
		if err := replaceSkillLinksTx(ctx, tx, questionID, command.Create.SkillLinks); err != nil {
			return question.ImportBatch{}, err
		}
		if err := r.writeAudit(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorUserID,
			Action:       "questionbank.import.question.create",
			ResourceType: "question",
			ResourceID:   questionID,
			Metadata: map[string]any{
				"batchId":      batchID,
				"questionCode": command.Create.QuestionCode,
				"sourceItemId": command.Provenance.SourceItemID,
				"imageHash":    command.Provenance.ImageHash,
			},
		}); err != nil {
			return question.ImportBatch{}, err
		}
		imported = append(imported, question.ImportedQuestion{
			ID:             questionID,
			QuestionCode:   command.Create.QuestionCode,
			WorkflowStatus: question.WorkflowDraft,
		})
	}

	report, err := json.Marshal(map[string]any{
		"mode":          "WRITE",
		"draftOnly":     true,
		"questionCodes": codes,
	})
	if err != nil {
		return question.ImportBatch{}, err
	}
	var batch question.ImportBatch
	err = tx.QueryRow(ctx, `
		INSERT INTO question_import_batches (
			batch_id, status, requested_count, inserted_count, created_by, report
		)
		VALUES ($1,'imported',$2,$2,$3::uuid,$4::jsonb)
		RETURNING batch_id,status,requested_count,inserted_count,
		          COALESCE(created_by::text,''),created_at,rolled_back_at
	`, batchID, len(commands), actorUserID, string(report)).Scan(
		&batch.BatchID,
		&batch.Status,
		&batch.RequestedCount,
		&batch.InsertedCount,
		&batch.CreatedBy,
		&batch.CreatedAt,
		&batch.RolledBackAt,
	)
	if err != nil {
		return question.ImportBatch{}, mapError(err)
	}
	batch.Questions = imported

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "questionbank.import.batch",
		ResourceType: "question_import_batch",
		ResourceID:   batchID,
		Metadata: map[string]any{
			"requested": len(commands),
			"inserted":  len(imported),
		},
	}); err != nil {
		return question.ImportBatch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return question.ImportBatch{}, err
	}
	return batch, nil
}

func (r *Repository) GetImportBatch(ctx context.Context, batchID string) (question.ImportBatch, error) {
	var batch question.ImportBatch
	err := r.db.QueryRow(ctx, `
		SELECT
			batch_id,status,requested_count,inserted_count,
			COALESCE(created_by::text,''),created_at,rolled_back_at
		FROM question_import_batches
		WHERE batch_id=$1
	`, batchID).Scan(
		&batch.BatchID,
		&batch.Status,
		&batch.RequestedCount,
		&batch.InsertedCount,
		&batch.CreatedBy,
		&batch.CreatedAt,
		&batch.RolledBackAt,
	)
	if err != nil {
		return question.ImportBatch{}, mapError(err)
	}

	rows, err := r.db.Query(ctx, `
		SELECT id::text, question_code, workflow_status
		FROM questions
		WHERE import_batch_id=$1
		ORDER BY created_at, id
	`, batchID)
	if err != nil {
		return question.ImportBatch{}, err
	}
	defer rows.Close()

	batch.Questions = []question.ImportedQuestion{}
	for rows.Next() {
		var item question.ImportedQuestion
		if err := rows.Scan(&item.ID, &item.QuestionCode, &item.WorkflowStatus); err != nil {
			return question.ImportBatch{}, err
		}
		batch.Questions = append(batch.Questions, item)
	}
	if err := rows.Err(); err != nil {
		return question.ImportBatch{}, err
	}
	return batch, nil
}

func (r *Repository) RollbackImportBatch(
	ctx context.Context,
	actorUserID, batchID string,
) (question.ImportBatch, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return question.ImportBatch{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status string
	if err := tx.QueryRow(ctx, `
		SELECT status
		FROM question_import_batches
		WHERE batch_id=$1
		FOR UPDATE
	`, batchID).Scan(&status); err != nil {
		return question.ImportBatch{}, mapError(err)
	}
	if status != "imported" {
		return question.ImportBatch{}, question.ErrConflict
	}

	rows, err := tx.Query(ctx, `
		SELECT id::text, question_code, workflow_status
		FROM questions
		WHERE import_batch_id=$1
		ORDER BY created_at, id
		FOR UPDATE
	`, batchID)
	if err != nil {
		return question.ImportBatch{}, err
	}
	items := []question.ImportedQuestion{}
	for rows.Next() {
		var item question.ImportedQuestion
		if err := rows.Scan(&item.ID, &item.QuestionCode, &item.WorkflowStatus); err != nil {
			rows.Close()
			return question.ImportBatch{}, err
		}
		if item.WorkflowStatus != question.WorkflowDraft {
			rows.Close()
			return question.ImportBatch{}, question.ErrConflict
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return question.ImportBatch{}, err
	}
	rows.Close()
	if len(items) == 0 {
		return question.ImportBatch{}, question.ErrNotFound
	}

	if _, err := tx.Exec(ctx, `
		UPDATE questions
		SET workflow_status='archived', updated_at=now()
		WHERE import_batch_id=$1
		  AND workflow_status='draft'
	`, batchID); err != nil {
		return question.ImportBatch{}, err
	}
	var rolledBackAt time.Time
	if err := tx.QueryRow(ctx, `
		UPDATE question_import_batches
		SET status='rolled_back', rolled_back_at=now()
		WHERE batch_id=$1
		RETURNING rolled_back_at
	`, batchID).Scan(&rolledBackAt); err != nil {
		return question.ImportBatch{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "questionbank.import.rollback",
		ResourceType: "question_import_batch",
		ResourceID:   batchID,
		Metadata:     map[string]any{"archived": len(items)},
	}); err != nil {
		return question.ImportBatch{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return question.ImportBatch{}, err
	}
	return r.GetImportBatch(ctx, batchID)
}

type importQueryer interface {
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
}

func importConflicts(
	ctx context.Context,
	queryer importQueryer,
	questionCodes, sourceItemIDs, imageHashes []string,
) ([]question.ImportConflict, error) {
	clauses := []string{}
	args := []any{}
	appendIn := func(column string, values []string) {
		if len(values) == 0 {
			return
		}
		placeholders := make([]string, 0, len(values))
		for _, value := range values {
			args = append(args, value)
			placeholders = append(placeholders, fmt.Sprintf("$%d", len(args)))
		}
		clauses = append(clauses, column+" IN ("+strings.Join(placeholders, ",")+")")
	}
	appendIn("question_code", questionCodes)
	appendIn("source_item_id", sourceItemIDs)
	appendIn("image_hash", imageHashes)
	if len(clauses) == 0 {
		return []question.ImportConflict{}, nil
	}

	rows, err := queryer.Query(ctx, `
		SELECT
			id::text, question_code, COALESCE(source_item_id,''), COALESCE(image_hash,''),
			COALESCE(import_batch_id,''), workflow_status
		FROM questions
		WHERE `+strings.Join(clauses, " OR ")+`
		ORDER BY created_at, id
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []question.ImportConflict{}
	for rows.Next() {
		var item question.ImportConflict
		if err := rows.Scan(
			&item.ID,
			&item.QuestionCode,
			&item.SourceItemID,
			&item.ImageHash,
			&item.ImportBatchID,
			&item.WorkflowStatus,
		); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func importIdentityLists(commands []question.ImportCommand) ([]string, []string, []string) {
	codes := make([]string, 0, len(commands))
	sourceIDs := make([]string, 0, len(commands))
	hashes := make([]string, 0, len(commands))
	for _, command := range commands {
		codes = append(codes, command.Create.QuestionCode)
		sourceIDs = append(sourceIDs, command.Provenance.SourceItemID)
		hashes = append(hashes, command.Provenance.ImageHash)
	}
	return codes, sourceIDs, hashes
}
