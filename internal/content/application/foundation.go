package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (s *Service) CreateTopic(ctx context.Context, actor identity.User, input TopicInput) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	write, err := normalizeTopic(input)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	return s.repo.CreateTopic(ctx, actor.ID, write)
}

func (s *Service) UpdateTopic(ctx context.Context, actor identity.User, topicID string, input UpdateTopicInput) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	topicID = strings.TrimSpace(topicID)
	if topicID == "" || input.ExpectedRevision < 1 {
		return content.FoundationTopic{}, ErrInvalidInput
	}
	current, err := s.repo.GetTopic(ctx, topicID)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	write, err := normalizeTopic(input.TopicInput)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	if write.Code != current.Code {
		return content.FoundationTopic{}, ErrInvalidInput
	}
	return s.repo.UpdateTopic(ctx, actor.ID, topicID, input.ExpectedRevision, write)
}

func (s *Service) StaffTopic(ctx context.Context, actor identity.User, topicID string) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	return s.repo.GetTopic(ctx, strings.TrimSpace(topicID))
}

func (s *Service) ListTopics(ctx context.Context, actor identity.User, query content.TopicQuery) (content.TopicPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.TopicPage{}, ErrForbidden
	}
	query.PathID, query.SubjectID = strings.TrimSpace(query.PathID), strings.TrimSpace(query.SubjectID)
	query.ParentID, query.Search = strings.TrimSpace(query.ParentID), strings.TrimSpace(query.Search)
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Limit == 0 {
		query.Limit = 50
	}
	if query.Page < 1 || query.Limit < 1 || query.Limit > 100 || len(query.Search) > 160 {
		return content.TopicPage{}, ErrInvalidInput
	}
	if query.Status != "" && !content.ValidTopicStatus(query.Status) {
		return content.TopicPage{}, ErrInvalidInput
	}
	return s.repo.ListTopics(ctx, query)
}

func normalizeTopic(input TopicInput) (content.TopicWrite, error) {
	write := content.TopicWrite{
		PathID: strings.TrimSpace(input.PathID), SubjectID: strings.TrimSpace(input.SubjectID), ParentTopicID: strings.TrimSpace(input.ParentTopicID),
		Code: strings.ToUpper(strings.TrimSpace(input.Code)), Title: strings.TrimSpace(input.Title), Description: strings.TrimSpace(input.Description),
		SortOrder: input.SortOrder, Status: input.Status, IsVisible: boolDefault(input.IsVisible, true), IsLocked: input.IsLocked, SkillIDs: normalizeIDs(input.SkillIDs),
	}
	if write.Status == "" {
		write.Status = content.TopicActive
	}
	if write.PathID == "" || write.SubjectID == "" || write.Code == "" || len(write.Code) > 80 || write.Title == "" || len(write.Title) > 240 || len(write.Description) > 12000 || write.SortOrder < 0 || !content.ValidTopicStatus(write.Status) || len(write.SkillIDs) == 0 || len(write.SkillIDs) > 50 {
		return content.TopicWrite{}, ErrInvalidInput
	}
	return write, nil
}
