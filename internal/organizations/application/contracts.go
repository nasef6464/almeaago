package application

import (
	"context"
	"errors"
	"sort"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type UpsertSchoolContractInput struct {
	Status     org.SchoolContractStatus
	Modules    []org.SchoolModule
	ValidFrom  *time.Time
	ValidUntil *time.Time
}

func (s *Service) SchoolContract(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (*org.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return nil, ErrInvalidInput
	}

	contract, err := s.repo.SchoolContractBySchool(ctx, schoolID)
	if errors.Is(err, org.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &contract, nil
}

func (s *Service) UpsertSchoolContract(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input UpsertSchoolContractInput,
) (org.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return org.SchoolContract{}, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" || !org.ValidSchoolContractStatus(input.Status) {
		return org.SchoolContract{}, ErrInvalidInput
	}
	if input.ValidFrom != nil && input.ValidUntil != nil && input.ValidUntil.Before(*input.ValidFrom) {
		return org.SchoolContract{}, ErrInvalidInput
	}

	modules, err := normalizeSchoolModules(input.Modules)
	if err != nil || len(modules) == 0 {
		return org.SchoolContract{}, ErrInvalidInput
	}

	return s.repo.UpsertSchoolContract(ctx, actor.ID, schoolID, org.SchoolContractWrite{
		Status:     input.Status,
		Modules:    modules,
		ValidFrom:  utcTimePointer(input.ValidFrom),
		ValidUntil: utcTimePointer(input.ValidUntil),
	})
}

func (s *Service) ResolveSchoolEntitlement(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	module org.SchoolModule,
) (org.SchoolEntitlement, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" || !org.ValidSchoolModule(module) {
		return org.SchoolEntitlement{}, ErrInvalidInput
	}

	if !actor.HasRole(identity.RoleAdmin) {
		allowed, err := s.repo.CanAccessSchool(ctx, accessOf(actor), schoolID)
		if err != nil {
			return org.SchoolEntitlement{}, err
		}
		if !allowed {
			return org.SchoolEntitlement{}, ErrForbidden
		}
	}

	contract, err := s.repo.SchoolContractBySchool(ctx, schoolID)
	if errors.Is(err, org.ErrNotFound) {
		return org.SchoolEntitlement{
			Allowed: false,
			Module:  module,
			Contract: nil,
		}, nil
	}
	if err != nil {
		return org.SchoolEntitlement{}, err
	}

	allowed, err := s.repo.HasSchoolModule(ctx, schoolID, module)
	if err != nil {
		return org.SchoolEntitlement{}, err
	}
	return org.SchoolEntitlement{
		Allowed:  allowed,
		Module:   module,
		Contract: &contract,
	}, nil
}

func (s *Service) requireSchoolModule(
	ctx context.Context,
	schoolID string,
	module org.SchoolModule,
) error {
	allowed, err := s.repo.HasSchoolModule(ctx, schoolID, module)
	if err != nil {
		return err
	}
	if !allowed {
		return ErrForbidden
	}
	return nil
}

func normalizeSchoolModules(values []org.SchoolModule) ([]org.SchoolModule, error) {
	seen := make(map[org.SchoolModule]struct{}, len(values))
	result := make([]org.SchoolModule, 0, len(values))
	for _, module := range values {
		if !org.ValidSchoolModule(module) {
			return nil, ErrInvalidInput
		}
		if _, exists := seen[module]; exists {
			continue
		}
		seen[module] = struct{}{}
		result = append(result, module)
	}
	sort.Slice(result, func(i, j int) bool {
		return result[i] < result[j]
	})
	return result, nil
}

func utcTimePointer(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	utc := value.UTC()
	return &utc
}
