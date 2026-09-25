package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var (
	ErrInvalidInput    = errors.New("invalid question input")
	ErrForbidden       = errors.New("question operation forbidden")
	ErrVersionConflict = errors.New("question version conflict")
	ErrWorkflow        = errors.New("invalid question workflow transition")
)

type Repository interface {
	Create(ctx context.Context, actorUserID string, command question.CreateCommand) (question.Question, error)
	AppendVersion(ctx context.Context, actorUserID, questionID string, expectedCurrentVersion int, command question.VersionCommand) (question.Question, error)
	SetWorkflow(ctx context.Context, actorUserID, questionID string, expectedCurrentVersion int, status question.WorkflowStatus, reviewerNotes string) (question.Question, error)
	Get(ctx context.Context, questionID string) (question.Question, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service { return &Service{repo: repo} }

type OptionInput struct {
	Text    string `json:"text"`
	AssetID string `json:"assetId"`
}

type SkillLinkInput struct {
	SkillID      string                `json:"skillId"`
	RelationType question.RelationType `json:"relationType"`
}

type VersionInput struct {
	PathID                 string                `json:"pathId"`
	SubjectID              string                `json:"subjectId"`
	QuestionType           question.QuestionType `json:"type"`
	TextContent            string                `json:"text"`
	ImageAssetID           string                `json:"imageAssetId"`
	ImageAlt               string                `json:"imageAlt"`
	OptionsEmbeddedInImage bool                  `json:"optionsEmbeddedInImage"`
	CorrectOptionIndex     *int                  `json:"correctOptionIndex"`
	Explanation            string                `json:"explanation"`
	Hint                   string                `json:"hint"`
	SolvingStrategy        string                `json:"solvingStrategy"`
	VideoURL               string                `json:"videoUrl"`
	SourceMeta             json.RawMessage       `json:"sourceMeta"`
	AIContext              json.RawMessage       `json:"aiContext"`
	VoiceExplanation       json.RawMessage       `json:"voiceExplanation"`
	Difficulty             string                `json:"difficulty"`
	ExamType               string                `json:"examType"`
	Source                 string                `json:"source"`
	SourceYear             *int                  `json:"year"`
	RevisionNote           string                `json:"revisionNote"`
	Options                []OptionInput         `json:"options"`
	SkillLinks             []SkillLinkInput      `json:"skillLinks"`
}

type CreateInput struct {
	QuestionCode      string             `json:"questionCode"`
	OwnerType         question.OwnerType `json:"ownerType"`
	OwnerID           string             `json:"ownerId"`
	AssignedTeacherID string             `json:"assignedTeacherId"`
	Version           VersionInput       `json:"version"`
}

type WorkflowInput struct {
	ExpectedCurrentVersion int                     `json:"expectedCurrentVersion"`
	Status                 question.WorkflowStatus `json:"status"`
	ReviewerNotes          string                  `json:"reviewerNotes"`
}

func (s *Service) Create(ctx context.Context, actor identity.User, input CreateInput) (question.Question, error) {
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return question.Question{}, ErrForbidden
	}
	code := strings.TrimSpace(input.QuestionCode)
	if code == "" || len(code) > 120 {
		return question.Question{}, ErrInvalidInput
	}
	version, err := normalizeVersion(input.Version)
	if err != nil {
		return question.Question{}, err
	}

	ownerType := input.OwnerType
	ownerID := strings.TrimSpace(input.OwnerID)
	assignedTeacherID := strings.TrimSpace(input.AssignedTeacherID)
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		ownerType = question.OwnerTeacher
		ownerID = actor.ID
		assignedTeacherID = actor.ID
	} else {
		if ownerType == "" {
			ownerType = question.OwnerPlatform
		}
		if ownerType != question.OwnerPlatform && ownerType != question.OwnerTeacher {
			return question.Question{}, ErrInvalidInput
		}
		if ownerType == question.OwnerPlatform {
			ownerID = ""
		}
		if ownerType == question.OwnerTeacher && ownerID == "" {
			return question.Question{}, ErrInvalidInput
		}
	}

	return s.repo.Create(ctx, actor.ID, question.CreateCommand{
		QuestionCode:      code,
		PathID:            version.PathID,
		SubjectID:         version.SubjectID,
		OwnerType:         ownerType,
		OwnerID:           ownerID,
		AssignedTeacherID: assignedTeacherID,
		Version:           version,
		SkillLinks:        append([]question.SkillLink(nil), version.SkillLinks...),
	})
}

