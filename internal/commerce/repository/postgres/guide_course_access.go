package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

// The public guide reads the same active course product as ResolveCourseAccess
// but does not query or expose entitlements for a guest.
func (r *Repository) ResolveGuestGuideCourseAccess(ctx context.Context, courseID string) (commerce.AccessDecision, error) {
	var mode commerce.AccessMode
	err := r.db.QueryRow(ctx, `SELECT access_mode FROM commerce_products WHERE product_type='course' AND course_id=$1::uuid AND status='active' AND is_visible=true`, courseID).Scan(&mode)
	if errors.Is(err, pgx.ErrNoRows) {
		return commerce.AccessDecision{Configured: false, Reason: "commerce_unconfigured"}, nil
	}
	if err != nil {
		return commerce.AccessDecision{}, err
	}
	if mode == commerce.AccessFree {
		return commerce.AccessDecision{Configured: true, Allowed: true, Reason: "free_product"}, nil
	}
	if mode == commerce.AccessPaid {
		return commerce.AccessDecision{Configured: true, Allowed: false, Reason: "paid_required"}, nil
	}
	return commerce.AccessDecision{Configured: false, Reason: "unsupported_access_mode"}, nil
}
