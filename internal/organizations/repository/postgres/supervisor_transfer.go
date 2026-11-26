package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) SupervisorMoveStudent(ctx context.Context, actorID, schoolID, studentID string, move org.SupervisorClassMove) (bool, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Lock parent records before the dependent memberships and delegations,
	// following the same order as school and class archival.
	var schoolActive bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (SELECT 1 FROM schools WHERE id=$1::uuid AND status='active' FOR SHARE)
	`, schoolID).Scan(&schoolActive)
	if err != nil {
		return false, err
	}
	if !schoolActive {
		return false, org.ErrForbidden
	}
	var activeClasses int
	err = tx.QueryRow(ctx, `
		SELECT count(*) FROM (
			SELECT id FROM classes WHERE school_id=$1::uuid AND status='active'
			  AND id IN ($2::uuid, $3::uuid) ORDER BY id FOR SHARE
		) AS locked_classes
	`, schoolID, move.FromClassID, move.ClassID).Scan(&activeClasses)
	if err != nil {
		return false, err
	}
	if activeClasses != 2 {
		return false, org.ErrForbidden
	}
	var assignedToSchool bool
	err = tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM school_memberships WHERE school_id=$1::uuid AND user_id=$2::uuid
			  AND role='supervisor' AND status='active' FOR SHARE
		)
	`, schoolID, actorID).Scan(&assignedToSchool)
	if err != nil {
		return false, err
	}
	if !assignedToSchool {
		return false, org.ErrForbidden
	}

	// Hold the matched grants until commit so revocation cannot race the write.
	var allowed bool
	err = tx.QueryRow(ctx, `
		SELECT COALESCE(bool_or(scope_type='school'), false) OR count(DISTINCT class_id)=2
		FROM (
			SELECT scope_type, class_id FROM school_supervisor_scopes
			WHERE supervisor_user_id=$1::uuid AND school_id=$2::uuid AND status='active'
			  AND (scope_type='school' OR (scope_type='class' AND class_id IN ($3::uuid, $4::uuid)))
			FOR SHARE
		) AS locked_scopes
	`, actorID, schoolID, move.FromClassID, move.ClassID).Scan(&allowed)
	if err != nil {
		return false, err
	}
	if !allowed {
		return false, org.ErrForbidden
	}

	// Lock the same student row as the existing director move before inspecting
	// membership. A retry can observe the committed destination without writing.
	var memberID string
	err = tx.QueryRow(ctx, `
		SELECT u.id::text FROM users u
		JOIN school_memberships sm ON sm.user_id=u.id
		WHERE u.id=$1::uuid AND u.status='active' AND sm.school_id=$2::uuid
		  AND sm.role='student' AND sm.status='active'
		FOR UPDATE OF u FOR SHARE OF sm
	`, studentID, schoolID).Scan(&memberID)
	if errors.Is(err, pgx.ErrNoRows) {
		return false, org.ErrForbidden
	}
	if err != nil {
		return false, err
	}

	var memberships int
	var atSource, atDestination bool
	err = tx.QueryRow(ctx, `
		SELECT count(*), COALESCE(bool_or(c.id=$3::uuid), false), COALESCE(bool_or(c.id=$4::uuid), false)
		FROM class_memberships cm JOIN classes c ON c.id=cm.class_id
		WHERE cm.user_id=$1::uuid AND c.school_id=$2::uuid AND cm.status='active'
	`, studentID, schoolID, move.FromClassID, move.ClassID).Scan(&memberships, &atSource, &atDestination)
	if err != nil {
		return false, err
	}
	if !atSource && !atDestination {
		return false, org.ErrForbidden
	}
	if memberships != 1 {
		return false, org.ErrConflict
	}
	if atDestination {
		return true, tx.Commit(ctx)
	}
	if err := replaceStudentClassTx(ctx, tx, schoolID, memberID, move.ClassID); err != nil {
		return false, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorID, Action: "schools.supervisor.student.move_class",
		ResourceType: "student", ResourceID: studentID,
		Metadata: map[string]any{"schoolId": schoolID, "fromClassId": move.FromClassID, "classId": move.ClassID},
	}); err != nil {
		return false, err
	}
	return false, tx.Commit(ctx)
}
