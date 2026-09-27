package application

import (
	"context"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
)

type DeliveryQueueRepository interface {
	ClaimPending(context.Context, int, time.Duration) ([]communication.Delivery, error)
	CompleteAttempt(context.Context, string, bool, communication.DeliveryAttemptResult, time.Time) error
}

type Sender interface {
	Send(context.Context, communication.Delivery) (communication.DeliveryAttemptResult, bool)
}

type Processor struct {
	repo   DeliveryQueueRepository
	sender Sender
	now    func() time.Time
}

type ProcessResult struct {
	Claimed  int `json:"claimed"`
	Sent     int `json:"sent"`
	Retrying int `json:"retrying"`
	Failed   int `json:"failed"`
}

func NewProcessor(repo DeliveryQueueRepository, sender Sender) *Processor {
	return &Processor{repo: repo, sender: sender, now: time.Now}
}

func (p *Processor) ProcessBatch(ctx context.Context, limit int) (ProcessResult, error) {
	if limit < 1 {
		limit = 25
	}
	if limit > 50 {
		limit = 50
	}
	items, err := p.repo.ClaimPending(ctx, limit, 5*time.Minute)
	if err != nil {
		return ProcessResult{}, err
	}
	out := ProcessResult{Claimed: len(items)}
	for _, item := range items {
		result, ok := p.sender.Send(ctx, item)
		now := p.now().UTC()
		if err = p.repo.CompleteAttempt(ctx, item.ID, ok, result, now); err != nil {
			return out, err
		}
		if ok {
			out.Sent++
			continue
		}
		if item.RetryCount+1 >= 4 {
			out.Failed++
		} else {
			out.Retrying++
		}
	}
	return out, nil
}
