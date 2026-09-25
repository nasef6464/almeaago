package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) DirectorAddStudent(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.DirectorStudentCreate,
) (org.DirectorStudentMutationResult, error) {
	if r.studentAccounts == nil {
		return org.DirectorStudentMutationResult{}, errStudentAccountWriterUnavailable
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	className, err := activeClassNameTx(ctx, tx, schoolID, write.ClassID)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	account, created, err := r.studentAccounts.UpsertSchoolStudentTx(
		ctx,
		tx,
		write.Name,
		write.Email,
		write.Password,
	)
	if errors.Is(err, identity.ErrConflict) {
		return org.DirectorStudentMutationResult{}, org.ErrConflict
	}
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	var outside bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM school_memberships sm
			WHERE sm.user_id = $1::uuid
			  AND sm.role = 'student'
			  AND sm.status = 'active'
			  AND sm.school_id <> $2::uuid
		)
	`, account.UserID, schoolID).Scan(&outside); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	if outside {
		return org.DirectorStudentMutationResult{}, org.ErrConflict
	}

	if !account.Active {
		account, err = r.studentAccounts.SetSchoolStudentActiveTx(ctx, tx, account.UserID, true)
		if err != nil {
			return org.DirectorStudentMutationResult{}, err
		}
	}

	if _, err := tx.Exec(ctx, `
		INSERT INTO school_memberships (school_id, user_id, role, status)
		VALUES ($1::uuid, $2::uuid, 'student', 'active')
		ON CONFLICT (school_id, user_id, role)
		DO UPDATE SET status = 'active', updated_at = now()
	`, schoolID, account.UserID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	if err := replaceStudentClassTx(ctx, tx, schoolID, account.UserID, write.ClassID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "schools.director.student.add",
		ResourceType: "student",
		ResourceID:   account.UserID,
		Metadata: map[string]any{
			"schoolId": schoolID,
			"classId":  write.ClassID,
			"created":  created,
		},
	}); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	result := org.DirectorStudentMutationResult{
		Student: directorStudentFromAccount(account, write.ClassID, className),
		Created: created,
	}
	if err := tx.Commit(ctx); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return result, nil
}

func (r *Repository) DirectorMoveStudent(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	studentID string,
	classID string,
) (org.DirectorStudentMutationResult, error) {
	if r.studentAccounts == nil {
		return org.DirectorStudentMutationResult{}, errStudentAccountWriterUnavailable
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := requireStudentMembershipTx(ctx, tx, schoolID, studentID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	className, err := activeClassNameTx(ctx, tx, schoolID, classID)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	var already bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM class_memberships cm
			WHERE cm.class_id = $1::uuid
			  AND cm.user_id = $2::uuid
			  AND cm.status = 'active'
		)
	`, classID, studentID).Scan(&already); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	if err := replaceStudentClassTx(ctx, tx, schoolID, studentID, classID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	account, err := r.studentAccounts.SchoolStudentAccountTx(ctx, tx, studentID)
	if errors.Is(err, identity.ErrNotFound) {
		return org.DirectorStudentMutationResult{}, org.ErrNotFound
	}
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "schools.director.student.move_class",
		ResourceType: "student",
		ResourceID:   studentID,
		Metadata: map[string]any{
			"schoolId":   schoolID,
			"classId":    classID,
			"idempotent": already,
		},
	}); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	result := org.DirectorStudentMutationResult{
		Student:    directorStudentFromAccount(account, classID, className),
		Idempotent: already,
	}
	if err := tx.Commit(ctx); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return result, nil
}

func (r *Repository) DirectorUpdateStudentBasic(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	studentID string,
	patch org.DirectorStudentBasicPatch,
) (org.DirectorStudentMutationResult, error) {
	if r.studentAccounts == nil {
		return org.DirectorStudentMutationResult{}, errStudentAccountWriterUnavailable
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := requireStudentMembershipTx(ctx, tx, schoolID, studentID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	account, err := r.studentAccounts.UpdateSchoolStudentBasicTx(
		ctx,
		tx,
		studentID,
		patch.Name,
		patch.Phone,
	)
	if errors.Is(err, identity.ErrConflict) {
		return org.DirectorStudentMutationResult{}, org.ErrConflict
	}
	if errors.Is(err, identity.ErrNotFound) {
		return org.DirectorStudentMutationResult{}, org.ErrNotFound
	}
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	classID, className, err := currentStudentClassTx(ctx, tx, schoolID, studentID)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "schools.director.student.update_basic",
		ResourceType: "student",
		ResourceID:   studentID,
		Metadata: map[string]any{
			"schoolId": schoolID,
			"name":     patch.Name != nil,
			"phone":    patch.Phone != nil,
		},
	}); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	result := org.DirectorStudentMutationResult{
		Student: directorStudentFromAccount(account, classID, className),
	}
	if err := tx.Commit(ctx); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return result, nil
}

