package postgres

import (
	"context"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	parents "github.com/nasef6464/almeaago/internal/parents/domain"
)

var (
	ErrNotFound = errors.New("parent resource not found")
	ErrConflict = errors.New("parent resource conflict")
)

type Repository struct {
	db *pgxpool.Pool
}

func NewRepository(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListPendingApprovals(ctx context.Context, studentIDs []string) ([]parents.PaymentApproval, error) {
	if len(studentIDs) == 0 {
		return []parents.PaymentApproval{}, nil
	}
	rows, err := r.db.Query(ctx, `
		SELECT
			req.id::text,
			req.user_id::text,
			COALESCE(NULLIF(btrim(u.name), ''), u.email),
			req.product_id::text,
			req.product_name,
			COALESCE(prod.product_type, 'course'),
			req.final_amount_minor,
			req.currency,
			req.status,
			req.parent_approval_status,
			req.revision,
			req.created_at
		FROM commerce_payment_requests req
		JOIN users u
		  ON u.id = req.user_id
		LEFT JOIN commerce_products prod
		  ON prod.id = req.product_id
		WHERE req.user_id::text = ANY($1::text[])
		  AND req.status = 'pending'
		  AND req.parent_approval_status = 'pending'
		ORDER BY req.created_at DESC, req.id DESC
	`, studentIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	items := make([]parents.PaymentApproval, 0)
	for rows.Next() {
		var row parents.PaymentApproval
		if err = rows.Scan(
			&row.ID,
			&row.StudentID,
			&row.StudentName,
			&row.ProductID,
			&row.ProductName,
			&row.ProductType,
			&row.FinalAmountMinor,
			&row.Currency,
			&row.Status,
			&row.ParentApprovalStatus,
			&row.Revision,
			&row.CreatedAt,
		); err != nil {
			return nil, err
		}
		items = append(items, row)
	}
	return items, rows.Err()
}

func (r *Repository) GetApprovalTarget(ctx context.Context, requestID string) (studentID, status, parentStatus string, revision int, err error) {
	err = r.db.QueryRow(ctx, `
		SELECT user_id::text, status, parent_approval_status, revision
		FROM commerce_payment_requests
		WHERE id::text = $1
	`, strings.TrimSpace(requestID)).Scan(&studentID, &status, &parentStatus, &revision)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", "", "", 0, ErrNotFound
	}
	return studentID, status, parentStatus, revision, err
}

func (r *Repository) DecideApproval(
	ctx context.Context,
	requestID string,
	parentUserID string,
	decision string,
	expectedRevision int,
) (parents.PaymentApproval, error) {
	var query string
	if decision == "rejected" {
		query = `
			UPDATE commerce_payment_requests req
			SET parent_approval_status = 'rejected',
				status = 'rejected',
				parent_approved_by = $2::uuid,
				parent_approved_at = now(),
				reviewed_by = $2::uuid,
				reviewed_at = now(),
				reviewer_notes = 'رفض ولي الأمر',
				revision = req.revision + 1,
				updated_at = now()
			WHERE req.id::text = $1
			  AND req.status = 'pending'
			  AND req.parent_approval_status = 'pending'
			  AND req.revision = $3
			RETURNING
				req.id::text,
				req.user_id::text,
				req.product_id::text,
				req.product_name,
				req.final_amount_minor,
				req.currency,
				req.status,
				req.parent_approval_status,
				req.revision,
				req.created_at
		`
	} else {
		query = `
			UPDATE commerce_payment_requests req
			SET parent_approval_status = 'approved',
				parent_approved_by = $2::uuid,
				parent_approved_at = now(),
				revision = req.revision + 1,
				updated_at = now()
			WHERE req.id::text = $1
			  AND req.status = 'pending'
			  AND req.parent_approval_status = 'pending'
			  AND req.revision = $3
			RETURNING
				req.id::text,
				req.user_id::text,
				req.product_id::text,
				req.product_name,
				req.final_amount_minor,
				req.currency,
				req.status,
				req.parent_approval_status,
				req.revision,
				req.created_at
		`
	}
	var out parents.PaymentApproval
	err := r.db.QueryRow(ctx, query, strings.TrimSpace(requestID), strings.TrimSpace(parentUserID), expectedRevision).Scan(
		&out.ID,
		&out.StudentID,
		&out.ProductID,
		&out.ProductName,
		&out.FinalAmountMinor,
		&out.Currency,
		&out.Status,
		&out.ParentApprovalStatus,
		&out.Revision,
		&out.CreatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return parents.PaymentApproval{}, ErrConflict
	}
	return out, err
}

func (r *Repository) RevokeStudentLink(ctx context.Context, parentUserID, studentUserID string) error {
	tag, err := r.db.Exec(ctx, `
		UPDATE parent_student_relationships
		SET status = 'revoked',
			updated_at = now()
		WHERE parent_user_id::text = $1
		  AND student_user_id::text = $2
		  AND status = 'active'
	`, strings.TrimSpace(parentUserID), strings.TrimSpace(studentUserID))
	if err != nil {
		return err
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}
