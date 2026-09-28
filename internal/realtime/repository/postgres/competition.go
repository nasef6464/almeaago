package postgres

import (
	"context"
	"math"
	"time"

	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

func (r *Repository) CompetitionState(
	ctx context.Context,
	sessionID string,
) (*realtime.CompetitionState, error) {
	var state realtime.CompetitionState
	state.SessionID = sessionID
	var enabled bool
	err := r.db.QueryRow(ctx, `
		SELECT
			COALESCE(s.active_batch_id::text,''),
			COALESCE(b.competition_enabled,false),
			b.challenge_duration_seconds,
			b.timer_started_at,
			b.timer_ends_at
		FROM classroom_sessions s
		LEFT JOIN classroom_batches b
		  ON b.id=s.active_batch_id AND b.session_id=s.id
		WHERE s.id=$1::uuid
	`, sessionID).Scan(
		&state.ActiveBatchID,
		&enabled,
		&state.ChallengeDurationSeconds,
		&state.TimerStartedAt,
		&state.TimerEndsAt,
	)
	if err != nil {
		return nil, mapError(err)
	}
	if state.ActiveBatchID == "" || !enabled {
		return nil, nil
	}
	state.CompetitionEnabled = true
	state.ServerNow = time.Now().UTC()
	state.Expired = state.TimerEndsAt != nil && !state.ServerNow.Before(*state.TimerEndsAt)
	return &state, nil
}

func (r *Repository) ConfigureCompetition(
	ctx context.Context,
	sessionID, actorID string,
	durationSeconds int,
) (realtime.CompetitionState, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.CompetitionState{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	var batchID string
	if err = tx.QueryRow(ctx, `
		SELECT status,COALESCE(active_batch_id::text,'')
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &batchID); err != nil {
		return realtime.CompetitionState{}, mapError(err)
	}
	if status != realtime.SessionLive || batchID == "" {
		return realtime.CompetitionState{}, realtime.ErrConflict
	}
	var endedAt *time.Time
	if err = tx.QueryRow(ctx, `
		SELECT ended_at
		FROM classroom_batches
		WHERE id=$1::uuid AND session_id=$2::uuid
		FOR UPDATE
	`, batchID, sessionID).Scan(&endedAt); err != nil {
		return realtime.CompetitionState{}, mapError(err)
	}
	if endedAt != nil {
		return realtime.CompetitionState{}, realtime.ErrConflict
	}
	now := time.Now().UTC()
	endsAt := now.Add(time.Duration(durationSeconds) * time.Second)
	if _, err = tx.Exec(ctx, `
		UPDATE classroom_batches
		SET competition_enabled=true,
		    challenge_duration_seconds=$3,
		    timer_started_at=$4,
		    timer_ends_at=$5
		WHERE id=$1::uuid AND session_id=$2::uuid
	`, batchID, sessionID, durationSeconds, now, endsAt); err != nil {
		return realtime.CompetitionState{}, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.competition.configure",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata: map[string]any{
			"batchId":         batchID,
			"durationSeconds": durationSeconds,
		},
	}); err != nil {
		return realtime.CompetitionState{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.CompetitionState{}, err
	}
	state, err := r.CompetitionState(ctx, sessionID)
	if err != nil || state == nil {
		return realtime.CompetitionState{}, err
	}
	return *state, nil
}

func (r *Repository) EndCompetition(
	ctx context.Context,
	sessionID, actorID string,
) (realtime.CompetitionState, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return realtime.CompetitionState{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var status realtime.SessionStatus
	var batchID string
	if err = tx.QueryRow(ctx, `
		SELECT status,COALESCE(active_batch_id::text,'')
		FROM classroom_sessions
		WHERE id=$1::uuid
		FOR UPDATE
	`, sessionID).Scan(&status, &batchID); err != nil {
		return realtime.CompetitionState{}, mapError(err)
	}
	if status != realtime.SessionLive || batchID == "" {
		return realtime.CompetitionState{}, realtime.ErrConflict
	}
	var enabled bool
	var timerEndsAt *time.Time
	if err = tx.QueryRow(ctx, `
		SELECT competition_enabled,timer_ends_at
		FROM classroom_batches
		WHERE id=$1::uuid AND session_id=$2::uuid
		FOR UPDATE
	`, batchID, sessionID).Scan(&enabled, &timerEndsAt); err != nil {
		return realtime.CompetitionState{}, mapError(err)
	}
	if !enabled {
		return realtime.CompetitionState{}, realtime.ErrConflict
	}
	now := time.Now().UTC()
	if timerEndsAt == nil || timerEndsAt.After(now) {
		timerEndsAt = &now
		if _, err = tx.Exec(ctx, `
			UPDATE classroom_batches
			SET timer_ends_at=$3
			WHERE id=$1::uuid AND session_id=$2::uuid
		`, batchID, sessionID, now); err != nil {
			return realtime.CompetitionState{}, err
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorID,
		Action:       "realtime.classroom.competition.end",
		ResourceType: "classroom_session",
		ResourceID:   sessionID,
		Metadata:     map[string]any{"batchId": batchID},
	}); err != nil {
		return realtime.CompetitionState{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return realtime.CompetitionState{}, err
	}
	state, err := r.CompetitionState(ctx, sessionID)
	if err != nil || state == nil {
		return realtime.CompetitionState{}, err
	}
	return *state, nil
}

func (r *Repository) Competition(
	ctx context.Context,
	sessionID string,
) (realtime.Competition, error) {
	state, err := r.CompetitionState(ctx, sessionID)
	if err != nil {
		return realtime.Competition{}, err
	}
	if state == nil {
		return realtime.Competition{State: realtime.CompetitionState{SessionID: sessionID}}, nil
	}

	rows, err := r.db.Query(ctx, `
		SELECT
			r.student_id::text,
			count(*)::int AS answered,
			count(*) FILTER(WHERE r.is_correct)::int AS correct,
			max(r.submitted_at) AS last_submitted_at
		FROM classroom_responses r
		JOIN classroom_questions q
		  ON q.session_id=r.session_id
		 AND q.ordinal=r.question_ordinal
		WHERE r.session_id=$1::uuid
		  AND q.batch_id=$2::uuid
		GROUP BY r.student_id
		ORDER BY
			count(*) FILTER(WHERE r.is_correct) DESC,
			count(*) DESC,
			max(r.submitted_at) ASC,
			r.student_id
	`, sessionID, state.ActiveBatchID)
	if err != nil {
		return realtime.Competition{}, err
	}
	defer rows.Close()

	out := realtime.Competition{State: *state, Leaderboard: []realtime.CompetitionStanding{}}
	for rows.Next() {
		var item realtime.CompetitionStanding
		if err = rows.Scan(
			&item.StudentID,
			&item.Answered,
			&item.Correct,
			&item.LastSubmittedAt,
		); err != nil {
			return realtime.Competition{}, err
		}
		if item.Answered > 0 {
			item.Accuracy = int(math.Round(float64(item.Correct) / float64(item.Answered) * 100))
		}
		item.Score = item.Correct * 100
		out.Leaderboard = append(out.Leaderboard, item)
	}
	if err = rows.Err(); err != nil {
		return realtime.Competition{}, err
	}
	out.ParticipantCount = len(out.Leaderboard)
	return out, nil
}
