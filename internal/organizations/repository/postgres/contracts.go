package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) SchoolContractBySchool(
	ctx context.Context,
	schoolID string,
) (org.SchoolContract, error) {
	row := r.db.QueryRow(ctx, schoolContractSelect+`
		WHERE sc.school_id = $1::uuid
	`, schoolID)
	contract, err := scanSchoolContract(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return org.SchoolContract{}, org.ErrNotFound
	}
	return contract, err
}

func (r *Repository) UpsertSchoolContract(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write org.SchoolContractWrite,
) (org.SchoolContract, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.SchoolContract{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var contractID string
	err = tx.QueryRow(ctx, `
		INSERT INTO school_contracts (
			school_id,
			status,
			valid_from,
			valid_until
		)
		SELECT
			s.id,
			$2,
			$3,
			$4
		FROM schools s
		WHERE s.id = $1::uuid
		ON CONFLICT (school_id)
		DO UPDATE SET
			status = EXCLUDED.status,
			valid_from = EXCLUDED.valid_from,
			valid_until = EXCLUDED.valid_until,
			updated_at = now()
		RETURNING id::text
	`, schoolID, string(write.Status), write.ValidFrom, write.ValidUntil).Scan(&contractID)
	if errors.Is(err, pgx.ErrNoRows) {
		return org.SchoolContract{}, org.ErrNotFound
	}
	if err != nil {
		return org.SchoolContract{}, err
	}

	if _, err := tx.Exec(ctx, `
		DELETE FROM school_contract_modules
		WHERE contract_id = $1::uuid
	`, contractID); err != nil {
		return org.SchoolContract{}, err
	}

	for _, module := range write.Modules {
		if _, err := tx.Exec(ctx, `
			INSERT INTO school_contract_modules (
				contract_id,
				module
			)
			VALUES ($1::uuid, $2)
		`, contractID, string(module)); err != nil {
			return org.SchoolContract{}, err
		}
	}

	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "schools.contract.upsert",
		ResourceType: "school_contract",
		ResourceID:   contractID,
		Metadata: map[string]any{
			"schoolId":   schoolID,
			"status":     write.Status,
			"modules":    write.Modules,
			"validFrom":  timeValue(write.ValidFrom),
			"validUntil": timeValue(write.ValidUntil),
		},
	}); err != nil {
		return org.SchoolContract{}, err
	}

	contract, err := schoolContractTx(ctx, tx, contractID)
	if err != nil {
		return org.SchoolContract{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return org.SchoolContract{}, err
	}
	return contract, nil
}

func (r *Repository) HasSchoolModule(
	ctx context.Context,
	schoolID string,
	module org.SchoolModule,
) (bool, error) {
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1
			FROM school_contracts sc
			JOIN school_contract_modules scm
			  ON scm.contract_id = sc.id
			WHERE sc.school_id = $1::uuid
			  AND sc.status = 'active'
			  AND (sc.valid_from IS NULL OR sc.valid_from <= now())
			  AND (sc.valid_until IS NULL OR sc.valid_until >= now())
			  AND scm.module = $2
		)
	`, schoolID, string(module)).Scan(&allowed)
	return allowed, err
}

const schoolContractSelect = `
	SELECT
		sc.id::text,
		sc.school_id::text,
		sc.status,
		sc.valid_from,
		sc.valid_until,
		sc.created_at,
		sc.updated_at,
		ARRAY(
			SELECT scm.module
			FROM school_contract_modules scm
			WHERE scm.contract_id = sc.id
			ORDER BY scm.module
		)::text[]
	FROM school_contracts sc
`

func schoolContractTx(
	ctx context.Context,
	tx pgx.Tx,
	contractID string,
) (org.SchoolContract, error) {
	row := tx.QueryRow(ctx, schoolContractSelect+`
		WHERE sc.id = $1::uuid
	`, contractID)
	return scanSchoolContract(row)
}

func scanSchoolContract(row rowScanner) (org.SchoolContract, error) {
	var contract org.SchoolContract
	var moduleStrings []string
	err := row.Scan(
		&contract.ID,
		&contract.SchoolID,
		&contract.Status,
		&contract.ValidFrom,
		&contract.ValidUntil,
		&contract.CreatedAt,
		&contract.UpdatedAt,
		&moduleStrings,
	)
	if err != nil {
		return org.SchoolContract{}, err
	}
	contract.Modules = make([]org.SchoolModule, 0, len(moduleStrings))
	for _, module := range moduleStrings {
		contract.Modules = append(contract.Modules, org.SchoolModule(module))
	}
	return contract, nil
}

func timeValue(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.UTC()
}
