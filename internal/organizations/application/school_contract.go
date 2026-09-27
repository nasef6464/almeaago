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

var ErrContractConflict = errors.New("school contract revision conflict")

type SchoolContractRepository interface {
	SchoolContract(context.Context, string) (org.SchoolContract, error)
	UpsertSchoolContract(context.Context, string, string, org.SchoolContractWrite) (org.SchoolContract, error)
}

type SchoolContractService struct {
	repo SchoolContractRepository
}

func NewSchoolContractService(repo SchoolContractRepository) *SchoolContractService {
	return &SchoolContractService{repo: repo}
}

func normalizeContractWrite(input org.SchoolContractWrite) (org.SchoolContractWrite, error) {
	if !org.ValidSchoolContractStatus(input.Status) || input.ExpectedRevision < 0 {
		return org.SchoolContractWrite{}, ErrInvalidInput
	}
	if input.ValidFrom != nil && input.ValidUntil != nil && input.ValidUntil.Before(*input.ValidFrom) {
		return org.SchoolContractWrite{}, ErrInvalidInput
	}
	seen := map[org.SchoolModule]struct{}{}
	modules := make([]org.SchoolModule, 0, len(input.Modules))
	for _, module := range input.Modules {
		if !org.ValidSchoolModule(module) {
			return org.SchoolContractWrite{}, ErrInvalidInput
		}
		if _, exists := seen[module]; exists {
			continue
		}
		seen[module] = struct{}{}
		modules = append(modules, module)
	}
	if len(modules) > 32 {
		return org.SchoolContractWrite{}, ErrInvalidInput
	}
	sort.Slice(modules, func(i, j int) bool { return modules[i] < modules[j] })
	input.Modules = modules
	return input, nil
}

func (s *SchoolContractService) Get(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (org.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) || strings.TrimSpace(schoolID) == "" {
		return org.SchoolContract{}, ErrForbidden
	}
	return s.repo.SchoolContract(ctx, strings.TrimSpace(schoolID))
}

func (s *SchoolContractService) Upsert(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input org.SchoolContractWrite,
) (org.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return org.SchoolContract{}, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return org.SchoolContract{}, ErrInvalidInput
	}
	input, err := normalizeContractWrite(input)
	if err != nil {
		return org.SchoolContract{}, err
	}
	return s.repo.UpsertSchoolContract(ctx, actor.ID, schoolID, input)
}

func ContractAllowsModule(contract org.SchoolContract, module org.SchoolModule, now time.Time) bool {
	if contract.Status != org.SchoolContractActive {
		return false
	}
	if contract.ValidFrom != nil && now.Before(*contract.ValidFrom) {
		return false
	}
	if contract.ValidUntil != nil && now.After(*contract.ValidUntil) {
		return false
	}
	for _, enabled := range contract.Modules {
		if enabled == module {
			return true
		}
	}
	return false
}
