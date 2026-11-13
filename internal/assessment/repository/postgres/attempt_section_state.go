package postgres

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

type sectionQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func loadAttemptSections(ctx context.Context, db sectionQueryer, assessmentID string, version int) ([]assessment.Section, error) {
	rows, err := db.Query(ctx, `SELECT id::text,title,COALESCE(subject_id::text,''),sort_order,time_limit_seconds,domain,strict_lock FROM assessment_sections WHERE assessment_id=$1::uuid AND assessment_version=$2 ORDER BY sort_order,id`, assessmentID, version)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sections := []assessment.Section{}
	for rows.Next() {
		var s assessment.Section
		if err = rows.Scan(&s.ID, &s.Title, &s.SubjectID, &s.SortOrder, &s.TimeLimitSeconds, &s.Domain, &s.StrictLock); err != nil {
			return nil, err
		}
		sections = append(sections, s)
	}
	return sections, rows.Err()
}

func publicSectionProgress(s strictSectionState, now time.Time) *assessment.SectionProgress {
	return &assessment.SectionProgress{CurrentSectionID: s.CurrentSectionID, StartedAt: s.StartedAt, Deadline: s.Deadline, Finished: s.Finished, ServerTime: now}
}

// strictSectionState is stored in assessment_attempts.section_state. The
// server's clock and the attempt start, never the browser, govern deadlines.
type strictSectionState struct {
	CurrentSectionID string     `json:"currentSectionId"`
	StartedAt        time.Time  `json:"startedAt"`
	Deadline         *time.Time `json:"deadline,omitempty"`
	Finished         bool       `json:"finished"`
}

func strictMode(kind assessment.Kind, mode string, lock *bool) bool {
	return kind == assessment.KindMock && mode != "flexible" && lock != nil && *lock
}

func decodeStrictState(raw []byte) (*strictSectionState, error) {
	if len(raw) == 0 || string(raw) == "{}" || string(raw) == "null" {
		return nil, nil
	}
	var s strictSectionState
	if err := json.Unmarshal(raw, &s); err != nil {
		return nil, assessment.ErrConflict
	}
	return &s, nil
}

func resolveStrictSectionProgress(sections []assessment.Section, stored *strictSectionState, attemptStarted, now time.Time) (strictSectionState, error) {
	if len(sections) == 0 || attemptStarted.IsZero() {
		return strictSectionState{}, assessment.ErrConflict
	}
	s := strictSectionState{CurrentSectionID: sections[0].ID, StartedAt: attemptStarted.UTC()}
	if stored != nil {
		s = *stored
	}
	if s.Finished {
		if s.CurrentSectionID != "" {
			return strictSectionState{}, assessment.ErrConflict
		}
		return s, nil
	}
	index := -1
	for i, section := range sections {
		if section.ID == s.CurrentSectionID {
			index = i
			break
		}
	}
	if index < 0 || s.StartedAt.IsZero() || s.StartedAt.Before(attemptStarted) {
		return strictSectionState{}, assessment.ErrConflict
	}
	for index < len(sections) {
		duration := sections[index].TimeLimitSeconds
		s.Deadline = nil
		if duration == nil {
			return s, nil
		}
		if *duration <= 0 {
			return strictSectionState{}, assessment.ErrConflict
		}
		deadline := s.StartedAt.Add(time.Duration(*duration) * time.Second)
		s.Deadline = &deadline
		if now.Before(deadline) {
			return s, nil
		}
		index++
		if index == len(sections) {
			s.CurrentSectionID = ""
			s.StartedAt = deadline
			s.Deadline = nil
			s.Finished = true
			return s, nil
		}
		s.CurrentSectionID = sections[index].ID
		s.StartedAt = deadline
	}
	return strictSectionState{}, assessment.ErrConflict
}

// AdvanceStrictSection changes exactly one active section under an attempt-row
// lock. A replay naming a previous section observes the current state instead
// of skipping another section. Only a student's own attempt can be advanced.
func (r *Repository) AdvanceStrictSection(ctx context.Context, student, id, expectedSectionID string) (assessment.Attempt, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Attempt{}, err
	}
	defer tx.Rollback(ctx)
	var aid, mode string
	var ver int
	var status assessment.AttemptStatus
	var started, now time.Time
	var expires *time.Time
	var kind assessment.Kind
	var lock *bool
	var rawState []byte
	err = tx.QueryRow(ctx, `SELECT a.assessment_id::text,a.assessment_version,a.status,a.expires_at,a.started_at,a.section_state,clock_timestamp(),v.assessment_kind,COALESCE(v.mock_presentation_mode,''),v.mock_strict_section_lock FROM assessment_attempts a JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version WHERE a.id=$1::uuid AND a.student_id=$2::uuid FOR UPDATE OF a`, id, student).Scan(&aid, &ver, &status, &expires, &started, &rawState, &now, &kind, &mode, &lock)
	if err != nil {
		return assessment.Attempt{}, mapError(err)
	}
	if status != assessment.AttemptInProgress {
		return assessment.Attempt{}, assessment.ErrAttemptSubmitted
	}
	if expires != nil && !now.Before(*expires) {
		return assessment.Attempt{}, assessment.ErrAttemptExpired
	}
	if !strictMode(kind, mode, lock) {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	sections, err := loadAttemptSections(ctx, tx, aid, ver)
	if err != nil {
		return assessment.Attempt{}, err
	}
	stored, err := decodeStrictState(rawState)
	if err != nil {
		return assessment.Attempt{}, err
	}
	state, err := resolveStrictSectionProgress(sections, stored, started, now)
	if err != nil {
		return assessment.Attempt{}, err
	}
	expectedIndex, currentIndex := -1, len(sections)
	for i, s := range sections {
		if s.ID == expectedSectionID {
			expectedIndex = i
		}
		if s.ID == state.CurrentSectionID {
			currentIndex = i
		}
	}
	if expectedIndex < 0 || expectedIndex > currentIndex {
		return assessment.Attempt{}, assessment.ErrConflict
	}
	if expectedIndex == currentIndex {
		if currentIndex+1 == len(sections) {
			state.CurrentSectionID = ""
			state.StartedAt = now
			state.Deadline = nil
			state.Finished = true
		} else {
			state.CurrentSectionID = sections[currentIndex+1].ID
			state.StartedAt = now
			state.Deadline = nil
			state, err = resolveStrictSectionProgress(sections, &state, started, now)
			if err != nil {
				return assessment.Attempt{}, err
			}
		}
		raw, err := json.Marshal(state)
		if err != nil {
			return assessment.Attempt{}, err
		}
		if _, err = tx.Exec(ctx, `UPDATE assessment_attempts SET section_state=$2::jsonb WHERE id=$1::uuid`, id, raw); err != nil {
			return assessment.Attempt{}, err
		}
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Attempt{}, err
	}
	return r.GetAttempt(ctx, id)
}
