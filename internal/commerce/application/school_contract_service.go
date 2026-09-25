package application

import (
	"context"
	"errors"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

var (
	ErrForbidden    = errors.New("commerce action forbidden")
	ErrInvalidInput = errors.New("invalid commerce input")
)

type SchoolContractRepository interface {
	SchoolContractBySchool(ctx context.Context, schoolID string) (commerce.SchoolContract, error)
	UpsertSchoolContract(
		ctx context.Context,
		actorUserID string,
		schoolID string,
		write commerce.SchoolContractWrite,
	) (commerce.SchoolContract, error)
}

type SchoolContractService struct {
	repo SchoolContractRepository
	now  func() time.Time
}

func NewSchoolContractService(repo SchoolContractRepository) *SchoolContractService {
	return &SchoolContractService{repo: repo, now: time.Now}
}

type UpsertSchoolContractInput struct {
	Status     commerce.SchoolContractStatus
	Modules    []commerce.SchoolModule
	ValidFrom  *time.Time
	ValidUntil *time.Time
}

func (s *SchoolContractService) Contract(
	ctx context.Context,
	actor identity.User,
	schoolID string,
) (*commerce.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return nil, ErrInvalidInput
	}
	contract, err := s.repo.SchoolContractBySchool(ctx, schoolID)
	if errors.Is(err, commerce.ErrSchoolContractNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &contract, nil
}

func (s *SchoolContractService) Upsert(
	ctx context.Context,
	actor identity.User,
	schoolID string,
	input UpsertSchoolContractInput,
) (commerce.SchoolContract, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return commerce.SchoolContract{}, ErrForbidden
	}
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" {
		return commerce.SchoolContract{}, ErrInvalidInput
	}
	if !commerce.ValidSchoolContractStatus(input.Status) {
		return commerce.SchoolContract{}, ErrInvalidInput
	}
	modules, err := normalizeModules(input.Modules)
	if err != nil {
		return commerce.SchoolContract{}, err
	}
	if input.ValidFrom != nil && input.ValidUntil != nil && input.ValidUntil.Before(*input.ValidFrom) {
		return commerce.SchoolContract{}, ErrInvalidInput
	}

	return s.repo.UpsertSchoolContract(ctx, actor.ID, schoolID, commerce.SchoolContractWrite{
		Status:     input.Status,
		Modules:    modules,
		ValidFrom:  normalizeTime(input.ValidFrom),
		ValidUntil: normalizeTime(input.ValidUntil),
	})
}

func (s *SchoolContractService) ResolveModule(
	ctx context.Context,
	schoolID string,
	module commerce.SchoolModule,
) (commerce.SchoolModuleEntitlement, error) {
	schoolID = strings.TrimSpace(schoolID)
	if schoolID == "" || !commerce.ValidSchoolModule(module) {
		return commerce.SchoolModuleEntitlement{}, ErrInvalidInput
	}
	contract, err := s.repo.SchoolContractBySchool(ctx, schoolID)
	if errors.Is(err, commerce.ErrSchoolContractNotFound) {
		return commerce.SchoolModuleEntitlement{Allowed: false, Contract: nil}, nil
	}
	if err != nil {
		return commerce.SchoolModuleEntitlement{}, err
	}
	allowed := contract.IsCurrent(s.now()) && contract.HasModule(module)
	return commerce.SchoolModuleEntitlement{
		Allowed:  allowed,
		Contract: &contract,
	}, nil
}

func normalizeModules(values []commerce.SchoolModule) ([]commerce.SchoolModule, error) {
	if len(values) == 0 {
		return nil, ErrInvalidInput
	}
	seen := make(map[commerce.SchoolModule]struct{}, len(values))
	result := make([]commerce.SchoolModule, 0, len(values))
	for _, value := range values {
		if !commerce.ValidSchoolModule(value) {
			return nil, ErrInvalidInput
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	if len(result) == 0 {
		return nil, ErrInvalidInput
	}
	return result, nil
}

func normalizeTime(value *time.Time) *time.Time {
	if value == nil {
		return nil
	}
	normalized := value.UTC()
	return &normalized
}
