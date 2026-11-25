package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) ListQAQuestions(ctx context.Context, includeHidden bool, courseID, filter, search string, limit int) (content.QAListResult, error) {
	out := content.QAListResult{Items: []content.QAQuestion{}}
	args := []any{}
	where := []string{"1=1"}

	if !includeHidden {
		where = append(where, `
			(q.path_id IS NULL OR EXISTS (SELECT 1 FROM paths p WHERE p.id=q.path_id AND p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'))
			AND (q.course_id IS NULL OR EXISTS (SELECT 1 FROM courses c WHERE c.id=q.course_id AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true))
		`)
	}
	if courseID != "" {
		args = append(args, courseID)
		where = append(where, fmt.Sprintf("q.course_id=$%d::uuid", len(args)))
	}
	if search != "" {
		args = append(args, "%"+strings.ToLower(search)+"%")
		idx := len(args)
		where = append(where, fmt.Sprintf(`(
			lower(q.question) LIKE $%d
			OR lower(q.subject_name) LIKE $%d
			OR lower(COALESCE(c.title,'')) LIKE $%d
			OR lower(COALESCE(u.name,'')) LIKE $%d
			OR EXISTS (SELECT 1 FROM course_qa_replies r WHERE r.question_id=q.id AND lower(r.body) LIKE $%d)
		)`, idx, idx, idx, idx, idx))
	}

	switch filter {
	case "answered":
		where = append(where, "EXISTS (SELECT 1 FROM course_qa_replies r WHERE r.question_id=q.id)")
	case "unanswered", "pending":
		where = append(where, "NOT EXISTS (SELECT 1 FROM course_qa_replies r WHERE r.question_id=q.id)")
	case "", "all":
	default:
		args = append(args, filter)
		where = append(where, fmt.Sprintf("(q.subject_name=$%d OR COALESCE(s.name,'')=$%d OR COALESCE(p.name,'')=$%d)", len(args), len(args), len(args)))
	}

	args = append(args, limit)
	limitIdx := len(args)

	rows, err := r.db.Query(ctx, `
		SELECT
			q.id::text,
			COALESCE(q.course_id::text,''),
			COALESCE(c.title,''),
			COALESCE(q.path_id::text,''),
			COALESCE(p.name,''),
			COALESCE(q.subject_id::text,''),
			CASE
				WHEN NULLIF(btrim(q.subject_name),'') IS NOT NULL THEN q.subject_name
				WHEN NULLIF(btrim(s.name),'') IS NOT NULL THEN s.name
				WHEN NULLIF(btrim(p.name),'') IS NOT NULL THEN p.name
				ELSE 'عام'
			END AS resolved_subject_name,
			q.author_id::text,
			COALESCE(u.name,'طالب'),
			q.question,
			COALESCE(lr.body,''),
			COALESCE(lru.name,''),
			COALESCE(rc.cnt,0)::int,
			COALESCE(rc.cnt,0) > 0 AS has_answer,
			q.is_resolved,
			q.created_at,
			q.updated_at
		FROM course_qa_questions q
		LEFT JOIN courses c ON c.id=q.course_id
		LEFT JOIN paths p ON p.id=COALESCE(q.path_id, c.path_id)
		LEFT JOIN subjects s ON s.id=COALESCE(q.subject_id, c.subject_id)
		LEFT JOIN users u ON u.id=q.author_id
		LEFT JOIN LATERAL (
			SELECT count(*)::int AS cnt FROM course_qa_replies r WHERE r.question_id=q.id
		) rc ON true
		LEFT JOIN LATERAL (
			SELECT r.body, r.author_id
			FROM course_qa_replies r
			WHERE r.question_id=q.id
			ORDER BY r.is_instructor DESC, r.created_at DESC, r.id DESC
			LIMIT 1
		) lr ON true
		LEFT JOIN users lru ON lru.id=lr.author_id
		WHERE `+strings.Join(where, " AND ")+`
		ORDER BY q.created_at DESC, q.id DESC
		LIMIT $`+fmt.Sprintf("%d", limitIdx), args...)
	if err != nil {
		return out, mapError(err)
	}
	defer rows.Close()

	for rows.Next() {
		var item content.QAQuestion
		if scanErr := rows.Scan(
			&item.ID, &item.CourseID, &item.CourseTitle,
			&item.PathID, &item.PathName, &item.SubjectID, &item.SubjectName,
			&item.AuthorID, &item.AuthorName, &item.Question,
			&item.LatestReply, &item.LatestReplyBy, &item.RepliesCount, &item.HasAnswer,
			&item.IsResolved, &item.CreatedAt, &item.UpdatedAt,
		); scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items, item)
		out.Stats.Total++
		if item.HasAnswer {
			out.Stats.Answered++
		} else {
			out.Stats.Pending++
		}
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	return out, nil
}

