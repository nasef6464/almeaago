package postgres

import (
	"context"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func (r *Repository) ParentStudentAssessmentSnapshots(
	ctx context.Context,
	studentIDs []string,
	since time.Time,
	recentPerStudent int,
) (map[string]assessment.ParentStudentAssessmentSnapshot, error) {
	out := make(map[string]assessment.ParentStudentAssessmentSnapshot, len(studentIDs))
	for _, id := range studentIDs {
		out[id] = assessment.ParentStudentAssessmentSnapshot{StudentID: id, RecentResults: []assessment.ParentResultSummary{}}
	}
	if len(studentIDs) == 0 {
		return out, nil
	}
	if recentPerStudent < 1 {
		recentPerStudent = 3
	}
	if recentPerStudent > 10 {
		recentPerStudent = 10
	}

	rows, err := r.db.Query(ctx, `
		SELECT student_id::text,COUNT(*)::int,
		       COALESCE(ROUND(AVG(score),3)::float8,0),
		       COALESCE(SUM(time_spent_seconds),0)::bigint
		FROM assessment_results
		WHERE student_id::text=ANY($1::text[])
		  AND finalized_at >= $2
		GROUP BY student_id
	`, studentIDs, since)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var studentID string
		var count int
		var average float64
		var studySeconds int64
		if err = rows.Scan(&studentID, &count, &average, &studySeconds); err != nil {
			rows.Close()
			return nil, err
		}
		snapshot := out[studentID]
		snapshot.WeeklyAssessmentCount = count
		snapshot.WeeklyAverageScore = average
		snapshot.WeeklyStudySeconds = int(studySeconds)
		out[studentID] = snapshot
	}
	if err = rows.Err(); err != nil {
		rows.Close()
		return nil, err
	}
	rows.Close()

	recentRows, err := r.db.Query(ctx, `
		WITH ranked AS (
			SELECT
				r.student_id,
				r.attempt_id,
				r.assessment_id,
				r.assessment_version,
				v.title,
				a.attempt_number,
				r.score,
				r.total_questions,
				r.correct_answers,
				r.wrong_answers,
				r.unanswered,
				r.passed,
				r.time_spent_seconds,
				r.finalized_at,
				ROW_NUMBER() OVER(
					PARTITION BY r.student_id
					ORDER BY r.finalized_at DESC,r.attempt_id DESC
				) AS rn
			FROM assessment_results r
			JOIN assessment_attempts a ON a.id=r.attempt_id
			JOIN assessment_versions v
			  ON v.assessment_id=r.assessment_id
			 AND v.version=r.assessment_version
			WHERE r.student_id::text=ANY($1::text[])
		)
		SELECT student_id::text,attempt_id::text,assessment_id::text,assessment_version,title,
		       attempt_number,score::float8,total_questions,correct_answers,wrong_answers,unanswered,
		       passed,time_spent_seconds,finalized_at
		FROM ranked
		WHERE rn <= $2
		ORDER BY student_id,finalized_at DESC,attempt_id DESC
	`, studentIDs, recentPerStudent)
	if err != nil {
		return nil, err
	}
	defer recentRows.Close()
	for recentRows.Next() {
		var studentID string
		var item assessment.ParentResultSummary
		if err = recentRows.Scan(
			&studentID,
			&item.AttemptID,
			&item.AssessmentID,
			&item.AssessmentVersion,
			&item.Title,
			&item.AttemptNumber,
			&item.Score,
			&item.TotalQuestions,
			&item.CorrectAnswers,
			&item.WrongAnswers,
			&item.Unanswered,
			&item.Passed,
			&item.TimeSpentSeconds,
			&item.FinalizedAt,
		); err != nil {
			return nil, err
		}
		snapshot := out[studentID]
		snapshot.RecentResults = append(snapshot.RecentResults, item)
		out[studentID] = snapshot
	}
	return out, recentRows.Err()
}

func (r *Repository) ParentStudentResults(
	ctx context.Context,
	studentID string,
	page, limit int,
) (assessment.ParentResultPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			r.attempt_id::text,
			r.assessment_id::text,
			r.assessment_version,
			v.title,
			a.attempt_number,
			r.score::float8,
			r.total_questions,
			r.correct_answers,
			r.wrong_answers,
			r.unanswered,
			r.passed,
			r.time_spent_seconds,
			r.finalized_at
		FROM assessment_results r
		JOIN assessment_attempts a ON a.id=r.attempt_id
		JOIN assessment_versions v
		  ON v.assessment_id=r.assessment_id
		 AND v.version=r.assessment_version
		WHERE r.student_id=$1::uuid
		ORDER BY r.finalized_at DESC,r.attempt_id DESC
		LIMIT $2 OFFSET $3
	`, studentID, limit+1, (page-1)*limit)
	if err != nil {
		return assessment.ParentResultPage{}, err
	}
	defer rows.Close()

	out := assessment.ParentResultPage{Page: page, Limit: limit}
	for rows.Next() {
		var item assessment.ParentResultSummary
		if err = rows.Scan(
			&item.AttemptID,
			&item.AssessmentID,
			&item.AssessmentVersion,
			&item.Title,
			&item.AttemptNumber,
			&item.Score,
			&item.TotalQuestions,
			&item.CorrectAnswers,
			&item.WrongAnswers,
			&item.Unanswered,
			&item.Passed,
			&item.TimeSpentSeconds,
			&item.FinalizedAt,
		); err != nil {
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
