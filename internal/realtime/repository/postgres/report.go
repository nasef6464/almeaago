package postgres

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

type reportQuestion struct {
	Ordinal         int
	QuestionID      string
	QuestionVersion int
	Answered        int
	Correct         int
	Wrong           int
	Unanswered      int
	Distribution    map[string]int
	BatchID         string
}

func (r *Repository) FinalizeSession(
	ctx context.Context,
	sessionID, actorID string,
	rosterIDs []string,
) (realtime.ReportSnapshot, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	session, err := scanSession(tx.QueryRow(ctx, sessionSelect+` WHERE id=$1::uuid FOR UPDATE`, sessionID))
	if err != nil {
		return realtime.ReportSnapshot{}, mapError(err)
	}
	if session.Status == realtime.SessionEnded || session.Status == realtime.SessionArchived {
		report, reportErr := getReportTx(ctx, tx, sessionID)
		if reportErr != nil {
			return realtime.ReportSnapshot{}, reportErr
		}
		if err = tx.Commit(ctx); err != nil {
			return realtime.ReportSnapshot{}, err
		}
		return report, nil
	}
	if session.Status != realtime.SessionLive {
		return realtime.ReportSnapshot{}, realtime.ErrConflict
	}

	now := time.Now().UTC()
	if _, err = tx.Exec(ctx, `
		UPDATE classroom_batches
		SET ended_at=COALESCE(ended_at,$2)
		WHERE session_id=$1::uuid AND started_at IS NOT NULL
	`, sessionID, now); err != nil {
		return realtime.ReportSnapshot{}, err
	}
	if _, err = tx.Exec(ctx, `
		UPDATE classroom_sessions
		SET status='ended',active_batch_id=NULL,active_question_ordinal=NULL,
		    ended_at=$2,revision=revision+1,updated_at=$2
		WHERE id=$1::uuid
	`, sessionID, now); err != nil {
		return realtime.ReportSnapshot{}, mapError(err)
	}
	session.Status = realtime.SessionEnded
	session.EndedAt = &now
	session.ActiveBatchID = ""
	session.ActiveQuestionOrdinal = nil

	payload, err := buildReportTx(ctx, tx, session, rosterIDs)
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	raw, err := json.Marshal(payload)
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	if _, err = tx.Exec(ctx, `
		INSERT INTO classroom_report_snapshots(session_id,snapshot,finalized_at)
		VALUES($1::uuid,$2::jsonb,$3)
		ON CONFLICT(session_id) DO NOTHING
	`, sessionID, raw, now); err != nil {
		return realtime.ReportSnapshot{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.end",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata: map[string]any{
			"expectedRoster": len(uniqueStrings(rosterIDs)),
		},
	}); err != nil {
		return realtime.ReportSnapshot{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.ReportSnapshot{}, err
	}
	return r.GetReport(ctx, sessionID)
}

func (r *Repository) GetReport(
	ctx context.Context,
	sessionID string,
) (realtime.ReportSnapshot, error) {
	var out realtime.ReportSnapshot
	var raw []byte
	err := r.db.QueryRow(ctx, `
		SELECT session_id::text,snapshot,finalized_at
		FROM classroom_report_snapshots
		WHERE session_id=$1::uuid
	`, sessionID).Scan(&out.SessionID, &raw, &out.FinalizedAt)
	if err != nil {
		return realtime.ReportSnapshot{}, mapError(err)
	}
	out.Snapshot = json.RawMessage(raw)
	return out, nil
}

func getReportTx(
	ctx context.Context,
	tx pgx.Tx,
	sessionID string,
) (realtime.ReportSnapshot, error) {
	var out realtime.ReportSnapshot
	var raw []byte
	err := tx.QueryRow(ctx, `
		SELECT session_id::text,snapshot,finalized_at
		FROM classroom_report_snapshots
		WHERE session_id=$1::uuid
	`, sessionID).Scan(&out.SessionID, &raw, &out.FinalizedAt)
	if err != nil {
		return realtime.ReportSnapshot{}, mapError(err)
	}
	out.Snapshot = json.RawMessage(raw)
	return out, nil
}

