package postgres

import (
	"context"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

// GetLearnerFoundationLesson is a bounded learner read for a single Foundation
// lesson. It lives in its own file because historical scope proofs replace
// learning_space.go wholesale; the method must remain compilable there.
func (r *Repository) GetLearnerFoundationLesson(ctx context.Context, topicID, lessonID string) (content.FoundationLessonDetail, error) {
	var out content.FoundationLessonDetail
	err := r.db.QueryRow(ctx, `
		SELECT l.id::text,l.title,l.description,l.lesson_type,l.duration_seconds,l.is_locked,
		       tl.sort_order,l.content_text,COALESCE(l.video_url,''),COALESCE(l.video_source,''),
		       t.id::text,t.path_id::text,t.subject_id::text,t.is_locked
		FROM topic_lessons tl
		JOIN foundation_topics t ON t.id=tl.topic_id
		JOIN lessons l ON l.id=tl.lesson_id
		JOIN paths p ON p.id=t.path_id AND p.status='active'
		JOIN subjects s ON s.id=t.subject_id AND s.path_id=t.path_id AND s.status='active'
		WHERE t.id=$1::uuid AND l.id=$2::uuid AND t.status='active' AND t.is_visible=true
		  AND l.path_id=t.path_id AND l.subject_id=t.subject_id
		  AND l.workflow_status='approved' AND l.is_visible=true
	`, topicID, lessonID).Scan(&out.Lesson.ID, &out.Lesson.Title, &out.Lesson.Description,
		&out.Lesson.LessonType, &out.Lesson.DurationSeconds, &out.Lesson.IsLocked, &out.Lesson.SortOrder,
		&out.Lesson.ContentText, &out.Lesson.VideoURL, &out.Lesson.VideoSource,
		&out.TopicID, &out.PathID, &out.SubjectID, &out.TopicLocked)
	if err != nil {
		return out, mapError(err)
	}
	if ok, err := r.learningTaxonomyExists(ctx, out.PathID, out.SubjectID); err != nil {
		return content.FoundationLessonDetail{}, err
	} else if !ok {
		return content.FoundationLessonDetail{}, content.ErrNotFound
	}
	return out, nil
}
