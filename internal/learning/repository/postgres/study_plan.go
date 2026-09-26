package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

const studyPlanSummaryColumns = `
	id::text,
	student_id::text,
	name,
	path_id::text,
	start_date::text,
	end_date::text,
	skip_completed_assessments,
	daily_minutes,
	to_char(preferred_start_time,'HH24:MI'),
	status,
	created_at,
	updated_at
`

func scanStudyPlanSummary(row pgx.Row) (learning.StudyPlanSummary, error) {
	var out learning.StudyPlanSummary
	err := row.Scan(
		&out.ID,
		&out.StudentID,
		&out.Name,
		&out.PathID,
		&out.StartDate,
		&out.EndDate,
		&out.SkipCompletedAssessments,
		&out.DailyMinutes,
		&out.PreferredStartTime,
		&out.Status,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	return out, err
}

func insertStudyPlanDetails(
	ctx context.Context,
	tx pgx.Tx,
	planID string,
	write learning.StudyPlanWrite,
	items []learning.StudyPlanItemSeed,
) error {
	for index, subjectID := range write.SubjectIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO study_plan_subjects(plan_id,subject_id,sort_order)
			VALUES($1::uuid,$2::uuid,$3)
		`, planID, subjectID, index); err != nil {
			return err
		}
	}
	for index, courseID := range write.CourseIDs {
		if _, err := tx.Exec(ctx, `
			INSERT INTO study_plan_courses(plan_id,course_id,sort_order)
			VALUES($1::uuid,$2::uuid,$3)
		`, planID, courseID, index); err != nil {
			return err
		}
	}
	for _, day := range write.OffDays {
		if _, err := tx.Exec(ctx, `
			INSERT INTO study_plan_off_days(plan_id,weekday)
			VALUES($1::uuid,$2)
		`, planID, string(day)); err != nil {
			return err
		}
	}
	for _, item := range items {
		if _, err := tx.Exec(ctx, `
			INSERT INTO study_plan_items(
				plan_id,subject_id,item_type,lesson_id,course_id,library_item_id,
				assessment_placement_id,scheduled_date,scheduled_time,duration_minutes,phase,sort_order
			) VALUES(
				$1::uuid,NULLIF($2,'')::uuid,$3,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,NULLIF($6,'')::uuid,
				NULLIF($7,'')::uuid,$8::date,$9::time,$10,$11,$12
			)
		`,
			planID,
			item.SubjectID,
			string(item.ItemType),
			item.LessonID,
			item.CourseID,
			item.LibraryItemID,
			item.AssessmentPlacementID,
			item.ScheduledDate,
			item.ScheduledTime,
			item.DurationMinutes,
			string(item.Phase),
			item.SortOrder,
		); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) CreateStudyPlan(
	ctx context.Context,
	student string,
	write learning.StudyPlanWrite,
	items []learning.StudyPlanItemSeed,
) (learning.StudyPlan, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	defer tx.Rollback(ctx)

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO study_plans(
			student_id,name,path_id,start_date,end_date,skip_completed_assessments,
			daily_minutes,preferred_start_time,status
		) VALUES(
			$1::uuid,$2,$3::uuid,$4::date,$5::date,$6,$7,$8::time,$9
		)
		RETURNING id::text
	`,
		student,
		write.Name,
		write.PathID,
		write.StartDate,
		write.EndDate,
		write.SkipCompletedAssessments,
		write.DailyMinutes,
		write.PreferredStartTime,
		string(write.Status),
	).Scan(&id)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	if err = insertStudyPlanDetails(ctx, tx, id, write, items); err != nil {
		return learning.StudyPlan{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.StudyPlan{}, err
	}
	return r.GetStudyPlan(ctx, student, id)
}

func (r *Repository) ListStudyPlans(
	ctx context.Context,
	student, pathID string,
	status learning.StudyPlanStatus,
	page, limit int,
) (learning.StudyPlanPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+studyPlanSummaryColumns+`
		FROM study_plans
		WHERE student_id=$1::uuid
		  AND path_id=$2::uuid
		  AND status=$3
		ORDER BY updated_at DESC,id DESC
		LIMIT $4 OFFSET $5
	`, student, pathID, string(status), limit+1, (page-1)*limit)
	if err != nil {
		return learning.StudyPlanPage{}, err
	}
	defer rows.Close()
	out := learning.StudyPlanPage{Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanStudyPlanSummary(rows)
		if scanErr != nil {
			return out, scanErr
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

func (r *Repository) GetStudyPlan(ctx context.Context, student, id string) (learning.StudyPlan, error) {
	summary, err := scanStudyPlanSummary(r.db.QueryRow(ctx, `
		SELECT `+studyPlanSummaryColumns+`
		FROM study_plans
		WHERE id=$1::uuid AND student_id=$2::uuid
	`, id, student))
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.StudyPlan{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.StudyPlan{}, err
	}
	out := learning.StudyPlan{StudyPlanSummary: summary}

	subjectRows, err := r.db.Query(ctx, `
		SELECT subject_id::text
		FROM study_plan_subjects
		WHERE plan_id=$1::uuid
		ORDER BY sort_order,subject_id
	`, id)
	if err != nil {
		return out, err
	}
	for subjectRows.Next() {
		var value string
		if err = subjectRows.Scan(&value); err != nil {
			subjectRows.Close()
			return out, err
		}
		out.SubjectIDs = append(out.SubjectIDs, value)
	}
	if err = subjectRows.Err(); err != nil {
		subjectRows.Close()
		return out, err
	}
	subjectRows.Close()

	courseRows, err := r.db.Query(ctx, `
		SELECT course_id::text
		FROM study_plan_courses
		WHERE plan_id=$1::uuid
		ORDER BY sort_order,course_id
	`, id)
	if err != nil {
		return out, err
	}
	for courseRows.Next() {
		var value string
		if err = courseRows.Scan(&value); err != nil {
			courseRows.Close()
			return out, err
		}
		out.CourseIDs = append(out.CourseIDs, value)
	}
	if err = courseRows.Err(); err != nil {
		courseRows.Close()
		return out, err
	}
	courseRows.Close()

	offRows, err := r.db.Query(ctx, `
		SELECT weekday
		FROM study_plan_off_days
		WHERE plan_id=$1::uuid
		ORDER BY CASE weekday
			WHEN 'saturday' THEN 1 WHEN 'sunday' THEN 2 WHEN 'monday' THEN 3
			WHEN 'tuesday' THEN 4 WHEN 'wednesday' THEN 5 WHEN 'thursday' THEN 6 ELSE 7 END
	`, id)
	if err != nil {
		return out, err
	}
	for offRows.Next() {
		var value learning.StudyPlanWeekday
		if err = offRows.Scan(&value); err != nil {
			offRows.Close()
			return out, err
		}
		out.OffDays = append(out.OffDays, value)
	}
	if err = offRows.Err(); err != nil {
		offRows.Close()
		return out, err
	}
	offRows.Close()

	itemRows, err := r.db.Query(ctx, `
		SELECT id::text,COALESCE(subject_id::text,''),item_type,
		       COALESCE(lesson_id::text,''),COALESCE(course_id::text,''),
		       COALESCE(library_item_id::text,''),COALESCE(assessment_placement_id::text,''),
		       scheduled_date::text,to_char(scheduled_time,'HH24:MI'),
		       duration_minutes,phase,sort_order
		FROM study_plan_items
		WHERE plan_id=$1::uuid
		ORDER BY scheduled_date,scheduled_time,sort_order,id
	`, id)
	if err != nil {
		return out, err
	}
	defer itemRows.Close()
	for itemRows.Next() {
		var item learning.StudyPlanItem
		if err = itemRows.Scan(
			&item.ID,
			&item.SubjectID,
			&item.ItemType,
			&item.LessonID,
			&item.CourseID,
			&item.LibraryItemID,
			&item.AssessmentPlacementID,
			&item.ScheduledDate,
			&item.ScheduledTime,
			&item.DurationMinutes,
			&item.Phase,
			&item.SortOrder,
		); err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err = itemRows.Err(); err != nil {
		return out, err
	}
	out.ItemCount = len(out.Items)
	return out, nil
}

func (r *Repository) UpdateStudyPlan(
	ctx context.Context,
	student, id string,
	patch learning.StudyPlanPatch,
	items []learning.StudyPlanItemSeed,
) (learning.StudyPlan, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `
		UPDATE study_plans
		SET name=$4,path_id=$5::uuid,start_date=$6::date,end_date=$7::date,
		    skip_completed_assessments=$8,daily_minutes=$9,preferred_start_time=$10::time,
		    status=$11,updated_at=now()
		WHERE id=$1::uuid
		  AND student_id=$2::uuid
		  AND updated_at=$3
	`,
		id,
		student,
		patch.ExpectedUpdatedAt,
		patch.Name,
		patch.PathID,
		patch.StartDate,
		patch.EndDate,
		patch.SkipCompletedAssessments,
		patch.DailyMinutes,
		patch.PreferredStartTime,
		string(patch.Status),
	)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	if tag.RowsAffected() == 0 {
		return learning.StudyPlan{}, learning.ErrConflict
	}
	for _, table := range []string{"study_plan_items", "study_plan_off_days", "study_plan_courses", "study_plan_subjects"} {
		if _, err = tx.Exec(ctx, "DELETE FROM "+table+" WHERE plan_id=$1::uuid", id); err != nil {
			return learning.StudyPlan{}, err
		}
	}
	if err = insertStudyPlanDetails(ctx, tx, id, patch.StudyPlanWrite, items); err != nil {
		return learning.StudyPlan{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.StudyPlan{}, err
	}
	return r.GetStudyPlan(ctx, student, id)
}

func (r *Repository) DeleteStudyPlan(ctx context.Context, student, id string) error {
	tag, err := r.db.Exec(ctx, `
		DELETE FROM study_plans
		WHERE id=$1::uuid AND student_id=$2::uuid
	`, id, student)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return learning.ErrNotFound
	}
	return nil
}

func (r *Repository) CompletedStudyPlanLessons(
	ctx context.Context,
	student string,
	refs []learning.StudyPlanLessonRef,
) (map[string]bool, error) {
	out := map[string]bool{}
	if len(refs) == 0 {
		return out, nil
	}
	if len(refs) > 100 {
		return nil, learning.ErrConflict
	}
	conditions := make([]string, 0, len(refs))
	args := []any{student}
	for _, ref := range refs {
		ref.LessonID = strings.TrimSpace(ref.LessonID)
		ref.CourseID = strings.TrimSpace(ref.CourseID)
		if ref.LessonID == "" || ref.CourseID == "" {
			continue
		}
		args = append(args, ref.LessonID, ref.CourseID)
		conditions = append(conditions, fmt.Sprintf(
			"(lesson_id=$%d::uuid AND context_type='course' AND course_id=$%d::uuid)",
			len(args)-1,
			len(args),
		))
	}
	if len(conditions) == 0 {
		return out, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT lesson_id::text,course_id::text
		FROM learning_lesson_progress
		WHERE student_id=$1::uuid
		  AND status='completed'
		  AND (`+strings.Join(conditions, " OR ")+`)
	`, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var lessonID, courseID string
		if err = rows.Scan(&lessonID, &courseID); err != nil {
			return nil, err
		}
		out[lessonID+":"+courseID] = true
	}
	return out, rows.Err()
}
