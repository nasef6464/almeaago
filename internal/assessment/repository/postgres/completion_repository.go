package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func normalizeTaxonomyCode(input string) (clean, normalized string) {
	clean = strings.TrimSpace(input)
	normalized = strings.ToLower(clean)
	normalized = strings.TrimPrefix(normalized, "p_")
	normalized = strings.TrimPrefix(normalized, "p-")
	normalized = strings.TrimPrefix(normalized, "s_")
	normalized = strings.TrimPrefix(normalized, "s-")
	return clean, normalized
}

func (r *Repository) ResolvePathID(ctx context.Context, input string) (string, error) {
	clean, normalized := normalizeTaxonomyCode(input)
	if clean == "" {
		return "", assessment.ErrNotFound
	}

	var id string
	err := r.db.QueryRow(ctx, `
		SELECT id::text
		FROM paths
		WHERE (id::text = $1 OR lower(code) = lower($1) OR lower(code) = $2)
		  AND status = 'active'
		LIMIT 1
	`, clean, normalized).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", assessment.ErrNotFound
	}
	return id, err
}

func (r *Repository) ResolveSubjectID(ctx context.Context, pathID, input string) (string, error) {
	clean, normalized := normalizeTaxonomyCode(input)
	if clean == "" {
		return "", nil
	}
	var id string
	err := r.db.QueryRow(ctx, `
		SELECT id::text
		FROM subjects
		WHERE path_id = $1::uuid
		  AND (id::text = $2 OR lower(code) = lower($2) OR lower(code) = $3)
		  AND status = 'active'
		LIMIT 1
	`, pathID, clean, normalized).Scan(&id)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", nil
	}
	return id, err
}

