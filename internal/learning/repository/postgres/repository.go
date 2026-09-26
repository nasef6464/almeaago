package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ApplyAssessmentEvidence(ctx context.Context, event learning.SubmissionEvidence) (learning.ApplyResult, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.ApplyResult{}, err
	}
	defer tx.Rollback(ctx)

	affected := map[string]struct{}{}
	inserted := 0
	for _, outcome := range event.Questions {
		var evidenceID string
		err = tx.QueryRow(ctx, `
			INSERT INTO mastery_evidence(
				student_id,evidence_type,source_attempt_id,assessment_id,assessment_version,
				question_id,question_version,path_id,subject_id,answered,is_correct,occurred_at
			) VALUES(
				$1::uuid,'assessment',$2::uuid,$3::uuid,$4,$5::uuid,$6,$7::uuid,$8::uuid,$9,$10,$11
			)
			ON CONFLICT(evidence_type,source_attempt_id,question_id) DO NOTHING
			RETURNING id::text
		`, event.StudentID, event.AttemptID, event.AssessmentID, event.AssessmentVersion,
			outcome.QuestionID, outcome.QuestionVersion, event.PathID, event.SubjectID,
			outcome.Answered, outcome.Correct, event.OccurredAt).Scan(&evidenceID)
		if errors.Is(err, pgx.ErrNoRows) {
			continue
		}
		if err != nil {
			return learning.ApplyResult{}, err
		}
		inserted++

		skillIDs := uniqueStrings(outcome.SkillIDs)
		for _, skillID := range skillIDs {
			if _, err = tx.Exec(ctx, `
				INSERT INTO mastery_evidence_skills(evidence_id,skill_id)
				VALUES($1::uuid,$2::uuid)
				ON CONFLICT DO NOTHING
			`, evidenceID, skillID); err != nil {
				return learning.ApplyResult{}, err
			}
			affected[skillID] = struct{}{}
		}

		quality := 2
		if !outcome.Answered {
			quality = 1
		} else if outcome.Correct {
			quality = 4
		}
		schedule := learning.SM2(
			learning.SM2Card{EaseFactor: 2.5, Interval: 1, Repetitions: 0},
			quality,
			event.OccurredAt,
		)
		reviewType := "error_recovery"
		if outcome.Correct {
			reviewType = "mastery_review"
		}
		primarySkill := ""
		if len(skillIDs) > 0 {
			primarySkill = skillIDs[0]
		}
		var cardID string
		err = tx.QueryRow(ctx, `
			INSERT INTO review_cards(
				student_id,question_id,question_version,path_id,subject_id,primary_skill_id,
				review_type,has_mistake,ease_factor,interval_days,repetitions,next_review_at,
				last_quality,last_evidence_id
			) VALUES(
				$1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,NULLIF($6,'')::uuid,
				$7,$8,$9,$10,$11,$12,$13,$14::uuid
			)
			ON CONFLICT(student_id,question_id) DO UPDATE SET
				question_version=EXCLUDED.question_version,
				path_id=EXCLUDED.path_id,
				subject_id=EXCLUDED.subject_id,
				primary_skill_id=COALESCE(EXCLUDED.primary_skill_id,review_cards.primary_skill_id),
				review_type=EXCLUDED.review_type,
				has_mistake=review_cards.has_mistake OR EXCLUDED.has_mistake,
				ease_factor=EXCLUDED.ease_factor,
				interval_days=EXCLUDED.interval_days,
				repetitions=EXCLUDED.repetitions,
				next_review_at=EXCLUDED.next_review_at,
				last_quality=EXCLUDED.last_quality,
				last_evidence_id=EXCLUDED.last_evidence_id,
				updated_at=now()
			RETURNING id::text
		`, event.StudentID, outcome.QuestionID, outcome.QuestionVersion, event.PathID, event.SubjectID,
			primarySkill, reviewType, !outcome.Correct, schedule.EaseFactor, schedule.Interval,
			schedule.Repetitions, schedule.NextReview, quality, evidenceID).Scan(&cardID)
		if err != nil {
			return learning.ApplyResult{}, err
		}
		if _, err = tx.Exec(ctx, `DELETE FROM review_card_skills WHERE review_card_id=$1::uuid`, cardID); err != nil {
			return learning.ApplyResult{}, err
		}
		for _, skillID := range skillIDs {
			if _, err = tx.Exec(ctx, `
				INSERT INTO review_card_skills(review_card_id,skill_id)
				VALUES($1::uuid,$2::uuid)
				ON CONFLICT DO NOTHING
			`, cardID, skillID); err != nil {
				return learning.ApplyResult{}, err
			}
		}
	}

	if inserted == 0 {
		if err = tx.Commit(ctx); err != nil {
			return learning.ApplyResult{}, err
		}
		return learning.ApplyResult{}, nil
	}

	if len(affected) > 0 {
		skillIDs := make([]string, 0, len(affected))
		for skillID := range affected {
			skillIDs = append(skillIDs, skillID)
		}
		predicate, predicateArgs := uuidInPredicate("mes.skill_id", skillIDs, 2)
		queryArgs := []any{event.StudentID}
		queryArgs = append(queryArgs, predicateArgs...)
		rows, queryErr := tx.Query(ctx, `
			SELECT me.path_id::text,me.subject_id::text,mes.skill_id::text,
			       ROUND(100.0*AVG(CASE WHEN me.is_correct THEN 1.0 ELSE 0.0 END),3)::float8,
			       COUNT(*)::int,COUNT(DISTINCT me.source_attempt_id)::int,MAX(me.occurred_at)
			FROM mastery_evidence me
			JOIN mastery_evidence_skills mes ON mes.evidence_id=me.id
			WHERE me.student_id=$1::uuid AND (`+predicate+`)
			GROUP BY me.path_id,me.subject_id,mes.skill_id
		`, queryArgs...)
		if queryErr != nil {
			return learning.ApplyResult{}, queryErr
		}
		type aggregate struct {
			pathID        string
			subjectID     string
			skillID       string
			mastery       float64
			evidenceCount int
			attempts      int
			last          time.Time
		}
		var aggregates []aggregate
		for rows.Next() {
			var item aggregate
			if queryErr = rows.Scan(
				&item.pathID, &item.subjectID, &item.skillID, &item.mastery,
				&item.evidenceCount, &item.attempts, &item.last,
			); queryErr != nil {
				rows.Close()
				return learning.ApplyResult{}, queryErr
			}
			aggregates = append(aggregates, item)
		}
		queryErr = rows.Err()
		rows.Close()
		if queryErr != nil {
			return learning.ApplyResult{}, queryErr
		}
		for _, item := range aggregates {
			if _, err = tx.Exec(ctx, `
				INSERT INTO skill_progress(
					student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,
					last_attempt_id,last_evidence_at,recommended_action
				) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::uuid,$10,$11)
				ON CONFLICT(student_id,path_id,subject_id,skill_id) DO UPDATE SET
					mastery=EXCLUDED.mastery,status=EXCLUDED.status,attempts=EXCLUDED.attempts,
					evidence_count=EXCLUDED.evidence_count,last_attempt_id=EXCLUDED.last_attempt_id,
					last_evidence_at=EXCLUDED.last_evidence_at,recommended_action=EXCLUDED.recommended_action,
					updated_at=now()
			`, event.StudentID, item.pathID, item.subjectID, item.skillID, item.mastery,
				learning.SkillStatus(item.mastery), item.attempts, item.evidenceCount,
				event.AttemptID, item.last, learning.RecommendedAction(item.mastery, item.attempts)); err != nil {
				return learning.ApplyResult{}, err
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return learning.ApplyResult{}, err
	}
	return learning.ApplyResult{InsertedEvidence: inserted, AffectedSkills: len(affected)}, nil
}

func (r *Repository) ListSkillProgress(ctx context.Context, student, pathID, subjectID string, page, limit int) (learning.SkillProgressPage, error) {
	args := []any{student, pathID, limit + 1, (page - 1) * limit}
	subjectFilter := ""
	if strings.TrimSpace(subjectID) != "" {
		args = append(args, subjectID)
		subjectFilter = fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	rows, err := r.db.Query(ctx, `
		SELECT path_id::text,subject_id::text,skill_id::text,mastery::float8,status,
		       attempts,evidence_count,COALESCE(last_evidence_at,created_at),recommended_action
		FROM skill_progress
		WHERE student_id=$1::uuid AND path_id=$2::uuid`+subjectFilter+`
		ORDER BY mastery ASC,last_evidence_at DESC NULLS LAST,skill_id
		LIMIT $3 OFFSET $4
	`, args...)
	if err != nil {
		return learning.SkillProgressPage{}, err
	}
	defer rows.Close()
	out := learning.SkillProgressPage{Page: page, Limit: limit}
	for rows.Next() {
		var item learning.SkillProgress
		if err = rows.Scan(
			&item.PathID, &item.SubjectID, &item.SkillID, &item.Mastery, &item.Status,
			&item.Attempts, &item.EvidenceCount, &item.LastEvidenceAt, &item.RecommendedAction,
		); err != nil {
			return out, err
		}
		out.Items = append(out.Items, item)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if len(out.Items) > limit {
		out.HasMore = true
		out.Items = out.Items[:limit]
	}
	return out, nil
}

func (r *Repository) WeakestSkillProgress(ctx context.Context, student, pathID, subjectID string) (*learning.SkillProgress, error) {
	args := []any{student, pathID}
	subjectFilter := ""
	if strings.TrimSpace(subjectID) != "" {
		args = append(args, subjectID)
		subjectFilter = fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	var item learning.SkillProgress
	err := r.db.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text,skill_id::text,mastery::float8,status,
		       attempts,evidence_count,COALESCE(last_evidence_at,created_at),recommended_action
		FROM skill_progress
		WHERE student_id=$1::uuid AND path_id=$2::uuid`+subjectFilter+`
		ORDER BY mastery ASC,last_evidence_at DESC NULLS LAST,skill_id
		LIMIT 1
	`, args...).Scan(
		&item.PathID, &item.SubjectID, &item.SkillID, &item.Mastery, &item.Status,
		&item.Attempts, &item.EvidenceCount, &item.LastEvidenceAt, &item.RecommendedAction,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &item, nil
}

func (r *Repository) ListReviewCards(ctx context.Context, student string, tab learning.ReviewTab, pathID, subjectID string, page, limit int) ([]learning.ReviewCard, bool, error) {
	args := []any{student, pathID, limit + 1, (page - 1) * limit}
	filter := " AND (saved_for_review=true OR has_mistake=true OR review_type='error_recovery')"
	if tab == learning.ReviewSaved {
		filter = " AND saved_for_review=true"
	} else if tab == learning.ReviewMistakes {
		filter = " AND (has_mistake=true OR review_type='error_recovery')"
	}
	if strings.TrimSpace(subjectID) != "" {
		args = append(args, subjectID)
		filter += fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	rows, err := r.db.Query(ctx, `
		SELECT id::text,question_id::text,question_version,path_id::text,subject_id::text,
		       review_type,saved_for_review,saved_at,has_mistake,next_review_at,updated_at
		FROM review_cards
		WHERE student_id=$1::uuid AND path_id=$2::uuid`+filter+`
		ORDER BY updated_at DESC,id DESC
		LIMIT $3 OFFSET $4
	`, args...)
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	cards := []learning.ReviewCard{}
	for rows.Next() {
		var card learning.ReviewCard
		if err = rows.Scan(
			&card.ID, &card.QuestionID, &card.QuestionVersion, &card.PathID, &card.SubjectID,
			&card.ReviewType, &card.SavedForReview, &card.SavedAt, &card.HasMistake,
			&card.NextReviewAt, &card.UpdatedAt,
		); err != nil {
			return nil, false, err
		}
		cards = append(cards, card)
	}
	if err = rows.Err(); err != nil {
		return nil, false, err
	}
	more := len(cards) > limit
	if more {
		cards = cards[:limit]
	}
	if len(cards) == 0 {
		return cards, more, nil
	}

	ids := make([]string, 0, len(cards))
	for _, card := range cards {
		ids = append(ids, card.ID)
	}
	predicate, skillArgs := uuidInPredicate("rcs.review_card_id", ids, 1)
	skillRows, err := r.db.Query(ctx, `
		SELECT rcs.review_card_id::text,rcs.skill_id::text
		FROM review_card_skills rcs
		WHERE `+predicate+`
		ORDER BY rcs.review_card_id,rcs.skill_id
	`, skillArgs...)
	if err != nil {
		return nil, false, err
	}
	defer skillRows.Close()

	index := make(map[string]int, len(cards))
	for i := range cards {
		index[cards[i].ID] = i
	}
	for skillRows.Next() {
		var cardID, skillID string
		if err = skillRows.Scan(&cardID, &skillID); err != nil {
			return nil, false, err
		}
		if i, ok := index[cardID]; ok {
			cards[i].SkillIDs = append(cards[i].SkillIDs, skillID)
		}
	}
	return cards, more, skillRows.Err()
}

func (r *Repository) SetSavedReview(ctx context.Context, student, questionID string, saved bool) error {
	if saved {
		tag, err := r.db.Exec(ctx, `
			UPDATE review_cards
			SET saved_for_review=true,saved_at=COALESCE(saved_at,now()),updated_at=now()
			WHERE student_id=$1::uuid AND question_id=$2::uuid
		`, student, questionID)
		if err != nil {
			return err
		}
		if tag.RowsAffected() == 0 {
			return learning.ErrNotFound
		}
		return nil
	}

	var reviewType string
	var mistake bool
	err := r.db.QueryRow(ctx, `
		SELECT review_type,has_mistake
		FROM review_cards
		WHERE student_id=$1::uuid AND question_id=$2::uuid
	`, student, questionID).Scan(&reviewType, &mistake)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return err
	}
	if reviewType == "saved_review" && !mistake {
		_, err = r.db.Exec(ctx, `
			DELETE FROM review_cards
			WHERE student_id=$1::uuid AND question_id=$2::uuid
		`, student, questionID)
		return err
	}
	_, err = r.db.Exec(ctx, `
		UPDATE review_cards
		SET saved_for_review=false,saved_at=NULL,updated_at=now()
		WHERE student_id=$1::uuid AND question_id=$2::uuid
	`, student, questionID)
	return err
}

func uniqueStrings(values []string) []string {
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, value := range values {
		value = strings.TrimSpace(value)
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

func uuidInPredicate(column string, values []string, start int) (string, []any) {
	parts := make([]string, 0, len(values))
	args := make([]any, 0, len(values))
	for i, value := range values {
		parts = append(parts, fmt.Sprintf("%s=$%d::uuid", column, start+i))
		args = append(args, value)
	}
	return strings.Join(parts, " OR "), args
}
