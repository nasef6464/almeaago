package postgres

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateCourse(ctx context.Context, actorUserID string, command content.CourseCommand) (content.Course, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Course{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.Course{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.Course{}, err
	}
	if err := r.validateAssetsTx(ctx, tx, []string{command.ThumbnailAssetID}); err != nil {
		return content.Course{}, err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO courses (
			path_id, subject_id, title, description, instructor_name, duration_minutes, level,
			owner_type, owner_user_id, owner_school_id, created_by, assigned_teacher_id,
			workflow_status, is_visible, drip_content_enabled, certificate_enabled,
			thumbnail_asset_id, presentation
		)
		VALUES (
			$1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,
			NULLIF($9,'')::uuid,NULLIF($10,'')::uuid,$11::uuid,NULLIF($12,'')::uuid,
			'draft',$13,$14,$15,NULLIF($16,'')::uuid,$17::jsonb
		)
		RETURNING id::text
	`, command.PathID, command.SubjectID, command.Title, command.Description, command.InstructorName,
		command.DurationMinutes, command.Level, string(command.OwnerType), command.OwnerUserID, command.OwnerSchoolID,
		actorUserID, command.AssignedTeacherID, command.IsVisible, command.DripContentEnabled,
		command.CertificateEnabled, command.ThumbnailAssetID, string(command.Presentation)).Scan(&id)
	if err != nil {
		return content.Course{}, mapError(err)
	}
	if err := replaceCourseSkillsTx(ctx, tx, id, command.SkillLinks); err != nil {
		return content.Course{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID,
		Action: "content.course.create",
		ResourceType: "course",
		ResourceID: id,
		Metadata: map[string]any{"pathId": command.PathID, "subjectId": command.SubjectID},
	}); err != nil {
		return content.Course{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, id)
}

func (r *Repository) UpdateCourse(ctx context.Context, actorUserID, courseID string, expectedRevision int, command content.CourseCommand) (content.Course, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Course{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var currentRevision int
	var currentStatus content.WorkflowStatus
	if err := tx.QueryRow(ctx, `SELECT revision, workflow_status FROM courses WHERE id=$1::uuid FOR UPDATE`, courseID).Scan(&currentRevision, &currentStatus); err != nil {
		return content.Course{}, mapError(err)
	}
	if currentRevision != expectedRevision {
		return content.Course{}, content.ErrVersionConflict
	}
	if currentStatus == content.WorkflowArchived {
		return content.Course{}, content.ErrConflict
	}
	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.Course{}, err
	}
	if err := r.validateOwnerTx(ctx, tx, command.OwnerType, command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID); err != nil {
		return content.Course{}, err
	}
	if err := r.validateAssetsTx(ctx, tx, []string{command.ThumbnailAssetID}); err != nil {
		return content.Course{}, err
	}

	_, err = tx.Exec(ctx, `
		UPDATE courses
		SET path_id=$2::uuid, subject_id=$3::uuid, title=$4, description=$5, instructor_name=$6,
			duration_minutes=$7, level=$8, owner_type=$9, owner_user_id=NULLIF($10,'')::uuid,
			owner_school_id=NULLIF($11,'')::uuid, assigned_teacher_id=NULLIF($12,'')::uuid,
			is_visible=$13, drip_content_enabled=$14, certificate_enabled=$15,
			thumbnail_asset_id=NULLIF($16,'')::uuid, presentation=$17::jsonb,
			revision=revision+1, updated_at=now()
		WHERE id=$1::uuid
	`, courseID, command.PathID, command.SubjectID, command.Title, command.Description,
		command.InstructorName, command.DurationMinutes, command.Level, string(command.OwnerType),
		command.OwnerUserID, command.OwnerSchoolID, command.AssignedTeacherID, command.IsVisible,
		command.DripContentEnabled, command.CertificateEnabled, command.ThumbnailAssetID, string(command.Presentation))
	if err != nil {
		return content.Course{}, mapError(err)
	}
	if err := replaceCourseSkillsTx(ctx, tx, courseID, command.SkillLinks); err != nil {
		return content.Course{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.update", ResourceType: "course", ResourceID: courseID,
		Metadata: map[string]any{"fromRevision": currentRevision, "toRevision": currentRevision + 1},
	}); err != nil {
		return content.Course{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, courseID)
}

func (r *Repository) GetCourse(ctx context.Context, courseID string) (content.Course, error) {
	var row content.Course
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy, thumbnailAssetID string
	var revenue float64
	var presentation []byte
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,instructor_name,duration_minutes,level,
			owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),
			COALESCE(created_by::text,''),COALESCE(assigned_teacher_id::text,''),workflow_status,
			COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			COALESCE(revenue_share_percentage::float8,-1),is_visible,drip_content_enabled,certificate_enabled,
			COALESCE(thumbnail_asset_id::text,''),presentation,revision,created_at,updated_at
		FROM courses WHERE id=$1::uuid
	`, courseID).Scan(
		&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.InstructorName,
		&row.DurationMinutes, &row.Level, &row.Ownership.OwnerType, &ownerUserID, &ownerSchoolID,
		&createdBy, &assignedTeacherID, &row.Ownership.WorkflowStatus, &approvedBy, &row.Ownership.ApprovedAt,
		&row.Ownership.ReviewerNotes, &revenue, &row.IsVisible, &row.DripContentEnabled,
		&row.CertificateEnabled, &thumbnailAssetID, &presentation, &row.Ownership.Revision,
		&row.Ownership.CreatedAt, &row.Ownership.UpdatedAt,
	)
	if err != nil {
		return content.Course{}, mapError(err)
	}
	row.Ownership.OwnerUserID = ownerUserID
	row.Ownership.OwnerSchoolID = ownerSchoolID
	row.Ownership.CreatedBy = createdBy
	row.Ownership.AssignedTeacherID = assignedTeacherID
	row.Ownership.ApprovedBy = approvedBy
	if revenue >= 0 {
		row.Ownership.RevenueShare = &revenue
	}
	row.ThumbnailAssetID = thumbnailAssetID
	row.Presentation = json.RawMessage(presentation)
	links, err := r.loadCourseSkills(ctx, courseID)
	if err != nil {
		return content.Course{}, err
	}
	row.SkillLinks = links
	return row, nil
}

func (r *Repository) ListCourses(ctx context.Context, query content.ListQuery) (content.CoursePage, error) {
	args := []any{query.PathID, query.SubjectID, string(query.Workflow), query.Search, string(query.StaffScope), query.ActorUserID, query.Limit + 1, (query.Page - 1) * query.Limit}
	rows, err := r.db.Query(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,instructor_name,duration_minutes,level,
			owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),
			COALESCE(created_by::text,''),COALESCE(assigned_teacher_id::text,''),workflow_status,
			COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			COALESCE(revenue_share_percentage::float8,-1),is_visible,drip_content_enabled,certificate_enabled,
			COALESCE(thumbnail_asset_id::text,''),presentation,revision,created_at,updated_at
		FROM courses c
		WHERE ($1='' OR c.path_id=$1::uuid)
		  AND ($2='' OR c.subject_id=$2::uuid)
		  AND ($3='' OR c.workflow_status=$3)
		  AND ($4='' OR lower(c.title) LIKE '%' || lower($4) || '%')
		  AND (
			$5='admin'
			OR ($5='teacher' AND (c.owner_user_id=$6::uuid OR c.assigned_teacher_id=$6::uuid))
			OR ($5='school_admin' AND EXISTS(
				SELECT 1 FROM school_memberships sm
				WHERE sm.user_id=$6::uuid AND sm.school_id=c.owner_school_id
				  AND sm.role='school_admin' AND sm.status='active'
			))
		  )
		ORDER BY c.updated_at DESC,c.id DESC
		LIMIT $7 OFFSET $8
	`, args...)
	if err != nil {
		return content.CoursePage{}, mapError(err)
	}
	defer rows.Close()
	items := make([]content.Course, 0, query.Limit+1)
	for rows.Next() {
		var row content.Course
		var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy, thumbnailAssetID string
		var revenue float64
		var presentation []byte
		if err := rows.Scan(
			&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.InstructorName,
			&row.DurationMinutes, &row.Level, &row.Ownership.OwnerType, &ownerUserID, &ownerSchoolID,
			&createdBy, &assignedTeacherID, &row.Ownership.WorkflowStatus, &approvedBy, &row.Ownership.ApprovedAt,
			&row.Ownership.ReviewerNotes, &revenue, &row.IsVisible, &row.DripContentEnabled,
			&row.CertificateEnabled, &thumbnailAssetID, &presentation, &row.Ownership.Revision,
			&row.Ownership.CreatedAt, &row.Ownership.UpdatedAt,
		); err != nil {
			return content.CoursePage{}, err
		}
		row.Ownership.OwnerUserID = ownerUserID
		row.Ownership.OwnerSchoolID = ownerSchoolID
		row.Ownership.CreatedBy = createdBy
		row.Ownership.AssignedTeacherID = assignedTeacherID
		row.Ownership.ApprovedBy = approvedBy
		if revenue >= 0 {
			row.Ownership.RevenueShare = &revenue
		}
		row.ThumbnailAssetID = thumbnailAssetID
		row.Presentation = json.RawMessage(presentation)
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return content.CoursePage{}, err
	}
	hasMore := len(items) > query.Limit
	if hasMore {
		items = items[:query.Limit]
	}
	return content.CoursePage{Items: items, Page: query.Page, Limit: query.Limit, HasMore: hasMore}, nil
}

func (r *Repository) SetCourseWorkflow(ctx context.Context, actorUserID, courseID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.Course, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Course{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var current int
	if err := tx.QueryRow(ctx, `SELECT revision FROM courses WHERE id=$1::uuid FOR UPDATE`, courseID).Scan(&current); err != nil {
		return content.Course{}, mapError(err)
	}
	if current != expectedRevision {
		return content.Course{}, content.ErrVersionConflict
	}
	_, err = tx.Exec(ctx, `
		UPDATE courses
		SET workflow_status=$2, reviewer_notes=$3,
			approved_by=CASE WHEN $2='approved' THEN $4::uuid WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_by END,
			approved_at=CASE WHEN $2='approved' THEN now() WHEN $2 IN ('draft','pending_review','rejected') THEN NULL ELSE approved_at END,
			revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, courseID, string(status), notes, actorUserID)
	if err != nil {
		return content.Course{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.workflow", ResourceType: "course", ResourceID: courseID,
		Metadata: map[string]any{"status": status, "fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.Course{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, courseID)
}

func (r *Repository) CreateCourseModule(ctx context.Context, actorUserID, courseID, title, description string, sortOrder int) (content.CourseModule, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.CourseModule{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var status content.WorkflowStatus
	if err := tx.QueryRow(ctx, `SELECT workflow_status FROM courses WHERE id=$1::uuid FOR UPDATE`, courseID).Scan(&status); err != nil {
		return content.CourseModule{}, mapError(err)
	}
	if status == content.WorkflowArchived {
		return content.CourseModule{}, content.ErrConflict
	}
	var row content.CourseModule
	err = tx.QueryRow(ctx, `
		INSERT INTO course_modules(course_id,title,description,sort_order)
		VALUES($1::uuid,$2,$3,$4)
		RETURNING id::text,course_id::text,title,description,sort_order,status,created_at,updated_at
	`, courseID, title, description, sortOrder).Scan(
		&row.ID, &row.CourseID, &row.Title, &row.Description, &row.SortOrder, &row.Status, &row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return content.CourseModule{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.module.create", ResourceType: "course_module", ResourceID: row.ID,
		Metadata: map[string]any{"courseId": courseID},
	}); err != nil {
		return content.CourseModule{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.CourseModule{}, err
	}
	return row, nil
}

func (r *Repository) PlaceCourseLesson(ctx context.Context, actorUserID, courseID, moduleID, lessonID string, sortOrder int, preview bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var moduleCourseID string
	if err := tx.QueryRow(ctx, `
		SELECT course_id::text FROM course_modules
		WHERE id=$1::uuid AND status='active'
		FOR UPDATE
	`, moduleID).Scan(&moduleCourseID); err != nil {
		return mapError(err)
	}
	if moduleCourseID != courseID {
		return content.ErrConflict
	}
	var coursePath, courseSubject, lessonPath, lessonSubject string
	if err := tx.QueryRow(ctx, `SELECT path_id::text,subject_id::text FROM courses WHERE id=$1::uuid AND workflow_status<>'archived'`, courseID).Scan(&coursePath, &courseSubject); err != nil {
		return mapError(err)
	}
	if err := tx.QueryRow(ctx, `SELECT path_id::text,subject_id::text FROM lessons WHERE id=$1::uuid AND workflow_status<>'archived'`, lessonID).Scan(&lessonPath, &lessonSubject); err != nil {
		return mapError(err)
	}
	if coursePath != lessonPath || courseSubject != lessonSubject {
		return content.ErrConflict
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO course_lessons(module_id,lesson_id,sort_order,is_preview)
		VALUES($1::uuid,$2::uuid,$3,$4)
		ON CONFLICT(module_id,lesson_id)
		DO UPDATE SET sort_order=EXCLUDED.sort_order,is_preview=EXCLUDED.is_preview
	`, moduleID, lessonID, sortOrder, preview)
	if err != nil {
		return mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.course.lesson.place", ResourceType: "course", ResourceID: courseID,
		Metadata: map[string]any{"moduleId": moduleID, "lessonId": lessonID, "sortOrder": sortOrder, "preview": preview},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func replaceCourseSkillsTx(ctx context.Context, tx pgx.Tx, courseID string, links []content.SkillLink) error {
	if _, err := tx.Exec(ctx, `DELETE FROM course_skill_links WHERE course_id=$1::uuid`, courseID); err != nil {
		return err
	}
	for _, link := range links {
		if _, err := tx.Exec(ctx, `
			INSERT INTO course_skill_links(course_id,skill_id,relation_type)
			VALUES($1::uuid,$2::uuid,$3)
		`, courseID, link.SkillID, link.RelationType); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) loadCourseSkills(ctx context.Context, courseID string) ([]content.SkillLink, error) {
	rows, err := r.db.Query(ctx, `
		SELECT skill_id::text,relation_type
		FROM course_skill_links
		WHERE course_id=$1::uuid
		ORDER BY relation_type,skill_id
	`, courseID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []content.SkillLink{}
	for rows.Next() {
		var item content.SkillLink
		if err := rows.Scan(&item.SkillID, &item.RelationType); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

