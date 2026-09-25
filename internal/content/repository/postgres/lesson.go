package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateLesson(ctx context.Context, actorUserID string, command content.LessonCommand) (content.Lesson, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Lesson{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.Lesson{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.Lesson{}, err
	}
	assetIDs := make([]string, 0, len(command.Assets))
	for _, item := range command.Assets {
		assetIDs = append(assetIDs, item.AssetID)
	}
	if err := r.validateAssetsTx(ctx, tx, assetIDs); err != nil {
		return content.Lesson{}, err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO lessons (
			path_id,subject_id,title,description,lesson_type,content_text,duration_seconds,
			video_url,video_source,meeting_url,meeting_at,recording_url,join_instructions,show_recording,
			owner_type,owner_user_id,owner_school_id,created_by,assigned_teacher_id,workflow_status,
			is_visible,is_locked
		)
		VALUES (
			$1::uuid,$2::uuid,$3,$4,$5,$6,$7,NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),$11,
			NULLIF($12,''),$13,$14,$15,NULLIF($16,'')::uuid,NULLIF($17,'')::uuid,$18::uuid,
			NULLIF($19,'')::uuid,'draft',$20,$21
		)
		RETURNING id::text
	`, command.PathID, command.SubjectID, command.Title, command.Description, command.LessonType,
		command.ContentText, command.DurationSeconds, command.VideoURL, command.VideoSource, command.MeetingURL,
		command.MeetingAt, command.RecordingURL, command.JoinInstructions, command.ShowRecording,
		string(command.OwnerType), command.OwnerUserID, command.OwnerSchoolID, actorUserID,
		command.AssignedTeacherID, command.IsVisible, command.IsLocked).Scan(&id)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	if err := replaceLessonLinksTx(ctx, tx, id, command.SkillLinks, command.Assets); err != nil {
		return content.Lesson{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.lesson.create", ResourceType: "lesson", ResourceID: id,
		Metadata: map[string]any{"pathId": command.PathID, "subjectId": command.SubjectID, "type": command.LessonType},
	}); err != nil {
		return content.Lesson{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, id)
}

func (r *Repository) UpdateLesson(ctx context.Context, actorUserID, lessonID string, expectedRevision int, command content.LessonCommand) (content.Lesson, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Lesson{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	var status content.WorkflowStatus
	if err := tx.QueryRow(ctx, `SELECT revision,workflow_status FROM lessons WHERE id=$1::uuid FOR UPDATE`, lessonID).Scan(&current, &status); err != nil {
		return content.Lesson{}, mapError(err)
	}
	if current != expectedRevision {
		return content.Lesson{}, content.ErrVersionConflict
	}
	if status == content.WorkflowArchived {
		return content.Lesson{}, content.ErrConflict
	}
	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.Lesson{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.Lesson{}, err
	}
	assetIDs := make([]string, 0, len(command.Assets))
	for _, item := range command.Assets {
		assetIDs = append(assetIDs, item.AssetID)
	}
	if err := r.validateAssetsTx(ctx, tx, assetIDs); err != nil {
		return content.Lesson{}, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE lessons
		SET path_id=$2::uuid,subject_id=$3::uuid,title=$4,description=$5,lesson_type=$6,
			content_text=$7,duration_seconds=$8,video_url=NULLIF($9,''),video_source=NULLIF($10,''),
			meeting_url=NULLIF($11,''),meeting_at=$12,recording_url=NULLIF($13,''),join_instructions=$14,
			show_recording=$15,owner_type=$16,owner_user_id=NULLIF($17,'')::uuid,
			owner_school_id=NULLIF($18,'')::uuid,assigned_teacher_id=NULLIF($19,'')::uuid,
			is_visible=$20,is_locked=$21,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, lessonID, command.PathID, command.SubjectID, command.Title, command.Description, command.LessonType,
		command.ContentText, command.DurationSeconds, command.VideoURL, command.VideoSource, command.MeetingURL,
		command.MeetingAt, command.RecordingURL, command.JoinInstructions, command.ShowRecording,
		string(command.OwnerType), command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID,
		command.IsVisible, command.IsLocked)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	if err := replaceLessonLinksTx(ctx, tx, lessonID, command.SkillLinks, command.Assets); err != nil {
		return content.Lesson{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.lesson.update", ResourceType: "lesson", ResourceID: lessonID,
		Metadata: map[string]any{"fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.Lesson{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, lessonID)
}

func (r *Repository) GetLesson(ctx context.Context, lessonID string) (content.Lesson, error) {
	var row content.Lesson
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy string
	var revenue float64
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,lesson_type,content_text,duration_seconds,
			COALESCE(video_url,''),COALESCE(video_source,''),COALESCE(meeting_url,''),meeting_at,
			COALESCE(recording_url,''),join_instructions,show_recording,owner_type,
			COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),COALESCE(created_by::text,''),
			COALESCE(assigned_teacher_id::text,''),workflow_status,COALESCE(approved_by::text,''),approved_at,
			reviewer_notes,COALESCE(revenue_share_percentage::float8,-1),is_visible,is_locked,revision,created_at,updated_at
		FROM lessons WHERE id=$1::uuid
	`, lessonID).Scan(
		&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.LessonType, &row.ContentText,
		&row.DurationSeconds, &row.VideoURL, &row.VideoSource, &row.MeetingURL, &row.MeetingAt,
		&row.RecordingURL, &row.JoinInstructions, &row.ShowRecording, &row.Ownership.OwnerType,
		&ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID, &row.Ownership.WorkflowStatus,
		&approvedBy, &row.Ownership.ApprovedAt, &row.Ownership.ReviewerNotes, &revenue,
		&row.IsVisible, &row.IsLocked, &row.Ownership.Revision, &row.Ownership.CreatedAt, &row.Ownership.UpdatedAt,
	)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	row.Ownership.OwnerUserID = ownerUserID
	row.Ownership.OwnerSchoolID = ownerSchoolID
	row.Ownership.CreatedBy = createdBy
	row.Ownership.AssignedTeacherID = assignedTeacherID
	row.Ownership.ApprovedBy = approvedBy
	if revenue >= 0 {
		row.Ownership.RevenueShare = &revenue
	}
	links, assets, err := r.loadLessonLinks(ctx, lessonID)
	if err != nil {
		return content.Lesson{}, err
	}
	row.SkillLinks, row.Assets = links, assets
	return row, nil
}