func (r *Repository) GetStudentCompletedQuizIDs(ctx context.Context, studentID string) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT assessment_id::text
		FROM assessment_attempts
		WHERE student_id = $1::uuid
		  AND status = 'submitted'
	`, studentID)
	if err != nil {
		return []string{}, err
	}
	defer rows.Close()

	ids := make([]string, 0)
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (r *Repository) GetTrainingAndTestsCompletion(
	ctx context.Context,
	pathID, subjectID string,
	completedQuizIDs []string,
) (training assessment.CompletionBucket, tests assessment.CompletionBucket, err error) {
	rows, err := r.db.Query(ctx, `
		WITH scoped_quizzes AS (
			SELECT DISTINCT
				a.id AS assessment_id,
				COALESCE(
					p.slot,
					CASE 
						WHEN v.normal_mode = 'practice' THEN 'training'
						WHEN v.normal_mode = 'exam' THEN 'tests'
					END
				) AS slot
			FROM assessments a
			JOIN assessment_versions v ON v.assessment_id = a.id AND v.version = a.published_version
			LEFT JOIN assessment_learning_placements p 
				ON p.assessment_id = a.id 
			   AND p.assessment_version = a.published_version
			   AND p.is_visible = true
			   AND p.slot IN ('training', 'tests')
			WHERE a.owner_type = 'platform'
			  AND a.workflow_status = 'approved'
			  AND a.is_published = true
			  AND a.is_visible = true
			  AND v.version_status = 'published'
			  AND v.assessment_kind = 'normal'
			  AND (
				(p.id IS NOT NULL AND p.path_id = $1::uuid AND (NULLIF($2, '')::uuid IS NULL OR p.subject_id = NULLIF($2, '')::uuid))
				OR
				(p.id IS NULL AND v.path_id = $1::uuid AND (NULLIF($2, '')::uuid IS NULL OR v.subject_id = NULLIF($2, '')::uuid))
			  )
		)
		SELECT 
			slot,
			count(assessment_id)::int AS total,
			count(assessment_id) FILTER (WHERE assessment_id::text = ANY($3::text[]))::int AS completed
		FROM scoped_quizzes
		WHERE slot IN ('training', 'tests')
		GROUP BY slot
	`, pathID, subjectID, completedQuizIDs)
	if err != nil {
		return training, tests, err
	}
	defer rows.Close()

	for rows.Next() {
		var slot string
		var total, completed int
		if err := rows.Scan(&slot, &total, &completed); err != nil {
			return training, tests, err
		}
		bucket := assessment.CompletionBucket{
			Total:      total,
			Completed:  completed,
			Percentage: assessment.CalcPercentage(completed, total),
		}
		if slot == "training" {
			training = bucket
		} else if slot == "tests" {
			tests = bucket
		}
	}
	return training, tests, rows.Err()
}

func (r *Repository) GetMockExamsCompletion(
	ctx context.Context,
	pathID string,
	completedQuizIDs []string,
) (assessment.CompletionBucket, error) {
	var total, completed int
	err := r.db.QueryRow(ctx, `
		SELECT
			count(DISTINCT a.id)::int AS total,
			count(DISTINCT a.id) FILTER (WHERE a.id::text = ANY($2::text[]))::int AS completed
		FROM assessments a
		JOIN assessment_versions v ON v.assessment_id = a.id AND v.version = a.published_version
		WHERE a.owner_type = 'platform'
		  AND a.workflow_status = 'approved'
		  AND a.is_published = true
		  AND a.is_visible = true
		  AND v.version_status = 'published'
		  AND v.assessment_kind = 'mock'
		  AND v.path_id = $1::uuid
	`, pathID, completedQuizIDs).Scan(&total, &completed)
	if err != nil {
		return assessment.CompletionBucket{}, err
	}
	return assessment.CompletionBucket{
		Total:      total,
		Completed:  completed,
		Percentage: assessment.CalcPercentage(completed, total),
	}, nil
}

func (r *Repository) GetFoundationCompletion(
	ctx context.Context,
	studentID, pathID, subjectID string,
	completedQuizIDs []string,
) (map[string]assessment.TopicCompletionDetail, []string, error) {
	foundation := make(map[string]assessment.TopicCompletionDetail)
	locked := make([]string, 0)

	if subjectID == "" {
		return foundation, locked, nil
	}

	rootRows, err := r.db.Query(ctx, `
		SELECT id::text, is_locked
		FROM foundation_topics
		WHERE path_id = $1::uuid
		  AND subject_id = $2::uuid
		  AND parent_topic_id IS NULL
		  AND is_visible = true
		  AND status = 'active'
		ORDER BY sort_order, id
	`, pathID, subjectID)
	if err != nil {
		return foundation, locked, err
	}
	defer rootRows.Close()

	for rootRows.Next() {
		var id string
		var isLocked bool
		if err := rootRows.Scan(&id, &isLocked); err != nil {
			return foundation, locked, err
		}
		if isLocked {
			locked = append(locked, id)
		}
		foundation[id] = assessment.TopicCompletionDetail{
			Total: 0, Completed: 0, Percent: 0, Complete: false,
		}
	}

	unitsRows, err := r.db.Query(ctx, `
		WITH RECURSIVE topic_tree AS (
			SELECT id, id AS root_id
			FROM foundation_topics
			WHERE path_id = $1::uuid
			  AND subject_id = $2::uuid
			  AND parent_topic_id IS NULL
			  AND is_visible = true
			  AND status = 'active'
			UNION ALL
			SELECT c.id, t.root_id
			FROM foundation_topics c
			JOIN topic_tree t ON c.parent_topic_id = t.id
			WHERE c.is_visible = true
			  AND c.status = 'active'
		),
		topic_units AS (
			SELECT t.root_id, tl.lesson_id::text AS unit_id,
				   EXISTS (
					   SELECT 1 FROM lesson_progress lp
					   WHERE lp.lesson_id = tl.lesson_id
						 AND lp.student_id = $3::uuid
						 AND lp.status = 'completed'
				   ) AS is_completed
			FROM topic_tree t
			JOIN topic_lessons tl ON tl.topic_id = t.id
			JOIN lessons l ON l.id = tl.lesson_id
			WHERE l.status = 'active'

			UNION

			SELECT t.root_id, p.assessment_id::text AS unit_id,
				   (p.assessment_id::text = ANY($4::text[])) AS is_completed
			FROM topic_tree t
			JOIN assessment_learning_placements p 
			  ON p.topic_id = t.id 
			 AND p.slot = 'foundation' 
			 AND p.is_visible = true
			JOIN assessments a ON a.id = p.assessment_id
			WHERE a.is_published = true 
			  AND a.is_visible = true 
			  AND a.workflow_status = 'approved'
		)
		SELECT 
			root_id::text,
			count(DISTINCT unit_id)::int AS total,
			count(DISTINCT unit_id) FILTER (WHERE is_completed)::int AS completed
		FROM topic_units
		GROUP BY root_id
	`, pathID, subjectID, studentID, completedQuizIDs)
	if err != nil {
		return foundation, locked, err
	}
	defer unitsRows.Close()

	for unitsRows.Next() {
		var rootID string
		var total, completed int
		if err := unitsRows.Scan(&rootID, &total, &completed); err != nil {
			return foundation, locked, err
		}
		pct := assessment.CalcPercentage(completed, total)
		foundation[rootID] = assessment.TopicCompletionDetail{
			Total:     total,
			Completed: completed,
			Percent:   pct,
			Complete:  total > 0 && completed == total,
		}
	}

	return foundation, locked, nil
}
