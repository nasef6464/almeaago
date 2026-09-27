package postgres

import (
	"context"
	"fmt"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) ClassroomList(
	ctx context.Context,
	subjectID, search string,
	page, limit int,
) (question.ClassroomQuestionPage, error) {
	pattern := literalLikePattern(search)
	args := []any{subjectID, limit + 1, (page - 1) * limit}
	searchClause := ""
	if search != "" {
		args = append(args, pattern)
		searchClause = ` AND (q.question_code ILIKE $4 ESCAPE '\\' OR qv.text_content ILIKE $4 ESCAPE '\\')`
	}
	rows, err := r.db.Query(ctx, `
		SELECT q.id::text,q.current_version,qv.question_type,qv.text_content,COALESCE(qv.difficulty,'')
		FROM questions q
		JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version
		WHERE q.workflow_status='approved'
		  AND q.subject_id=$1::uuid
		  AND qv.question_type IN ('mcq','true_false')
	`+searchClause+`
		ORDER BY q.updated_at DESC,q.id DESC
		LIMIT $2 OFFSET $3
	`, args...)
	if err != nil {
		return question.ClassroomQuestionPage{}, err
	}
	defer rows.Close()
	out := question.ClassroomQuestionPage{
		Items: []question.ClassroomQuestionSummary{},
		Page:  page,
		Limit: limit,
	}
	for rows.Next() {
		var item question.ClassroomQuestionSummary
		if err = rows.Scan(&item.ID, &item.Version, &item.QuestionType, &item.TextContent, &item.Difficulty); err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) ClassroomBatch(
	ctx context.Context,
	questionIDs []string,
	subjectID string,
) ([]question.ClassroomQuestion, error) {
	rows, err := r.db.Query(ctx, `
		WITH requested AS (
			SELECT id,ordinality
			FROM unnest($1::text[]) WITH ORDINALITY AS requested(id,ordinality)
		)
		SELECT
			q.id::text,
			q.current_version,
			qv.question_type,
			qv.text_content,
			COALESCE(qv.image_asset_id::text,''),
			qv.image_alt,
			qv.options_embedded_in_image,
			qv.correct_option_index,
			qv.explanation,
			COALESCE(qv.difficulty,''),
			ARRAY(
				SELECT qsl.skill_id::text
				FROM question_skill_links qsl
				WHERE qsl.question_id=q.id
				ORDER BY CASE qsl.relation_type WHEN 'main' THEN 0 WHEN 'sub' THEN 1 ELSE 2 END,qsl.skill_id
			)::text[]
		FROM requested
		JOIN questions q ON q.id::text=requested.id
		JOIN question_versions qv
		  ON qv.question_id=q.id AND qv.version=q.current_version
		WHERE q.workflow_status='approved'
		  AND q.subject_id=$2::uuid
		  AND qv.question_type IN ('mcq','true_false')
		ORDER BY requested.ordinality
	`, questionIDs, subjectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := make([]question.ClassroomQuestion, 0, len(questionIDs))
	for rows.Next() {
		var item question.ClassroomQuestion
		if err = rows.Scan(
			&item.ID,
			&item.Version,
			&item.QuestionType,
			&item.TextContent,
			&item.ImageAssetID,
			&item.ImageAlt,
			&item.OptionsEmbeddedInImage,
			&item.CorrectOptionIndex,
			&item.Explanation,
			&item.Difficulty,
			&item.SkillIDs,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if err = r.loadClassroomOptions(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) ClassroomBatchByRefs(
	ctx context.Context,
	refs []question.ReviewRef,
) ([]question.ClassroomQuestion, error) {
	if len(refs) == 0 {
		return []question.ClassroomQuestion{}, nil
	}
	predicate, args := reviewPairPredicate(refs, 1, "qv.question_id", "qv.version")
	sql := `
		SELECT
			qv.question_id::text,
			qv.version,
			qv.question_type,
			qv.text_content,
			COALESCE(qv.image_asset_id::text,''),
			qv.image_alt,
			qv.options_embedded_in_image,
			qv.correct_option_index,
			qv.explanation,
			COALESCE(qv.difficulty,''),
			ARRAY(
				SELECT qsl.skill_id::text
				FROM question_skill_links qsl
				WHERE qsl.question_id=qv.question_id
				ORDER BY CASE qsl.relation_type WHEN 'main' THEN 0 WHEN 'sub' THEN 1 ELSE 2 END,qsl.skill_id
			)::text[]
		FROM question_versions qv
		WHERE (` + predicate + `)
		  AND qv.question_type IN ('mcq','true_false')
	`
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byKey := make(map[string]question.ClassroomQuestion, len(refs))
	for rows.Next() {
		var item question.ClassroomQuestion
		if err = rows.Scan(
			&item.ID,
			&item.Version,
			&item.QuestionType,
			&item.TextContent,
			&item.ImageAssetID,
			&item.ImageAlt,
			&item.OptionsEmbeddedInImage,
			&item.CorrectOptionIndex,
			&item.Explanation,
			&item.Difficulty,
			&item.SkillIDs,
		); err != nil {
			return nil, err
		}
		byKey[fmt.Sprintf("%s:%d", item.ID, item.Version)] = item
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	out := make([]question.ClassroomQuestion, 0, len(refs))
	for _, ref := range refs {
		if item, ok := byKey[fmt.Sprintf("%s:%d", ref.QuestionID, ref.Version)]; ok {
			out = append(out, item)
		}
	}
	if err = r.loadClassroomOptions(ctx, out); err != nil {
		return nil, err
	}
	return out, nil
}

func (r *Repository) loadClassroomOptions(
	ctx context.Context,
	items []question.ClassroomQuestion,
) error {
	if len(items) == 0 {
		return nil
	}
	refs := make([]question.ReviewRef, 0, len(items))
	for _, item := range items {
		refs = append(refs, question.ReviewRef{QuestionID: item.ID, Version: item.Version})
	}
	predicate, args := reviewPairPredicate(refs, 1, "qo.question_id", "qo.version")
	sql := `
		SELECT qo.question_id::text,qo.version,qo.option_index,qo.option_text,COALESCE(qo.asset_id::text,'')
		FROM question_options qo
		WHERE ` + predicate + `
		ORDER BY qo.question_id,qo.version,qo.option_index
	`
	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	index := make(map[string]int, len(items))
	for i := range items {
		index[fmt.Sprintf("%s:%d", items[i].ID, items[i].Version)] = i
	}
	for rows.Next() {
		var questionID, optionText, assetID string
		var version, optionIndex int
		if err = rows.Scan(&questionID, &version, &optionIndex, &optionText, &assetID); err != nil {
			return err
		}
		if position, ok := index[fmt.Sprintf("%s:%d", questionID, version)]; ok {
			items[position].Options = append(items[position].Options, question.Option{
				Index: optionIndex, Text: optionText, AssetID: assetID,
			})
		}
	}
	return rows.Err()
}