func (r *Repository) CreateQAQuestion(ctx context.Context, authorID, courseID, pathID, subjectID, subjectName, question, requestID string) (content.QAQuestion, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.QAQuestion{}, err
	}
	defer tx.Rollback(ctx)

	var insertedID string
	err = tx.QueryRow(ctx, `
		INSERT INTO course_qa_questions(course_id, path_id, subject_id, author_id, request_id, subject_name, question)
		VALUES(NULLIF($1,'')::uuid, NULLIF($2,'')::uuid, NULLIF($3,'')::uuid, $4::uuid, $5, $6, $7)
		ON CONFLICT (author_id, request_id) DO NOTHING
		RETURNING id::text
	`, courseID, pathID, subjectID, authorID, requestID, subjectName, question).Scan(&insertedID)
	created := true
	if errors.Is(err, pgx.ErrNoRows) {
		created = false
		err = tx.QueryRow(ctx, `
			SELECT id::text FROM course_qa_questions WHERE author_id=$1::uuid AND request_id=$2
		`, authorID, requestID).Scan(&insertedID)
	}
	if err != nil {
		return content.QAQuestion{}, mapError(err)
	}

	if created && r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  authorID,
			Action:       "content.qa_question.create",
			ResourceType: "course_qa_question",
			ResourceID:   insertedID,
			Status:       string(operations.AuditSuccess),
			Metadata:     map[string]any{"courseId": courseID, "subjectName": subjectName},
		}); err != nil {
			return content.QAQuestion{}, err
		}
	}

	var out content.QAQuestion
	err = tx.QueryRow(ctx, `
		SELECT
			q.id::text, COALESCE(q.course_id::text,''), COALESCE(c.title,''),
			COALESCE(q.path_id::text,''), COALESCE(p.name,''), COALESCE(q.subject_id::text,''),
			COALESCE(NULLIF(btrim(q.subject_name),''), s.name, p.name, 'عام'),
			q.author_id::text, COALESCE(u.name,'طالب'), q.question,
			'', '', 0, false, q.is_resolved, q.created_at, q.updated_at
		FROM course_qa_questions q
		LEFT JOIN courses c ON c.id=q.course_id
		LEFT JOIN paths p ON p.id=COALESCE(q.path_id, c.path_id)
		LEFT JOIN subjects s ON s.id=COALESCE(q.subject_id, c.subject_id)
		LEFT JOIN users u ON u.id=q.author_id
		WHERE q.id=$1::uuid
	`, insertedID).Scan(
		&out.ID, &out.CourseID, &out.CourseTitle,
		&out.PathID, &out.PathName, &out.SubjectID, &out.SubjectName,
		&out.AuthorID, &out.AuthorName, &out.Question,
		&out.LatestReply, &out.LatestReplyBy, &out.RepliesCount, &out.HasAnswer,
		&out.IsResolved, &out.CreatedAt, &out.UpdatedAt,
	)
	if err != nil {
		return content.QAQuestion{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return content.QAQuestion{}, err
	}
	return out, nil
}

