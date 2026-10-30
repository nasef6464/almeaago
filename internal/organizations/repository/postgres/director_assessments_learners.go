package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// Named learner evidence has a stricter authorization boundary than the
// aggregate report. Both contract modules and the detailed-read permission
// are checked again inside the data query, so revocation cannot race the API.
const schoolAssessmentLearnerScope = `
WITH permitted_assessment AS (
  SELECT a.id
  FROM assessments a
  JOIN schools s ON s.id=a.owner_school_id
  WHERE a.id=$3::uuid AND a.owner_type='school'
    AND a.owner_school_id=$1::uuid AND s.status='active'
    AND EXISTS (
      SELECT 1 FROM school_memberships staff
      JOIN users staff_user ON staff_user.id=staff.user_id
      JOIN school_membership_permissions permission ON permission.membership_id=staff.id
      JOIN school_contracts contract ON contract.school_id=staff.school_id
      JOIN school_contract_modules assessments_module ON assessments_module.contract_id=contract.id
      JOIN school_contract_modules intelligence_module ON intelligence_module.contract_id=contract.id
      WHERE staff.school_id=$1::uuid AND staff.user_id=$2::uuid
        AND staff.role='school_admin' AND staff.status='active' AND staff_user.status='active'
        AND permission.permission='SCHOOL_REPORTS_DETAILED_VIEW'
        AND contract.status='active'
        AND (contract.valid_from IS NULL OR contract.valid_from<=now())
        AND (contract.valid_until IS NULL OR contract.valid_until>=now())
        AND assessments_module.module_code='SCHOOL_ASSESSMENTS' AND assessments_module.enabled=true
        AND intelligence_module.module_code='SCHOOL_INTELLIGENCE' AND intelligence_module.enabled=true
    )
), targeted AS (
  SELECT DISTINCT learner.user_id, student.name
  FROM permitted_assessment pa
  JOIN assessment_assignments aa ON aa.assessment_id=pa.id
    AND aa.school_id=$1::uuid AND aa.status IN ('active','closed')
  JOIN school_memberships learner ON learner.school_id=aa.school_id
    AND learner.role='student' AND learner.status='active'
  JOIN users student ON student.id=learner.user_id AND student.status='active'
  WHERE aa.targets_entire_school
    OR EXISTS (
      SELECT 1 FROM assessment_assignment_users au
      WHERE au.assignment_id=aa.id AND au.user_id=learner.user_id
    )
    OR EXISTS (
      SELECT 1 FROM assessment_assignment_classes ac
      JOIN classes c ON c.id=ac.class_id AND c.school_id=aa.school_id AND c.status='active'
      JOIN class_memberships cm ON cm.class_id=c.id AND cm.user_id=learner.user_id AND cm.status='active'
      WHERE ac.assignment_id=aa.id
    )
), latest AS (
  SELECT DISTINCT ON (att.student_id)
    att.student_id, att.id AS attempt_id, att.attempt_number,
    result.score::float8 AS score, result.passed, result.finalized_at
  FROM assessment_attempts att
  JOIN assessment_results result ON result.attempt_id=att.id
    AND result.assessment_id=att.assessment_id
    AND result.assessment_version=att.assessment_version
    AND result.student_id=att.student_id
  JOIN assessment_assignments aa ON aa.id=att.assignment_id
    AND aa.school_id=$1::uuid AND aa.assessment_id=$3::uuid AND aa.status IN ('active','closed')
  JOIN targeted learner ON learner.user_id=att.student_id
  WHERE att.assessment_id=$3::uuid AND att.status='submitted'
  ORDER BY att.student_id, result.finalized_at DESC, att.started_at DESC, att.id DESC
)
`

type schoolAssessmentLearnerRow interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Repository) DirectorAssessmentLearners(ctx context.Context, actorUserID, schoolID, assessmentID string, query org.DirectorAssessmentLearnerQuery) (org.DirectorAssessmentLearnerPage, error) {
	return readDirectorAssessmentLearners(ctx, r.db, actorUserID, schoolID, assessmentID, query)
}

func (r *Repository) DirectorAssessmentLearnerResult(ctx context.Context, actorUserID, schoolID, assessmentID, attemptID string) (org.DirectorAssessmentLearnerResult, error) {
	return readDirectorAssessmentLearnerResult(ctx, r.db, actorUserID, schoolID, assessmentID, attemptID)
}

