package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func scanSchoolContract(row rowScanner) (org.SchoolContract, error) {
	var out org.SchoolContract
	var moduleStrings []string
	err := row.Scan(
		&out.ID,
		&out.SchoolID,
		&out.Status,
		&out.ValidFrom,
		&out.ValidUntil,
		&out.Revision,
		&moduleStrings,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	if err != nil {
		return org.SchoolContract{}, err
	}
	out.Modules = make([]org.SchoolModule, 0, len(moduleStrings))
	for _, module := range moduleStrings {
		out.Modules = append(out.Modules, org.SchoolModule(module))
	}
	return out, nil
}

const schoolContractSelect = `
	SELECT
		sc.id::text,
		sc.school_id::text,
		sc.status,
		sc.valid_from,
		sc.valid_until,
		sc.revision,
		ARRAY(
			SELECT scm.module_code
			FROM school_contract_modules scm
			WHERE scm.contract_id=sc.id AND scm.enabled=true
			ORDER BY scm.module_code
		)::text[],
		sc.created_at,
		sc.updated_at
	FROM school_contracts sc
`

func (r *Repository) SchoolContract(ctx context.Context, schoolID string) (org.SchoolContract, error) {
	out, err := scanSchoolContract(r.db.QueryRow(ctx, schoolContractSelect+` WHERE sc.school_id=$1::uuid`, schoolID))
	if errors.Is(err, pgx.ErrNoRows) {
		return org.SchoolContract{}, org.ErrNotFound
	}
	return out, err
}

func (r *Repository) UpsertSchoolContract(
	ctx context.Context,
	actorID string,
	schoolID string,
	write org.SchoolContractWrite,
) (org.SchoolContract, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.SchoolContract{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var contractID string
	var revision int
	err = tx.QueryRow(ctx, `
		SELECT id::text,revision
		FROM school_contracts
		WHERE school_id=$1::uuid
		FOR UPDATE
	`, schoolID).Scan(&contractID, &revision)

	switch {
	case errors.Is(err, pgx.ErrNoRows):
		if write.ExpectedRevision != 0 {
			return org.SchoolContract{}, org.ErrConflict
		}
		err = tx.QueryRow(ctx, `
			INSERT INTO school_contracts(
				school_id,status,valid_from,valid_until,created_by,updated_by
			)
			SELECT s.id,$2,$3,$4,$5::uuid,$5::uuid
			FROM schools s
			WHERE s.id=$1::uuid
			RETURNING id::text,revision
		`, schoolID, write.Status, write.ValidFrom, write.ValidUntil, actorID).Scan(&contractID, &revision)
		if errors.Is(err, pgx.ErrNoRows) {
			return org.SchoolContract{}, org.ErrNotFound
		}
		if err != nil {
			return org.SchoolContract{}, err
		}
	case err != nil:
		return org.SchoolContract{}, err
	default:
		if revision != write.ExpectedRevision {
			return org.SchoolContract{}, org.ErrConflict
		}
		err = tx.QueryRow(ctx, `
			UPDATE school_contracts
			SET status=$2,valid_from=$3,valid_until=$4,revision=revision+1,
			    updated_by=$5::uuid,updated_at=now()
			WHERE id=$1::uuid
			RETURNING revision
		`, contractID, write.Status, write.ValidFrom, write.ValidUntil, actorID).Scan(&revision)
		if err != nil {
			return org.SchoolContract{}, err
		}
	}

	if _, err = tx.Exec(ctx, `DELETE FROM school_contract_modules WHERE contract_id=$1::uuid`, contractID); err != nil {
		return org.SchoolContract{}, err
	}
	for _, module := range write.Modules {
		if _, err = tx.Exec(ctx, `
			INSERT INTO school_contract_modules(contract_id,module_code,enabled)
			VALUES($1::uuid,$2,true)
		`, contractID, module); err != nil {
			return org.SchoolContract{}, err
		}
	}
	if err = r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorID,
		Action:      "organizations.school_contract.upsert",
		ResourceType:"school_contract",
		ResourceID:  contractID,
		Metadata: map[string]any{
			"schoolId": schoolID,
			"status":   write.Status,
			"modules":  write.Modules,
			"revision": revision,
		},
	}); err != nil {
		return org.SchoolContract{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return org.SchoolContract{}, err
	}
	return r.SchoolContract(ctx, schoolID)
}

func (r *Repository) SmartClassroomModuleEnabled(ctx context.Context, schoolID string) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM school_contracts sc
			JOIN school_contract_modules scm
			  ON scm.contract_id=sc.id
			 AND scm.module_code='SMART_CLASSROOM'
			 AND scm.enabled=true
			JOIN schools s
			  ON s.id=sc.school_id
			 AND s.status='active'
			WHERE sc.school_id=$1::uuid
			  AND sc.status='active'
			  AND (sc.valid_from IS NULL OR sc.valid_from <= now())
			  AND (sc.valid_until IS NULL OR sc.valid_until >= now())
		)
	`, schoolID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) CanTeacherControlSmartClassroom(
	ctx context.Context,
	teacherID, schoolID, classID, subjectID string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM teaching_assignments ta
			JOIN users u
			  ON u.id=ta.teacher_id AND u.status='active'
			JOIN school_memberships sm
			  ON sm.school_id=ta.school_id
			 AND sm.user_id=ta.teacher_id
			 AND sm.role='teacher'
			 AND sm.status='active'
			JOIN schools s
			  ON s.id=ta.school_id AND s.status='active'
			JOIN classes c
			  ON c.id=ta.class_id
			 AND c.school_id=ta.school_id
			 AND c.status='active'
			WHERE ta.teacher_id=$1::uuid
			  AND ta.school_id=$2::uuid
			  AND ta.class_id=$3::uuid
			  AND ta.status='active'
			  AND (ta.subject_id IS NULL OR ta.subject_id=$4::uuid)
		)
	`, teacherID, schoolID, classID, subjectID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) CanStudentJoinSmartClassroom(
	ctx context.Context,
	studentID, schoolID, classID string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM users u
			JOIN school_memberships sm
			  ON sm.user_id=u.id
			 AND sm.school_id=$2::uuid
			 AND sm.role='student'
			 AND sm.status='active'
			JOIN classes c
			  ON c.id=$3::uuid
			 AND c.school_id=sm.school_id
			 AND c.status='active'
			JOIN class_memberships cm
			  ON cm.class_id=c.id
			 AND cm.user_id=u.id
			 AND cm.status='active'
			WHERE u.id=$1::uuid
			  AND u.status='active'
		)
	`, studentID, schoolID, classID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) CanStaffViewSmartClassroom(
	ctx context.Context,
	actorID, schoolID, classID string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM school_memberships sm
			WHERE sm.school_id=$2::uuid
			  AND sm.user_id=$1::uuid
			  AND sm.status='active'
			  AND (
				(
					sm.role='teacher'
					AND EXISTS(
						SELECT 1 FROM teaching_assignments ta
						WHERE ta.school_id=sm.school_id
						  AND ta.teacher_id=sm.user_id
						  AND ta.class_id=$3::uuid
						  AND ta.status='active'
					)
				)
				OR
				(
					sm.role='school_admin'
					AND EXISTS(
						SELECT 1 FROM school_membership_permissions p
						WHERE p.membership_id=sm.id
						  AND p.permission='SCHOOL_SMART_CLASSROOM_VIEW'
					)
				)
			)
		)
		OR EXISTS(
			SELECT 1
			FROM school_supervisor_scopes ss
			WHERE ss.supervisor_user_id=$1::uuid
			  AND ss.school_id=$2::uuid
			  AND ss.status='active'
			  AND (
				ss.scope_type='school'
				OR (ss.scope_type='class' AND ss.class_id=$3::uuid)
			  )
		)
	`, actorID, schoolID, classID).Scan(&allowed)
	return allowed, err
}


