package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Resolve both supported identifiers before applying the normal direct policy.
func (r *Repository) GetSingleShotAccessContext(ctx context.Context, identifier string) (assessment.AccessContext, bool, error) {
	var id string
	var strict bool
	err := r.db.QueryRow(ctx, `SELECT a.id::text, (v.assessment_kind='mock' AND v.mock_presentation_mode='qiyas_strict' AND COALESCE(v.mock_strict_section_lock,false)) FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.published_version WHERE (a.id::text=$1 OR a.assessment_code=$1) AND a.workflow_status='approved' AND a.is_published AND a.is_visible`, identifier).Scan(&id, &strict)
	if err != nil {
		return assessment.AccessContext{}, false, mapError(err)
	}
	scope, err := r.GetPublishedAccessContext(ctx, id)
	return scope, strict, err
}

// Retry returns only a completed result belonging to this student AND the
// requested assessment. A key collision never reveals the other attempt.
func (r *Repository) FindSingleShotResult(ctx context.Context, student, identifier, key string) (assessment.ResultDetail, bool, error) {
	var id, owner, status string
	var sameAssessment bool
	err := r.db.QueryRow(ctx, `SELECT t.id::text,t.student_id::text,t.status,(a.id::text=$2 OR a.assessment_code=$2) FROM assessment_attempts t JOIN assessments a ON a.id=t.assessment_id WHERE (t.submission_key=$1 OR t.start_key=$1) ORDER BY (t.submission_key=$1) DESC NULLS LAST LIMIT 1`, key, identifier).Scan(&id, &owner, &status, &sameAssessment)
	if errors.Is(err, pgx.ErrNoRows) {
		return assessment.ResultDetail{}, false, nil
	}
	if err != nil {
		return assessment.ResultDetail{}, false, err
	}
	if owner != student || !sameAssessment {
		return assessment.ResultDetail{}, false, assessment.ErrConflict
	}
	if status != "submitted" {
		return assessment.ResultDetail{}, false, nil
	}
	detail, err := r.GetResultDetail(ctx, student, id)
	return detail, err == nil, err
}
