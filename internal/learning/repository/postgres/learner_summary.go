package postgres

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func computeConsecutiveStreak(dayKeys []string, now time.Time) int {
	if len(dayKeys) == 0 {
		return 0
	}
	riyadh := time.FixedZone("Asia/Riyadh", 3*60*60)
	localNow := now.In(riyadh)
	todayKey := localNow.Format("2006-01-02")
	yesterdayKey := localNow.AddDate(0, 0, -1).Format("2006-01-02")

	daySet := make(map[string]struct{}, len(dayKeys))
	for _, k := range dayKeys {
		if k != "" {
			daySet[k] = struct{}{}
		}
	}

	cursor := localNow
	if _, hasToday := daySet[todayKey]; hasToday {
		// start from today
	} else if _, hasYesterday := daySet[yesterdayKey]; hasYesterday {
		cursor = localNow.AddDate(0, 0, -1)
	} else {
		return 0
	}

	streak := 0
	for {
		key := cursor.Format("2006-01-02")
		if _, ok := daySet[key]; !ok {
			break
		}
		streak++
		cursor = cursor.AddDate(0, 0, -1)
		if streak >= 3650 {
			break
		}
	}
	return streak
}

func (r *Repository) GetAchievementsSummary(ctx context.Context, studentID string) (learning.LearnerAchievementsSummary, error) {
	var out learning.LearnerAchievementsSummary
	out.Timeline = []learning.LearnerTimelineItem{}

	if err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM lesson_progress
		WHERE student_id=$1::uuid AND status='completed'
	`, studentID).Scan(&out.CompletedLessons); err != nil {
		return out, mapError(err)
	}

	var quizPoints int
	if err := r.db.QueryRow(ctx, `
		SELECT
			count(*)::int,
			count(*) FILTER (WHERE score >= 100)::int,
			COALESCE(sum(GREATEST(20, round(score / 2.0)::int) + CASE WHEN score >= 100 THEN 25 ELSE 0 END), 0)::int
		FROM assessment_results
		WHERE student_id=$1::uuid
	`, studentID).Scan(&out.CompletedQuizzes, &out.PerfectQuizzes, &quizPoints); err != nil {
		return out, mapError(err)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM skill_progress
		WHERE student_id=$1::uuid AND mastery >= 80
	`, studentID).Scan(&out.MasteredSkills); err != nil {
		return out, mapError(err)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT count(DISTINCT course_id)::int
		FROM (
			SELECT cp.course_id
			FROM commerce_entitlements ce
			JOIN commerce_products cp ON cp.id=ce.product_id
			WHERE ce.user_id=$1::uuid AND ce.status='active'
			  AND ce.starts_at <= now() AND (ce.expires_at IS NULL OR ce.expires_at > now())
			  AND cp.course_id IS NOT NULL
			UNION
			SELECT lp.course_id
			FROM lesson_progress lp
			WHERE lp.student_id=$1::uuid AND lp.context_type='course' AND lp.course_id IS NOT NULL
		) enrolled
	`, studentID).Scan(&out.EnrolledCourses); err != nil {
		return out, mapError(err)
	}

	if err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM course_certificates
		WHERE user_id=$1::uuid
	`, studentID).Scan(&out.CertificatesCount); err != nil {
		return out, mapError(err)
	}

	var reviewCount, bookingCount int
	if err := r.db.QueryRow(ctx, `
		SELECT
			(SELECT count(*)::int FROM review_answer_submissions WHERE student_id=$1::uuid),
			(SELECT count(*)::int FROM session_bookings WHERE user_id=$1::uuid)
	`, studentID).Scan(&reviewCount, &bookingCount); err != nil {
		return out, mapError(err)
	}
	out.ActivityCount = out.CompletedLessons + out.CompletedQuizzes + reviewCount + bookingCount

	dayRows, err := r.db.Query(ctx, `
		SELECT DISTINCT day_key FROM (
			SELECT to_char(updated_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS day_key
			FROM lesson_progress WHERE student_id=$1::uuid
			UNION ALL
			SELECT to_char(finalized_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS day_key
			FROM assessment_results WHERE student_id=$1::uuid
			UNION ALL
			SELECT to_char(created_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS day_key
			FROM review_answer_submissions WHERE student_id=$1::uuid
			UNION ALL
			SELECT to_char(created_at AT TIME ZONE 'Asia/Riyadh', 'YYYY-MM-DD') AS day_key
			FROM session_bookings WHERE user_id=$1::uuid
		) days
		ORDER BY day_key DESC
		LIMIT 400
	`, studentID)
	if err != nil {
		return out, mapError(err)
	}
	var dayKeys []string
	for dayRows.Next() {
		var key string
		if scanErr := dayRows.Scan(&key); scanErr != nil {
			dayRows.Close()
			return out, scanErr
		}
		dayKeys = append(dayKeys, key)
	}
	dayRows.Close()
	if err = dayRows.Err(); err != nil {
		return out, err
	}
	out.StreakDays = computeConsecutiveStreak(dayKeys, time.Now().UTC())

	out.Points = (out.CompletedLessons * 10) + quizPoints + (out.ActivityCount * 5) + (out.EnrolledCourses * 30)
	out.Level = (out.Points / 1000) + 1

	timelineRows, err := r.db.Query(ctx, `
		SELECT id, type, title, subtitle, occurred_at FROM (
			SELECT
				ar.attempt_id::text AS id,
				'quiz_complete'::text AS type,
				'أنهيت اختبار ' || COALESCE(av.title, 'تقييم') AS title,
				'حققت ' || round(ar.score)::int || '%' AS subtitle,
				ar.finalized_at AS occurred_at
			FROM assessment_results ar
			LEFT JOIN assessment_versions av ON av.assessment_id=ar.assessment_id AND av.version=ar.assessment_version
			WHERE ar.student_id=$1::uuid
			UNION ALL
			SELECT
				lp.id::text AS id,
				'lesson_complete'::text AS type,
				'أكملت درس ' || COALESCE(l.title, 'تعليمي') AS title,
				'+10 نقاط'::text AS subtitle,
				COALESCE(lp.completed_at, lp.updated_at) AS occurred_at
			FROM lesson_progress lp
			JOIN lessons l ON l.id=lp.lesson_id
			WHERE lp.student_id=$1::uuid AND lp.status='completed'
			UNION ALL
			SELECT
				sb.id::text AS id,
				'session_booked'::text AS type,
				sb.title AS title,
				'حجز حصة: ' || sb.scheduled_date::text AS subtitle,
				sb.created_at AS occurred_at
			FROM session_bookings sb
			WHERE sb.user_id=$1::uuid
		) events
		ORDER BY occurred_at DESC
		LIMIT 8
	`, studentID)
	if err != nil {
		return out, mapError(err)
	}
	defer timelineRows.Close()
	for timelineRows.Next() {
		var item learning.LearnerTimelineItem
		if scanErr := timelineRows.Scan(&item.ID, &item.Type, &item.Title, &item.Subtitle, &item.Date); scanErr != nil {
			return out, scanErr
		}
		out.Timeline = append(out.Timeline, item)
	}
	if err = timelineRows.Err(); err != nil {
		return out, err
	}

	return out, nil
}