func (s *Service) AppendVersion(ctx context.Context, actor identity.User, questionID string, expected int, input VersionInput) (question.Question, error) {
	questionID = strings.TrimSpace(questionID)
	if questionID == "" || expected < 1 {
		return question.Question{}, ErrInvalidInput
	}
	current, err := s.repo.Get(ctx, questionID)
	if err != nil {
		return question.Question{}, err
	}
	if !canEdit(actor, current) {
		return question.Question{}, ErrForbidden
	}
	if current.WorkflowStatus == question.WorkflowApproved || current.WorkflowStatus == question.WorkflowArchived {
		return question.Question{}, ErrWorkflow
	}
	version, err := normalizeVersion(input)
	if err != nil {
		return question.Question{}, err
	}
	row, err := s.repo.AppendVersion(ctx, actor.ID, questionID, expected, version)
	if errors.Is(err, question.ErrVersionConflict) {
		return question.Question{}, ErrVersionConflict
	}
	return row, err
}

func (s *Service) SetWorkflow(ctx context.Context, actor identity.User, questionID string, input WorkflowInput) (question.Question, error) {
	questionID = strings.TrimSpace(questionID)
	input.ReviewerNotes = strings.TrimSpace(input.ReviewerNotes)
	if questionID == "" || input.ExpectedCurrentVersion < 1 || !question.ValidWorkflowStatus(input.Status) || len(input.ReviewerNotes) > 4000 {
		return question.Question{}, ErrInvalidInput
	}
	current, err := s.repo.Get(ctx, questionID)
	if err != nil {
		return question.Question{}, err
	}
	if current.WorkflowStatus == question.WorkflowArchived {
		return question.Question{}, ErrWorkflow
	}
	if actor.HasRole(identity.RoleAdmin) {
		if input.Status == question.WorkflowApproved || input.Status == question.WorkflowPendingReview {
			if err := validatePublishable(current); err != nil {
				return question.Question{}, err
			}
		}
		row, err := s.repo.SetWorkflow(ctx, actor.ID, questionID, input.ExpectedCurrentVersion, input.Status, input.ReviewerNotes)
		if errors.Is(err, question.ErrVersionConflict) {
			return question.Question{}, ErrVersionConflict
		}
		return row, err
	}
	if !actor.HasRole(identity.RoleTeacher) || !canEdit(actor, current) {
		return question.Question{}, ErrForbidden
	}
	allowed := (current.WorkflowStatus == question.WorkflowDraft || current.WorkflowStatus == question.WorkflowRejected) && input.Status == question.WorkflowPendingReview
	allowed = allowed || (current.WorkflowStatus == question.WorkflowPendingReview && input.Status == question.WorkflowDraft)
	if !allowed {
		return question.Question{}, ErrWorkflow
	}
	if input.Status == question.WorkflowPendingReview {
		if err := validatePublishable(current); err != nil {
			return question.Question{}, err
		}
	}
	row, err := s.repo.SetWorkflow(ctx, actor.ID, questionID, input.ExpectedCurrentVersion, input.Status, input.ReviewerNotes)
	if errors.Is(err, question.ErrVersionConflict) {
		return question.Question{}, ErrVersionConflict
	}
	return row, err
}

func (s *Service) StaffGet(ctx context.Context, actor identity.User, questionID string) (question.Question, error) {
	row, err := s.repo.Get(ctx, strings.TrimSpace(questionID))
	if err != nil {
		return question.Question{}, err
	}
	if !canEdit(actor, row) {
		return question.Question{}, ErrForbidden
	}
	return row, nil
}

func (s *Service) LearnerGet(ctx context.Context, actor identity.User, questionID string) (question.Question, error) {
	if strings.TrimSpace(actor.ID) == "" {
		return question.Question{}, ErrForbidden
	}
	row, err := s.repo.Get(ctx, strings.TrimSpace(questionID))
	if err != nil {
		return question.Question{}, err
	}
	if row.WorkflowStatus != question.WorkflowApproved {
		return question.Question{}, question.ErrNotFound
	}
	return row, nil
}

func canEdit(actor identity.User, row question.Question) bool {
	if actor.HasRole(identity.RoleAdmin) {
		return true
	}
	if !actor.HasRole(identity.RoleTeacher) {
		return false
	}
	return row.OwnerType == question.OwnerTeacher && row.OwnerID == actor.ID || row.AssignedTeacherID == actor.ID
}

