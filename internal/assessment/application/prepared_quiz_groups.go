package application

import (
	"context"
	"strings"
	"unicode/utf8"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type preparedQuizGroupStore interface {
	ListPreparedQuizGroups(context.Context) ([]assessment.PreparedQuizGroup, error)
	CreatePreparedQuizGroup(context.Context, string, assessment.PreparedQuizGroup) (assessment.PreparedQuizGroup, error)
	ListPreparedQuizGroupMembers(context.Context, string) ([]string, error)
	SetPreparedQuizGroupMember(context.Context, string, string, string, bool) error
}
type preparedQuizMemberDetailsReader interface {
	ListPreparedQuizGroupMemberDetails(context.Context, string) ([]assessment.PreparedQuizGroupMember, error)
}

func (s *Service) ListPreparedQuizGroupMemberDetails(ctx context.Context, actor identity.User, groupID string) ([]assessment.PreparedQuizGroupMember, error) {
	if _, err := s.preparedGroups(actor); err != nil {
		return nil, err
	}
	if !preparedUUID.MatchString(groupID) {
		return nil, ErrInvalidInput
	}
	repo, ok := s.repo.(preparedQuizMemberDetailsReader)
	if !ok {
		return nil, ErrWorkflow
	}
	return repo.ListPreparedQuizGroupMemberDetails(ctx, groupID)
}

func (s *Service) preparedGroups(actor identity.User) (preparedQuizGroupStore, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	repo, ok := s.repo.(preparedQuizGroupStore)
	if !ok {
		return nil, ErrWorkflow
	}
	return repo, nil
}
func (s *Service) ListPreparedQuizGroups(ctx context.Context, actor identity.User) ([]assessment.PreparedQuizGroup, error) {
	r, err := s.preparedGroups(actor)
	if err != nil {
		return nil, err
	}
	return r.ListPreparedQuizGroups(ctx)
}
func (s *Service) CreatePreparedQuizGroup(ctx context.Context, actor identity.User, g assessment.PreparedQuizGroup) (assessment.PreparedQuizGroup, error) {
	r, err := s.preparedGroups(actor)
	if err != nil {
		return assessment.PreparedQuizGroup{}, err
	}
	g.Name = strings.TrimSpace(g.Name)
	g.LegacyID = strings.TrimSpace(g.LegacyID)
	if g.ID != "" || g.MemberCount != 0 || g.Name == "" || utf8.RuneCountInString(g.Name) > 200 || len(g.LegacyID) > 200 || (g.GroupType != "SCHOOL" && g.GroupType != "CLASS" && g.GroupType != "PRIVATE_GROUP") {
		return assessment.PreparedQuizGroup{}, ErrInvalidInput
	}
	return r.CreatePreparedQuizGroup(ctx, actor.ID, g)
}
func (s *Service) ListPreparedQuizGroupMembers(ctx context.Context, actor identity.User, groupID string) ([]string, error) {
	r, err := s.preparedGroups(actor)
	if err != nil {
		return nil, err
	}
	if !preparedUUID.MatchString(groupID) {
		return nil, ErrInvalidInput
	}
	return r.ListPreparedQuizGroupMembers(ctx, groupID)
}
func (s *Service) SetPreparedQuizGroupMember(ctx context.Context, actor identity.User, groupID, userID string, add bool) error {
	r, err := s.preparedGroups(actor)
	if err != nil {
		return err
	}
	if !preparedUUID.MatchString(groupID) || !preparedUUID.MatchString(userID) {
		return ErrInvalidInput
	}
	return r.SetPreparedQuizGroupMember(ctx, actor.ID, groupID, userID, add)
}
