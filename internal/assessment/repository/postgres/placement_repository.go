package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreatePlacement(ctx context.Context, actor, assessmentID string, w assessment.PlacementWrite) (assessment.Placement, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Placement{}, err
	}
	defer tx.Rollback(ctx)

	var version int
	err = tx.QueryRow(ctx, `
		SELECT d.published_version
		FROM assessments d
		JOIN assessment_versions v
		  ON v.assessment_id=d.id
		 AND v.version=d.published_version
		WHERE d.id=$1::uuid
		  AND d.workflow_status='approved'
		  AND d.is_published=true
		  AND d.is_visible=true
		  AND v.path_id=$2::uuid
		  AND v.subject_id=$3::uuid
		FOR UPDATE OF d
	`, assessmentID, w.PathID, w.SubjectID).Scan(&version)
	if err != nil {
		return assessment.Placement{}, mapError(err)
	}

	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_learning_placements(
			assessment_id,assessment_version,slot,access_type,path_id,subject_id,course_id,lesson_id,topic_id,
			is_visible,sort_order,created_by
		) VALUES(
			$1::uuid,$2,$3,$4,$5::uuid,$6::uuid,NULLIF($7,'')::uuid,NULLIF($8,'')::uuid,NULLIF($9,'')::uuid,
			$10,$11,$12::uuid
		)
		RETURNING id::text
	`, assessmentID, version, string(w.Slot), string(w.AccessType), w.PathID, w.SubjectID, w.CourseID, w.LessonID, w.TopicID, w.IsVisible, w.SortOrder, actor).Scan(&id)
	if err != nil {
		return assessment.Placement{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actor,
		Action:       "assessment.placement.create",
		ResourceType: "assessment_learning_placement",
		ResourceID:   id,
		Metadata: map[string]any{
			"assessmentId": assessmentID,
			"version":      version,
			"slot":         w.Slot,
			"pathId":       w.PathID,
			"subjectId":    w.SubjectID,
		},
	}); err != nil {
		return assessment.Placement{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Placement{}, err
	}
	return r.GetPlacement(ctx, id)
}

func (r *Repository) GetPlacement(ctx context.Context, id string) (assessment.Placement, error) {
	var p assessment.Placement
	err := r.db.QueryRow(ctx, `
		SELECT id::text,assessment_id::text,assessment_version,slot,access_type,path_id::text,
		       COALESCE(subject_id::text,''),COALESCE(course_id::text,''),COALESCE(lesson_id::text,''),
		       COALESCE(topic_id::text,''),is_visible,sort_order,created_at,updated_at
		FROM assessment_learning_placements
		WHERE id=$1::uuid
	`, id).Scan(
		&p.ID, &p.AssessmentID, &p.AssessmentVersion, &p.Slot, &p.AccessType, &p.PathID, &p.SubjectID,
		&p.CourseID, &p.LessonID, &p.TopicID, &p.IsVisible, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
	)
	if err != nil {
		return p, mapError(err)
	}
	return p, nil
}

func (r *Repository) ListPlacements(ctx context.Context, assessmentID string, page, limit int) (assessment.PlacementPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,assessment_id::text,assessment_version,slot,access_type,path_id::text,
		       COALESCE(subject_id::text,''),COALESCE(course_id::text,''),COALESCE(lesson_id::text,''),
		       COALESCE(topic_id::text,''),is_visible,sort_order,created_at,updated_at
		FROM assessment_learning_placements
		WHERE assessment_id=$1::uuid
		ORDER BY assessment_version DESC,sort_order,id
		LIMIT $2 OFFSET $3
	`, assessmentID, limit+1, (page-1)*limit)
	if err != nil {
		return assessment.PlacementPage{}, err
	}
	defer rows.Close()
	out := assessment.PlacementPage{Page: page, Limit: limit}
	for rows.Next() {
		var p assessment.Placement
		if err = rows.Scan(
			&p.ID, &p.AssessmentID, &p.AssessmentVersion, &p.Slot, &p.AccessType, &p.PathID, &p.SubjectID,
			&p.CourseID, &p.LessonID, &p.TopicID, &p.IsVisible, &p.SortOrder, &p.CreatedAt, &p.UpdatedAt,
		); err != nil {
			return out, err
		}
		out.Items = append(out.Items, p)
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

func (r *Repository) PatchPlacement(ctx context.Context, actor, id string, expected time.Time, accessType assessment.PlacementAccessType, visible bool, sortOrder int) (assessment.Placement, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Placement{}, err
	}
	defer tx.Rollback(ctx)
	tag, err := tx.Exec(ctx, `
		UPDATE assessment_learning_placements
		SET access_type=$3,is_visible=$4,sort_order=$5,updated_at=now()
		WHERE id=$1::uuid AND updated_at=$2
	`, id, expected, string(accessType), visible, sortOrder)
	if err != nil {
		return assessment.Placement{}, mapError(err)
	}
	if tag.RowsAffected() == 0 {
		return assessment.Placement{}, assessment.ErrVersionConflict
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actor,
		Action:       "assessment.placement.update",
		ResourceType: "assessment_learning_placement",
		ResourceID:   id,
		Metadata:     map[string]any{"accessType": accessType, "visible": visible, "sortOrder": sortOrder},
	}); err != nil {
		return assessment.Placement{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Placement{}, err
	}
	return r.GetPlacement(ctx, id)
}

