package application

import (
	"context"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (s *Service) CreateLibraryItem(ctx context.Context, actor identity.User, input LibraryInput) (content.LibraryItem, error) {
	write, err := normalizeLibrary(actor, input)
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, write.PathID, write.SubjectID); err != nil {
		return content.LibraryItem{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		write.RevenueSharePercentage = nil
	}
	return s.repo.CreateLibraryItem(ctx, actor.ID, write)
}

func (s *Service) UpdateLibraryItem(ctx context.Context, actor identity.User, itemID string, input UpdateLibraryInput) (content.LibraryItem, error) {
	itemID = strings.TrimSpace(itemID)
	if itemID == "" || input.ExpectedRevision < 1 {
		return content.LibraryItem{}, ErrInvalidInput
	}
	current, err := s.repo.GetLibraryItem(ctx, itemID)
	if err != nil {
		return content.LibraryItem{}, err
	}
	if !canEdit(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID) {
		return content.LibraryItem{}, ErrForbidden
	}
	if err := s.requireAuthorScope(ctx, actor, current.PathID, current.SubjectID); err != nil {
		return content.LibraryItem{}, err
	}
	if current.WorkflowStatus == content.WorkflowApproved || current.WorkflowStatus == content.WorkflowArchived {
		return content.LibraryItem{}, ErrWorkflow
	}
	write, err := normalizeLibrary(actor, input.LibraryInput)
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, write.PathID, write.SubjectID); err != nil {
		return content.LibraryItem{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		write.OwnerType, write.OwnerUserID, write.OwnerSchoolID, write.AssignedTeacherID = current.OwnerType, current.OwnerUserID, current.OwnerSchoolID, current.AssignedTeacherID
		write.RevenueSharePercentage = current.RevenueSharePercentage
	}
	return s.repo.UpdateLibraryItem(ctx, actor.ID, itemID, input.ExpectedRevision, write)
}

func (s *Service) SetLibraryWorkflow(ctx context.Context, actor identity.User, itemID string, input WorkflowInput) (content.LibraryItem, error) {
	current, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(itemID))
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := validateWorkflowInput(input); err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.requireAuthorScope(ctx, actor, current.PathID, current.SubjectID); err != nil {
		return content.LibraryItem{}, err
	}
	if err := authorizeWorkflow(actor, current.OwnerType, current.OwnerUserID, current.AssignedTeacherID, current.WorkflowStatus, input.Status); err != nil {
		return content.LibraryItem{}, err
	}
	if input.Status == content.WorkflowApproved && !libraryPublishable(current) {
		return content.LibraryItem{}, ErrWorkflow
	}
	return s.repo.SetLibraryWorkflow(ctx, actor.ID, current.ID, input.ExpectedRevision, input.Status, strings.TrimSpace(input.ReviewerNotes))
}

func (s *Service) StaffLibraryItem(ctx context.Context, actor identity.User, itemID string) (content.LibraryItem, error) {
	row, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(itemID))
	if err != nil {
		return content.LibraryItem{}, err
	}
	if !canEdit(actor, row.OwnerType, row.OwnerUserID, row.AssignedTeacherID) {
		return content.LibraryItem{}, ErrForbidden
	}
	if err := s.requireAuthorScope(ctx, actor, row.PathID, row.SubjectID); err != nil {
		return content.LibraryItem{}, err
	}
	return row, nil
}

func (s *Service) ListLibraryItems(ctx context.Context, actor identity.User, query content.ListQuery) (content.LibraryPage, error) {
	if err := normalizeList(actor, &query); err != nil {
		return content.LibraryPage{}, err
	}
	return s.repo.ListLibraryItems(ctx, query)
}

func normalizeLibrary(actor identity.User, input LibraryInput) (content.LibraryWrite, error) {
	write := content.LibraryWrite{
		PathID: strings.TrimSpace(input.PathID), SubjectID: strings.TrimSpace(input.SubjectID),
		Title: strings.TrimSpace(input.Title), Description: strings.TrimSpace(input.Description), ItemType: input.ItemType,
		ExternalURL: strings.TrimSpace(input.ExternalURL), OwnerType: input.OwnerType, OwnerUserID: strings.TrimSpace(input.OwnerUserID),
		OwnerSchoolID: strings.TrimSpace(input.OwnerSchoolID), AssignedTeacherID: strings.TrimSpace(input.AssignedTeacherID),
		RevenueSharePercentage: input.RevenueSharePercentage, IsVisible: boolDefault(input.IsVisible, true), IsLocked: input.IsLocked,
		SkillIDs: normalizeIDs(input.SkillIDs), PrimaryAssetID: strings.TrimSpace(input.PrimaryAssetID),
	}
	if write.PathID == "" || write.SubjectID == "" || write.Title == "" || len(write.Title) > 240 || len(write.Description) > 12000 || len(write.ExternalURL) > 2048 || !content.ValidLibraryType(write.ItemType) || len(write.SkillIDs) == 0 || len(write.SkillIDs) > 50 || (write.ExternalURL == "" && write.PrimaryAssetID == "") {
		return content.LibraryWrite{}, ErrInvalidInput
	}
	if write.ItemType == content.LibraryLink && write.ExternalURL == "" {
		return content.LibraryWrite{}, ErrInvalidInput
	}
	if write.RevenueSharePercentage != nil && (*write.RevenueSharePercentage < 0 || *write.RevenueSharePercentage > 100) {
		return content.LibraryWrite{}, ErrInvalidInput
	}
	if err := normalizeOwner(actor, &write.OwnerType, &write.OwnerUserID, &write.OwnerSchoolID, &write.AssignedTeacherID); err != nil {
		return content.LibraryWrite{}, err
	}
	return write, nil
}

func libraryPublishable(row content.LibraryItem) bool {
	return len(row.SkillIDs) > 0 && (strings.TrimSpace(row.ExternalURL) != "" || strings.TrimSpace(row.PrimaryAssetID) != "")
}
