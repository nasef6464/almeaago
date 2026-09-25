package commercehttp

import (
	"strings"
	"time"

	commerce "github.com/nasef6464/almeaago/internal/commerce/domain"
)

func parseOptionalTime(raw *string) (*time.Time, error) {
	if raw == nil || strings.TrimSpace(*raw) == "" {
		return nil, nil
	}
	value, err := time.Parse(time.RFC3339, strings.TrimSpace(*raw))
	if err != nil {
		return nil, err
	}
	value = value.UTC()
	return &value, nil
}

func presentContract(contract commerce.SchoolContract) map[string]any {
	modules := contract.Modules
	if modules == nil {
		modules = []commerce.SchoolModule{}
	}
	return map[string]any{
		"id":         contract.ID,
		"schoolId":   contract.SchoolID,
		"status":     contract.Status,
		"modules":    modules,
		"validFrom":  presentOptionalTime(contract.ValidFrom),
		"validUntil": presentOptionalTime(contract.ValidUntil),
		"createdAt":  contract.CreatedAt.UTC().Format(time.RFC3339),
		"updatedAt":  contract.UpdatedAt.UTC().Format(time.RFC3339),
	}
}

func presentOptionalTime(value *time.Time) any {
	if value == nil {
		return nil
	}
	return value.UTC().Format(time.RFC3339)
}