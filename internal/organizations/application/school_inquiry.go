package application

import (
	"context"
	"crypto/rand"
	"fmt"
	"math/big"
	"strings"
	"time"

	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type SchoolInquiryRepository interface {
	CreateSchoolInquiry(ctx context.Context, input orgdomain.SchoolInquiryCreate) (orgdomain.SchoolInquiry, error)
	GetSchoolInquiryByID(ctx context.Context, id string) (orgdomain.SchoolInquiry, error)
	GetSchoolInquiryByRef(ctx context.Context, refNumber string) (orgdomain.SchoolInquiry, error)
	ListSchoolInquiries(ctx context.Context, limit, offset int) ([]orgdomain.SchoolInquiry, int, error)
}

type SchoolInquiryService struct {
	repo SchoolInquiryRepository
}

func NewSchoolInquiryService(repo SchoolInquiryRepository) *SchoolInquiryService {
	return &SchoolInquiryService{repo: repo}
}

func (s *SchoolInquiryService) SubmitInquiry(
	ctx context.Context,
	input orgdomain.SchoolInquiryCreate,
) (orgdomain.SchoolInquiry, error) {
	input.SchoolName = strings.TrimSpace(input.SchoolName)
	input.DirectorName = strings.TrimSpace(input.DirectorName)
	input.Phone = strings.TrimSpace(input.Phone)
	input.City = strings.TrimSpace(input.City)
	input.Email = strings.TrimSpace(input.Email)
	input.TierID = strings.TrimSpace(input.TierID)
	input.TierName = strings.TrimSpace(input.TierName)
	input.Notes = strings.TrimSpace(input.Notes)
	input.RefNumber = strings.TrimSpace(input.RefNumber)

	// Strict mandatory validation: missing schoolName, directorName, or phone must be rejected
	if input.SchoolName == "" || input.DirectorName == "" || input.Phone == "" {
		return orgdomain.SchoolInquiry{}, ErrInvalidInput
	}

	if input.StudentCount < 0 {
		input.StudentCount = 0
	}
	if input.TotalAnnualEstimate < 0 {
		input.TotalAnnualEstimate = 0
	}
	if input.Paths == nil {
		input.Paths = []string{}
	}

	// Generate RefNumber if not supplied
	if input.RefNumber == "" {
		n, err := rand.Int(rand.Reader, big.NewInt(90000))
		if err != nil {
			input.RefNumber = fmt.Sprintf("SCH-%d-%05d", time.Now().UTC().Year(), time.Now().UnixNano()%90000+10000)
		} else {
			input.RefNumber = fmt.Sprintf("SCH-%d-%05d", time.Now().UTC().Year(), n.Int64()+10000)
		}
	}

	return s.repo.CreateSchoolInquiry(ctx, input)
}

func (s *SchoolInquiryService) GetInquiryByID(ctx context.Context, id string) (orgdomain.SchoolInquiry, error) {
	id = strings.TrimSpace(id)
	if id == "" {
		return orgdomain.SchoolInquiry{}, ErrInvalidInput
	}
	return s.repo.GetSchoolInquiryByID(ctx, id)
}

func (s *SchoolInquiryService) GetInquiryByRef(ctx context.Context, refNumber string) (orgdomain.SchoolInquiry, error) {
	refNumber = strings.TrimSpace(refNumber)
	if refNumber == "" {
		return orgdomain.SchoolInquiry{}, ErrInvalidInput
	}
	return s.repo.GetSchoolInquiryByRef(ctx, refNumber)
}

func (s *SchoolInquiryService) ListInquiries(ctx context.Context, limit, offset int) ([]orgdomain.SchoolInquiry, int, error) {
	return s.repo.ListSchoolInquiries(ctx, limit, offset)
}
