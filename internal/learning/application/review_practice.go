package application

import (
	"context"
	"errors"
	"strconv"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (s *Service) ReviewPractice(
	ctx context.Context,
	actor identity.User,
	tab learning.ReviewTab,
	pathID, subjectID string,
	page, limit int,
) (learning.ReviewPracticePage, error) {
	if requireStudent(actor) != nil {
		return learning.ReviewPracticePage{}, ErrForbidden
	}
	if !learning.ValidReviewTab(tab) {
		tab = learning.ReviewAll
	}
	pathID = strings.TrimSpace(pathID)
	subjectID = strings.TrimSpace(subjectID)
	if pathID == "" {
		return learning.ReviewPracticePage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.ReviewPracticePage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	now := time.Now().UTC()
	cards, more, err := s.repo.ListDueReviewCards(ctx, actor.ID, tab, pathID, subjectID, page, limit, now)
	if err != nil {
		return learning.ReviewPracticePage{}, err
	}
	if len(cards) == 0 {
		return learning.ReviewPracticePage{
			Items: []learning.ReviewPracticeItem{}, Page: page, Limit: limit, HasMore: more,
		}, nil
	}
	if s.questions == nil {
		return learning.ReviewPracticePage{}, errors.New("review question reader is not configured")
	}
	refs := make([]question.ReviewRef, 0, len(cards))
	for _, card := range cards {
		refs = append(refs, question.ReviewRef{QuestionID: card.QuestionID, Version: card.QuestionVersion})
	}
	rows, err := s.questions.ReviewBatch(ctx, refs)
	if err != nil {
		return learning.ReviewPracticePage{}, err
	}
	byKey := make(map[string]question.ReviewProjection, len(rows))
	for _, row := range rows {
		byKey[reviewPracticeKey(row.ID, row.Version)] = row
	}
	items := make([]learning.ReviewPracticeItem, 0, len(cards))
	for _, card := range cards {
		row, ok := byKey[reviewPracticeKey(card.QuestionID, card.QuestionVersion)]
		if !ok || row.CorrectOptionIndex == nil || len(row.Options) == 0 {
			continue
		}
		safe := learning.ReviewPracticeQuestion{
			ID: row.ID, Version: row.Version, Type: string(row.QuestionType), Text: row.TextContent,
			ImageAssetID: row.ImageAssetID, ImageAlt: row.ImageAlt,
			OptionsEmbeddedInImage: row.OptionsEmbeddedInImage, VideoURL: row.VideoURL,
			Difficulty: row.Difficulty,
		}
		for _, option := range row.Options {
			safe.Options = append(safe.Options, learning.ReviewQuestionOption{
				Index: option.Index, Text: option.Text, AssetID: option.AssetID,
			})
		}
		items = append(items, learning.ReviewPracticeItem{Card: card, Question: safe})
	}
	return learning.ReviewPracticePage{Items: items, Page: page, Limit: limit, HasMore: more}, nil
}

func (s *Service) SubmitReviewAnswer(
	ctx context.Context,
	actor identity.User,
	cardID string,
	write learning.ReviewAnswerWrite,
) (learning.ReviewAnswerResult, error) {
	if requireStudent(actor) != nil {
		return learning.ReviewAnswerResult{}, ErrForbidden
	}
	cardID = strings.TrimSpace(cardID)
	write.SubmissionKey = strings.TrimSpace(write.SubmissionKey)
	if cardID == "" || len(write.SubmissionKey) < 8 || len(write.SubmissionKey) > 160 ||
		write.ExpectedCardUpdated.IsZero() || write.SelectedOptionIndex < 0 {
		return learning.ReviewAnswerResult{}, ErrInvalidInput
	}
	if existing, err := s.repo.GetReviewSubmissionByKey(ctx, actor.ID, write.SubmissionKey); err != nil {
		return learning.ReviewAnswerResult{}, err
	} else if existing != nil {
		if existing.CardID != cardID || existing.SelectedOptionIndex != write.SelectedOptionIndex {
			return learning.ReviewAnswerResult{}, learning.ErrConflict
		}
		return s.reviewAnswerResult(ctx, *existing)
	}

	card, err := s.repo.GetReviewCard(ctx, actor.ID, cardID)
	if err != nil {
		return learning.ReviewAnswerResult{}, err
	}
	if s.questions == nil {
		return learning.ReviewAnswerResult{}, errors.New("review question reader is not configured")
	}
	rows, err := s.questions.ReviewBatch(ctx, []question.ReviewRef{{
		QuestionID: card.QuestionID,
		Version:    card.QuestionVersion,
	}})
	if err != nil {
		return learning.ReviewAnswerResult{}, err
	}
	if len(rows) != 1 || rows[0].CorrectOptionIndex == nil {
		return learning.ReviewAnswerResult{}, ErrInvalidInput
	}
	row := rows[0]
	optionExists := false
	for _, option := range row.Options {
		if option.Index == write.SelectedOptionIndex {
			optionExists = true
			break
		}
	}
	if !optionExists {
		return learning.ReviewAnswerResult{}, ErrInvalidInput
	}

	correct := write.SelectedOptionIndex == *row.CorrectOptionIndex
	evidenceType := learning.EvidenceMasteryReview
	if card.ReviewType == "error_recovery" {
		evidenceType = learning.EvidenceRemediation
	}
	quality := 2
	if correct {
		quality = 4
	}
	submission, err := s.repo.ApplyReviewAnswer(ctx, learning.ReviewAnswerEvent{
		StudentID: actor.ID, CardID: card.ID, QuestionID: card.QuestionID,
		QuestionVersion: card.QuestionVersion, ExpectedCardUpdated: write.ExpectedCardUpdated,
		SelectedOptionIndex: write.SelectedOptionIndex, Correct: correct, EvidenceType: evidenceType,
		Quality: quality, OccurredAt: time.Now().UTC(), SubmissionKey: write.SubmissionKey,
	})
	if err != nil {
		return learning.ReviewAnswerResult{}, err
	}
	return reviewResultFromProjection(submission, row), nil
}

func (s *Service) reviewAnswerResult(
	ctx context.Context,
	submission learning.ReviewSubmission,
) (learning.ReviewAnswerResult, error) {
	if s.questions == nil {
		return learning.ReviewAnswerResult{}, errors.New("review question reader is not configured")
	}
	rows, err := s.questions.ReviewBatch(ctx, []question.ReviewRef{{
		QuestionID: submission.QuestionID,
		Version:    submission.QuestionVersion,
	}})
	if err != nil {
		return learning.ReviewAnswerResult{}, err
	}
	if len(rows) != 1 || rows[0].CorrectOptionIndex == nil {
		return learning.ReviewAnswerResult{}, ErrInvalidInput
	}
	return reviewResultFromProjection(submission, rows[0]), nil
}

func reviewResultFromProjection(
	submission learning.ReviewSubmission,
	row question.ReviewProjection,
) learning.ReviewAnswerResult {
	return learning.ReviewAnswerResult{
		SubmissionID: submission.ID, CardID: submission.CardID,
		QuestionID: submission.QuestionID, QuestionVersion: submission.QuestionVersion,
		SelectedOptionIndex: submission.SelectedOptionIndex, Correct: submission.Correct,
		EvidenceType: submission.EvidenceType, Quality: submission.Quality,
		CorrectOptionIndex: row.CorrectOptionIndex, Explanation: row.Explanation,
		Hint: row.Hint, SolvingStrategy: row.SolvingStrategy,
		ReviewTypeAfter: submission.ReviewTypeAfter, NextReviewAt: submission.NextReviewAt,
	}
}

func reviewPracticeKey(id string, version int) string {
	return id + ":" + strconv.Itoa(version)
}
