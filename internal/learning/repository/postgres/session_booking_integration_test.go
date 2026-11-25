package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type testBookingAuditWriter struct{}

func (testBookingAuditWriter) WriteTx(ctx context.Context, tx pgx.Tx, event operations.AuditEvent) error {
	_, err := tx.Exec(ctx, `
		INSERT INTO audit_logs(actor_user_id, action, resource_type, resource_id, status)
		VALUES ($1, $2, $3, $4, $5)
	`, event.ActorUserID, event.Action, event.ResourceType, event.ResourceID, event.Status)
	return err
}

func TestSessionBookingsIdempotencyCancelAndRBACPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	for _, stmt := range []string{
		"CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL)",
		"CREATE TEMP TABLE user_roles (LIKE public.user_roles INCLUDING ALL)",
		"CREATE TEMP TABLE session_bookings (LIKE public.session_bookings INCLUDING ALL)",
		"CREATE TEMP TABLE audit_logs (LIKE public.audit_logs INCLUDING ALL)",
	} {
		if _, err := db.Exec(ctx, stmt); err != nil {
			t.Fatalf("setup %s: %v", stmt, err)
		}
	}

	const studentA = "00000000-0000-4000-8000-000000000001"
	const studentB = "00000000-0000-4000-8000-000000000002"
	const teacherA = "00000000-0000-4000-8000-000000000003"
	const adminUser = "00000000-0000-4000-8000-000000000004"
	const pathID = "0199aabb-ccdd-7eee-8fff-001122334401"
	const subjectID = "0199aabb-ccdd-7eee-8fff-001122334402"
	const skillID = "0199aabb-ccdd-7eee-8fff-001122334403"

	if _, err := db.Exec(ctx, `
		INSERT INTO users(id, email, name, password_hash, status) VALUES
		($1, 'studenta@example.invalid', 'سارة الحربي', 'hash', 'active'),
		($2, 'studentb@example.invalid', 'نورة القحطاني', 'hash', 'active'),
		($3, 'teachera@example.invalid', 'أ. فهد', 'hash', 'active'),
		($4, 'admin@example.invalid', 'مدير المنصة', 'hash', 'active')
	`, studentA, studentB, teacherA, adminUser); err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(ctx, `INSERT INTO user_roles(user_id, role) VALUES ($1, 'teacher')`, teacherA); err != nil {
		t.Fatal(err)
	}

	repo := New(db, testBookingAuditWriter{})
	svc := learningapp.NewSessionBookingService(repo)
	studentActor := identity.User{ID: studentA, Roles: []identity.Role{identity.RoleStudent}}
	otherStudentActor := identity.User{ID: studentB, Roles: []identity.Role{identity.RoleStudent}}
	teacherActor := identity.User{ID: teacherA, Roles: []identity.Role{identity.RoleTeacher}}
	adminActor := identity.User{ID: adminUser, Roles: []identity.Role{identity.RoleAdmin}}

	riyadh := time.FixedZone("Asia/Riyadh", 3*60*60)
	tomorrow := time.Now().In(riyadh).AddDate(0, 0, 1).Format("2006-01-02")
	yesterday := time.Now().In(riyadh).AddDate(0, 0, -1).Format("2006-01-02")

	// Past date in Asia/Riyadh must be rejected.
	if _, _, err := svc.Create(ctx, studentActor, learning.SessionBookingCreate{
		Title:         "مراجعة جبر",
		TargetLabel:   "الرياضيات > المعادلات",
		ScheduledDate: yesterday,
		ScheduledTime: "16:00",
		RequestKey:    "req-past-date-1234",
	}); !errors.Is(err, learningapp.ErrBookingPastDate) {
		t.Fatalf("expected ErrBookingPastDate, got %v", err)
	}

	// Non-student cannot create a student booking via student flow if missing student role.
	if _, _, err := svc.Create(ctx, teacherActor, learning.SessionBookingCreate{
		Title:         "حصة",
		TargetLabel:   "مهارة",
		ScheduledDate: tomorrow,
		ScheduledTime: "16:00",
		RequestKey:    "req-teacher-forbidden-1",
	}); !errors.Is(err, learningapp.ErrForbidden) {
		t.Fatalf("expected forbidden for teacher role creating student booking, got %v", err)
	}

	createInput := learning.SessionBookingCreate{
		Title:         "مراجعة مهارة المعادلات الخطية",
		TargetLabel:   "القدرات > الكمي > المعادلات الخطية",
		ScheduledDate: tomorrow,
		ScheduledTime: "17:30",
		Notes:         "أحتاج شرح المسائل اللفظية",
		RequestKey:    "booking-idem-key-0001",
		PathID:        pathID,
		SubjectID:     subjectID,
		SkillIDs:      []string{skillID},
	}
	first, created, err := svc.Create(ctx, studentActor, createInput)
	if err != nil || !created || first.BookingStatus != learning.BookingPending {
		t.Fatalf("first create failed: booking=%+v created=%v err=%v", first, created, err)
	}

	// Duplicate requestKey must return the existing row with created=false and write only 1 audit row.
	dup, createdDup, err := svc.Create(ctx, studentActor, createInput)
	if err != nil || createdDup || dup.ID != first.ID {
		t.Fatalf("duplicate create must be idempotent: dup=%+v created=%v err=%v", dup, createdDup, err)
	}

	var countBookings, countAudits int
	if err := db.QueryRow(ctx, `SELECT count(*)::int FROM session_bookings WHERE user_id=$1::uuid`, studentA).Scan(&countBookings); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRow(ctx, `SELECT count(*)::int FROM audit_logs WHERE resource_id=$1 AND action='learning.session_booking.create'`, first.ID).Scan(&countAudits); err != nil {
		t.Fatal(err)
	}
	if countBookings != 1 || countAudits != 1 {
		t.Fatalf("expected 1 booking and 1 audit log, got bookings=%d audits=%d", countBookings, countAudits)
	}

	// Other student cannot see or cancel studentA's booking.
	otherList, err := svc.ListMine(ctx, otherStudentActor, 20)
	if err != nil || len(otherList) != 0 {
		t.Fatalf("expected empty list for other student, got %+v err=%v", otherList, err)
	}
	if _, err := svc.CancelMine(ctx, otherStudentActor, first.ID); !errors.Is(err, learning.ErrNotFound) {
		t.Fatalf("other student cancel expected ErrNotFound, got %v", err)
	}

	// Cancel pending booking succeeds, second cancel returns ErrConflict.
	cancelled, err := svc.CancelMine(ctx, studentActor, first.ID)
	if err != nil || cancelled.BookingStatus != learning.BookingCancelled {
		t.Fatalf("cancel pending failed: %+v err=%v", cancelled, err)
	}
	if _, err := svc.CancelMine(ctx, studentActor, first.ID); !errors.Is(err, learning.ErrConflict) {
		t.Fatalf("second cancel expected ErrConflict, got %v", err)
	}

	// Create second booking for admin confirm + teacher list/reject isolation.
	second, _, err := svc.Create(ctx, studentActor, learning.SessionBookingCreate{
		Title:         "تقوية هندسة",
		TargetLabel:   "الرياضيات > الهندسة",
		ScheduledDate: tomorrow,
		ScheduledTime: "19:00",
		RequestKey:    "booking-idem-key-0002",
	})
	if err != nil {
		t.Fatal(err)
	}

	// Student cannot call admin/teacher endpoints.
	if _, err := svc.ListAdmin(ctx, studentActor, "all", 20); !errors.Is(err, learningapp.ErrForbidden) {
		t.Fatalf("student must be forbidden from ListAdmin, got %v", err)
	}
	if _, err := svc.ListTeacher(ctx, studentActor, 20); !errors.Is(err, learningapp.ErrForbidden) {
		t.Fatalf("student must be forbidden from ListTeacher, got %v", err)
	}

	// Admin assigns teacher while leaving status pending so teacher can test reject, then confirm another.
	assigned, err := svc.AdminUpdate(ctx, adminActor, second.ID, learning.SessionBookingAdminPatch{
		TeacherID:           teacherA,
		AssignedTeacherName: "أ. فهد",
		AdminNotes:          "مجدول مبدئياً",
	})
	if err != nil || assigned.TeacherID != teacherA || assigned.BookingStatus != learning.BookingPending {
		t.Fatalf("admin assign failed: %+v err=%v", assigned, err)
	}

	teacherItems, err := svc.ListTeacher(ctx, teacherActor, 20)
	if err != nil || len(teacherItems) != 1 || teacherItems[0].ID != second.ID {
		t.Fatalf("teacher list mismatch: %+v err=%v", teacherItems, err)
	}

	rejected, err := svc.RejectTeacher(ctx, teacherActor, second.ID)
	if err != nil || rejected.BookingStatus != learning.BookingRejected {
		t.Fatalf("teacher reject failed: %+v err=%v", rejected, err)
	}
	if _, err := svc.RejectTeacher(ctx, teacherActor, second.ID); !errors.Is(err, learning.ErrConflict) {
		t.Fatalf("second teacher reject expected ErrConflict, got %v", err)
	}
}
