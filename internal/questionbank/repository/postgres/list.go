package postgres

import (
	"context"
	"fmt"
	"strings"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (r *Repository) List(ctx context.Context, query question.ListQuery) (question.QuestionPage, error) {
	clauses, args := buildListFilters(query)
	limitPlaceholder := len(args) + 1
	offsetPlaceholder := len(args) + 2
	args = append(args, query.Limit+1, (query.Page-1)*query.Limit)

	sql := `
		SELECT
			q.id::text,
			q.question_code,
			q.current_version,
			q.workflow_status,
			q.owner_type,
			COALESCE(q.owner_id::text,''),
			q.path_id::text,
			q.subject_id::text,
			COALESCE(q.assigned_teacher_id::text,''),
			qv.question_type,
			COALESCE(qv.difficulty,''),
			COALESCE(qv.exam_type,''),
			COALESCE(qv.source,''),
			qv.source_year,
			qv.image_asset_id IS NOT NULL,
			NULLIF(btrim(COALESCE(qv.video_url,'')),'') IS NOT NULL,
			btrim(qv.explanation) <> '',
			COALESCE((
				SELECT qsl.skill_id::text
				FROM question_skill_links qsl
				WHERE qsl.question_id=q.id AND qsl.relation_type='main'
				ORDER BY qsl.skill_id
				LIMIT 1
			),''),
			ARRAY(
				SELECT qsl.skill_id::text
				FROM question_skill_links qsl
				WHERE qsl.question_id=q.id
				ORDER BY CASE qsl.relation_type WHEN 'main' THEN 0 WHEN 'sub' THEN 1 ELSE 2 END, qsl.skill_id
			),
			q.updated_at
		FROM questions q
		JOIN question_versions qv
		  ON qv.question_id=q.id AND qv.version=q.current_version
		WHERE ` + strings.Join(clauses, " AND ") + fmt.Sprintf(`
		ORDER BY q.updated_at DESC, q.id DESC
		LIMIT $%d OFFSET $%d
	`, limitPlaceholder, offsetPlaceholder)

	rows, err := r.db.Query(ctx, sql, args...)
	if err != nil {
		return question.QuestionPage{}, err
	}
	defer rows.Close()

	items := make([]question.QuestionSummary, 0, query.Limit+1)
	for rows.Next() {
		var row question.QuestionSummary
		if err := rows.Scan(
			&row.ID,
			&row.QuestionCode,
			&row.CurrentVersion,
			&row.WorkflowStatus,
			&row.OwnerType,
			&row.OwnerID,
			&row.PathID,
			&row.SubjectID,
			&row.AssignedTeacherID,
			&row.QuestionType,
			&row.Difficulty,
			&row.ExamType,
			&row.Source,
			&row.SourceYear,
			&row.HasImage,
			&row.HasVideo,
			&row.HasExplanation,
			&row.MainSkillID,
			&row.SkillIDs,
			&row.UpdatedAt,
		); err != nil {
			return question.QuestionPage{}, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return question.QuestionPage{}, err
	}

	hasMore := len(items) > query.Limit
	if hasMore {
		items = items[:query.Limit]
	}
	return question.QuestionPage{
		Items:   items,
		Page:    query.Page,
		Limit:   query.Limit,
		HasMore: hasMore,
	}, nil
}

func (r *Repository) Coverage(ctx context.Context, query question.CoverageQuery) (question.Coverage, error) {
	clauses, args := buildListFilters(query.ListQuery)
	filtered := `
		SELECT q.id, q.workflow_status
		FROM questions q
		JOIN question_versions qv
		  ON qv.question_id=q.id AND qv.version=q.current_version
		WHERE ` + strings.Join(clauses, " AND ")

	var result question.Coverage
	aggregateSQL := `
		WITH filtered AS (` + filtered + `)
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE workflow_status='approved')::int,
			count(*) FILTER (WHERE workflow_status='pending_review')::int,
			count(*) FILTER (
				WHERE
					NOT EXISTS (
						SELECT 1 FROM question_skill_links qsl
						WHERE qsl.question_id=filtered.id
					)
					OR (
						EXISTS (
							SELECT 1
							FROM question_skill_links main_link
							JOIN skills child
							  ON child.parent_skill_id=main_link.skill_id
							 AND child.kind='sub'
							 AND child.status='active'
							WHERE main_link.question_id=filtered.id
							  AND main_link.relation_type='main'
						)
						AND NOT EXISTS (
							SELECT 1 FROM question_skill_links sub_link
							WHERE sub_link.question_id=filtered.id
							  AND sub_link.relation_type='sub'
						)
					)
			)::int,
			(
				SELECT count(DISTINCT qsl.skill_id)::int
				FROM question_skill_links qsl
				JOIN filtered f ON f.id=qsl.question_id
				WHERE qsl.relation_type='main'
			),
			(
				SELECT count(DISTINCT qsl.skill_id)::int
				FROM question_skill_links qsl
				JOIN filtered f ON f.id=qsl.question_id
				WHERE qsl.relation_type='sub'
			)
		FROM filtered
	`
	if err := r.db.QueryRow(ctx, aggregateSQL, args...).Scan(
		&result.QuestionsTotal,
		&result.Approved,
		&result.PendingReview,
		&result.Unlinked,
		&result.MainSkillCoverage,
		&result.SubSkillCoverage,
	); err != nil {
		return question.Coverage{}, err
	}

	skillArgs := append([]any(nil), args...)
	limitPlaceholder := len(skillArgs) + 1
	offsetPlaceholder := len(skillArgs) + 2
	skillArgs = append(skillArgs, query.SkillLimit+1, (query.SkillPage-1)*query.SkillLimit)
	skillSQL := `
		WITH filtered AS (` + filtered + `)
		SELECT
			qsl.skill_id::text,
			qsl.relation_type,
			count(DISTINCT qsl.question_id)::int AS question_count
		FROM question_skill_links qsl
		JOIN filtered f ON f.id=qsl.question_id
		GROUP BY qsl.skill_id, qsl.relation_type
		ORDER BY question_count DESC, qsl.skill_id
	` + fmt.Sprintf(" LIMIT $%d OFFSET $%d", limitPlaceholder, offsetPlaceholder)

	rows, err := r.db.Query(ctx, skillSQL, skillArgs...)
	if err != nil {
		return question.Coverage{}, err
	}
	defer rows.Close()

	skills := make([]question.SkillCoverage, 0, query.SkillLimit+1)
	for rows.Next() {
		var item question.SkillCoverage
		if err := rows.Scan(&item.SkillID, &item.RelationType, &item.QuestionCount); err != nil {
			return question.Coverage{}, err
		}
		skills = append(skills, item)
	}
	if err := rows.Err(); err != nil {
		return question.Coverage{}, err
	}

	result.SkillPage = query.SkillPage
	result.SkillLimit = query.SkillLimit
	result.SkillsHasMore = len(skills) > query.SkillLimit
	if result.SkillsHasMore {
		skills = skills[:query.SkillLimit]
	}
	result.Skills = skills
	return result, nil
}

func buildListFilters(query question.ListQuery) ([]string, []any) {
	clauses := []string{"TRUE"}
	args := []any{}
	add := func(format string, value any) {
		args = append(args, value)
		clauses = append(clauses, fmt.Sprintf(format, len(args)))
	}

	if query.TeacherScopeUserID != "" {
		args = append(args, query.TeacherScopeUserID)
		index := len(args)
		clauses = append(clauses, fmt.Sprintf(
			"(q.assigned_teacher_id=$%d::uuid OR (q.owner_type='teacher' AND q.owner_id=$%d::uuid))",
			index,
			index,
		))
		if !query.TeacherScopePrevalidated {
			clauses = append(clauses, fmt.Sprintf(`(
				EXISTS(
					SELECT 1 FROM content_trainer_path_scopes ps
					JOIN paths p ON p.id=ps.path_id
					WHERE ps.user_id=$%d::uuid AND ps.path_id=q.path_id AND p.status='active'
				)
				OR EXISTS(
					SELECT 1 FROM content_trainer_subject_scopes ss
					JOIN subjects s ON s.id=ss.subject_id
					WHERE ss.user_id=$%d::uuid AND ss.subject_id=q.subject_id
					  AND s.path_id=q.path_id AND s.status='active'
				)
			)`, index, index))

		}
	}
	if query.Search != "" {
		pattern := literalLikePattern(query.Search)
		args = append(args, pattern)
		index := len(args)
		clauses = append(clauses, fmt.Sprintf(
			"(q.question_code ILIKE $%d ESCAPE '\\' OR qv.text_content ILIKE $%d ESCAPE '\\' OR qv.explanation ILIKE $%d ESCAPE '\\' OR q.id::text ILIKE $%d ESCAPE '\\')",
			index, index, index, index,
		))
	}
	if query.PathID != "" {
		add("q.path_id=$%d::uuid", query.PathID)
	}
	if query.SubjectID != "" {
		add("q.subject_id=$%d::uuid", query.SubjectID)
	}
	if query.MainSkillID != "" {
		add("EXISTS (SELECT 1 FROM question_skill_links qsl WHERE qsl.question_id=q.id AND qsl.skill_id=$%d::uuid AND qsl.relation_type='main')", query.MainSkillID)
	}
	if len(query.SkillIDs) > 0 {
		parts := make([]string, 0, len(query.SkillIDs))
		for _, skillID := range query.SkillIDs {
			args = append(args, skillID)
			parts = append(parts, fmt.Sprintf("$%d::uuid", len(args)))
		}
		clauses = append(clauses, "EXISTS (SELECT 1 FROM question_skill_links qsl WHERE qsl.question_id=q.id AND qsl.skill_id IN ("+strings.Join(parts, ",")+"))")
	}
	if query.Linked != nil {
		if *query.Linked {
			clauses = append(clauses, "EXISTS (SELECT 1 FROM question_skill_links qsl WHERE qsl.question_id=q.id)")
		} else {
			clauses = append(clauses, "NOT EXISTS (SELECT 1 FROM question_skill_links qsl WHERE qsl.question_id=q.id)")
		}
	}
	if query.Difficulty != "" {
		add("qv.difficulty=$%d", query.Difficulty)
	}
	if query.QuestionType != "" {
		add("qv.question_type=$%d", string(query.QuestionType))
	}
	if query.ExamType != "" {
		add("qv.exam_type=$%d", query.ExamType)
	}
	if query.Source != "" {
		add("qv.source=$%d", query.Source)
	}
	if query.Year != nil {
		add("qv.source_year=$%d", *query.Year)
	}
	if query.WorkflowStatus != "" {
		add("q.workflow_status=$%d", string(query.WorkflowStatus))
	}
	if query.WithVideo != nil {
		if *query.WithVideo {
			clauses = append(clauses, "NULLIF(btrim(COALESCE(qv.video_url,'')),'') IS NOT NULL")
		} else {
			clauses = append(clauses, "NULLIF(btrim(COALESCE(qv.video_url,'')),'') IS NULL")
		}
	}
	if query.WithExplanation != nil {
		if *query.WithExplanation {
			clauses = append(clauses, "btrim(qv.explanation) <> ''")
		} else {
			clauses = append(clauses, "btrim(qv.explanation) = ''")
		}
	}
	return clauses, args
}

func literalLikePattern(value string) string {
	replacer := strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_")
	return "%" + replacer.Replace(value) + "%"
}
