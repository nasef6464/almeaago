package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) GetLessonProgress(
	ctx context.Context,
	student, lessonID string,
	contextType learning.LessonProgressContext,
	courseID, topicID string,
) (learning.LessonProgress, error) {
	var out learning.LessonProgress
	var completedAt *time.Time
	var updatedAt time.Time
	err := r.db.QueryRow(ctx, `
		SELECT lp.lesson_id::text,lp.context_type,COALESCE(lp.course_id::text,''),COALESCE(lp.topic_id::text,''),
		       lp.status,COALESCE(lvp.position_seconds,0),lp.completed_at,lp.updated_at
		FROM lesson_progress lp
		LEFT JOIN lesson_video_progress lvp ON lvp.lesson_progress_id=lp.id
		WHERE lp.student_id=$1::uuid
		  AND lp.lesson_id=$2::uuid
		  AND lp.context_type=$3
		  AND COALESCE(lp.course_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(NULLIF($4,'')::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
		  AND COALESCE(lp.topic_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(NULLIF($5,'')::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
	`, student, lessonID, string(contextType), courseID, topicID).Scan(
		&out.LessonID, &out.ContextType, &out.CourseID, &out.TopicID,
		&out.Status, &out.PositionSeconds, &completedAt, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return out, learning.ErrNotFound
	}
	if err != nil {
		return out, err
	}
	out.CompletedAt = completedAt
	out.UpdatedAt = &updatedAt
	return out, nil
}

func (r *Repository) ensureLessonProgress(
	ctx context.Context,
	tx pgx.Tx,
	student, lessonID string,
	contextType learning.LessonProgressContext,
	courseID, topicID string,
) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO lesson_progress(student_id,lesson_id,context_type,course_id,topic_id,status,last_opened_at)
		VALUES($1::uuid,$2::uuid,$3,NULLIF($4,'')::uuid,NULLIF($5,'')::uuid,'in_progress',now())
		ON CONFLICT DO NOTHING
		RETURNING id::text
	`, student, lessonID, string(contextType), courseID, topicID).Scan(&id)
	if err == nil {
		return id, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	err = tx.QueryRow(ctx, `
		SELECT id::text
		FROM lesson_progress
		WHERE student_id=$1::uuid
		  AND lesson_id=$2::uuid
		  AND context_type=$3
		  AND COALESCE(course_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(NULLIF($4,'')::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
		  AND COALESCE(topic_id,'00000000-0000-0000-0000-000000000000'::uuid)=COALESCE(NULLIF($5,'')::uuid,'00000000-0000-0000-0000-000000000000'::uuid)
		FOR UPDATE
	`, student, lessonID, string(contextType), courseID, topicID).Scan(&id)
	return id, err
}

func (r *Repository) SaveVideoProgress(
	ctx context.Context,
	student, lessonID string,
	contextType learning.LessonProgressContext,
	courseID, topicID string,
	position int,
) (learning.LessonProgress, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	defer tx.Rollback(ctx)

	id, err := r.ensureLessonProgress(ctx, tx, student, lessonID, contextType, courseID, topicID)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE lesson_progress SET last_opened_at=now(),updated_at=now() WHERE id=$1::uuid
	`, id); err != nil {
		return learning.LessonProgress{}, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO lesson_video_progress(lesson_progress_id,position_seconds,updated_at)
		VALUES($1::uuid,$2,now())
		ON CONFLICT(lesson_progress_id) DO UPDATE SET position_seconds=EXCLUDED.position_seconds,updated_at=now()
	`, id, position); err != nil {
		return learning.LessonProgress{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.LessonProgress{}, err
	}
	return r.GetLessonProgress(ctx, student, lessonID, contextType, courseID, topicID)
}

func (r *Repository) CompleteLesson(
	ctx context.Context,
	student, lessonID string,
	contextType learning.LessonProgressContext,
	courseID, topicID string,
) (learning.LessonProgress, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	defer tx.Rollback(ctx)

	id, err := r.ensureLessonProgress(ctx, tx, student, lessonID, contextType, courseID, topicID)
	if err != nil {
		return learning.LessonProgress{}, err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE lesson_progress
		SET status='completed',completed_at=COALESCE(completed_at,now()),last_opened_at=now(),updated_at=now()
		WHERE id=$1::uuid
	`, id); err != nil {
		return learning.LessonProgress{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.LessonProgress{}, err
	}
	return r.GetLessonProgress(ctx, student, lessonID, contextType, courseID, topicID)
}