func (r *Repository) ListCoursesProgressSummary(ctx context.Context, studentID string) ([]learning.LearnerCourseProgressSummary, error) {
	rows, err := r.db.Query(ctx, `
		SELECT
			c.id::text,
			c.path_id::text,
			COALESCE(p.name,''),
			c.subject_id::text,
			COALESCE(s.name,''),
			c.title,
			c.description,
			c.instructor_name,
			COALESCE(c.thumbnail_asset_id::text,''),
			COALESCE(a.public_url,''),
			c.certificate_enabled,
			EXISTS (
				SELECT 1
				FROM commerce_entitlements ce
				JOIN commerce_products cp ON cp.id=ce.product_id
				LEFT JOIN commerce_packages pkg ON pkg.product_id=cp.id
				LEFT JOIN commerce_package_items cpi ON cpi.package_id=pkg.id
				WHERE ce.user_id=$1::uuid AND ce.status='active'
				  AND ce.starts_at <= now() AND (ce.expires_at IS NULL OR ce.expires_at > now())
				  AND (
					cp.course_id=c.id
					OR (cpi.scope_type='course' AND cpi.course_id=c.id)
					OR (cpi.scope_type='path' AND cpi.path_id=c.path_id)
					OR (cpi.scope_type='subject' AND cpi.subject_id=c.subject_id)
					OR cpi.scope_type='all'
				  )
			) OR EXISTS (
				SELECT 1 FROM lesson_progress lp
				WHERE lp.student_id=$1::uuid AND lp.context_type='course' AND lp.course_id=c.id
			) AS is_enrolled
		FROM courses c
		JOIN paths p ON p.id=c.path_id AND p.status='active'
		JOIN subjects s ON s.id=c.subject_id AND s.status='active'
		LEFT JOIN assets a ON a.id=c.thumbnail_asset_id AND a.status='active'
		WHERE c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
		ORDER BY c.published_at DESC NULLS LAST, c.id DESC
		LIMIT 100
	`, studentID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()

	courses := make([]learning.LearnerCourseProgressSummary, 0)
	courseIdx := make(map[string]int)
	courseIDs := make([]string, 0)
	for rows.Next() {
		var c learning.LearnerCourseProgressSummary
		var publicURL string
		if scanErr := rows.Scan(
			&c.ID, &c.PathID, &c.PathName, &c.SubjectID, &c.SubjectName,
			&c.Title, &c.Description, &c.InstructorName, &c.ThumbnailAssetID,
			&publicURL, &c.CertificateEnabled, &c.IsEnrolled,
		); scanErr != nil {
			return nil, scanErr
		}
		c.Category = strings.TrimSpace(c.PathName)
		if c.Category == "" {
			c.Category = strings.TrimSpace(c.SubjectName)
		}
		if publicURL != "" {
			c.ThumbnailURL = publicURL
		} else if c.ThumbnailAssetID != "" {
			c.ThumbnailURL = "/api/v1/assets/" + c.ThumbnailAssetID + "/raw"
		}
		c.Modules = []learning.LearnerCourseModulePreview{}
		courseIdx[c.ID] = len(courses)
		courseIDs = append(courseIDs, c.ID)
		courses = append(courses, c)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if len(courses) == 0 {
		return courses, nil
	}

	modRows, err := r.db.Query(ctx, `
		SELECT
			cm.course_id::text,
			cm.id::text,
			cm.title,
			l.id::text,
			l.title,
			l.duration_seconds,
			EXISTS (
				SELECT 1 FROM lesson_progress lp
				WHERE lp.student_id=$1::uuid AND lp.context_type='course'
				  AND lp.course_id=cm.course_id AND lp.lesson_id=l.id AND lp.status='completed'
			) AS completed
		FROM course_modules cm
		LEFT JOIN course_lessons cl ON cl.module_id=cm.id
		LEFT JOIN lessons l ON l.id=cl.lesson_id
		WHERE cm.course_id::text = ANY($2::text[]) AND cm.status='active'
		ORDER BY cm.course_id, cm.sort_order ASC, cl.sort_order ASC NULLS LAST
	`, studentID, courseIDs)
	if err != nil {
		return nil, mapError(err)
	}
	defer modRows.Close()

	modPosByCourse := make(map[string]map[string]int)
	for modRows.Next() {
		var cid, mid, mtitle string
		var lid, ltitle *string
		var dur *int
		var completed *bool
		if scanErr := modRows.Scan(&cid, &mid, &mtitle, &lid, &ltitle, &dur, &completed); scanErr != nil {
			return nil, scanErr
		}
		idx, ok := courseIdx[cid]
		if !ok {
			continue
		}
		if modPosByCourse[cid] == nil {
			modPosByCourse[cid] = make(map[string]int)
		}
		mIdx, mOk := modPosByCourse[cid][mid]
		if !mOk {
			mIdx = len(courses[idx].Modules)
			modPosByCourse[cid][mid] = mIdx
			courses[idx].Modules = append(courses[idx].Modules, learning.LearnerCourseModulePreview{
				ID:      mid,
				Title:   mtitle,
				Lessons: []learning.LearnerCourseLessonPreview{},
			})
		}
		if lid != nil && *lid != "" {
			isDone := completed != nil && *completed
			d := 0
			if dur != nil {
				d = *dur
			}
			t := ""
			if ltitle != nil {
				t = *ltitle
			}
			courses[idx].Modules[mIdx].Lessons = append(courses[idx].Modules[mIdx].Lessons, learning.LearnerCourseLessonPreview{
				ID:              *lid,
				Title:           t,
				DurationSeconds: d,
				Completed:       isDone,
			})
			courses[idx].LessonsCount++
			if isDone {
				courses[idx].CompletedLessonsCount++
			}
		}
	}
	if err = modRows.Err(); err != nil {
		return nil, err
	}

	for i := range courses {
		if courses[i].LessonsCount > 0 {
			courses[i].Progress = int(math.Round(float64(courses[i].CompletedLessonsCount) * 100.0 / float64(courses[i].LessonsCount)))
		}
	}
	return courses, nil
}

func randomCertCode() (string, error) {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return "ALM-CERT-" + strings.ToUpper(hex.EncodeToString(b[:])), nil
}

func (r *Repository) IssueCourseCertificate(ctx context.Context, userID, courseID string) (learning.CourseCertificate, error) {
	var cert learning.CourseCertificate
	err := r.db.QueryRow(ctx, `
		SELECT id::text, user_id::text, course_id::text, verification_code, issued_at
		FROM course_certificates
		WHERE user_id=$1::uuid AND course_id=$2::uuid
	`, userID, courseID).Scan(&cert.ID, &cert.UserID, &cert.CourseID, &cert.VerificationCode, &cert.IssuedAt)
	if err == nil {
		return cert, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return learning.CourseCertificate{}, mapError(err)
	}

	var certEnabled bool
	var totalLessons, completedLessons int
	err = r.db.QueryRow(ctx, `
		SELECT
			c.certificate_enabled,
			(
				SELECT count(DISTINCT cl.lesson_id)::int
				FROM course_modules cm
				JOIN course_lessons cl ON cl.module_id=cm.id
				WHERE cm.course_id=c.id AND cm.status='active'
			),
			(
				SELECT count(DISTINCT lp.lesson_id)::int
				FROM lesson_progress lp
				JOIN course_modules cm ON cm.course_id=c.id AND cm.status='active'
				JOIN course_lessons cl ON cl.module_id=cm.id AND cl.lesson_id=lp.lesson_id
				WHERE lp.student_id=$1::uuid AND lp.context_type='course' AND lp.course_id=c.id AND lp.status='completed'
			)
		FROM courses c
		WHERE c.id=$2::uuid AND c.workflow_status='approved' AND c.is_published=true AND c.is_visible=true
	`, userID, courseID).Scan(&certEnabled, &totalLessons, &completedLessons)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.CourseCertificate{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.CourseCertificate{}, mapError(err)
	}
	if !certEnabled || totalLessons == 0 || completedLessons < totalLessons {
		return learning.CourseCertificate{}, learning.ErrConflict
	}

	code, err := randomCertCode()
	if err != nil {
		return learning.CourseCertificate{}, err
	}

	tx, err := r.db.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return learning.CourseCertificate{}, err
	}
	defer tx.Rollback(ctx)

	err = tx.QueryRow(ctx, `
		INSERT INTO course_certificates(user_id, course_id, verification_code)
		VALUES($1::uuid, $2::uuid, $3)
		ON CONFLICT (user_id, course_id) DO NOTHING
		RETURNING id::text, user_id::text, course_id::text, verification_code, issued_at
	`, userID, courseID, code).Scan(&cert.ID, &cert.UserID, &cert.CourseID, &cert.VerificationCode, &cert.IssuedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		err = tx.QueryRow(ctx, `
			SELECT id::text, user_id::text, course_id::text, verification_code, issued_at
			FROM course_certificates
			WHERE user_id=$1::uuid AND course_id=$2::uuid
		`, userID, courseID).Scan(&cert.ID, &cert.UserID, &cert.CourseID, &cert.VerificationCode, &cert.IssuedAt)
	}
	if err != nil {
		return learning.CourseCertificate{}, mapError(err)
	}

	if err = r.writeAuditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  userID,
		Action:       "learning.course_certificate.issue",
		ResourceType: "course_certificate",
		ResourceID:   cert.ID,
		Status:       string(operations.AuditSuccess),
		Metadata:     map[string]any{"courseId": courseID, "verificationCode": cert.VerificationCode},
	}); err != nil {
		return learning.CourseCertificate{}, err
	}

	if err = tx.Commit(ctx); err != nil {
		return learning.CourseCertificate{}, err
	}
	return cert, nil
}

