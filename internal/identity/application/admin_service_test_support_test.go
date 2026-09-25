package application

import (
	"context"

	"github.com/nasef6464/almeaago/internal/identity/domain"
)

type adminRepoMock struct {
	lastQuery      domain.AdminUserQuery
	listPage       domain.AdminUserPage
	summary        domain.AdminUserSummary
	upsertInput    domain.AdminUpsertUserInput
	updateTargetID string
	updateInput    domain.AdminUpdateUserInput
	bulkIDs        []string
	bulkActive     bool
	deleteTargetID string
	err            error
}

func (m *adminRepoMock) AdminListUsers(
	_ context.Context,
	query domain.AdminUserQuery,
) (domain.AdminUserPage, error) {
	m.lastQuery = query
	if m.err != nil {
		return domain.AdminUserPage{}, m.err
	}
	if m.listPage.Limit == 0 {
		m.listPage = domain.AdminUserPage{Page: query.Page, Limit: query.Limit}
	}
	return m.listPage, nil
}

func (m *adminRepoMock) AdminSummary(context.Context) (domain.AdminUserSummary, error) {
	if m.err != nil {
		return domain.AdminUserSummary{}, m.err
	}
	return m.summary, nil
}

func (m *adminRepoMock) AdminUpsertUser(
	_ context.Context,
	_ string,
	input domain.AdminUpsertUserInput,
) (domain.AdminUserRecord, error) {
	m.upsertInput = input
	if m.err != nil {
		return domain.AdminUserRecord{}, m.err
	}
	return domain.AdminUserRecord{
		User: domain.User{
			ID:     "user-1",
			Email:  input.Email,
			Name:   input.Name,
			Status: "active",
			Roles:  []domain.Role{input.Role},
		},
		SchoolID:         input.SchoolID,
		ClassIDs:         append([]string(nil), input.ClassIDs...),
		LinkedStudentIDs: append([]string(nil), input.LinkedStudentIDs...),
	}, nil
}

func (m *adminRepoMock) AdminUpdateUser(
	_ context.Context,
	_ string,
	targetID string,
	input domain.AdminUpdateUserInput,
) (domain.AdminUserRecord, error) {
	m.updateTargetID = targetID
	m.updateInput = input
	if m.err != nil {
		return domain.AdminUserRecord{}, m.err
	}
	return domain.AdminUserRecord{
		User: domain.User{ID: targetID, Status: "active"},
	}, nil
}

func (m *adminRepoMock) AdminBulkStatus(
	_ context.Context,
	_ string,
	userIDs []string,
	active bool,
) ([]domain.AdminBulkStatusResult, error) {
	m.bulkIDs = append([]string(nil), userIDs...)
	m.bulkActive = active
	if m.err != nil {
		return nil, m.err
	}
	return []domain.AdminBulkStatusResult{{UserID: userIDs[0], Status: "updated"}}, nil
}

func (m *adminRepoMock) AdminDeleteUser(
	_ context.Context,
	_ string,
	targetID string,
) error {
	m.deleteTargetID = targetID
	return m.err
}

func adminActor() domain.User {
	return domain.User{
		ID:     "admin-1",
		Status: "active",
		Roles:  []domain.Role{domain.RoleAdmin},
	}
}
