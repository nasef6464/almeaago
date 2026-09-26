package postgres

import (
	"context"
	"fmt"
	"strings"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func reviewPairPredicate(refs []question.ReviewRef, start int, questionExpr, versionExpr string) (string, []any) {
	parts := make([]string, 0, len(refs))
	args := make([]any, 0, len(refs)*2)
	position := start
	for _, ref := range refs {
		parts = append(parts, fmt.Sprintf("(%s=$%d::uuid AND %s=$%d)", questionExpr, position, versionExpr, position+1))
		args = append(args, ref.QuestionID, ref.Version)
		position += 2
	}
	return strings.Join(parts, " OR "), args
}

func (r *Repository) ReviewBatch(ctx context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	if len(refs) == 0 {
		return []question.ReviewProjection{}, nil
	}
	predicate, args := reviewPairPredicate(refs, 1, "qv.question_id", "qv.version")
	rows, err := r.db.Query(ctx, `
		SELECT qv.question_id::text,qv.version,qv.question_type,qv.text_content,
		       COALESCE(qv.image_asset_id::text,''),qv.image_alt,qv.options_embedded_in_image,
		       qv.correct_option_index,qv.explanation,qv.hint,qv.solving_strategy,
		       COALESCE(qv.video_url,''),COALESCE(qv.difficulty,'')
		FROM question_versions qv
		WHERE `+predicate, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	byKey := make(map[string]*question.ReviewProjection, len(refs))
	for rows.Next() {
		var projection question.ReviewProjection
		if err = rows.Scan(
			&projection.ID, &projection.Version, &projection.QuestionType, &projection.TextContent,
			&projection.ImageAssetID, &projection.ImageAlt, &projection.OptionsEmbeddedInImage,
			&projection.CorrectOptionIndex, &projection.Explanation, &projection.Hint,
			&projection.SolvingStrategy, &projection.VideoURL, &projection.Difficulty,
		); err != nil {
			return nil, err
		}
		key := fmt.Sprintf("%s:%d", projection.ID, projection.Version)
		copy := projection
		byKey[key] = &copy
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	optionPredicate, optionArgs := reviewPairPredicate(refs, 1, "qo.question_id", "qo.version")
	optionRows, err := r.db.Query(ctx, `
		SELECT qo.question_id::text,qo.version,qo.option_index,qo.option_text,COALESCE(qo.asset_id::text,'')
		FROM question_options qo
		WHERE `+optionPredicate+`
		ORDER BY qo.question_id,qo.version,qo.option_index
	`, optionArgs...)
	if err != nil {
		return nil, err
	}
	defer optionRows.Close()
	for optionRows.Next() {
		var id, text, asset string
		var version, index int
		if err = optionRows.Scan(&id, &version, &index, &text, &asset); err != nil {
			return nil, err
		}
		if projection := byKey[fmt.Sprintf("%s:%d", id, version)]; projection != nil {
			projection.Options = append(projection.Options, question.Option{Index: index, Text: text, AssetID: asset})
		}
	}
	if err = optionRows.Err(); err != nil {
		return nil, err
	}

	out := make([]question.ReviewProjection, 0, len(refs))
	for _, ref := range refs {
		if projection := byKey[fmt.Sprintf("%s:%d", ref.QuestionID, ref.Version)]; projection != nil {
			out = append(out, *projection)
		}
	}
	return out, nil
}
