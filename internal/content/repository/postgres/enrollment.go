package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"
	contentapp "github.com/nasef6464/almeaago/internal/content/application"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

var ErrCoursePurchaseRequired = contentapp.ErrCoursePurchaseRequired

func (r *Repository) EnrollFreeCourse(ctx context.Context, userID, courseID string) (content.CourseEnrollmentResponse, error) {
	var title string
	var isPublished, isVisible bool
	var workflowStatus string
	err := r.db.QueryRow(ctx, `
		SELECT title, is_published, is_visible, workflow_status
		FROM courses
		WHERE id = $1::uuid
	`, courseID).Scan(&title, &isPublished, &isVisible, &workflowStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return content.CourseEnrollmentResponse{}, content.ErrNotFound
	}
	if err != nil {
		return content.CourseEnrollmentResponse{}, err
	}
	if !isPublished || !isVisible || workflowStatus != "approved" {
		return content.CourseEnrollmentResponse{}, content.ErrNotFound
	}

	var productID, accessMode string
	var priceMinor int
	err = r.db.QueryRow(ctx, `
		SELECT id::text, access_mode, price_minor
		FROM commerce_products
		WHERE course_id = $1::uuid AND product_type = 'course' AND status = 'active'
		ORDER BY created_at DESC
		LIMIT 1
	`, courseID).Scan(&productID, &accessMode, &priceMinor)

	if err == nil {
		if accessMode == "paid" && priceMinor > 0 {
			return content.CourseEnrollmentResponse{}, ErrCoursePurchaseRequired
		}
	} else if errors.Is(err, pgx.ErrNoRows) {
		// Product not registered yet, default to free product
		code := "course_" + courseID
		err = r.db.QueryRow(ctx, `
			INSERT INTO commerce_products (
				code, product_type, name, description, status, access_mode, price_minor, currency, course_id, is_visible
			)
			VALUES ($1, 'course', $2, '', 'active', 'free', 0, 'SAR', $3::uuid, true)
			ON CONFLICT (code) DO UPDATE SET updated_at = now()
			RETURNING id::text
		`, code, title, courseID).Scan(&productID)
		if err != nil {
			return content.CourseEnrollmentResponse{}, err
		}
	} else {
		return content.CourseEnrollmentResponse{}, err
	}

	// Check if already actively enrolled
	var existingCreatedAt time.Time
	err = r.db.QueryRow(ctx, `
		SELECT created_at
		FROM commerce_entitlements
		WHERE user_id = $1::uuid AND product_id = $2::uuid AND status = 'active'
		  AND (expires_at IS NULL OR expires_at > now())
		LIMIT 1
	`, userID, productID).Scan(&existingCreatedAt)
	if err == nil {
		return content.CourseEnrollmentResponse{
			Success:         true,
			Enrolled:        true,
			AlreadyEnrolled: true,
			CourseID:        courseID,
			EnrolledAt:      existingCreatedAt,
			Message:         "Already enrolled in course",
		}, nil
	}

	// Insert active entitlement
	var enrolledAt time.Time
	idempotencyKey := "free_enrollment:" + userID + ":" + courseID
	err = r.db.QueryRow(ctx, `
		INSERT INTO commerce_entitlements (
			subject_type, user_id, product_id, source_type, source_id, status, starts_at, expires_at, idempotency_key, metadata
		)
		VALUES (
			'user', $1::uuid, $2::uuid, 'free_enrollment', $3, 'active', now(), NULL,
			$4,
			jsonb_build_object('channel', 'direct_free_enrollment')
		)
		ON CONFLICT (idempotency_key) DO UPDATE SET status = 'active', updated_at = now()
		RETURNING created_at
	`, userID, productID, courseID, idempotencyKey).Scan(&enrolledAt)
	if err != nil {
		return content.CourseEnrollmentResponse{}, err
	}

	if r.audit != nil {
		_ = r.audit.WriteTx(ctx, nil, operations.AuditEvent{
			ActorUserID:  userID,
			Action:       "course.free_enroll",
			ResourceType: "course",
			ResourceID:   courseID,
		})
	}

	return content.CourseEnrollmentResponse{
		Success:         true,
		Enrolled:        true,
		AlreadyEnrolled: false,
		CourseID:        courseID,
		EnrolledAt:      enrolledAt,
		Message:         "Enrolled in course successfully",
	}, nil
}