func (r *Repository) ValidateSmartClassroomScope(
	ctx context.Context,
	schoolID, classID, subjectID string,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM schools s
			JOIN classes c ON c.school_id=s.id
			JOIN subjects subject ON subject.id=$3::uuid
			JOIN paths path ON path.id=subject.path_id
			WHERE s.id=$1::uuid
			  AND s.status='active'
			  AND c.id=$2::uuid
			  AND c.status='active'
			  AND subject.status='active'
			  AND path.status='active'
		)
	`, schoolID, classID, subjectID).Scan(&allowed)
	return allowed, err
}

func (r *Repository) SmartClassroomRoster(
	ctx context.Context,
	schoolID, classID string,
) ([]string, error) {
	rows, err := r.db.Query(ctx, `
		SELECT u.id::text
		FROM class_memberships cm
		JOIN users u ON u.id=cm.user_id AND u.status='active'
		JOIN school_memberships sm
		  ON sm.user_id=u.id
		 AND sm.school_id=$1::uuid
		 AND sm.role='student'
		 AND sm.status='active'
		JOIN classes c
		  ON c.id=cm.class_id
		 AND c.school_id=sm.school_id
		 AND c.status='active'
		WHERE cm.class_id=$2::uuid
		  AND cm.status='active'
		ORDER BY u.id
	`, schoolID, classID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out,id)
	}
	return out, rows.Err()
}
