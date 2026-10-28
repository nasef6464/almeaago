package postgres

import (
	"context"
	"database/sql"
	"errors"
	"math"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// schoolAssessmentReporter is deliberately limited to a single row; the SQL
// authorizes the actor and binds learner audience/results to the *same school*.
type schoolAssessmentReporter interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Repository) DirectorAssessmentReport(ctx context.Context, actorUserID, schoolID, assessmentID string) (org.DirectorAssessmentReport, error) {
	return readDirectorAssessmentReport(ctx, r.db, actorUserID, schoolID, assessmentID)
}

func readDirectorAssessmentReport(ctx context.Context, db schoolAssessmentReporter, actorUserID, schoolID, assessmentID string) (org.DirectorAssessmentReport, error) {
	const query = `
WITH permitted_assessment AS (
  SELECT a.id
  FROM assessments a
  JOIN schools s ON s.id=a.owner_school_id
  WHERE a.id=$3::uuid AND a.owner_type='school' AND a.owner_school_id=$1::uuid
    AND s.status='active'
    AND EXISTS (
      SELECT 1 FROM school_memberships staff
      JOIN users staff_user ON staff_user.id=staff.user_id
      JOIN school_membership_permissions p ON p.membership_id=staff.id
      JOIN school_contracts sc ON sc.school_id=staff.school_id
      JOIN school_contract_modules scm ON scm.contract_id=sc.id
      WHERE staff.school_id=$1::uuid AND staff.user_id=$2::uuid
        AND staff.role='school_admin' AND staff.status='active'
        AND staff_user.status='active'
        AND p.permission IN ('SCHOOL_ASSESSMENTS_MANAGE','SCHOOL_REPORTS_AGGREGATE_VIEW')
        AND sc.status='active'
        AND (sc.valid_from IS NULL OR sc.valid_from<=now())
        AND (sc.valid_until IS NULL OR sc.valid_until>=now())
        AND scm.module_code='SCHOOL_ASSESSMENTS' AND scm.enabled=true
    )
), targeted AS (
  SELECT DISTINCT students.user_id
  FROM permitted_assessment permitted
  JOIN assessment_assignments aa ON aa.assessment_id=permitted.id
    AND aa.school_id=$1::uuid AND aa.status IN ('active','closed')
  JOIN school_memberships students ON students.school_id=aa.school_id
    AND students.role='student' AND students.status='active'
  JOIN users student ON student.id=students.user_id AND student.status='active'
  WHERE aa.targets_entire_school
    OR EXISTS (
      SELECT 1 FROM assessment_assignment_users assigned
      WHERE assigned.assignment_id=aa.id AND assigned.user_id=students.user_id
    )
    OR EXISTS (
      SELECT 1 FROM assessment_assignment_classes assigned_class
      JOIN classes c ON c.id=assigned_class.class_id
        AND c.school_id=aa.school_id AND c.status='active'
      JOIN class_memberships cm ON cm.class_id=c.id
        AND cm.user_id=students.user_id AND cm.status='active'
      WHERE assigned_class.assignment_id=aa.id
    )
), latest AS (
  SELECT DISTINCT ON (attempt.student_id) attempt.student_id, result.score, result.passed
  FROM assessment_attempts attempt
  JOIN assessment_results result ON result.attempt_id=attempt.id
    AND result.assessment_id=attempt.assessment_id
    AND result.assessment_version=attempt.assessment_version
    AND result.student_id=attempt.student_id
  JOIN assessment_assignments school_assignment ON school_assignment.id=attempt.assignment_id
    AND school_assignment.school_id=$1::uuid AND school_assignment.assessment_id=$3::uuid
  JOIN targeted learner ON learner.user_id=attempt.student_id
  WHERE attempt.assessment_id=$3::uuid AND attempt.status='submitted'
  ORDER BY attempt.student_id, result.finalized_at DESC, attempt.started_at DESC, attempt.id DESC
), totals AS (
  SELECT COUNT(targeted.user_id)::int AS targeted_count,
    COUNT(latest.student_id)::int AS completed_count,
    COUNT(*) FILTER (WHERE latest.passed)::int AS passed_count,
    ROUND(AVG(latest.score),2)::float8 AS average_score,
    MAX(latest.score)::float8 AS highest_score,
    MIN(latest.score)::float8 AS lowest_score
  FROM targeted LEFT JOIN latest ON latest.student_id=targeted.user_id
)
SELECT totals.targeted_count, totals.completed_count, totals.passed_count,
  totals.average_score, totals.highest_score, totals.lowest_score
FROM permitted_assessment CROSS JOIN totals`
	var report org.DirectorAssessmentReport
	var targeted, completed, passed int
	var avg, highest, lowest sql.NullFloat64
	err := db.QueryRow(ctx, query, schoolID, actorUserID, assessmentID).Scan(&targeted, &completed, &passed, &avg, &highest, &lowest)
	if errors.Is(err, pgx.ErrNoRows) {
		// Do not reveal existence of another school's assessment or an
		// assessment whose authorization was revoked after app-layer check.
		return report, org.ErrNotFound
	}
	if err != nil {
		return report, err
	}
	report.Audience.Targeted = targeted
	report.Participation.Completed = completed
	report.Participation.NotCompleted = targeted - completed
	if avg.Valid {
		score := avg.Float64
		report.Scores.Average = &score
	}
	if highest.Valid {
		score := highest.Float64
		report.Scores.Highest = &score
	}
	if lowest.Valid {
		score := lowest.Float64
		report.Scores.Lowest = &score
	}
	if completed > 0 {
		passRate := math.Round(float64(passed)*10000/float64(completed)) / 100
		report.Scores.PassRate = &passRate
	}
	report.Coverage.Complete = false
	report.Coverage.MissingEvidence = []string{"started_attempts"}
	report.Coverage.Subjects.Completed = completed
	report.Coverage.Subjects.Complete = completed == 0
	if completed > 0 {
		report.Coverage.MissingEvidence = append(report.Coverage.MissingEvidence, "subject_totals")
	}
	// These four arrays stay empty until 005C-2/3 loads evidence from the
	// persisted result dimensions. Never masquerade missing data as analytics.
	report.Subjects = make([]any, 0)
	report.Sections = make([]any, 0)
	report.Skills = make([]any, 0)
	report.SubjectBreakdowns = make([]any, 0)
	return report, nil
}
