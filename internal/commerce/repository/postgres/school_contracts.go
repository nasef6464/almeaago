package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

const schoolContractSelect = `
	SELECT
		sc.id::text,
		sc.school_id::text,
		sc.status,
		sc.valid_from,
		sc.valid_until,
		ARRAY(
			SELECT scm.module
			FROM school_contract_modules scm
			WHERE scm.contract_id = sc.id
			ORDER BY scm.module
		)::text[],
		sc.created_at,
		sc.updated_at
	FROM school_contracts sc
`

func (r *Repository) SchoolContractBySchool(
	ctx context.Context,
	schoolID string,
) (commerce.SchoolContract, error) {
	contract, err := scanSchoolContract(r.db.QueryRow(
		ctx,
		schoolContractSelect+" WHERE sc.school_id = $1::uuid",
		schoolID,
	))
	if errors.Is(err, pgx.ErrNoRows) {
		return commerce.SchoolContract{}, commerce.ErrSchoolContractNotFound
	}
	return contract, err
}

func (r *Repository) UpsertSchoolContract(
	ctx context.Context,
	actorUserID string,
	schoolID string,
	write commerce.SchoolContractWrite,
) (commerce.SchoolContract, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return commerce.SchoolContract{}, err
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
		  AND s.status <> 'archived'
		ON CONFLICT (school_id) DO UPDATE SET
			status = EXCLUDED.status,
			valid_from = EXCLUDED.valid_from,
			valid_until = EXCLUDED.valid_until,
			updated_at = now()
		RETURNING id::text
	`,
		schoolID,
		string(write.Status),
		write.ValidFrom,
		write.ValidUntil,
	).Scan(&contractID)
	if errors.Is(err, pgx.ErrNoRows) {
		return commerce.SchoolContract{}, commerce.ErrSchoolContractNotFound
	}
	if err != nil {
		return commerce.SchoolContract{}, err
	}

	if _, err := tx.Exec(
		ctx,
		"DELETE FROM school_contract_modules WHERE contract_id = $1::uuid",
		contractID,
	); err != nil {
		return commerce.SchoolContract{}, err
	}

	for _, module := range write.Modules {
		if _, err := tx.Exec(
			ctx,
			`INSERT INTO school_contract_modules (contract_id, module)
			 VALUES ($1::uuid, $2)`,
			contractID,
			string(module),
		); err != nil {
			return commerce.SchoolContract{}, err
		}
	}

	contract, err := scanSchoolContract(tx.QueryRow(
		ctx,
		schoolContractSelect+" WHERE sc.id = $1::uuid",
		contractID,
	))
	if err != nil {
		return commerce.SchoolContract{}, err
	}

	if r.audit == nil {
		return commerce.SchoolContract{}, errors.New("commerce audit writer is not configured")
	}
	if err := r.audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "commerce.school_contract.upsert",
		ResourceType: "school_contract",
		ResourceID:   contract.ID,
		Metadata: map[string]any{
			"schoolId":   contract.SchoolID,
			"status":     contract.Status,
			"modules":    contract.Modules,
			"validFrom":  contract.ValidFrom,
			"validUntil": contract.ValidUntil,
		},
	}); err != nil {
		return commerce.SchoolContract{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return commerce.SchoolContract{}, err
	}
	return contract, nil
}

func scanSchoolContract(row rowScanner) (commerce.SchoolContract, error) {
	var contract commerce.SchoolContract
	var moduleStrings []string
	err := row.Scan(
		&contract.ID,
		&contract.SchoolID,
		&contract.Status,
		&contract.ValidFrom,
		&contract.ValidUntil,
		&moduleStrings,
		&contract.CreatedAt,
		&contract.UpdatedAt,
	)
	if err != nil {
		return commerce.SchoolContract{}, err
	}
	contract.Modules = make([]commerce.SchoolModule, 0, len(moduleStrings))
	for _, value := range moduleStrings {
		contract.Modules = append(contract.Modules, commerce.SchoolModule(value))
	}
	return contract, nil
}
