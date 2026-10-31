package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type schoolAssessmentDefinitionReader interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}

func (r *Repository) DirectorAssessmentDefinition(ctx context.Context, actorUserID, schoolID, assessmentID string) (org.DirectorAssessmentDefinition, error) {
	return readDirectorAssessmentDefinition(ctx, r.db, actorUserID, schoolID, assessmentID)
}

// One SQL statement authorizes the active director, school contract and owner
// before exposing the pinned authoring snapshot. Reading the assignment and
// questions through the permitted assessment prevents cross-school leakage.
func readDirectorAssessmentDefinition(ctx context.Context, db schoolAssessmentDefinitionReader, actorUserID, schoolID, assessmentID string) (org.DirectorAssessmentDefinition, error) {
	const query = `
WITH permitted AS (
  SELECT a.id,a.current_version,a.is_published,v.title,v.path_id,v.subject_id,
         v.max_attempts,v.passing_score::float8 AS passing_score,
         COALESCE(v.time_limit_seconds,0) AS time_limit_seconds,
         COALESCE(v.option_layout,'auto') AS option_layout,
         COALESCE(v.randomize_questions,true) AS randomize_questions,
         COALESCE(v.randomize_options,false) AS randomize_options,
         COALESCE(v.show_progress_bar,true) AS show_progress_bar,
         COALESCE(v.require_answer_before_next,false) AS require_answer_before_next,
         COALESCE(v.allow_question_review,true) AS allow_question_review,
         COALESCE(v.show_answers,true) AS show_answers,
         COALESCE(v.show_results_report,true) AS show_results_report,
         COALESCE(v.show_explanations,true) AS show_explanations,
         aa.id AS assignment_id,aa.targets_entire_school
  FROM assessments a
  JOIN schools s ON s.id=a.owner_school_id AND s.status='active'
  JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.current_version
  JOIN assessment_assignments aa ON aa.assessment_id=a.id
    AND aa.school_id=$1::uuid AND aa.status IN ('active','closed')
  WHERE a.id=$3::uuid AND a.owner_type='school' AND a.owner_school_id=$1::uuid
    AND EXISTS (
      SELECT 1 FROM school_memberships staff
      JOIN users u ON u.id=staff.user_id
      JOIN school_membership_permissions p ON p.membership_id=staff.id
      JOIN school_contracts contract ON contract.school_id=staff.school_id
      JOIN school_contract_modules module ON module.contract_id=contract.id
      WHERE staff.school_id=$1::uuid AND staff.user_id=$2::uuid
        AND staff.role='school_admin' AND staff.status='active' AND u.status='active'
        AND p.permission='SCHOOL_ASSESSMENTS_MANAGE'
        AND contract.status='active'
        AND (contract.valid_from IS NULL OR contract.valid_from<=now())
        AND (contract.valid_until IS NULL OR contract.valid_until>=now())
        AND module.module_code='SCHOOL_ASSESSMENTS' AND module.enabled=true
    )
  ORDER BY aa.created_at DESC,aa.id DESC
  LIMIT 1
)
SELECT permitted.id::text,permitted.current_version,permitted.is_published,
       permitted.title,permitted.path_id::text,permitted.subject_id::text,
       permitted.max_attempts,permitted.passing_score,permitted.time_limit_seconds,
       permitted.option_layout,permitted.randomize_questions,permitted.randomize_options,
       permitted.show_progress_bar,permitted.require_answer_before_next,
       permitted.allow_question_review,permitted.show_answers,
       permitted.show_results_report,permitted.show_explanations,
       permitted.targets_entire_school,
       COALESCE((SELECT array_agg(q.question_id::text ORDER BY q.sort_order,q.question_id)
                 FROM assessment_version_questions q
                 WHERE q.assessment_id=permitted.id AND q.assessment_version=permitted.current_version),ARRAY[]::text[]),
       COALESCE((SELECT array_agg(q.question_version ORDER BY q.sort_order,q.question_id)
                 FROM assessment_version_questions q
                 WHERE q.assessment_id=permitted.id AND q.assessment_version=permitted.current_version),ARRAY[]::integer[]),
       COALESCE((SELECT array_agg(c.class_id::text ORDER BY c.class_id)
                 FROM assessment_assignment_classes c WHERE c.assignment_id=permitted.assignment_id),ARRAY[]::text[]),
       COALESCE((SELECT array_agg(u.user_id::text ORDER BY u.user_id)
                 FROM assessment_assignment_users u WHERE u.assignment_id=permitted.assignment_id),ARRAY[]::text[])
FROM permitted`
	var result org.DirectorAssessmentDefinition
	var maxAttempts, timeLimitSeconds int
	var passingScore float64
	var optionLayout string
	var randomizeQuestions, randomizeOptions, showProgressBar, requireAnswerBeforeNext bool
	var allowQuestionReview, showAnswers, showResultsReport, showExplanations bool
	var entireSchool bool
	var questionVersions []int32
	err := db.QueryRow(ctx, query, schoolID, actorUserID, assessmentID).Scan(
		&result.AssessmentID, &result.Version, &result.IsPublished,
		&result.Title, &result.PathID, &result.SubjectID,
		&maxAttempts, &passingScore, &timeLimitSeconds, &optionLayout,
		&randomizeQuestions, &randomizeOptions, &showProgressBar, &requireAnswerBeforeNext,
		&allowQuestionReview, &showAnswers, &showResultsReport, &showExplanations,
		&entireSchool, &result.QuestionIDs, &questionVersions, &result.ClassIDs, &result.StudentIDs,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return org.DirectorAssessmentDefinition{}, org.ErrNotFound
	}
	if err != nil {
		return org.DirectorAssessmentDefinition{}, err
	}
	result.QuestionVersions = make([]int, len(questionVersions))
	for index, version := range questionVersions {
		result.QuestionVersions[index] = int(version)
	}
	minutes := timeLimitSeconds / 60
	result.Settings = org.DirectorAssessmentSettings{
		MaxAttempts: &maxAttempts, PassingScore: &passingScore, TimeLimitMinutes: &minutes,
		OptionLayout: &optionLayout, RandomizeQuestions: &randomizeQuestions,
		RandomizeOptions: &randomizeOptions, ShowProgressBar: &showProgressBar,
		RequireAnswerBeforeNext: &requireAnswerBeforeNext,
		AllowQuestionReview:     &allowQuestionReview, ShowAnswers: &showAnswers,
		ShowResultsReport: &showResultsReport, ShowExplanations: &showExplanations,
	}
	switch {
	case entireSchool:
		result.TargetScope = "school"
	case len(result.StudentIDs) > 0:
		result.TargetScope = "selected"
	case len(result.ClassIDs) == 1:
		result.TargetScope = "class"
	default:
		result.TargetScope = "classes"
	}
	result.CanManage = true
	// The Go director API does not yet expose a safe clone/edit command.
	// Never claim that a displayed action is available before it exists.
	result.CanClone = false
	result.CanEditContent = false
	return result, nil
}
