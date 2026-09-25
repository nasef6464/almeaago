package postgres

import (
	"context"
	"encoding/json"
	"fmt"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateCourse(ctx context.Context, actorUserID string, write content.CourseWrite) (content.Course, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Course{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, []string{write.ThumbnailAssetID}); err != nil {
		return content.Course{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.PathID, write.SubjectID, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.Course{}, err
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO courses (
			path_id, subject_id, title, description, instructor_name, duration_minutes, level,
			owner_type, owner_user_id, owner_school_id, created_by, assigned_teacher_id,
			revenue_share_percentage, is_visible, drip_content_enabled, certificate_enabled,
			thumbnail_asset_id, presentation
		)
		VALUES (
			$1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8,NULLIF($9,'')::uuid,NULLIF($10,'')::uuid,
			$11::uuid,NULLIF($12,'')::uuid,$13,$14,$15,$16,NULLIF($17,'')::uuid,$18::jsonb
		)
		RETURNING id::text
	`, write.PathID, write.SubjectID, write.Title, write.Description, write.InstructorName, write.DurationMinutes, string(write.Level),
		string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID, actorUserID, write.AssignedTeacherID,
		write.RevenueSharePercentage, write.IsVisible, write.DripContentEnabled, write.CertificateEnabled,
		write.ThumbnailAssetID, string(write.Presentation)).Scan(&id)
	if err != nil {
		return content.Course{}, mapError(err)
	}
	if err := replaceCourseSkillsTx(ctx, tx, id, write.SkillIDs); err != nil {
		return content.Course{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.course.create", ResourceType: "course", ResourceID: id}); err != nil {
		return content.Course{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, id)
}

func (r *Repository) UpdateCourse(ctx context.Context, actorUserID, courseID string, expectedRevision int, write content.CourseWrite) (content.Course, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.Course{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, []string{write.ThumbnailAssetID}); err != nil {
		return content.Course{}, err
	}
	if err := validateOwnerTx(ctx, tx, write.PathID, write.SubjectID, write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID); err != nil {
		return content.Course{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		UPDATE courses SET
			path_id=$3::uuid, subject_id=$4::uuid, title=$5, description=$6, instructor_name=$7,
			duration_minutes=$8, level=$9, owner_type=$10, owner_user_id=NULLIF($11,'')::uuid,
			owner_school_id=NULLIF($12,'')::uuid, assigned_teacher_id=NULLIF($13,'')::uuid,
			revenue_share_percentage=$14, is_visible=$15, drip_content_enabled=$16,
			certificate_enabled=$17, thumbnail_asset_id=NULLIF($18,'')::uuid, presentation=$19::jsonb,
			revision=revision+1, updated_at=now()
		WHERE id=$1::uuid AND revision=$2 AND workflow_status NOT IN ('approved','archived')
		RETURNING id::text
	`, courseID, expectedRevision, write.PathID, write.SubjectID, write.Title, write.Description, write.InstructorName,
		write.DurationMinutes, string(write.Level), string(write.OwnerType), write.OwnerUserID, write.OwnerSchoolID,
		write.AssignedTeacherID, write.RevenueSharePercentage, write.IsVisible, write.DripContentEnabled,
		write.CertificateEnabled, write.ThumbnailAssetID, string(write.Presentation)).Scan(&id)
	if err != nil {
		return content.Course{}, mapUpdateError(ctx, tx, "courses", courseID, expectedRevision, err)
	}
	if err := replaceCourseSkillsTx(ctx, tx, id, write.SkillIDs); err != nil {
		return content.Course{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.course.update", ResourceType: "course", ResourceID: id}); err != nil {
		return content.Course{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, id)
}

func (r *Repository) SetCourseWorkflow(ctx context.Context, actorUserID, courseID string, expectedRevision int, status content.WorkflowStatus, reviewerNotes string) (content.Course, error) {
	if err := r.setWorkflow(ctx, actorUserID, "courses", "course", courseID, expectedRevision, status, reviewerNotes); err != nil {
		return content.Course{}, err
	}
	return r.GetCourse(ctx, courseID)
}

func (r *Repository) GetCourse(ctx context.Context, courseID string) (content.Course, error) {
	var row content.Course
	var ownerUserID, ownerSchoolID, createdBy, assignedTeacherID, approvedBy, thumbnailAssetID string
	var presentation []byte
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,title,description,instructor_name,duration_minutes,level,
			owner_type,COALESCE(owner_user_id::text,''),COALESCE(owner_school_id::text,''),COALESCE(created_by::text,''),
			COALESCE(assigned_teacher_id::text,''),workflow_status,COALESCE(approved_by::text,''),approved_at,reviewer_notes,
			revenue_share_percentage,is_visible,drip_content_enabled,certificate_enabled,COALESCE(thumbnail_asset_id::text,''),
			presentation,revision,created_at,updated_at
		FROM courses WHERE id=$1::uuid
	`, courseID).Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.Description, &row.InstructorName,
		&row.DurationMinutes, &row.Level, &row.OwnerType, &ownerUserID, &ownerSchoolID, &createdBy, &assignedTeacherID,
		&row.WorkflowStatus, &approvedBy, &row.ApprovedAt, &row.ReviewerNotes, &row.RevenueSharePercentage, &row.IsVisible,
		&row.DripContentEnabled, &row.CertificateEnabled, &thumbnailAssetID, &presentation, &row.Revision, &row.CreatedAt, &row.UpdatedAt)
	if err != nil {
		return content.Course{}, mapError(err)
	}
	row.OwnerUserID, row.OwnerSchoolID, row.CreatedBy = ownerUserID, ownerSchoolID, createdBy
	row.AssignedTeacherID, row.ApprovedBy, row.ThumbnailAssetID = assignedTeacherID, approvedBy, thumbnailAssetID
	row.Presentation = json.RawMessage(presentation)
	row.SkillIDs, err = r.loadIDs(ctx, `SELECT skill_id::text FROM course_skill_links WHERE course_id=$1::uuid ORDER BY skill_id`, courseID)
	if err != nil {
		return content.Course{}, err
	}
	return row, nil
}

func (r *Repository) ListCourses(ctx context.Context, query content.ListQuery) (content.CoursePage, error) {
	where, args := buildListWhere(query, "c")
	args = append(args, query.Limit+1, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT c.id::text,c.path_id::text,c.subject_id::text,c.title,c.instructor_name,c.duration_minutes,c.level,
			c.owner_type,COALESCE(c.owner_user_id::text,''),COALESCE(c.owner_school_id::text,''),
			COALESCE(c.assigned_teacher_id::text,''),c.workflow_status,c.is_visible,c.revision,c.updated_at
		FROM courses c
		WHERE `+where+`
		ORDER BY c.updated_at DESC,c.id DESC
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return content.CoursePage{}, err
	}
	defer rows.Close()
	items := make([]content.Course, 0, query.Limit+1)
	for rows.Next() {
		var row content.Course
		if err := rows.Scan(&row.ID, &row.PathID, &row.SubjectID, &row.Title, &row.InstructorName, &row.DurationMinutes,
			&row.Level, &row.OwnerType, &row.OwnerUserID, &row.OwnerSchoolID, &row.AssignedTeacherID,
			&row.WorkflowStatus, &row.IsVisible, &row.Revision, &row.UpdatedAt); err != nil {
			return content.CoursePage{}, err
		}
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

func (r *Repository) CourseReadyForApproval(ctx context.Context, courseID string) (bool, error) {
	var ready bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM course_modules cm
			JOIN course_lessons cl ON cl.module_id=cm.id
			JOIN lessons l ON l.id=cl.lesson_id
			WHERE cm.course_id=$1::uuid AND cm.status='active'
			  AND l.workflow_status='approved' AND l.is_visible=true
		)
	`, courseID).Scan(&ready)
	return ready, err
}
