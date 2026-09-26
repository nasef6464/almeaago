package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func (r *Repository) ResolveScopedAccess(
	ctx context.Context,
	userID string,
	schoolIDs []string,
	pathID, subjectID, courseID string,
	contentType commerce.ContentType,
	packageOnly bool,
) (commerce.AccessDecision, error) {
	decision := commerce.AccessDecision{Configured: true}
	var entitlementID, subjectType, productID, sourceType string
	err := r.db.QueryRow(ctx, `
SELECT e.id::text,e.subject_type,p.id::text,e.source_type
FROM commerce_entitlements e
JOIN commerce_products p ON p.id=e.product_id
LEFT JOIN commerce_packages pkg ON pkg.product_id=p.id
WHERE e.status='active'
  AND e.starts_at<=now()
  AND (e.expires_at IS NULL OR e.expires_at>now())
  AND p.status='active'
  AND p.is_visible=true
  AND (
    (e.subject_type='user' AND e.user_id=$1::uuid)
    OR
    (e.subject_type='school' AND e.school_id::text=ANY($2::text[]))
  )
  AND (
    (
      NOT $7
      AND $5<>''
      AND p.product_type='course'
      AND p.course_id=$5::uuid
    )
    OR
    (
      p.product_type IN ('package','membership')
      AND (e.subject_type='user' OR pkg.seat_capacity IS NULL)
      AND EXISTS(
        SELECT 1
        FROM commerce_package_items pi
        WHERE pi.package_id=pkg.id
          AND (
            pi.scope_type='all'
            OR (pi.scope_type='course' AND $5<>'' AND pi.course_id=$5::uuid)
            OR (pi.scope_type='path' AND pi.path_id=$3::uuid)
            OR (pi.scope_type='subject' AND $4<>'' AND pi.subject_id=$4::uuid)
            OR (pi.scope_type='content_type' AND pi.content_type IN ($6,'all'))
          )
      )
    )
  )
ORDER BY
  CASE WHEN e.subject_type='user' THEN 0 ELSE 1 END,
  CASE WHEN p.product_type='course' THEN 0 ELSE 1 END,
  e.created_at DESC,e.id
LIMIT 1
`, userID, schoolIDs, pathID, subjectID, courseID, string(contentType), packageOnly).Scan(
		&entitlementID, &subjectType, &productID, &sourceType,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		decision.Allowed = false
		decision.Reason = "paid_required"
		return decision, nil
	}
	if err != nil {
		return decision, err
	}
	decision.Allowed = true
	decision.ProductID = productID
	decision.EntitlementID = entitlementID
	decision.EntitlementSource = sourceType
	if subjectType == "school" {
		decision.Reason = "school_entitlement"
	} else {
		decision.Reason = "user_entitlement"
	}
	return decision, nil
}