func (r *Repository) ListMyCertificates(ctx context.Context, userID string) ([]learning.CourseCertificate, error) {
	rows, err := r.db.Query(ctx, `
		SELECT cc.id::text, cc.user_id::text, cc.course_id::text, cc.verification_code,
		       COALESCE(c.title, ''), COALESCE(u.name, ''), cc.issued_at
		FROM course_certificates cc
		LEFT JOIN courses c ON c.id = cc.course_id
		LEFT JOIN users u ON u.id = cc.user_id
		WHERE cc.user_id = $1::uuid
		ORDER BY cc.issued_at DESC, cc.id DESC
	`, userID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := make([]learning.CourseCertificate, 0)
	for rows.Next() {
		var item learning.CourseCertificate
		if err := rows.Scan(
			&item.ID,
			&item.UserID,
			&item.CourseID,
			&item.VerificationCode,
			&item.CourseName,
			&item.StudentName,
			&item.IssuedAt,
		); err != nil {
			return nil, mapError(err)
		}
		item.CompletionPercentage = 100
		out = append(out, item)
	}
	return out, rows.Err()
}

func (r *Repository) GetCertificateByCode(ctx context.Context, verificationCode string) (learning.CertificateVerification, error) {
	var item learning.CertificateVerification
	err := r.db.QueryRow(ctx, `
		SELECT cc.verification_code,
		       COALESCE(c.title, ''), COALESCE(u.name, ''), cc.issued_at
		FROM course_certificates cc
		LEFT JOIN courses c ON c.id = cc.course_id
		LEFT JOIN users u ON u.id = cc.user_id
		WHERE cc.verification_code IN ($1, upper($1), lower($1))
		ORDER BY (cc.verification_code = $1) DESC, cc.verification_code
		LIMIT 1
	`, verificationCode).Scan(
		&item.VerificationCode,
		&item.CourseName,
		&item.StudentName,
		&item.IssuedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.CertificateVerification{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.CertificateVerification{}, mapError(err)
	}
	item.CompletionPercentage = 100
	return item, nil
}