func readDirectorAssessmentLearners(ctx context.Context, db schoolAssessmentLearnerRow, actorUserID, schoolID, assessmentID string, query org.DirectorAssessmentLearnerQuery) (org.DirectorAssessmentLearnerPage, error) {
	const sql = schoolAssessmentLearnerScope + `,
filtered AS (
  SELECT target.user_id, target.name, latest.attempt_id, latest.attempt_number,
    latest.score, latest.passed, latest.finalized_at
  FROM targeted target LEFT JOIN latest ON latest.student_id=target.user_id
  WHERE ($4='all'
    OR ($4='completed' AND latest.attempt_id IS NOT NULL)
    OR ($4='not_completed' AND latest.attempt_id IS NULL)
    OR ($4='needs_support' AND latest.passed=false))
    AND ($5='' OR target.name ILIKE '%'||$5||'%' ESCAPE '\'
      OR target.user_id::text ILIKE '%'||$5||'%' ESCAPE '\')
), page AS (
  SELECT * FROM filtered ORDER BY name, user_id LIMIT $6 OFFSET (($7-1)*$6)
)
SELECT (SELECT COUNT(*)::int FROM filtered),
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'studentId',p.user_id::text,'name',p.name,
    'result',CASE WHEN p.attempt_id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',p.attempt_id::text,'score',p.score,'passed',p.passed,
      'date',p.finalized_at,'attemptNumber',p.attempt_number) END
  ) ORDER BY p.name,p.user_id) FROM page p),'[]'::jsonb)
FROM permitted_assessment LIMIT 1`
	var result org.DirectorAssessmentLearnerPage
	var rows []byte
	// PostgreSQL LIKE wildcard characters in a name/ID search are literal.
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(query.Search)
	err := db.QueryRow(ctx, sql, schoolID, actorUserID, assessmentID, query.Status, escaped, query.Limit, query.Page).Scan(&result.Pagination.Total, &rows)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, org.ErrNotFound
	}
	if err != nil {
		return result, err
	}
	if err = json.Unmarshal(rows, &result.Learners); err != nil {
		return result, err
	}
	result.Pagination.Page = query.Page
	result.Pagination.Limit = query.Limit
	result.Pagination.TotalPages = (result.Pagination.Total + query.Limit - 1) / query.Limit
	return result, nil
}

func readDirectorAssessmentLearnerResult(ctx context.Context, db schoolAssessmentLearnerRow, actorUserID, schoolID, assessmentID, attemptID string) (org.DirectorAssessmentLearnerResult, error) {
	const sql = schoolAssessmentLearnerScope + `
SELECT att.id::text, att.student_id::text, result.score::float8, result.passed,
  att.attempt_number, result.finalized_at, result.total_questions,
  result.correct_answers, result.wrong_answers, result.unanswered, result.time_spent_seconds,
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',s.id::text,'name',s.title,'score',rs.score::float8,
    'totalQuestions',rs.total_questions,'correctAnswers',rs.correct_answers,
    'wrongAnswers',rs.wrong_answers,'unanswered',rs.unanswered
    ) ORDER BY s.sort_order,s.id)
    FROM assessment_result_sections rs
    JOIN assessment_sections s ON s.id=rs.section_id AND s.assessment_id=rs.assessment_id
      AND s.assessment_version=rs.assessment_version
    WHERE rs.attempt_id=att.id),'[]'::jsonb),
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'id',skill.id::text,'name',skill.name,'score',skill_result.score::float8,
    'totalQuestions',skill_result.total_questions,'correctAnswers',skill_result.correct_answers,
    'wrongAnswers',skill_result.wrong_answers,'unanswered',skill_result.unanswered
    ) ORDER BY skill.name,skill.id)
    FROM assessment_result_skill_summaries skill_result
    JOIN skills skill ON skill.id=skill_result.skill_id
    WHERE skill_result.attempt_id=att.id),'[]'::jsonb)
FROM permitted_assessment pa
JOIN assessment_attempts att ON att.id=$4::uuid AND att.assessment_id=pa.id
  AND att.status='submitted'
JOIN assessment_assignments aa ON aa.id=att.assignment_id
  AND aa.school_id=$1::uuid AND aa.assessment_id=pa.id AND aa.status IN ('active','closed')
JOIN targeted target ON target.user_id=att.student_id
JOIN assessment_results result ON result.attempt_id=att.id
  AND result.assessment_id=att.assessment_id AND result.assessment_version=att.assessment_version
  AND result.student_id=att.student_id
LIMIT 1`
	var detail org.DirectorAssessmentLearnerResult
	var date time.Time
	var sections, skills []byte
	err := db.QueryRow(ctx, sql, schoolID, actorUserID, assessmentID, attemptID).Scan(
		&detail.Result.ID, &detail.Result.StudentID, &detail.Result.Score, &detail.Result.Passed,
		&detail.Result.AttemptNumber, &date, &detail.Result.TotalQuestions,
		&detail.Result.CorrectAnswers, &detail.Result.WrongAnswers, &detail.Result.Unanswered,
		&detail.Result.TimeSpentSeconds, &sections, &skills)
	if errors.Is(err, pgx.ErrNoRows) {
		return detail, org.ErrNotFound
	}
	if err != nil {
		return detail, err
	}
	detail.Result.Date = date.UTC().Format(time.RFC3339)
	if err = json.Unmarshal(sections, &detail.Result.Sections); err != nil {
		return detail, err
	}
	if err = json.Unmarshal(skills, &detail.Result.Skills); err != nil {
		return detail, err
	}
	return detail, nil
}