func (r *Repository) ListLessons(ctx context.Context, query content.ListQuery) (content.LessonPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,lesson_type,content_text,duration_seconds,
			COALESCE(video_url,''),COALESCE(video_source,''),COALESCE(meeting_url,''),meeting_at,
			COALESCE(recording_url,''),join_instructions,show_recording,owner_type,
			COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),COALESCE(created_by::text,''),
			COALESCE(assigned_teacher_id::text,''),workflow_status,COALESCE(approved_by::text,''),approved_at,
			reviewer_notes,COALESCE(revenue_share_percentage::float8,-1),is_visible,is_locked,revision,created_at,updated_at
		FROM lessons l
		WHERE ($1='' OR l.path_id=$1::uuid)
		  AND ($2='' OR l.subject_id=$2::uuid)
		  AND ($3='' OR l.workflow_status=$3)
		  AND ($4='' OR lower(l.title) LIKE '%' || lower($4) || '%')
		  AND (
			$5='admin'
			OR ($5='teacher' AND (l.owner_user_id=$6::uuid OR l.assigned_teacher_id=$6::uuid))
			OR ($5='school_admin' AND EXISTS(
				SELECT 1 FROM school_memberships sm
				WHERE sm.user_id=$6::uuid AND sm.school_id=l.owner_school_id
				  AND sm.role='school_admin' AND sm.status='active'
			))
		  )
		ORDER BY l.updated_at DESC,l.id DESC
		LIMIT $7 OFFSET $8
	`, query.PathID, query.SubjectID, string(query.Workflow), query.Search, string(query.StaffScope), query.ActorUserID,
		query.Limit+1, (query.Page-1)*query.Limit)
	if err != nil {
		return content.LessonPage{}, mapError(err)
	}
	defer rows.Close()
	items := make([]content.Lesson, 0, query.Limit+1)
	for rows.Next() {
		var row content.Lesson
		var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy string
		var revenue float64
		if err := rows.Scan(
			&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.LessonType, &row.ContentText,
			&row.DurationSeconds, &row.VideoURL, &row.VideoSource, &row.MeetingURL, &row.MeetingAt,
			&row.RecordingURL, &row.JoinInstructions, &row.ShowRecording, &row.Ownership.OwnerType,
			&ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID, &row.Ownership.WorkflowStatus,
			&approvedBy, &row.Ownership.ApprovedAt, &row.Ownership.ReviewerNotes, &revenue,
			&row.IsVisible, &row.IsLocked, &row.Ownership.Revision, &row.Ownership.CreatedAt, &row.Ownership.UpdatedAt,
		); err != nil {
			return content.LessonPage{}, err
		}
		row.Ownership.OwnerUserID = ownerUserID
		row.Ownership.OwnerSchoolID = ownerSchoolID
		row.Ownership.CreatedBy = createdBy
		row.Ownership.AssignedTeacherID = assignedTeacherID
		row.Ownership.ApprovedBy = approvedBy
		if revenue >= 0 {
			row.Ownership.RevenueShare = &revenue
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

func (r *Repository) SetLessonWorkflow(ctx context.Context, actorUserID, lessonID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.Lesson, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Lesson{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var current int
	if err := tx.QueryRow(ctx, `SELECT revision FROM lessons WHERE id=$1::uuid FOR UPDATE`, lessonID).Scan(&current); err != nil {
		return content.Lesson{}, mapError(err)
	}
	if current != expectedRevision {
		return content.Lesson{}, content.ErrVersionConflict
	}
	_, err = tx.Exec(ctx, `
		UPDATE lessons
		SET workflow_status=$2,reviewer_notes=$3,
			approved_by=CASE WHEN $2='approved' THEN $4::uuid WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_by END,
			approved_at=CASE WHEN $2='approved' THEN now() WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_at END,
			revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, lessonID, string(status), notes, actorUserID)
	if err != nil {
		return content.Lesson{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.lesson.workflow", ResourceType: "lesson", ResourceID: lessonID,
		Metadata: map[string]any{"status": status, "fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.Lesson{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Lesson{}, err
	}
	return r.GetLesson(ctx, lessonID)
}

func replaceLessonLinksTx(ctx context.Context, tx pgx.Tx, lessonID string, skills []content.SkillLink, assets []content.AssetLink) error {
	if _, err := tx.Exec(ctx, `DELETE FROM lesson_skill_links WHERE lesson_id=$1::uuid`, lessonID); err != nil {
		return err
	}
	if _, err := tx.Exec(ctx, `DELETE FROM lesson_assets WHERE lesson_id=$1::uuid`, lessonID); err != nil {
		return err
	}
	for _, link := range skills {
		if _, err := tx.Exec(ctx, `
			INSERT INTO lesson_skill_links(lesson_id,skill_id,relation_type)
			VALUES($1::uuid,$2::uuid,$3)
		`, lessonID, link.SkillID, link.RelationType); err != nil {
			return mapError(err)
		}
	}
	for _, asset := range assets {
		if _, err := tx.Exec(ctx, `
			INSERT INTO lesson_assets(lesson_id,asset_id,purpose,title,sort_order)
			VALUES($1::uuid,$2::uuid,$3,$4,$5)
		`, lessonID, asset.AssetID, asset.Purpose, asset.Title, asset.SortOrder); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) loadLessonLinks(ctx context.Context, lessonID string) ([]content.SkillLink, []content.AssetLink, error) {
	skillRows, err := r.db.Query(ctx, `
		SELECT skill_id::text,relation_type FROM lesson_skill_links
		WHERE lesson_id=$1::uuid ORDER BY relation_type,skill_id
	`, lessonID)
	if err != nil {
		return nil, nil, err
	}
	skills := []content.SkillLink{}
	for skillRows.Next() {
		var item content.SkillLink
		if err := skillRows.Scan(&item.SkillID, &item.RelationType); err != nil {
			skillRows.Close()
			return nil, nil, err
		}
		skills = append(skills, item)
	}
	if err := skillRows.Err(); err != nil {
		skillRows.Close()
		return nil, nil, err
	}
	skillRows.Close()

	assetRows, err := r.db.Query(ctx, `
		SELECT asset_id::text,purpose,title,sort_order FROM lesson_assets
		WHERE lesson_id=$1::uuid ORDER BY sort_order,asset_id
	`, lessonID)
	if err != nil {
		return nil, nil, err
	}
	defer assetRows.Close()
	assets := []content.AssetLink{}
	for assetRows.Next() {
		var item content.AssetLink
		if err := assetRows.Scan(&item.AssetID, &item.Purpose, &item.Title, &item.SortOrder); err != nil {
			return nil, nil, err
		}
		assets = append(assets, item)
	}
	return skills, assets, assetRows.Err()
}
