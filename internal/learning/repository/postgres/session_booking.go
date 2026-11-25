package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func mapError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.ErrNotFound
	}
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		switch pgErr.Code {
		case "23505", "23503", "23514":
			return learning.ErrConflict
		case "22P02":
			return learning.ErrNotFound
		}
	}
	return err
}

const sessionBookingSelectCols = `
	sb.id::text,
	sb.user_id::text,
	sb.request_key,
	sb.title,
	sb.target_label,
	sb.scheduled_date::text,
	sb.scheduled_time,
	sb.notes,
	COALESCE(sb.path_id::text,''),
	COALESCE(sb.stage_id::text,''),
	COALESCE(sb.subject_id::text,''),
	COALESCE(sb.section_id::text,''),
	COALESCE(ARRAY(SELECT x::text FROM unnest(sb.skill_ids) AS x), ARRAY[]::text[]),
	sb.booking_status,
	COALESCE(sb.teacher_id::text,''),
	sb.assigned_teacher_name,
	COALESCE(sb.session_id::text,''),
	sb.admin_notes,
	COALESCE(u.name,''),
	COALESCE(u.email,''),
	sb.created_at,
	sb.updated_at
`

func scanSessionBooking(row pgx.Row) (learning.SessionBooking, error) {
	var out learning.SessionBooking
	var status string
	err := row.Scan(
		&out.ID,
		&out.UserID,
		&out.RequestKey,
		&out.Title,
		&out.TargetLabel,
		&out.ScheduledDate,
		&out.ScheduledTime,
		&out.Notes,
		&out.PathID,
		&out.StageID,
		&out.SubjectID,
		&out.SectionID,
		&out.SkillIDs,
		&status,
		&out.TeacherID,
		&out.AssignedTeacherName,
		&out.SessionID,
		&out.AdminNotes,
		&out.StudentName,
		&out.StudentEmail,
		&out.CreatedAt,
		&out.UpdatedAt,
	)
	out.BookingStatus = learning.BookingStatus(status)
	if out.SkillIDs == nil {
		out.SkillIDs = []string{}
	}
	return out, err
}

func (r *Repository) getSessionBookingByID(ctx context.Context, q interface {
	QueryRow(context.Context, string, ...any) pgx.Row
}, bookingID string) (learning.SessionBooking, error) {
	return scanSessionBooking(q.QueryRow(ctx, `
		SELECT `+sessionBookingSelectCols+`
		FROM session_bookings sb
		LEFT JOIN users u ON u.id=sb.user_id
		WHERE sb.id=$1::uuid
	`, bookingID))
}

func (r *Repository) CreateSessionBooking(ctx context.Context, userID string, input learning.SessionBookingCreate) (learning.SessionBooking, bool, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return learning.SessionBooking{}, false, err
	}
	defer tx.Rollback(ctx)

	var insertedID string
	err = tx.QueryRow(ctx, `
		INSERT INTO session_bookings(
			user_id,request_key,title,target_label,scheduled_date,scheduled_time,notes,
			path_id,stage_id,subject_id,section_id,skill_ids
		) VALUES(
			$1::uuid,$2,$3,$4,$5::date,$6,$7,
			NULLIF($8,'')::uuid,NULLIF($9,'')::uuid,NULLIF($10,'')::uuid,NULLIF($11,'')::uuid,$12::uuid[]
		)
		ON CONFLICT (user_id,request_key) DO NOTHING
		RETURNING id::text
	`, userID, input.RequestKey, input.Title, input.TargetLabel, input.ScheduledDate, input.ScheduledTime, input.Notes,
		input.PathID, input.StageID, input.SubjectID, input.SectionID, input.SkillIDs).Scan(&insertedID)

	created := true
	if errors.Is(err, pgx.ErrNoRows) {
		created = false
		err = tx.QueryRow(ctx, `
			SELECT id::text FROM session_bookings WHERE user_id=$1::uuid AND request_key=$2
		`, userID, input.RequestKey).Scan(&insertedID)
	}
	if err != nil {
		return learning.SessionBooking{}, false, mapError(err)
	}

	booking, err := r.getSessionBookingByID(ctx, tx, insertedID)
	if err != nil {
		return learning.SessionBooking{}, false, mapError(err)
	}

	if created {
		if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
			ActorUserID:  userID,
			Action:       "learning.session_booking.create",
			ResourceType: "session_booking",
			ResourceID:   booking.ID,
			Status:       string(operations.AuditSuccess),
			Metadata: map[string]any{
				"scheduledDate": booking.ScheduledDate,
				"scheduledTime": booking.ScheduledTime,
				"pathId":        booking.PathID,
				"subjectId":     booking.SubjectID,
			},
		}); err != nil {
			return learning.SessionBooking{}, false, err
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return learning.SessionBooking{}, false, err
	}
	return booking, created, nil
}