func (r *Repository) ListQAReplies(ctx context.Context, questionID string) ([]content.QAReply, error) {
	rows, err := r.db.Query(ctx, `
		SELECT r.id::text, r.question_id::text, r.author_id::text, COALESCE(u.name,'مستخدم'), r.body, r.is_instructor, r.created_at
		FROM course_qa_replies r
		LEFT JOIN users u ON u.id=r.author_id
		WHERE r.question_id=$1::uuid
		ORDER BY r.created_at ASC, r.id ASC
		LIMIT 100
	`, questionID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()

	items := make([]content.QAReply, 0)
	for rows.Next() {
		var item content.QAReply
		if scanErr := rows.Scan(&item.ID, &item.QuestionID, &item.AuthorID, &item.AuthorName, &item.Body, &item.IsInstructor, &item.CreatedAt); scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CreateQAReply(ctx context.Context, questionID, authorID, body, requestID string, isInstructor bool) (content.QAReply, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.QAReply{}, err
	}
	defer tx.Rollback(ctx)

	var exists bool
	if err = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM course_qa_questions WHERE id=$1::uuid)`, questionID).Scan(&exists); err != nil {
		return content.QAReply{}, mapError(err)
	}
	if !exists {
		return content.QAReply{}, content.ErrNotFound
	}

	var replyID string
	err = tx.QueryRow(ctx, `
		INSERT INTO course_qa_replies(question_id, author_id, request_id, body, is_instructor)
		VALUES($1::uuid, $2::uuid, $3, $4, $5)
		ON CONFLICT (question_id, author_id, request_id) DO NOTHING
		RETURNING id::text
	`, questionID, authorID, requestID, body, isInstructor).Scan(&replyID)
	created := true
	if errors.Is(err, pgx.ErrNoRows) {
		created = false
		err = tx.QueryRow(ctx, `
			SELECT id::text FROM course_qa_replies WHERE question_id=$1::uuid AND author_id=$2::uuid AND request_id=$3
		`, questionID, authorID, requestID).Scan(&replyID)
	}
	if err != nil {
		return content.QAReply{}, mapError(err)
	}

	if created && r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  authorID,
			Action:       "content.qa_reply.create",
			ResourceType: "course_qa_reply",
			ResourceID:   replyID,
			Status:       string(operations.AuditSuccess),
			Metadata:     map[string]any{"questionId": questionID, "isInstructor": isInstructor},
		}); err != nil {
			return content.QAReply{}, err
		}
	}

	var out content.QAReply
	err = tx.QueryRow(ctx, `
		SELECT r.id::text, r.question_id::text, r.author_id::text, COALESCE(u.name,'مستخدم'), r.body, r.is_instructor, r.created_at
		FROM course_qa_replies r
		LEFT JOIN users u ON u.id=r.author_id
		WHERE r.id=$1::uuid
	`, replyID).Scan(&out.ID, &out.QuestionID, &out.AuthorID, &out.AuthorName, &out.Body, &out.IsInstructor, &out.CreatedAt)
	if err != nil {
		return content.QAReply{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return content.QAReply{}, err
	}
	return out, nil
}

func (r *Repository) ResolveQAQuestion(ctx context.Context, actorID, questionID string) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	tag, err := tx.Exec(ctx, `UPDATE course_qa_questions SET is_resolved=true, updated_at=now() WHERE id=$1::uuid`, questionID)
	if err != nil {
		return mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return content.ErrNotFound
	}
	if r.audit != nil {
		if err = r.audit.WriteTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  actorID,
			Action:       "content.qa_question.resolve",
			ResourceType: "course_qa_question",
			ResourceID:   questionID,
			Status:       string(operations.AuditSuccess),
		}); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}

func (r *Repository) ListLearnerLiveSessions(ctx context.Context, userID string, includeHidden bool) (content.LearnerLiveSessionsFeed, error) {
	feed := content.LearnerLiveSessionsFeed{
		Lessons:           []content.LearnerLiveLesson{},
		ClassroomSessions: []content.LearnerClassroomSession{},
	}

	lessonRows, err := r.db.Query(ctx, `
		SELECT
			l.id::text,
			l.title,
			l.description,
			l.lesson_type,
			l.path_id::text,
			COALESCE(p.name,''),
			l.subject_id::text,
			COALESCE(s.name,''),
			COALESCE(tu.name,''),
			COALESCE(l.meeting_url,''),
			l.meeting_at,
			GREATEST(1, (l.duration_seconds / 60))::int,
			COALESCE(l.recording_url,''),
			l.show_recording,
			l.join_instructions,
			l.is_locked AND NOT $2::bool AND NOT EXISTS (
				SELECT 1
				FROM commerce_entitlements ce
				JOIN commerce_products cp ON cp.id=ce.product_id
				JOIN commerce_packages pkg ON pkg.product_id=cp.id
				JOIN commerce_package_items cpi ON cpi.package_id=pkg.id
				WHERE ce.user_id=$1::uuid AND ce.status='active'
				  AND ce.starts_at <= now() AND (ce.expires_at IS NULL OR ce.expires_at > now())
				  AND (
					(cpi.scope_type='path' AND cpi.path_id=l.path_id)
					OR (cpi.scope_type='subject' AND cpi.subject_id=l.subject_id)
					OR cpi.scope_type='all'
				  )
			) AS effective_locked
		FROM lessons l
		JOIN paths p ON p.id=l.path_id
		JOIN subjects s ON s.id=l.subject_id
		LEFT JOIN users tu ON tu.id=COALESCE(l.assigned_teacher_id, l.owner_user_id)
		WHERE l.lesson_type IN ('live_youtube','zoom','google_meet','teams')
		  AND l.workflow_status='approved'
		  AND l.is_visible=true
		  AND ($2::bool OR (p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'))
		ORDER BY l.meeting_at ASC NULLS LAST, l.created_at DESC
		LIMIT 100
	`, userID, includeHidden)
	if err != nil {
		return feed, mapError(err)
	}
	defer lessonRows.Close()

	for lessonRows.Next() {
		var item content.LearnerLiveLesson
		var meetingURL, recordingURL string
		if scanErr := lessonRows.Scan(
			&item.ID, &item.Title, &item.Description, &item.Type,
			&item.PathID, &item.PathName, &item.SubjectID, &item.SubjectName, &item.TeacherName,
			&meetingURL, &item.MeetingDate, &item.DurationMinutes,
			&recordingURL, &item.ShowRecording, &item.JoinInstructions, &item.IsLocked,
		); scanErr != nil {
			return feed, scanErr
		}
		if !item.IsLocked {
			item.MeetingURL = meetingURL
			if item.ShowRecording {
				item.RecordingURL = recordingURL
			}
		}
		feed.Lessons = append(feed.Lessons, item)
	}
	if err = lessonRows.Err(); err != nil {
		return feed, err
	}

	clsRows, err := r.db.Query(ctx, `
		SELECT
			cs.id::text,
			cs.class_id::text,
			COALESCE(cl.name,''),
			cs.subject_id::text,
			COALESCE(s.name,''),
			COALESCE(tu.name,''),
			cs.status,
			cs.day,
			cs.started_at
		FROM classroom_sessions cs
		JOIN classes cl ON cl.id=cs.class_id
		JOIN subjects s ON s.id=cs.subject_id
		LEFT JOIN users tu ON tu.id=cs.teacher_id
		WHERE cs.status IN ('live','scheduled')
		  AND ($2::bool OR EXISTS (
			SELECT 1 FROM class_memberships cm
			WHERE cm.class_id=cs.class_id AND cm.user_id=$1::uuid AND cm.status='active'
		  ))
		ORDER BY CASE WHEN cs.status='live' THEN 0 ELSE 1 END, cs.created_at DESC
		LIMIT 30
	`, userID, includeHidden)
	if err != nil {
		return feed, mapError(err)
	}
	defer clsRows.Close()

	for clsRows.Next() {
		var item content.LearnerClassroomSession
		if scanErr := clsRows.Scan(
			&item.ID, &item.ClassID, &item.ClassName,
			&item.SubjectID, &item.SubjectName, &item.TeacherName,
			&item.Status, &item.Day, &item.StartedAt,
		); scanErr != nil {
			return feed, scanErr
		}
		feed.ClassroomSessions = append(feed.ClassroomSessions, item)
	}
	if err = clsRows.Err(); err != nil {
		return feed, err
	}

	return feed, nil
}

func (r *Repository) GetLearnerLiveLesson(ctx context.Context, userID, lessonID string, includeHidden bool) (content.LearnerLiveLesson, error) {
	var item content.LearnerLiveLesson
	var meetingURL, recordingURL string
	err := r.db.QueryRow(ctx, `
		SELECT
			l.id::text,
			l.title,
			l.description,
			l.lesson_type,
			l.path_id::text,
			COALESCE(p.name,''),
			l.subject_id::text,
			COALESCE(s.name,''),
			COALESCE(tu.name,''),
			COALESCE(l.meeting_url,''),
			l.meeting_at,
			GREATEST(1, (l.duration_seconds / 60))::int,
			COALESCE(l.recording_url,''),
			l.show_recording,
			l.join_instructions,
			l.is_locked AND NOT $3::bool AND NOT EXISTS (
				SELECT 1
				FROM commerce_entitlements ce
				JOIN commerce_products cp ON cp.id=ce.product_id
				JOIN commerce_packages pkg ON pkg.product_id=cp.id
				JOIN commerce_package_items cpi ON cpi.package_id=pkg.id
				WHERE ce.user_id=$1::uuid AND ce.status='active'
				  AND ce.starts_at <= now() AND (ce.expires_at IS NULL OR ce.expires_at > now())
				  AND (
					(cpi.scope_type='path' AND cpi.path_id=l.path_id)
					OR (cpi.scope_type='subject' AND cpi.subject_id=l.subject_id)
					OR cpi.scope_type='all'
				  )
			) AS effective_locked
		FROM lessons l
		JOIN paths p ON p.id=l.path_id
		JOIN subjects s ON s.id=l.subject_id
		LEFT JOIN users tu ON tu.id=COALESCE(l.assigned_teacher_id, l.owner_user_id)
		WHERE l.id=$2::uuid
		  AND l.lesson_type IN ('live_youtube','zoom','google_meet','teams')
		  AND ($3::bool OR (l.workflow_status='approved' AND l.is_visible=true AND p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'))
	`, userID, lessonID, includeHidden).Scan(
		&item.ID, &item.Title, &item.Description, &item.Type,
		&item.PathID, &item.PathName, &item.SubjectID, &item.SubjectName, &item.TeacherName,
		&meetingURL, &item.MeetingDate, &item.DurationMinutes,
		&recordingURL, &item.ShowRecording, &item.JoinInstructions, &item.IsLocked,
	)
	if err != nil {
		return content.LearnerLiveLesson{}, mapError(err)
	}
	if !item.IsLocked {
		item.MeetingURL = meetingURL
		if item.ShowRecording {
			item.RecordingURL = recordingURL
		}
	}
	return item, nil
}
