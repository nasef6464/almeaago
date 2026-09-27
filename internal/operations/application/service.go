package application

import (
	"context"
	"errors"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

var (
	ErrForbidden    = errors.New("operations access forbidden")
	ErrInvalidInput = errors.New("invalid operations request")
)

type Repository interface {
	ListAudit(context.Context, operations.AuditQuery) (operations.AuditPage, error)
	ReadinessCounts(context.Context) (operations.OperationalCounts, error)
	DependencyHealth(context.Context) operations.DependencyHealth
}

type Config struct {
	Integrations []operations.IntegrationCheck
}

type Service struct {
	repo Repository
	cfg  Config
	now  func() time.Time
}

func NewService(repo Repository, cfg Config) *Service {
	return &Service{repo: repo, cfg: cfg, now: time.Now}
}

func requireAdmin(actor identity.User) error {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	return nil
}

func (s *Service) Audit(
	ctx context.Context,
	actor identity.User,
	query operations.AuditQuery,
) (operations.AuditPage, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.AuditPage{}, err
	}
	query.Action = strings.TrimSpace(query.Action)
	query.ResourceType = strings.TrimSpace(query.ResourceType)
	query.ActorUserID = strings.TrimSpace(query.ActorUserID)
	if len(query.Action) > 160 || len(query.ResourceType) > 120 || len(query.ActorUserID) > 120 {
		return operations.AuditPage{}, ErrInvalidInput
	}
	if query.Status != "" && !operations.ValidAuditStatus(query.Status) {
		return operations.AuditPage{}, ErrInvalidInput
	}
	if query.Page < 1 {
		query.Page = 1
	}
	if query.Limit < 1 {
		query.Limit = 50
	}
	if query.Page > 10000 || query.Limit > 100 {
		return operations.AuditPage{}, ErrInvalidInput
	}
	return s.repo.ListAudit(ctx, query)
}

func (s *Service) Readiness(
	ctx context.Context,
	actor identity.User,
) (operations.Readiness, error) {
	if err := requireAdmin(actor); err != nil {
		return operations.Readiness{}, err
	}
	dependencies := s.repo.DependencyHealth(ctx)
	counts, err := s.repo.ReadinessCounts(ctx)
	if err != nil {
		return operations.Readiness{}, err
	}
	status := "ready"
	if !dependencies.Postgres || !dependencies.Redis {
		status = "blocked"
	} else {
		for _, item := range s.cfg.Integrations {
			if item.Required && !item.Configured {
				status = "blocked"
				break
			}
			if !item.Configured && status == "ready" {
				status = "ready_with_notes"
			}
		}
		if counts.NotificationFailed > 0 || counts.AuditFailed24h > 0 {
			if status == "ready" {
				status = "ready_with_notes"
			}
		}
		// Release readiness cannot be presented as fully green while no dated,
		// verified restore drill is recorded by deployment operations.
		if status == "ready" {
			status = "ready_with_notes"
		}
	}
	return operations.Readiness{
		CheckedAt:           s.now().UTC(),
		Status:              status,
		Dependencies:        dependencies,
		Integrations:        append([]operations.IntegrationCheck(nil), s.cfg.Integrations...),
		Counts:              counts,
		BackupRestoreProof:  "external_proof_required",
		BackupRestoreDetail: "The application records no verified backup/restore drill yet; deployment infrastructure must supply dated restore evidence.",
	}, nil
}
