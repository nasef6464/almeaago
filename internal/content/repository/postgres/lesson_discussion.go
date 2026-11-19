package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func (r *Repository) ListLessonDiscussion(ctx context.Context, courseID, lessonID string, page, limit int) (content.LessonDiscussionPage, error) {
	rows, err := r.db.Query(ctx, `SELECT m.id::text,COALESCE(m.parent_id::text,''),m.author_id::text,u.name,m.body,m.created_at
		FROM lesson_discussion_messages m JOIN users u ON u.id=m.author_id
		WHERE m.course_id=$1::uuid AND m.lesson_id=$2::uuid ORDER BY m.created_at,m.id LIMIT $3 OFFSET $4`, courseID, lessonID, limit+1, (page-1)*limit)
	if err != nil {
		return content.LessonDiscussionPage{}, mapError(err)
	}
	defer rows.Close()
	out := content.LessonDiscussionPage{Items: []content.LessonDiscussionMessage{}, Page: page}
	for rows.Next() {
		var m content.LessonDiscussionMessage
		if err := rows.Scan(&m.ID, &m.ParentID, &m.AuthorID, &m.AuthorName, &m.Body, &m.CreatedAt); err != nil {
			return content.LessonDiscussionPage{}, err
		}
		out.Items = append(out.Items, m)
	}
	if err := rows.Err(); err != nil {
		return content.LessonDiscussionPage{}, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) CreateLessonDiscussion(ctx context.Context, courseID, lessonID, authorID, parentID, body, requestID string) (content.LessonDiscussionMessage, error) {
	var out content.LessonDiscussionMessage
	err := r.db.QueryRow(ctx, `WITH created AS (
		INSERT INTO lesson_discussion_messages(course_id,lesson_id,author_id,parent_id,body,request_id)
		SELECT $1::uuid,$2::uuid,$3::uuid,NULLIF($4,'')::uuid,$5,$6
		WHERE $4='' OR EXISTS (SELECT 1 FROM lesson_discussion_messages p WHERE p.id=NULLIF($4,'')::uuid AND p.course_id=$1::uuid AND p.lesson_id=$2::uuid)
		ON CONFLICT (course_id,lesson_id,author_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id
		WHERE lesson_discussion_messages.body=EXCLUDED.body AND lesson_discussion_messages.parent_id IS NOT DISTINCT FROM EXCLUDED.parent_id
		RETURNING id,parent_id,author_id,body,created_at
	) SELECT c.id::text,COALESCE(c.parent_id::text,''),c.author_id::text,u.name,c.body,c.created_at FROM created c JOIN users u ON u.id=c.author_id`, courseID, lessonID, authorID, parentID, body, requestID).Scan(&out.ID, &out.ParentID, &out.AuthorID, &out.AuthorName, &out.Body, &out.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return content.LessonDiscussionMessage{}, content.ErrConflict
	}
	if err != nil {
		return content.LessonDiscussionMessage{}, mapError(err)
	}
	return out, nil
}
