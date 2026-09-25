package postgres

import (
	"context"
	"errors"
	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	"strconv"
	"time"
)

func has(r []identity.Role, x identity.Role) bool {
	for _, v := range r {
		if v == x {
			return true
		}
	}
	return false
}
func (r *Repository) canManageAssignment(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, actor string, roles []identity.Role, school, assessmentID string) (bool, error) {
	if has(roles, identity.RoleAdmin) {
		return true, nil
	}
	var ok bool
	e := q.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessments a WHERE a.id=$1::uuid AND ((a.owner_type='teacher' AND a.owner_user_id=$2::uuid) OR a.assigned_teacher_id=$2::uuid)) AND EXISTS(SELECT 1 FROM schools s WHERE s.id=$3::uuid AND s.status='active' AND (EXISTS(SELECT 1 FROM teaching_assignments ta WHERE ta.school_id=s.id AND ta.teacher_id=$2::uuid AND ta.status='active') OR EXISTS(SELECT 1 FROM school_supervisor_scopes ss WHERE ss.school_id=s.id AND ss.supervisor_user_id=$2::uuid AND ss.status='active') OR EXISTS(SELECT 1 FROM school_memberships sm WHERE sm.school_id=s.id AND sm.user_id=$2::uuid AND sm.role='school_admin' AND sm.status='active')))`, assessmentID, actor, school).Scan(&ok)
	return ok, e
}
func (r *Repository) CreateAssignment(ctx context.Context, actor string, roles []identity.Role, aid string, w assessment.AssignmentWrite) (assessment.Assignment, error) {
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Assignment{}, e
	}
	defer tx.Rollback(ctx)
	ok, e := r.canManageAssignment(ctx, tx, actor, roles, w.SchoolID, aid)
	if e != nil {
		return assessment.Assignment{}, e
	}
	if !ok {
		return assessment.Assignment{}, assessment.ErrConflict
	}
	var ver int
	e = tx.QueryRow(ctx, `SELECT published_version FROM assessments WHERE id=$1::uuid AND workflow_status='approved' AND is_published AND is_visible`, aid).Scan(&ver)
	if e != nil {
		return assessment.Assignment{}, mapError(e)
	}
	var id string
	e = tx.QueryRow(ctx, `INSERT INTO assessment_assignments(assessment_id,assessment_version,school_id,opens_at,closes_at,max_attempts_override,supervisor_message,created_by) VALUES($1::uuid,$2,$3::uuid,$4,$5,$6,$7,$8::uuid) RETURNING id::text`, aid, ver, w.SchoolID, w.OpensAt, w.ClosesAt, w.MaxAttemptsOverride, w.SupervisorMessage, actor).Scan(&id)
	if e != nil {
		return assessment.Assignment{}, mapError(e)
	}
	for _, u := range w.UserIDs {
		tag, e := tx.Exec(ctx, `INSERT INTO assessment_assignment_users(assignment_id,user_id) SELECT $1::uuid,cm.user_id FROM class_memberships cm JOIN classes c ON c.id=cm.class_id WHERE cm.user_id=$2::uuid AND cm.status='active' AND c.school_id=$3::uuid AND c.status='active' AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=cm.user_id AND ur.role='student') ON CONFLICT DO NOTHING`, id, u, w.SchoolID)
		if e != nil {
			return assessment.Assignment{}, mapError(e)
		}
		if tag.RowsAffected() == 0 {
			return assessment.Assignment{}, assessment.ErrConflict
		}
	}
	for _, cl := range w.ClassIDs {
		tag, e := tx.Exec(ctx, `INSERT INTO assessment_assignment_classes(assignment_id,class_id) SELECT $1::uuid,c.id FROM classes c WHERE c.id=$2::uuid AND c.school_id=$3::uuid AND c.status='active' ON CONFLICT DO NOTHING`, id, cl, w.SchoolID)
		if e != nil {
			return assessment.Assignment{}, mapError(e)
		}
		if tag.RowsAffected() == 0 {
			return assessment.Assignment{}, assessment.ErrConflict
		}
	}
	if e = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.assignment.create", ResourceType: "assessment_assignment", ResourceID: id, Metadata: map[string]any{"assessmentId": aid, "version": ver, "schoolId": w.SchoolID}}); e != nil {
		return assessment.Assignment{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Assignment{}, e
	}
	return r.getAssignment(ctx, id)
}
func (r *Repository) getAssignment(ctx context.Context, id string) (assessment.Assignment, error) {
	var a assessment.Assignment
	e := r.db.QueryRow(ctx, `SELECT id::text,assessment_id::text,assessment_version,COALESCE(school_id::text,''),status,opens_at,closes_at,max_attempts_override,supervisor_message,created_at,updated_at FROM assessment_assignments WHERE id=$1::uuid`, id).Scan(&a.ID, &a.AssessmentID, &a.AssessmentVersion, &a.SchoolID, &a.Status, &a.OpensAt, &a.ClosesAt, &a.MaxAttemptsOverride, &a.SupervisorMessage, &a.CreatedAt, &a.UpdatedAt)
	if e != nil {
		return a, mapError(e)
	}
	rows, e := r.db.Query(ctx, `SELECT user_id::text FROM assessment_assignment_users WHERE assignment_id=$1::uuid ORDER BY user_id`, id)
	if e != nil {
		return a, e
	}
	for rows.Next() {
		var x string
		if e = rows.Scan(&x); e != nil {
			rows.Close()
			return a, e
		}
		a.UserIDs = append(a.UserIDs, x)
	}
	rows.Close()
	rows, e = r.db.Query(ctx, `SELECT class_id::text FROM assessment_assignment_classes WHERE assignment_id=$1::uuid ORDER BY class_id`, id)
	if e != nil {
		return a, e
	}
	for rows.Next() {
		var x string
		if e = rows.Scan(&x); e != nil {
			rows.Close()
			return a, e
		}
		a.ClassIDs = append(a.ClassIDs, x)
	}
	rows.Close()
	return a, nil
}
func (r *Repository) ListAssignments(ctx context.Context, actor string, roles []identity.Role, aid string, page, limit int) (assessment.AssignmentPage, error) {
	args := []any{aid, limit + 1, (page - 1) * limit}
	scope := ""
	if !has(roles, identity.RoleAdmin) {
		args = append(args, actor)
		scope = ` AND (a.created_by=$4::uuid OR (a.school_id IS NOT NULL AND (EXISTS(SELECT 1 FROM teaching_assignments ta WHERE ta.school_id=a.school_id AND ta.teacher_id=$4::uuid AND ta.status='active') OR EXISTS(SELECT 1 FROM school_supervisor_scopes ss WHERE ss.school_id=a.school_id AND ss.supervisor_user_id=$4::uuid AND ss.status='active') OR EXISTS(SELECT 1 FROM school_memberships sm WHERE sm.school_id=a.school_id AND sm.user_id=$4::uuid AND sm.role='school_admin' AND sm.status='active'))))`
	}
	rows, e := r.db.Query(ctx, `SELECT id::text,assessment_id::text,assessment_version,COALESCE(school_id::text,''),status,opens_at,closes_at,max_attempts_override,supervisor_message,created_at,updated_at FROM assessment_assignments a WHERE assessment_id=$1::uuid`+scope+` ORDER BY created_at DESC,id DESC LIMIT $2 OFFSET $3`, args...)
	if e != nil {
		return assessment.AssignmentPage{}, e
	}
	defer rows.Close()
	out := assessment.AssignmentPage{Page: page, Limit: limit}
	for rows.Next() {
		var a assessment.Assignment
		if e = rows.Scan(&a.ID, &a.AssessmentID, &a.AssessmentVersion, &a.SchoolID, &a.Status, &a.OpensAt, &a.ClosesAt, &a.MaxAttemptsOverride, &a.SupervisorMessage, &a.CreatedAt, &a.UpdatedAt); e != nil {
			return out, e
		}
		out.Items = append(out.Items, a)
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, rows.Err()
}
func (r *Repository) SetAssignmentStatus(ctx context.Context, actor string, roles []identity.Role, id string, status assessment.AssignmentStatus) (assessment.Assignment, error) {
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Assignment{}, e
	}
	defer tx.Rollback(ctx)
	var school, aid string
	e = tx.QueryRow(ctx, `SELECT COALESCE(school_id::text,''),assessment_id::text FROM assessment_assignments WHERE id=$1::uuid FOR UPDATE`, id).Scan(&school, &aid)
	if e != nil {
		return assessment.Assignment{}, mapError(e)
	}
	ok, e := r.canManageAssignment(ctx, tx, actor, roles, school, aid)
	if e != nil {
		return assessment.Assignment{}, e
	}
	if !ok {
		return assessment.Assignment{}, assessment.ErrConflict
	}
	_, e = tx.Exec(ctx, `UPDATE assessment_assignments SET status=$2,updated_at=now() WHERE id=$1::uuid`, id, string(status))
	if e != nil {
		return assessment.Assignment{}, mapError(e)
	}
	if e = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.assignment.status", ResourceType: "assessment_assignment", ResourceID: id, Metadata: map[string]any{"status": status}}); e != nil {
		return assessment.Assignment{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Assignment{}, e
	}
	return r.getAssignment(ctx, id)
}
func (r *Repository) ListLearnerAssignments(ctx context.Context, student string, page, limit int) ([]assessment.LearnerAssignment, bool, error) {
	rows, e := r.db.Query(ctx, `SELECT a.id::text,a.assessment_id::text,a.assessment_version,v.title,COALESCE(a.school_id::text,''),a.opens_at,a.closes_at,a.supervisor_message,(SELECT count(*)::int FROM assessment_attempts x WHERE x.assignment_id=a.id AND x.student_id=$1::uuid),COALESCE(a.max_attempts_override,v.max_attempts) FROM assessment_assignments a JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version JOIN assessments d ON d.id=a.assessment_id WHERE a.status='active' AND d.workflow_status='approved' AND d.is_published AND d.is_visible AND (a.opens_at IS NULL OR a.opens_at<=now()) AND (a.closes_at IS NULL OR a.closes_at>now()) AND (EXISTS(SELECT 1 FROM assessment_assignment_users au WHERE au.assignment_id=a.id AND au.user_id=$1::uuid) OR EXISTS(SELECT 1 FROM assessment_assignment_classes ac JOIN class_memberships cm ON cm.class_id=ac.class_id WHERE ac.assignment_id=a.id AND cm.user_id=$1::uuid AND cm.status='active')) ORDER BY a.created_at DESC,a.id DESC LIMIT $2 OFFSET $3`, student, limit+1, (page-1)*limit)
	if e != nil {
		return nil, false, e
	}
	defer rows.Close()
	out := []assessment.LearnerAssignment{}
	for rows.Next() {
		var x assessment.LearnerAssignment
		if e = rows.Scan(&x.AssignmentID, &x.AssessmentID, &x.AssessmentVersion, &x.Title, &x.SchoolID, &x.OpensAt, &x.ClosesAt, &x.SupervisorMessage, &x.AttemptCount, &x.MaxAttempts); e != nil {
			return nil, false, e
		}
		x.CanStart = x.AttemptCount < x.MaxAttempts
		out = append(out, x)
	}
	more := len(out) > limit
	if more {
		out = out[:limit]
	}
	return out, more, rows.Err()
}
func (r *Repository) StartAssigned(ctx context.Context, student, assignmentID, startKey string) (assessment.Attempt, error) {
	tx, e := r.db.Begin(ctx)
	if e != nil {
		return assessment.Attempt{}, e
	}
	defer tx.Rollback(ctx)
	var existingID, existingStudent string
	e = tx.QueryRow(ctx, `SELECT id::text,student_id::text FROM assessment_attempts WHERE start_key=$1`, startKey).Scan(&existingID, &existingStudent)
	if e == nil {
		if existingStudent != student {
			return assessment.Attempt{}, assessment.ErrConflict
		}
		if e = tx.Commit(ctx); e != nil {
			return assessment.Attempt{}, e
		}
		return r.GetAttempt(ctx, existingID)
	}
	if !errors.Is(e, pgx.ErrNoRows) {
		return assessment.Attempt{}, e
	}
	var aid string
	var ver, max int
	var limit *int
	e = tx.QueryRow(ctx, `SELECT a.assessment_id::text,a.assessment_version,COALESCE(a.max_attempts_override,v.max_attempts),v.time_limit_seconds FROM assessment_assignments a JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version JOIN assessments d ON d.id=a.assessment_id WHERE a.id=$1::uuid AND a.status='active' AND d.workflow_status='approved' AND d.is_published AND d.is_visible AND (a.opens_at IS NULL OR a.opens_at<=now()) AND (a.closes_at IS NULL OR a.closes_at>now()) AND (EXISTS(SELECT 1 FROM assessment_assignment_users au WHERE au.assignment_id=a.id AND au.user_id=$2::uuid) OR EXISTS(SELECT 1 FROM assessment_assignment_classes ac JOIN class_memberships cm ON cm.class_id=ac.class_id WHERE ac.assignment_id=a.id AND cm.user_id=$2::uuid AND cm.status='active')) FOR UPDATE OF a`, assignmentID, student).Scan(&aid, &ver, &max, &limit)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	var used int
	if e = tx.QueryRow(ctx, `SELECT count(*)::int FROM assessment_attempts WHERE assignment_id=$1::uuid AND student_id=$2::uuid`, assignmentID, student).Scan(&used); e != nil {
		return assessment.Attempt{}, e
	}
	if used >= max {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	var invalid bool
	if e = tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM assessment_version_questions aq JOIN question_versions qv ON qv.question_id=aq.question_id AND qv.version=aq.question_version WHERE aq.assessment_id=$1::uuid AND aq.assessment_version=$2 AND qv.correct_option_index IS NULL) OR NOT EXISTS(SELECT 1 FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2)`, aid, ver).Scan(&invalid); e != nil {
		return assessment.Attempt{}, e
	}
	if invalid {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	var id string
	var expires *time.Time
	e = tx.QueryRow(ctx, `INSERT INTO assessment_attempts(assessment_id,assessment_version,student_id,assignment_id,attempt_number,start_key,expires_at,source_context) VALUES($1::uuid,$2,$3::uuid,$4::uuid,$5,$6,CASE WHEN $7::int IS NULL THEN NULL ELSE now()+make_interval(secs=>$7) END,jsonb_build_object('type','assignment','assignmentId',$4::text)) RETURNING id::text,expires_at`, aid, ver, student, assignmentID, used+1, startKey, limit).Scan(&id, &expires)
	if e != nil {
		return assessment.Attempt{}, mapError(e)
	}
	if e = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: student, Action: "assessment.assignment.attempt.start", ResourceType: "assessment_attempt", ResourceID: id, Metadata: map[string]any{"assignmentId": assignmentID, "assessmentId": aid, "version": ver}}); e != nil {
		return assessment.Attempt{}, e
	}
	if e = tx.Commit(ctx); e != nil {
		return assessment.Attempt{}, e
	}
	return r.GetAttempt(ctx, id)
}

var _ = strconv.Itoa
