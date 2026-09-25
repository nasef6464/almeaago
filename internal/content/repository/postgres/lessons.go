package postgres

import (
	"context"
	"fmt"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateLesson(ctx context.Context, actorUserID string, write content.LessonWrite) (content.Lesson, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Lesson{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, write.AssetIDs); err != nil {
		return content.Lesson{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.PathID, write.SubjectID, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.Lesson{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO lessons (
			path_id,subject_id,title,description,lesson_type,content_text,duration_seconds,video_url,video_source,
			meeting_url,meeting_at,recording_url,join_instructions,show_recording,owner_type,owner_user_id,owner_school_id,
			created_by,assigned_teacher_id,revenue_share_percentage,is_visible,is_locked
		) VALUES ($1::uuid,$2::uuid,$3,$4,$5,$6,$7,NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),$11,NULLIF($12,''),$13,$14,$15,
			NULLIF($16,'')::uuid,NULLIF($17,'')::uuid,$18::uuid,NULLIF($19,'')::uuid,$20,$21,$22)
		RETURNING id::text
	`, write.PathID, write.SubjectID, write.Title, write.Description, string(write.LessonType), write.ContentText, write.DurationSeconds,
		write.VideoURL, write.VideoSource, write.MeetingURL, write.MeetingAt, write.RecordingURL, write.JoinInstructions, write.ShowRecording,
		string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID, actorUserID, write.AssignedTeacherID, write.RevenueSharePercentage,
		write.IsVisible, write.IsLocked).Scan(&id)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	if err := replaceLessonLinksTx(ctx, tx, id, write.SkillIDs, write.AssetIDs, write.LessonType); err != nil {
		return content.Lesson{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.lesson.create", ResourceType: "lesson", ResourceID: id}); err != nil {
		return content.Lesson{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, id)
}

func (r *Repository) UpdateLesson(ctx context.Context, actorUserID, lessonID string, expectedRevision int, write content.LessonWrite) (content.Lesson, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Lesson{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, write.AssetIDs); err != nil {
		return content.Lesson{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.PathID, write.SubjectID, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.Lesson{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		UPDATE lessons SET path_id=$3::uuid,subject_id=$4::uuid,title=$5,description=$6,lesson_type=$7,content_text=$8,
			duration_seconds=$9,video_url=NULLIF($10,''),video_source=NULLIF($11,''),meeting_url=NULLIF($12,''),meeting_at=$13,
			recording_url=NULLIF($14,''),join_instructions=$15,show_recording=$16,owner_type=$17,
			owner_user_id=NULLIF($18,'')::uuid,owner_school_id=NULLIF($19,'')::uuid,assigned_teacher_id=NULLIF($20,'')::uuid,
			revenue_share_percentage=$21,is_visible=$22,is_locked=$23,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2 AND workflow_status NOT IN ('approved','archived')
		RETURNING id::text
	`, lessonID, expectedRevision, write.PathID, write.SubjectID, write.Title, write.Description, string(write.LessonType), write.ContentText,
		write.DurationSeconds, write.VideoURL, write.VideoSource, write.MeetingURL, write.MeetingAt, write.RecordingURL, write.JoinInstructions,
		write.ShowRecording, string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID,
		write.RevenueSharePercentage, write.IsVisible, write.IsLocked).Scan(&id)
	if err != nil {
		return content.Lesson{}, mapUpdateError(ctx, tx, "lessons", lessonID, expectedRevision, err)
	}
	if err := replaceLessonLinksTx(ctx, tx, id, write.SkillIDs, write.AssetIDs, write.LessonType); err != nil {
		return content.Lesson{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.lesson.update", ResourceType: "lesson", ResourceID: id}); err != nil {
		return content.Lesson{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, id)
}

func (r *Repository) SetLessonWorkflow(ctx context.Context, actorUserID, lessonID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.Lesson, error) {
	if err := r.setWorkflow(ctx, actorUserID, "lessons", "lesson", lessonID, expectedRevision, status, reviewerNotes); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, lessonID)
}

func (r *Repository) GetLesson(ctx context.Context, lessonID string) (content.Lesson, error) {
	var row content.Lesson
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy, videoURL, videoSource, meetingURL, recordingURL string
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,lesson_type,content_text,duration_seconds,
			COALESCE(video_url,''),COALESCE(video_source,''),COALESCE(meeting_url,''),meeting_at,COALESCE(recording_url,''),join_instructions,
			show_recording,owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),COALESCE(created_by::text,''),
			COALESCE(assigned_teacher_id::text,''),workflow_status,COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			revenue_share_percentage,is_visible,is_locked,revision,created_at,updated_at
		FROM lessons WHERE id=$1::uuid
	`, lessonID).Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.LessonType, &row.ContentText,
		&row.DurationSeconds, &videoURL, &videoSource, &meetingURL, &row.MeetingAt, &recordingURL, &row.JoinInstructions,
		&row.ShowRecording, &row.OwnerType, &ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID, &row.WorkflowStatus,
		&approvedBy, &row.ApprovedAt, &row.ReviewerNotes, &row.RevenueSharePercentage, &row.IsVisible, &row.IsLocked,
		&row.Revision, &row.CreatedAt, &row.UpdatedAt)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	row.OwnerUserID, row.OwnerSchoolID, row.CreatedBy = ownerUserID, ownerSchoolID, createdBy
	row.AssignedTeacherID, row.ApprovedBy = assignedTeacherID, approvedBy
	row.VideoURL, row.VideoSource, row.MeetingURL, row.RecordingURL = videoURL, videoSource, meetingURL, recordingURL
	row.SkillIDs, err = r.loadIDs(ctx, `SELECT skill_id::text FROM lesson_skill_links WHERE lesson_id=$1::uuid ORDER BY skill_id`, lessonID)
	if err != nil {
		return content.Lesson{}, err
	}
	row.AssetIDs, err = r.loadIDs(ctx, `SELECT asset_id::text FROM lesson_assets WHERE lesson_id=$1::uuid ORDER BY sort_order,asset_id`, lessonID)
	if err != nil {
		return content.Lesson{}, err
	}
	return row, nil
}

func (r *Repository) ListLessons(ctx context.Context, query content.ListQuery) (content.LessonPage, error) {
	where, args := buildListWhere(query, "l")
	args = append(args, query.Limit+1, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT l.id::text,l.path_id::text,l.subject_id::text,l.title,l.lesson_type,l.duration_seconds,
			l.owner_type,COALESCE(l.owner_user_id::text,''),COALESCE(l.owner_school_id::text,''),
			COALESCE(l.assigned_teacher_id::text,''),l.workflow_status,l.is_visible,l.is_locked,l.revision,l.updated_at
		FROM lessons l WHERE `+where+`
		ORDER BY l.updated_at DESC,l.id DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return content.LessonPage{}, err
	}
	defer rows.Close()
	items := make([]content.Lesson, 0, query.Limit+1)
	for rows.Next() {
		var row content.Lesson
		if err := rows.Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.LessonType, &row.DurationSeconds,
			&row.OwnerType, &row.OwnerUserID, &row.OwnerSchoolID, &row.AssignedTeacherID, &row.WorkflowStatus,
			&row.IsVisible, &row.IsLocked, &row.Revision, &row.UpdatedAt); err != nil {
			return content.LessonPage{}, err
		}
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return content.LessonPage{}, err
	}
	hasMore := len(items) > query.Limit
	if hasMore {
		items = items[:query.Limit]
	}
	return content.LessonPage{Items: items, Page: query.Page, Limit: query.Limit, HasMore: hasMore}, nil
}