func (r *Repository) DirectorSetStudentActive(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	studentID string,
	active bool,
) (org.DirectorStudentMutationResult, error) {
	if r.studentAccounts == nil {
		return org.DirectorStudentMutationResult{}, errStudentAccountWriterUnavailable
	}

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := requireStudentMembershipTx(ctx, tx, schoolID, studentID); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	account, err := r.studentAccounts.SetSchoolStudentActiveTx(ctx, tx, studentID, active)
	if errors.Is(err, identity.ErrNotFound) {
		return org.DirectorStudentMutationResult{}, org.ErrNotFound
	}
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	membershipStatus := "suspended"
	if active {
		membershipStatus = "active"
	}
	if _, err := tx.Exec(ctx, `
		UPDATE school_memberships
		SET status = $3, updated_at = now()
		WHERE school_id = $1::uuid
		  AND user_id = $2::uuid
		  AND role = 'student'
	`, schoolID, studentID, membershipStatus); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	classID, className, err := currentStudentClassTx(ctx, tx, schoolID, studentID)
	if err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	action := "schools.director.student.deactivate"
	if active {
		action = "schools.director.student.reactivate"
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       action,
		ResourceType: "student",
		ResourceID:   studentID,
		Metadata: map[string]any{
			"schoolId": schoolID,
		},
	}); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}

	result := org.DirectorStudentMutationResult{
		Student: directorStudentFromAccount(account, classID, className),
	}
	if err := tx.Commit(ctx); err != nil {
		return org.DirectorStudentMutationResult{}, err
	}
	return result, nil
}

func requireStudentMembershipTx(
	ctx context.Context,
	tx pgx.Tx,
	schoolID string,
	studentID string,
) error {
	var exists bool
	if err := tx.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM school_memberships sm
			WHERE sm.school_id = $1::uuid
			  AND sm.user_id = $2::uuid
			  AND sm.role = 'student'
			  AND sm.status IN ('active','suspended')
		)
	`, schoolID, studentID).Scan(&exists); err != nil {
		return err
	}
	if !exists {
		return org.ErrNotFound
	}
	return nil
}

func activeClassNameTx(
	ctx context.Context,
	tx pgx.Tx,
	schoolID string,
	classID string,
) (string, error) {
	var name string
	err := tx.QueryRow(ctx, `
		SELECT c.name
		FROM classes c
		JOIN schools s ON s.id = c.school_id
		WHERE c.id = $2::uuid
		  AND c.school_id = $1::uuid
		  AND c.status = 'active'
		  AND s.status = 'active'
	`, schoolID, classID).Scan(&name)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", org.ErrNotFound
	}
	return name, err
}

func replaceStudentClassTx(
	ctx context.Context,
	tx pgx.Tx,
	schoolID string,
	studentID string,
	classID string,
) error {
	if _, err := tx.Exec(ctx, `
		UPDATE class_memberships cm
		SET status = 'inactive',
		    left_at = COALESCE(cm.left_at, now())
		FROM classes c
		WHERE cm.class_id = c.id
		  AND c.school_id = $1::uuid
		  AND cm.user_id = $2::uuid
		  AND cm.status = 'active'
		  AND cm.class_id <> $3::uuid
	`, schoolID, studentID, classID); err != nil {
		return err
	}

	tag, err := tx.Exec(ctx, `
		INSERT INTO class_memberships (
			class_id, user_id, status, joined_at, left_at
		)
		SELECT c.id, $2::uuid, 'active', now(), NULL
		FROM classes c
		WHERE c.id = $3::uuid
		  AND c.school_id = $1::uuid
		  AND c.status = 'active'
		ON CONFLICT (class_id, user_id)
		DO UPDATE SET
			status = 'active',
			joined_at = now(),
			left_at = NULL
	`, schoolID, studentID, classID)
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return org.ErrNotFound
	}
	return nil
}

func currentStudentClassTx(
	ctx context.Context,
	tx pgx.Tx,
	schoolID string,
	studentID string,
) (string, string, error) {
	var classID string
	var className string
	err := tx.QueryRow(ctx, `
		SELECT c.id::text, c.name
		FROM class_memberships cm
		JOIN classes c ON c.id = cm.class_id
		WHERE cm.user_id = $2::uuid
		  AND cm.status = 'active'
		  AND c.school_id = $1::uuid
		  AND c.status = 'active'
		ORDER BY cm.joined_at DESC
		LIMIT 1
	`, schoolID, studentID).Scan(&classID, &className)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", nil
	}
	return classID, className, err
}

func directorStudentFromAccount(
	account identity.SchoolStudentAccount,
	classID string,
	className string,
) org.DirectorStudent {
	return org.DirectorStudent{
		StudentID: account.UserID,
		Name:      account.Name,
		Email:     account.Email,
		Phone:     account.Phone,
		Active:    account.Active,
		ClassID:   classID,
		ClassName: className,
	}
}