func (r *Repository) ListLearnerPlacements(ctx context.Context, student string, q assessment.LearnerPlacementQuery) (assessment.LearnerPlacementPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			p.id::text,p.assessment_id::text,p.assessment_version,v.assessment_kind,v.title,p.slot,p.path_id::text,
			COALESCE(p.subject_id::text,''),COALESCE(p.course_id::text,''),COALESCE(p.lesson_id::text,''),
			COALESCE(p.topic_id::text,''),p.sort_order,
			(SELECT count(*)::int FROM assessment_attempts x WHERE x.placement_id=p.id AND x.student_id=$1::uuid),
			v.max_attempts,p.access_type,v.access_type
		FROM assessment_learning_placements p
		JOIN assessments d ON d.id=p.assessment_id
		JOIN assessment_versions v ON v.assessment_id=p.assessment_id AND v.version=p.assessment_version
		WHERE p.is_visible=true
		  AND d.workflow_status='approved'
		  AND d.is_published=true
		  AND d.is_visible=true
		  AND p.path_id=$2::uuid
		  AND p.subject_id=$3::uuid
		  AND p.slot=$4
		  AND ($5='' OR p.course_id=NULLIF($5,'')::uuid)
		  AND ($6='' OR p.lesson_id=NULLIF($6,'')::uuid)
		  AND ($7='' OR p.topic_id=NULLIF($7,'')::uuid)
		ORDER BY p.sort_order,p.id
		LIMIT $8 OFFSET $9
	`, student, q.PathID, q.SubjectID, string(q.Slot), q.CourseID, q.LessonID, q.TopicID, q.Limit+1, (q.Page-1)*q.Limit)
	if err != nil {
		return assessment.LearnerPlacementPage{}, err
	}
	defer rows.Close()
	out := assessment.LearnerPlacementPage{Page: q.Page, Limit: q.Limit}
	for rows.Next() {
		var p assessment.LearnerPlacement
		if err = rows.Scan(
			&p.PlacementID, &p.AssessmentID, &p.AssessmentVersion, &p.AssessmentKind, &p.Title, &p.Slot, &p.PathID,
			&p.SubjectID, &p.CourseID, &p.LessonID, &p.TopicID, &p.SortOrder, &p.AttemptCount, &p.MaxAttempts,
			&p.AccessType, &p.BaseAccessType,
		); err != nil {
			return out, err
		}
		p.CanStart = p.AttemptCount < p.MaxAttempts
		out.Items = append(out.Items, p)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > q.Limit {
		out.HasMore = true
		out.Items = out.Items[:q.Limit]
	}
	return out, nil
}

func (r *Repository) GetPlacementAccessContext(ctx context.Context, placementID string) (assessment.AccessContext, error) {
	var out assessment.AccessContext
	err := r.db.QueryRow(ctx, `
SELECT p.assessment_id::text,v.assessment_kind,v.access_type,p.id::text,p.slot,p.access_type,
       p.path_id::text,COALESCE(p.subject_id::text,''),COALESCE(p.course_id::text,'')
FROM assessment_learning_placements p
JOIN assessments a ON a.id=p.assessment_id
JOIN assessment_versions v ON v.assessment_id=p.assessment_id AND v.version=p.assessment_version
WHERE p.id=$1::uuid
  AND p.is_visible=true
  AND a.workflow_status='approved'
  AND a.is_published=true
  AND a.is_visible=true
`, placementID).Scan(
		&out.AssessmentID, &out.AssessmentKind, &out.BaseAccess, &out.PlacementID, &out.PlacementSlot,
		&out.PlacementAccess, &out.PathID, &out.SubjectID, &out.CourseID,
	)
	if err != nil {
		return out, mapError(err)
	}
	return out, nil
}

func (r *Repository) StartPlacement(ctx context.Context, student, placementID, startKey string) (assessment.Attempt, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Attempt{}, err
	}
	defer tx.Rollback(ctx)

	var existingID, existingStudent, existingPlacement string
	err = tx.QueryRow(ctx, `
		SELECT id::text,student_id::text,COALESCE(placement_id::text,'')
		FROM assessment_attempts
		WHERE start_key=$1
	`, startKey).Scan(&existingID, &existingStudent, &existingPlacement)
	if err == nil {
		if existingStudent != student || existingPlacement != placementID {
			return assessment.Attempt{}, assessment.ErrConflict
		}
		if err = tx.Commit(ctx); err != nil {
			return assessment.Attempt{}, err
		}
		return r.GetAttempt(ctx, existingID)
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return assessment.Attempt{}, err
	}

	var assessmentID string
	var version, maxAttempts int
	var timeLimit *int
	err = tx.QueryRow(ctx, `
		SELECT p.assessment_id::text,p.assessment_version,v.max_attempts,v.time_limit_seconds
		FROM assessment_learning_placements p
		JOIN assessments d ON d.id=p.assessment_id
		JOIN assessment_versions v ON v.assessment_id=p.assessment_id AND v.version=p.assessment_version
		WHERE p.id=$1::uuid
		  AND p.is_visible=true
		  AND d.workflow_status='approved'
		  AND d.is_published=true
		  AND d.is_visible=true
		FOR UPDATE OF p
	`, placementID).Scan(&assessmentID, &version, &maxAttempts, &timeLimit)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}

	var used int
	if err = tx.QueryRow(ctx, `
		SELECT count(*)::int
		FROM assessment_attempts
		WHERE placement_id=$1::uuid AND student_id=$2::uuid
	`, placementID, student).Scan(&used); err != nil {
		return assessment.Attempt{}, err
	}
	if used >= maxAttempts {
		return assessment.Attempt{}, assessment.ErrConflict
	}

	var invalid bool
	if err = tx.QueryRow(ctx, `
		SELECT
			EXISTS(
				SELECT 1
				FROM assessment_version_questions aq
				JOIN question_versions qv
				  ON qv.question_id=aq.question_id AND qv.version=aq.question_version
				WHERE aq.assessment_id=$1::uuid
				  AND aq.assessment_version=$2
				  AND qv.correct_option_index IS NULL
			)
			OR NOT EXISTS(
				SELECT 1
				FROM assessment_version_questions
				WHERE assessment_id=$1::uuid AND assessment_version=$2
			)
	`, assessmentID, version).Scan(&invalid); err != nil {
		return assessment.Attempt{}, err
	}
	if invalid {
		return assessment.Attempt{}, assessment.ErrConflict
	}

	var id string
	var expires *time.Time
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_attempts(
			assessment_id,assessment_version,student_id,placement_id,attempt_number,start_key,expires_at,source_context
		) VALUES(
			$1::uuid,$2,$3::uuid,$4::uuid,$5,$6,
			CASE WHEN $7::int IS NULL THEN NULL ELSE now()+make_interval(secs=>$7) END,
			jsonb_build_object('type','placement','placementId',$4::text)
		)
		RETURNING id::text,expires_at
	`, assessmentID, version, student, placementID, used+1, startKey, timeLimit).Scan(&id, &expires)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorOrStudent(student),
		Action:       "assessment.placement.attempt.start",
		ResourceType: "assessment_attempt",
		ResourceID:   id,
		Metadata: map[string]any{
			"placementId":  placementID,
			"assessmentId": assessmentID,
			"version":      version,
		},
	}); err != nil {
		return assessment.Attempt{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Attempt{}, err
	}
	return r.GetAttempt(ctx, id)
}