func (r *Repository) ListMySessionBookings(ctx context.Context, userID string, limit int) ([]learning.SessionBooking, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+sessionBookingSelectCols+`
		FROM session_bookings sb
		LEFT JOIN users u ON u.id=sb.user_id
		WHERE sb.user_id=$1::uuid
		ORDER BY sb.created_at DESC, sb.id DESC
		LIMIT $2
	`, userID, limit)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()

	items := make([]learning.SessionBooking, 0)
	for rows.Next() {
		item, scanErr := scanSessionBooking(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) CancelMySessionBooking(ctx context.Context, userID, bookingID string) (learning.SessionBooking, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return learning.SessionBooking{}, err
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT booking_status
		FROM session_bookings
		WHERE id=$1::uuid AND user_id=$2::uuid
		FOR UPDATE
	`, bookingID, userID).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.SessionBooking{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if currentStatus != string(learning.BookingPending) {
		return learning.SessionBooking{}, learning.ErrConflict
	}

	if _, err = tx.Exec(ctx, `
		UPDATE session_bookings
		SET booking_status='cancelled', updated_at=now()
		WHERE id=$1::uuid AND user_id=$2::uuid AND booking_status='pending'
	`, bookingID, userID); err != nil {
		return learning.SessionBooking{}, mapError(err)
	}

	if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  userID,
		Action:       "learning.session_booking.cancel",
		ResourceType: "session_booking",
		ResourceID:   bookingID,
		Status:       string(operations.AuditSuccess),
	}); err != nil {
		return learning.SessionBooking{}, err
	}

	out, err := r.getSessionBookingByID(ctx, tx, bookingID)
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.SessionBooking{}, err
	}
	return out, nil
}

func (r *Repository) ListTeacherSessionBookings(ctx context.Context, teacherID string, limit int) ([]learning.SessionBooking, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+sessionBookingSelectCols+`
		FROM session_bookings sb
		LEFT JOIN users u ON u.id=sb.user_id
		WHERE sb.teacher_id=$1::uuid
		ORDER BY sb.created_at DESC, sb.id DESC
		LIMIT $2
	`, teacherID, limit)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()

	items := make([]learning.SessionBooking, 0)
	for rows.Next() {
		item, scanErr := scanSessionBooking(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) RejectTeacherSessionBooking(ctx context.Context, teacherID, bookingID string) (learning.SessionBooking, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return learning.SessionBooking{}, err
	}
	defer tx.Rollback(ctx)

	var currentStatus string
	err = tx.QueryRow(ctx, `
		SELECT booking_status
		FROM session_bookings
		WHERE id=$1::uuid AND teacher_id=$2::uuid
		FOR UPDATE
	`, bookingID, teacherID).Scan(&currentStatus)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.SessionBooking{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if currentStatus != string(learning.BookingPending) {
		return learning.SessionBooking{}, learning.ErrConflict
	}

	if _, err = tx.Exec(ctx, `
		UPDATE session_bookings
		SET booking_status='rejected', updated_at=now()
		WHERE id=$1::uuid AND teacher_id=$2::uuid AND booking_status='pending'
	`, bookingID, teacherID); err != nil {
		return learning.SessionBooking{}, mapError(err)
	}

	if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  teacherID,
		Action:       "learning.session_booking.reject",
		ResourceType: "session_booking",
		ResourceID:   bookingID,
		Status:       string(operations.AuditSuccess),
	}); err != nil {
		return learning.SessionBooking{}, err
	}

	out, err := r.getSessionBookingByID(ctx, tx, bookingID)
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.SessionBooking{}, err
	}
	return out, nil
}

func (r *Repository) ListAdminSessionBookings(ctx context.Context, status string, limit int) ([]learning.SessionBooking, error) {
	args := []any{limit}
	whereClause := ""
	if status != "" && status != "all" {
		args = append(args, status)
		whereClause = fmt.Sprintf("WHERE sb.booking_status=$%d", len(args))
	}
	rows, err := r.db.Query(ctx, `
		SELECT `+sessionBookingSelectCols+`
		FROM session_bookings sb
		LEFT JOIN users u ON u.id=sb.user_id
		`+whereClause+`
		ORDER BY sb.created_at DESC, sb.id DESC
		LIMIT $1
	`, args...)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()

	items := make([]learning.SessionBooking, 0)
	for rows.Next() {
		item, scanErr := scanSessionBooking(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		items = append(items, item)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	return items, nil
}

func (r *Repository) AdminUpdateSessionBooking(ctx context.Context, actorID, bookingID string, patch learning.SessionBookingAdminPatch) (learning.SessionBooking, error) {
	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return learning.SessionBooking{}, err
	}
	defer tx.Rollback(ctx)

	var currentStatus, currentTeacherID, currentSessionID string
	err = tx.QueryRow(ctx, `
		SELECT booking_status, COALESCE(teacher_id::text,''), COALESCE(session_id::text,'')
		FROM session_bookings
		WHERE id=$1::uuid
		FOR UPDATE
	`, bookingID).Scan(&currentStatus, &currentTeacherID, &currentSessionID)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.SessionBooking{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if currentSessionID != "" && patch.TeacherID != "" {
		return learning.SessionBooking{}, learning.ErrConflict
	}

	sets := []string{"updated_at=now()"}
	args := []any{bookingID}
	addArg := func(col, expr string, val any) {
		args = append(args, val)
		sets = append(sets, fmt.Sprintf("%s=%s$%d", col, expr, len(args)))
	}

	if patch.TeacherID != "" {
		var teacherName string
		err = tx.QueryRow(ctx, `
			SELECT u.name
			FROM users u
			JOIN user_roles ur ON ur.user_id=u.id
			WHERE u.id=$1::uuid AND ur.role IN ('teacher','platform_trainer') AND u.status='active'
			LIMIT 1
		`, patch.TeacherID).Scan(&teacherName)
		if errors.Is(err, pgx.ErrNoRows) {
			return learning.SessionBooking{}, learning.ErrConflict
		}
		if err != nil {
			return learning.SessionBooking{}, mapError(err)
		}
		addArg("teacher_id", "", patch.TeacherID)
		if patch.AssignedTeacherName == "" {
			patch.AssignedTeacherName = teacherName
		}
	}
	if patch.AssignedTeacherName != "" {
		addArg("assigned_teacher_name", "", patch.AssignedTeacherName)
	}
	if patch.BookingStatus != "" {
		addArg("booking_status", "", patch.BookingStatus)
	}
	if patch.AdminNotes != "" {
		addArg("admin_notes", "", patch.AdminNotes)
	}

	query := fmt.Sprintf("UPDATE session_bookings SET %s WHERE id=$1::uuid", strings.Join(sets, ", "))
	if _, err = tx.Exec(ctx, query, args...); err != nil {
		return learning.SessionBooking{}, mapError(err)
	}

	if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "learning.session_booking.admin_update",
		ResourceType: "session_booking",
		ResourceID:   bookingID,
		Status:       string(operations.AuditSuccess),
		Metadata: map[string]any{
			"previousStatus": currentStatus,
			"nextStatus":     patch.BookingStatus,
			"teacherId":      patch.TeacherID,
		},
	}); err != nil {
		return learning.SessionBooking{}, err
	}

	out, err := r.getSessionBookingByID(ctx, tx, bookingID)
	if err != nil {
		return learning.SessionBooking{}, mapError(err)
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.SessionBooking{}, err
	}
	return out, nil
}
