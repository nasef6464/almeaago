package postgres

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) ListDueReviewCards(
	ctx context.Context,
	student string,
	tab learning.ReviewTab,
	pathID, subjectID string,
	page, limit int,
	now time.Time,
) ([]learning.ReviewCard, bool, error) {
	args := []any{student, pathID, now, limit + 1, (page - 1) * limit}
	filter := ""
	if tab == learning.ReviewSaved {
		filter = " AND saved_for_review=true"
	} else if tab == learning.ReviewMistakes {
		filter = " AND (has_mistake=true OR review_type='error_recovery')"
	}
	if subjectID != "" {
		args = append(args, subjectID)
		filter += fmt.Sprintf(" AND subject_id=$%d::uuid", len(args))
	}
	rows, err := r.db.Query(ctx, `
		SELECT id::text,question_id::text,question_version,path_id::text,subject_id::text,
		       review_type,saved_for_review,saved_at,has_mistake,next_review_at,updated_at
		FROM review_cards
		WHERE student_id=$1::uuid
		  AND path_id=$2::uuid
		  AND next_review_at <= $3
		  `+filter+`
		ORDER BY next_review_at ASC,id
		LIMIT $4 OFFSET $5
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
	if err = r.loadReviewCardSkills(ctx, cards); err != nil {
		return nil, false, err
	}
	return cards, more, nil
}

func (r *Repository) GetReviewCard(
	ctx context.Context,
	student, cardID string,
) (learning.ReviewCard, error) {
	var card learning.ReviewCard
	err := r.db.QueryRow(ctx, `
		SELECT id::text,question_id::text,question_version,path_id::text,subject_id::text,
		       review_type,saved_for_review,saved_at,has_mistake,next_review_at,updated_at
		FROM review_cards
		WHERE id=$1::uuid AND student_id=$2::uuid
	`, cardID, student).Scan(
		&card.ID, &card.QuestionID, &card.QuestionVersion, &card.PathID, &card.SubjectID,
		&card.ReviewType, &card.SavedForReview, &card.SavedAt, &card.HasMistake,
		&card.NextReviewAt, &card.UpdatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return card, learning.ErrNotFound
	}
	return card, err
}

func (r *Repository) GetReviewSubmissionByKey(
	ctx context.Context,
	student, key string,
) (*learning.ReviewSubmission, error) {
	var row learning.ReviewSubmission
	err := r.db.QueryRow(ctx, `
		SELECT id::text,student_id::text,review_card_id::text,question_id::text,question_version,
		       selected_option_index,is_correct,evidence_type,quality,review_type_after,next_review_at,submitted_at
		FROM review_answer_submissions
		WHERE student_id=$1::uuid AND submission_key=$2
	`, student, key).Scan(
		&row.ID, &row.StudentID, &row.CardID, &row.QuestionID, &row.QuestionVersion,
		&row.SelectedOptionIndex, &row.Correct, &row.EvidenceType, &row.Quality,
		&row.ReviewTypeAfter, &row.NextReviewAt, &row.SubmittedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) ApplyReviewAnswer(
	ctx context.Context,
	event learning.ReviewAnswerEvent,
) (learning.ReviewSubmission, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.ReviewSubmission{}, err
	}
	defer tx.Rollback(ctx)

	var existing learning.ReviewSubmission
	err = tx.QueryRow(ctx, `
		SELECT id::text,student_id::text,review_card_id::text,question_id::text,question_version,
		       selected_option_index,is_correct,evidence_type,quality,review_type_after,next_review_at,submitted_at
		FROM review_answer_submissions
		WHERE student_id=$1::uuid AND submission_key=$2
	`, event.StudentID, event.SubmissionKey).Scan(
		&existing.ID, &existing.StudentID, &existing.CardID, &existing.QuestionID,
		&existing.QuestionVersion, &existing.SelectedOptionIndex, &existing.Correct,
		&existing.EvidenceType, &existing.Quality, &existing.ReviewTypeAfter,
		&existing.NextReviewAt, &existing.SubmittedAt,
	)
	if err == nil {
		if existing.CardID != event.CardID || existing.SelectedOptionIndex != event.SelectedOptionIndex {
			return learning.ReviewSubmission{}, learning.ErrConflict
		}
		return existing, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return learning.ReviewSubmission{}, err
	}

	var questionID, pathID, subjectID string
	var questionVersion int
	var ease float64
	var interval, repetitions int
	var nextReviewAt, updatedAt time.Time
	err = tx.QueryRow(ctx, `
		SELECT question_id::text,question_version,path_id::text,subject_id::text,
		       ease_factor::float8,interval_days,repetitions,next_review_at,updated_at
		FROM review_cards
		WHERE id=$1::uuid AND student_id=$2::uuid
		FOR UPDATE
	`, event.CardID, event.StudentID).Scan(
		&questionID, &questionVersion, &pathID, &subjectID,
		&ease, &interval, &repetitions, &nextReviewAt, &updatedAt,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return learning.ReviewSubmission{}, learning.ErrNotFound
	}
	if err != nil {
		return learning.ReviewSubmission{}, err
	}
	if !updatedAt.Equal(event.ExpectedCardUpdated) ||
		questionID != event.QuestionID || questionVersion != event.QuestionVersion {
		return learning.ReviewSubmission{}, learning.ErrConflict
	}
	if event.OccurredAt.Before(nextReviewAt) {
		return learning.ReviewSubmission{}, learning.ErrNotDue
	}

	schedule := learning.SM2(learning.SM2Card{
		EaseFactor: ease, Interval: interval, Repetitions: repetitions,
	}, event.Quality, event.OccurredAt)
	afterType := "error_recovery"
	if event.Correct {
		afterType = "mastery_review"
	}

	var submission learning.ReviewSubmission
	err = tx.QueryRow(ctx, `
		INSERT INTO review_answer_submissions(
			student_id,review_card_id,question_id,question_version,selected_option_index,
			is_correct,evidence_type,quality,submission_key,review_type_after,next_review_at,submitted_at
		) VALUES(
			$1::uuid,$2::uuid,$3::uuid,$4,$5,$6,$7,$8,$9,$10,$11,$12
		)
		RETURNING id::text,student_id::text,review_card_id::text,question_id::text,question_version,
		          selected_option_index,is_correct,evidence_type,quality,review_type_after,next_review_at,submitted_at
	`, event.StudentID, event.CardID, event.QuestionID, event.QuestionVersion,
		event.SelectedOptionIndex, event.Correct, string(event.EvidenceType), event.Quality,
		event.SubmissionKey, afterType, schedule.NextReview, event.OccurredAt).Scan(
		&submission.ID, &submission.StudentID, &submission.CardID, &submission.QuestionID,
		&submission.QuestionVersion, &submission.SelectedOptionIndex, &submission.Correct,
		&submission.EvidenceType, &submission.Quality, &submission.ReviewTypeAfter,
		&submission.NextReviewAt, &submission.SubmittedAt,
	)
	if err != nil {
		if isReviewUniqueViolation(err) {
			return learning.ReviewSubmission{}, learning.ErrConflict
		}
		return learning.ReviewSubmission{}, err
	}

	var evidenceID string
	err = tx.QueryRow(ctx, `
		INSERT INTO mastery_evidence(
			student_id,evidence_type,review_submission_id,question_id,question_version,
			path_id,subject_id,answered,is_correct,occurred_at
		) VALUES(
			$1::uuid,$2,$3::uuid,$4::uuid,$5,$6::uuid,$7::uuid,true,$8,$9
		)
		RETURNING id::text
	`, event.StudentID, string(event.EvidenceType), submission.ID, event.QuestionID,
		event.QuestionVersion, pathID, subjectID, event.Correct, event.OccurredAt).Scan(&evidenceID)
	if err != nil {
		return learning.ReviewSubmission{}, err
	}

	if _, err = tx.Exec(ctx, `
		INSERT INTO mastery_evidence_skills(evidence_id,skill_id)
		SELECT $1::uuid,skill_id
		FROM review_card_skills
		WHERE review_card_id=$2::uuid
		ON CONFLICT DO NOTHING
	`, evidenceID, event.CardID); err != nil {
		return learning.ReviewSubmission{}, err
	}

	if _, err = tx.Exec(ctx, `
		UPDATE review_cards
		SET review_type=$3,
		    has_mistake=has_mistake OR NOT $4,
		    ease_factor=$5,
		    interval_days=$6,
		    repetitions=$7,
		    next_review_at=$8,
		    last_quality=$9,
		    last_evidence_id=$10::uuid,
		    last_reviewed_at=$11,
		    updated_at=now()
		WHERE id=$1::uuid AND student_id=$2::uuid
	`, event.CardID, event.StudentID, afterType, event.Correct, schedule.EaseFactor,
		schedule.Interval, schedule.Repetitions, schedule.NextReview, event.Quality,
		evidenceID, event.OccurredAt); err != nil {
		return learning.ReviewSubmission{}, err
	}

	skillRows, err := tx.Query(ctx, `
		SELECT skill_id::text
		FROM review_card_skills
		WHERE review_card_id=$1::uuid
		ORDER BY skill_id
	`, event.CardID)
	if err != nil {
		return learning.ReviewSubmission{}, err
	}
	var skillIDs []string
	for skillRows.Next() {
		var skillID string
		if err = skillRows.Scan(&skillID); err != nil {
			skillRows.Close()
			return learning.ReviewSubmission{}, err
		}
		skillIDs = append(skillIDs, skillID)
	}
	err = skillRows.Err()
	skillRows.Close()
	if err != nil {
		return learning.ReviewSubmission{}, err
	}

	if len(skillIDs) > 0 {
		predicate, predicateArgs := uuidInPredicate("mes.skill_id", skillIDs, 2)
		args := []any{event.StudentID}
		args = append(args, predicateArgs...)
		rows, queryErr := tx.Query(ctx, `
			SELECT me.path_id::text,me.subject_id::text,mes.skill_id::text,
			       ROUND(100.0*AVG(CASE WHEN me.is_correct THEN 1.0 ELSE 0.0 END),3)::float8,
			       COUNT(*)::int,
			       COUNT(DISTINCT COALESCE(me.source_attempt_id::text,me.review_submission_id::text))::int,
			       MAX(me.occurred_at)
			FROM mastery_evidence me
			JOIN mastery_evidence_skills mes ON mes.evidence_id=me.id
			WHERE me.student_id=$1::uuid AND (`+predicate+`)
			GROUP BY me.path_id,me.subject_id,mes.skill_id
		`, args...)
		if queryErr != nil {
			return learning.ReviewSubmission{}, queryErr
		}
		type aggregate struct {
			pathID, subjectID, skillID string
			mastery                   float64
			evidenceCount, attempts   int
			last                      time.Time
		}
		var aggregates []aggregate
		for rows.Next() {
			var item aggregate
			if queryErr = rows.Scan(
				&item.pathID, &item.subjectID, &item.skillID, &item.mastery,
				&item.evidenceCount, &item.attempts, &item.last,
			); queryErr != nil {
				rows.Close()
				return learning.ReviewSubmission{}, queryErr
			}
			aggregates = append(aggregates, item)
		}
		queryErr = rows.Err()
		rows.Close()
		if queryErr != nil {
			return learning.ReviewSubmission{}, queryErr
		}
		for _, item := range aggregates {
			if _, err = tx.Exec(ctx, `
				INSERT INTO skill_progress(
					student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,
					last_attempt_id,last_evidence_at,recommended_action
				) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,NULL,$9,$10)
				ON CONFLICT(student_id,path_id,subject_id,skill_id) DO UPDATE SET
					mastery=EXCLUDED.mastery,
					status=EXCLUDED.status,
					attempts=EXCLUDED.attempts,
					evidence_count=EXCLUDED.evidence_count,
					last_attempt_id=skill_progress.last_attempt_id,
					last_evidence_at=EXCLUDED.last_evidence_at,
					recommended_action=EXCLUDED.recommended_action,
					updated_at=now()
			`, event.StudentID, item.pathID, item.subjectID, item.skillID, item.mastery,
				learning.SkillStatus(item.mastery), item.attempts, item.evidenceCount,
				item.last, learning.RecommendedAction(item.mastery, item.attempts)); err != nil {
				return learning.ReviewSubmission{}, err
			}
		}
	}

	if err = tx.Commit(ctx); err != nil {
		return learning.ReviewSubmission{}, err
	}
	return submission, nil
}

func (r *Repository) loadReviewCardSkills(ctx context.Context, cards []learning.ReviewCard) error {
	if len(cards) == 0 {
		return nil
	}
	ids := make([]string, 0, len(cards))
	for _, card := range cards {
		ids = append(ids, card.ID)
	}
	predicate, args := uuidInPredicate("review_card_id", ids, 1)
	rows, err := r.db.Query(ctx, `
		SELECT review_card_id::text,skill_id::text
		FROM review_card_skills
		WHERE `+predicate+`
		ORDER BY review_card_id,skill_id
	`, args...)
	if err != nil {
		return err
	}
	defer rows.Close()

	index := make(map[string]int, len(cards))
	for i := range cards {
		index[cards[i].ID] = i
	}
	for rows.Next() {
		var cardID, skillID string
		if err = rows.Scan(&cardID, &skillID); err != nil {
			return err
		}
		if i, ok := index[cardID]; ok {
			cards[i].SkillIDs = append(cards[i].SkillIDs, skillID)
		}
	}
	return rows.Err()
}

func isReviewUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	return errors.As(err, &pgErr) && pgErr.Code == "23505"
}