func actorOrStudent(student string) string { return student }

// ListStudyPlanResources is Learning's bounded Assessment catalog boundary.
// Only visible placements pinned to published Assessment versions are exposed.
func (r *Repository) ListStudyPlanResources(
	ctx context.Context,
	studentID, pathID string,
	subjectIDs, courseIDs []string,
	limit int,
) ([]assessment.StudyPlanResource, error) {
	if limit < 1 || limit > 100 {
		return nil, assessment.ErrConflict
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			p.id::text,
			p.assessment_id::text,
			p.assessment_version,
			p.subject_id::text,
			v.title,
			p.slot,
			COALESCE(p.course_id::text,''),
			GREATEST(10,COALESCE(CEIL(v.time_limit_seconds/60.0)::int,25)),
			p.sort_order,
			EXISTS(
				SELECT 1
				FROM assessment_attempts x
				JOIN assessment_results z ON z.attempt_id=x.id
				WHERE x.placement_id=p.id
				  AND x.student_id=$1::uuid
			),
			(
				SELECT COUNT(*)::int
				FROM assessment_attempts x
				WHERE x.placement_id=p.id
				  AND x.student_id=$1::uuid
			) < v.max_attempts
		FROM assessment_learning_placements p
		JOIN assessments d ON d.id=p.assessment_id
		JOIN assessment_versions v
		  ON v.assessment_id=p.assessment_id
		 AND v.version=p.assessment_version
		WHERE p.is_visible=true
		  AND d.workflow_status='approved'
		  AND d.is_published=true
		  AND d.is_visible=true
		  AND p.path_id=$2::uuid
		  AND (cardinality($3::text[])=0 OR p.subject_id::text=ANY($3::text[]))
		  AND p.slot IN ('training','tests','foundation','course')
		  AND (
			p.slot<>'course'
			OR cardinality($4::text[])=0
			OR p.course_id::text=ANY($4::text[])
		  )
		ORDER BY p.subject_id,p.sort_order,p.id
		LIMIT $5
	`, studentID, pathID, subjectIDs, courseIDs, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := make([]assessment.StudyPlanResource, 0, limit)
	for rows.Next() {
		var item assessment.StudyPlanResource
		if err = rows.Scan(
			&item.PlacementID,
			&item.AssessmentID,
			&item.AssessmentVersion,
			&item.SubjectID,
			&item.Title,
			&item.Slot,
			&item.CourseID,
			&item.DurationMinutes,
			&item.SortOrder,
			&item.Completed,
			&item.CanStart,
		); err != nil {
			return nil, err
		}
		out = append(out, item)
	}
	return out, rows.Err()
}
