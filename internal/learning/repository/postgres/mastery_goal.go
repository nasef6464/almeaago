package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func scanMasteryGoal(row pgx.Row) (learning.MasteryGoal, error) {
	var out learning.MasteryGoal
	err := row.Scan(
		&out.ID,
		&out.StudentID,
		&out.CreatedByUserID,
		&out.CreatedByRole,
		&out.PathID,
		&out.SubjectID,
		&out.TargetType,
		&out.TargetID,
		&out.Title,
		&out.TargetMastery,
		&out.Horizon,
		&out.DueDate,
		&out.Status,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	return out, err
}

const masteryGoalColumns = `
	id::text,
	student_id::text,
	created_by_user_id::text,
	created_by_role,
	path_id::text,
	COALESCE(subject_id::text,''),
	target_type,
	target_id::text,
	title,
	target_mastery,
	horizon,
	COALESCE(due_date::text,''),
	status,
	created_at,
	updated_at
`

func (r *Repository) CreateMasteryGoal(
	ctx context.Context,
	student string,
	write learning.MasteryGoalWrite,
) (learning.MasteryGoal, error) {
	return scanMasteryGoal(r.db.QueryRow(ctx, `
		INSERT INTO mastery_goals(
			student_id,created_by_user_id,created_by_role,path_id,subject_id,
			target_type,target_id,title,target_mastery,horizon,due_date,status
		) VALUES(
			$1::uuid,$1::uuid,'student',$2::uuid,NULLIF($3,'')::uuid,
			$4,$5::uuid,$6,$7,$8,NULLIF($9,'')::date,'active'
		)
		RETURNING `+masteryGoalColumns,
		student,
		write.PathID,
		write.SubjectID,
		write.TargetType,
		write.TargetID,
		write.Title,
		write.TargetMastery,
		write.Horizon,
		write.DueDate,
	))
}

func (r *Repository) ListMasteryGoals(
	ctx context.Context,
	student, pathID, subjectID string,
	status learning.GoalStatus,
	page, limit int,
) (learning.MasteryGoalPage, error) {
	args := []any{student, pathID, status, limit + 1, (page - 1) * limit}
	subjectFilter := ""
	if strings.TrimSpace(subjectID) != "" {
		args = append(args, subjectID)
		subjectFilter = fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	rows, err := r.db.Query(ctx, `
		SELECT `+masteryGoalColumns+`
		FROM mastery_goals
		WHERE student_id=$1::uuid
		  AND path_id=$2::uuid
		  AND status=$3
		  `+subjectFilter+`
		ORDER BY due_date ASC NULLS LAST,created_at DESC,id
		LIMIT $4 OFFSET $5
	`, args...)
	if err != nil {
		return learning.MasteryGoalPage{}, err
	}
	defer rows.Close()

	out := learning.MasteryGoalPage{Page: page, Limit: limit}
	for rows.Next() {
		item, scanErr := scanMasteryGoal(rows)
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

func (r *Repository) UpdateMasteryGoal(
	ctx context.Context,
	student, goalID string,
	patch learning.MasteryGoalPatch,
) (learning.MasteryGoal, error) {
	var title any
	if patch.Title != nil {
		title = *patch.Title
	}
	var targetMastery any
	if patch.TargetMastery != nil {
		targetMastery = *patch.TargetMastery
	}
	var dueDate any
	if patch.DueDate != nil {
		dueDate = *patch.DueDate
	}
	var status any
	if patch.Status != nil {
		status = *patch.Status
	}

	out, err := scanMasteryGoal(r.db.QueryRow(ctx, `
		UPDATE mastery_goals
		SET title=COALESCE($4::text,title),
		    target_mastery=COALESCE($5::integer,target_mastery),
		    due_date=CASE WHEN $6::text IS NULL THEN due_date ELSE NULLIF($6,'')::date END,
		    status=COALESCE($7::text,status),
		    updated_at=now()
		WHERE id=$1::uuid
		  AND student_id=$2::uuid
		  AND updated_at=$3
		RETURNING `+masteryGoalColumns,
		goalID,
		student,
		patch.ExpectedUpdatedAt,
		title,
		targetMastery,
		dueDate,
		status,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.MasteryGoal{}, learning.ErrConflict
	}
	return out, err
}