func buildReportTx(
	ctx context.Context,
	tx pgx.Tx,
	session realtime.Session,
	rosterIDs []string,
) (map[string]any, error) {
	rosterIDs = uniqueStrings(rosterIDs)
	participantRows, err := tx.Query(ctx, `
		SELECT
			student_id::text,joined_at,COALESCE(joined_method,''),attendance_status,
			COALESCE(attendance_overridden_by::text,''),attendance_overridden_at
		FROM classroom_participants
		WHERE session_id=$1::uuid
		ORDER BY student_id
	`, session.ID)
	if err != nil {
		return nil, err
	}
	participants := map[string]realtime.Participant{}
	for participantRows.Next() {
		var item realtime.Participant
		if err = participantRows.Scan(
			&item.StudentID,
			&item.JoinedAt,
			&item.JoinedMethod,
			&item.AttendanceStatus,
			&item.AttendanceOverriddenBy,
			&item.AttendanceOverriddenAt,
		); err != nil {
			participantRows.Close()
			return nil, err
		}
		participants[item.StudentID] = item
	}
	if err = participantRows.Err(); err != nil {
		participantRows.Close()
		return nil, err
	}
	participantRows.Close()

	joined := 0
	presentCount := 0
	lateCount := 0
	absentCount := 0
	excusedCount := 0
	attendance := make([]map[string]any, 0, len(rosterIDs))
	for _, studentID := range rosterIDs {
		item, exists := participants[studentID]
		status := realtime.AttendanceAbsent
		var joinedAt *time.Time
		joinedMethod := ""
		overrideBy := ""
		var overrideAt *time.Time
		if exists {
			status = item.AttendanceStatus
			joinedAt = item.JoinedAt
			joinedMethod = item.JoinedMethod
			overrideBy = item.AttendanceOverriddenBy
			overrideAt = item.AttendanceOverriddenAt
			if item.JoinedAt != nil {
				joined++
			}
		}
		switch status {
		case realtime.AttendancePresent:
			presentCount++
		case realtime.AttendanceLate:
			lateCount++
		case realtime.AttendanceExcused:
			excusedCount++
		default:
			absentCount++
		}
		attendance = append(attendance, map[string]any{
			"studentId":              studentID,
			"status":                 status,
			"joinedAt":               joinedAt,
			"joinedMethod":           joinedMethod,
			"attendanceOverriddenBy": overrideBy,
			"attendanceOverriddenAt": overrideAt,
		})
	}

	rows, err := tx.Query(ctx, `
		SELECT
			q.ordinal,q.question_id::text,q.question_version,q.batch_id::text,
			count(r.student_id)::int,
			count(r.student_id) FILTER (WHERE r.is_correct)::int
		FROM classroom_questions q
		LEFT JOIN classroom_responses r
		  ON r.session_id=q.session_id AND r.question_ordinal=q.ordinal
		WHERE q.session_id=$1::uuid
		GROUP BY q.ordinal,q.question_id,q.question_version,q.batch_id
		ORDER BY q.ordinal
	`, session.ID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	questions := []reportQuestion{}
	index := map[int]int{}
	for rows.Next() {
		var q reportQuestion
		if err = rows.Scan(
			&q.Ordinal, &q.QuestionID, &q.QuestionVersion, &q.BatchID, &q.Answered, &q.Correct,
		); err != nil {
			return nil, err
		}
		q.Wrong = q.Answered - q.Correct
		q.Unanswered = maxInt(0, joined-q.Answered)
		q.Distribution = map[string]int{}
		index[q.Ordinal] = len(questions)
		questions = append(questions, q)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}

	distRows, err := tx.Query(ctx, `
		SELECT question_ordinal,selected_option_index,count(*)::int
		FROM classroom_responses
		WHERE session_id=$1::uuid
		GROUP BY question_ordinal,selected_option_index
		ORDER BY question_ordinal,selected_option_index
	`, session.ID)
	if err != nil {
		return nil, err
	}
	defer distRows.Close()
	for distRows.Next() {
		var ordinal, option, count int
		if err = distRows.Scan(&ordinal, &option, &count); err != nil {
			return nil, err
		}
		if i, ok := index[ordinal]; ok {
			questions[i].Distribution[fmt.Sprint(option)] = count
		}
	}
	if err = distRows.Err(); err != nil {
		return nil, err
	}

	batchRows, err := tx.Query(ctx, `
		SELECT id::text,batch_number,label,started_at,ended_at
		FROM classroom_batches
		WHERE session_id=$1::uuid
		ORDER BY batch_number
	`, session.ID)
	if err != nil {
		return nil, err
	}
	defer batchRows.Close()
	batches := []map[string]any{}
	for batchRows.Next() {
		var id, label string
		var number int
		var startedAt, endedAt *time.Time
		if err = batchRows.Scan(&id, &number, &label, &startedAt, &endedAt); err != nil {
			return nil, err
		}
		ordinals := []int{}
		answered, correct, wrong, unanswered := 0, 0, 0, 0
		for _, q := range questions {
			if q.BatchID != id {
				continue
			}
			ordinals = append(ordinals, q.Ordinal)
			answered += q.Answered
			correct += q.Correct
			wrong += q.Wrong
			unanswered += q.Unanswered
		}
		var accuracy any
		if answered > 0 {
			accuracy = int(float64(correct)/float64(answered)*100 + 0.5)
		}
		batches = append(batches, map[string]any{
			"batchId":          id,
			"number":           number,
			"label":            label,
			"questionOrdinals": ordinals,
			"startedAt":        startedAt,
			"endedAt":          endedAt,
			"totals": map[string]any{
				"answered":   answered,
				"correct":    correct,
				"wrong":      wrong,
				"unanswered": unanswered,
				"accuracy":   accuracy,
			},
		})
	}
	if err = batchRows.Err(); err != nil {
		return nil, err
	}

	questionPayload := make([]map[string]any, 0, len(questions))
	totalResponses, totalCorrect := 0, 0
	for _, q := range questions {
		totalResponses += q.Answered
		totalCorrect += q.Correct
		questionPayload = append(questionPayload, map[string]any{
			"ordinal":         q.Ordinal,
			"questionId":      q.QuestionID,
			"questionVersion": q.QuestionVersion,
			"answered":        q.Answered,
			"correct":         q.Correct,
			"wrong":           q.Wrong,
			"unanswered":      q.Unanswered,
			"distribution":    q.Distribution,
		})
	}

	expected := len(rosterIDs)
	durationMinutes := any(nil)
	if session.StartedAt != nil && session.EndedAt != nil {
		durationMinutes = int(session.EndedAt.Sub(*session.StartedAt).Minutes() + 0.5)
		if durationMinutes.(int) < 0 {
			durationMinutes = 0
		}
	}
	return map[string]any{
		"sessionId":       session.ID,
		"schoolId":        session.SchoolID,
		"classId":         session.ClassID,
		"subjectId":       session.SubjectID,
		"teacherId":       session.TeacherID,
		"status":          realtime.SessionEnded,
		"startedAt":       session.StartedAt,
		"endedAt":         session.EndedAt,
		"durationMinutes": durationMinutes,
		"roster": map[string]any{
			"expected":          expected,
			"joined":            joined,
			"absentFromSession": maxInt(0, expected-joined),
			"present":           presentCount,
			"late":              lateCount,
			"absent":            absentCount,
			"excused":           excusedCount,
		},
		"attendance": attendance,
		"batches":    batches,
		"questions": questionPayload,
		"totals": map[string]any{
			"responses": totalResponses,
			"correct":   totalCorrect,
		},
	}, nil
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		if value == "" {
			continue
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out
}

func maxInt(a, b int) int {
	if a > b {
		return a
	}
	return b
}