func normalizeVersion(input VersionInput) (question.VersionCommand, error) {
	input.PathID = strings.TrimSpace(input.PathID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	input.TextContent = strings.TrimSpace(input.TextContent)
	input.ImageAssetID = strings.TrimSpace(input.ImageAssetID)
	input.ImageAlt = strings.TrimSpace(input.ImageAlt)
	input.Explanation = strings.TrimSpace(input.Explanation)
	input.Hint = strings.TrimSpace(input.Hint)
	input.SolvingStrategy = strings.TrimSpace(input.SolvingStrategy)
	input.VideoURL = strings.TrimSpace(input.VideoURL)
	input.Difficulty = strings.TrimSpace(input.Difficulty)
	input.ExamType = strings.TrimSpace(input.ExamType)
	input.Source = strings.TrimSpace(input.Source)
	input.RevisionNote = strings.TrimSpace(input.RevisionNote)

	if input.PathID == "" || input.SubjectID == "" || !question.ValidQuestionType(input.QuestionType) || (input.TextContent == "" && input.ImageAssetID == "") {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if len(input.TextContent) > 20000 || len(input.Explanation) > 30000 || len(input.Hint) > 10000 || len(input.SolvingStrategy) > 20000 || len(input.ImageAlt) > 1000 || len(input.RevisionNote) > 1000 {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if input.SourceYear != nil && (*input.SourceYear < 1900 || *input.SourceYear > 2200) {
		return question.VersionCommand{}, ErrInvalidInput
	}

	options := make([]question.Option, 0, len(input.Options))
	for i, item := range input.Options {
		text := strings.TrimSpace(item.Text)
		assetID := strings.TrimSpace(item.AssetID)
		if text == "" && assetID == "" {
			return question.VersionCommand{}, ErrInvalidInput
		}
		options = append(options, question.Option{Index: i, Text: text, AssetID: assetID})
	}
	if len(options) > 12 {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if input.QuestionType == question.QuestionEssay && input.CorrectOptionIndex != nil {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if input.CorrectOptionIndex != nil && (*input.CorrectOptionIndex < 0 || *input.CorrectOptionIndex >= len(options)) && !input.OptionsEmbeddedInImage {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if (input.QuestionType == question.QuestionMCQ || input.QuestionType == question.QuestionTrueFalse) && !input.OptionsEmbeddedInImage && len(options) < 2 {
		return question.VersionCommand{}, ErrInvalidInput
	}
	if input.OptionsEmbeddedInImage {
		if input.ImageAssetID == "" || !hasEmbeddedOptionTexts(input.AIContext) {
			return question.VersionCommand{}, ErrInvalidInput
		}
	}

	links := make([]question.SkillLink, 0, len(input.SkillLinks))
	seen := make(map[string]struct{}, len(input.SkillLinks))
	mainCount := 0
	for _, link := range input.SkillLinks {
		id := strings.TrimSpace(link.SkillID)
		if id == "" || (link.RelationType != question.RelationMain && link.RelationType != question.RelationSub && link.RelationType != question.RelationSecondary) {
			return question.VersionCommand{}, ErrInvalidInput
		}
		if _, exists := seen[id]; exists {
			return question.VersionCommand{}, ErrInvalidInput
		}
		seen[id] = struct{}{}
		if link.RelationType == question.RelationMain {
			mainCount++
		}
		links = append(links, question.SkillLink{SkillID: id, RelationType: link.RelationType})
	}
	if mainCount != 1 {
		return question.VersionCommand{}, ErrInvalidInput
	}

	return question.VersionCommand{
		PathID: input.PathID, SubjectID: input.SubjectID, QuestionType: input.QuestionType,
		TextContent: input.TextContent, ImageAssetID: input.ImageAssetID, ImageAlt: input.ImageAlt,
		OptionsEmbeddedInImage: input.OptionsEmbeddedInImage, CorrectOptionIndex: input.CorrectOptionIndex,
		Explanation: input.Explanation, Hint: input.Hint, SolvingStrategy: input.SolvingStrategy, VideoURL: input.VideoURL,
		SourceMeta: normalizeJSON(input.SourceMeta), AIContext: normalizeJSON(input.AIContext), VoiceExplanation: normalizeJSON(input.VoiceExplanation),
		Difficulty: input.Difficulty, ExamType: input.ExamType, Source: input.Source, SourceYear: input.SourceYear,
		RevisionNote: input.RevisionNote, Options: options, SkillLinks: links,
	}, nil
}

func validatePublishable(row question.Question) error {
	v := row.Version
	if v.QuestionType != question.QuestionEssay && v.CorrectOptionIndex == nil {
		return ErrInvalidInput
	}
	if v.ImageAssetID != "" && strings.TrimSpace(v.Explanation) == "" {
		return ErrInvalidInput
	}
	if v.OptionsEmbeddedInImage {
		count := embeddedOptionTextCount(v.AIContext)
		if count < 2 || v.CorrectOptionIndex == nil || *v.CorrectOptionIndex < 0 || *v.CorrectOptionIndex >= count {
			return ErrInvalidInput
		}
	}
	return nil
}

func hasEmbeddedOptionTexts(raw json.RawMessage) bool { return embeddedOptionTextCount(raw) >= 2 }

func embeddedOptionTextCount(raw json.RawMessage) int {
	if len(raw) == 0 {
		return 0
	}
	var value struct {
		OptionTexts []string `json:"optionTexts"`
	}
	if json.Unmarshal(raw, &value) != nil {
		return 0
	}
	for _, item := range value.OptionTexts {
		if strings.TrimSpace(item) == "" {
			return 0
		}
	}
	return len(value.OptionTexts)
}

func normalizeJSON(raw json.RawMessage) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage(`{}`)
	}
	return raw
}
