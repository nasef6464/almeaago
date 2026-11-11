package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (r *Repository) CreateSchoolInquiry(
	ctx context.Context,
	input orgdomain.SchoolInquiryCreate,
) (orgdomain.SchoolInquiry, error) {
	pathsBytes, err := json.Marshal(input.Paths)
	if err != nil {
		pathsBytes = []byte("[]")
	}

	const query = `
		INSERT INTO school_inquiries (
			ref_number,
			school_name,
			city,
			director_name,
			phone,
			email,
			student_count,
			tier_id,
			tier_name,
			paths,
			notes,
			total_annual_estimate,
			created_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, NOW()
		)
		RETURNING
			id::text,
			ref_number,
			school_name,
			city,
			director_name,
			phone,
			email,
			student_count,
			tier_id,
			tier_name,
			paths,
			notes,
			total_annual_estimate,
			created_at
	`

	var out orgdomain.SchoolInquiry
	var rawPaths []byte

	err = r.db.QueryRow(
		ctx,
		query,
		input.RefNumber,
		input.SchoolName,
		input.City,
		input.DirectorName,
		input.Phone,
		input.Email,
		input.StudentCount,
		input.TierID,
		input.TierName,
		pathsBytes,
		input.Notes,
		input.TotalAnnualEstimate,
	).Scan(
		&out.ID,
		&out.RefNumber,
		&out.SchoolName,
		&out.City,
		&out.DirectorName,
		&out.Phone,
		&out.Email,
		&out.StudentCount,
		&out.TierID,
		&out.TierName,
		&rawPaths,
		&out.Notes,
		&out.TotalAnnualEstimate,
		&out.CreatedAt,
	)

	if err != nil {
		var pgErr *pgconn.PgError
		if errors.As(err, &pgErr) && pgErr.Code == "23505" {
			return orgdomain.SchoolInquiry{}, orgdomain.ErrConflict
		}
		return orgdomain.SchoolInquiry{}, err
	}

	if len(rawPaths) > 0 {
		_ = json.Unmarshal(rawPaths, &out.Paths)
	}
	if out.Paths == nil {
		out.Paths = []string{}
	}

	return out, nil
}

func (r *Repository) GetSchoolInquiryByID(
	ctx context.Context,
	id string,
) (orgdomain.SchoolInquiry, error) {
	const query = `
		SELECT
			id::text,
			ref_number,
			school_name,
			city,
			director_name,
			phone,
			email,
			student_count,
			tier_id,
			tier_name,
			paths,
			notes,
			total_annual_estimate,
			created_at
		FROM school_inquiries
		WHERE id = $1::uuid
	`

	var out orgdomain.SchoolInquiry
	var rawPaths []byte

	err := r.db.QueryRow(ctx, query, id).Scan(
		&out.ID,
		&out.RefNumber,
		&out.SchoolName,
		&out.City,
		&out.DirectorName,
		&out.Phone,
		&out.Email,
		&out.StudentCount,
		&out.TierID,
		&out.TierName,
		&rawPaths,
		&out.Notes,
		&out.TotalAnnualEstimate,
		&out.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return orgdomain.SchoolInquiry{}, orgdomain.ErrNotFound
	}
	if err != nil {
		return orgdomain.SchoolInquiry{}, err
	}

	if len(rawPaths) > 0 {
		_ = json.Unmarshal(rawPaths, &out.Paths)
	}
	if out.Paths == nil {
		out.Paths = []string{}
	}

	return out, nil
}

func (r *Repository) GetSchoolInquiryByRef(
	ctx context.Context,
	refNumber string,
) (orgdomain.SchoolInquiry, error) {
	const query = `
		SELECT
			id::text,
			ref_number,
			school_name,
			city,
			director_name,
			phone,
			email,
			student_count,
			tier_id,
			tier_name,
			paths,
			notes,
			total_annual_estimate,
			created_at
		FROM school_inquiries
		WHERE ref_number = $1
	`

	var out orgdomain.SchoolInquiry
	var rawPaths []byte

	err := r.db.QueryRow(ctx, query, refNumber).Scan(
		&out.ID,
		&out.RefNumber,
		&out.SchoolName,
		&out.City,
		&out.DirectorName,
		&out.Phone,
		&out.Email,
		&out.StudentCount,
		&out.TierID,
		&out.TierName,
		&rawPaths,
		&out.Notes,
		&out.TotalAnnualEstimate,
		&out.CreatedAt,
	)

	if errors.Is(err, pgx.ErrNoRows) {
		return orgdomain.SchoolInquiry{}, orgdomain.ErrNotFound
	}
	if err != nil {
		return orgdomain.SchoolInquiry{}, err
	}

	if len(rawPaths) > 0 {
		_ = json.Unmarshal(rawPaths, &out.Paths)
	}
	if out.Paths == nil {
		out.Paths = []string{}
	}

	return out, nil
}

func (r *Repository) ListSchoolInquiries(
	ctx context.Context,
	limit, offset int,
) ([]orgdomain.SchoolInquiry, int, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	if offset < 0 {
		offset = 0
	}

	var total int
	err := r.db.QueryRow(ctx, `SELECT COUNT(*) FROM school_inquiries`).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	const query = `
		SELECT
			id::text,
			ref_number,
			school_name,
			city,
			director_name,
			phone,
			email,
			student_count,
			tier_id,
			tier_name,
			paths,
			notes,
			total_annual_estimate,
			created_at
		FROM school_inquiries
		ORDER BY created_at DESC
		LIMIT $1 OFFSET $2
	`

	rows, err := r.db.Query(ctx, query, limit, offset)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	items := make([]orgdomain.SchoolInquiry, 0, limit)
	for rows.Next() {
		var out orgdomain.SchoolInquiry
		var rawPaths []byte
		err := rows.Scan(
			&out.ID,
			&out.RefNumber,
			&out.SchoolName,
			&out.City,
			&out.DirectorName,
			&out.Phone,
			&out.Email,
			&out.StudentCount,
			&out.TierID,
			&out.TierName,
			&rawPaths,
			&out.Notes,
			&out.TotalAnnualEstimate,
			&out.CreatedAt,
		)
		if err != nil {
			return nil, 0, err
		}
		if len(rawPaths) > 0 {
			_ = json.Unmarshal(rawPaths, &out.Paths)
		}
		if out.Paths == nil {
			out.Paths = []string{}
		}
		items = append(items, out)
	}

	return items, total, rows.Err()
}
