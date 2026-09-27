package application

import (
	"context"
	"errors"
	"testing"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type repoStub struct {
	template        communication.Template
	templateWrite   communication.TemplateWrite
	campaign        communication.CampaignCommand
	campaignCalls   int
	inboxUser       string
	deliveries      communication.DeliveryPage
	templates       communication.TemplatePage
	adminDeliveries communication.DeliveryPage
}

func (r *repoStub) ListTemplates(context.Context, int, int) (communication.TemplatePage, error) {
	return r.templates, nil
}
func (r *repoStub) TemplateByKey(context.Context, string, bool) (communication.Template, error) {
	if r.template.ID == "" {
		return communication.Template{}, communication.ErrNotFound
	}
	return r.template, nil
}
func (r *repoStub) UpsertTemplate(_ context.Context, _ string, write communication.TemplateWrite) (communication.Template, error) {
	r.templateWrite = write
	return communication.Template{ID: "template-1", Key: write.Key, Revision: write.ExpectedRevision + 1}, nil
}
func (r *repoStub) CreateCampaign(_ context.Context, command communication.CampaignCommand) (communication.CampaignResult, error) {
	r.campaignCalls++
	r.campaign = command
	return communication.CampaignResult{CampaignID: "campaign-1", Recipients: len(command.Recipients), Created: len(command.Recipients) * len(command.Message.Channels)}, nil
}
func (r *repoStub) ListInbox(_ context.Context, userID string, _, _ int) (communication.DeliveryPage, error) {
	r.inboxUser = userID
	return r.deliveries, nil
}
func (r *repoStub) UnreadCount(context.Context, string) (int, error) { return 2, nil }
func (r *repoStub) MarkRead(context.Context, string, string) (communication.Delivery, error) {
	return communication.Delivery{ID: "delivery-1"}, nil
}
func (r *repoStub) MarkAllRead(context.Context, string) (int64, error) { return 2, nil }
func (r *repoStub) ListDeliveries(context.Context, communication.DeliveryFilter) (communication.DeliveryPage, error) {
	return r.adminDeliveries, nil
}

type audienceStub struct {
	rows  []identity.NotificationRecipient
	limit int
}

func (a *audienceStub) ResolveNotificationAudience(
	_ context.Context,
	_ []string,
	_ []identity.Role,
	limit int,
) ([]identity.NotificationRecipient, error) {
	a.limit = limit
	return a.rows, nil
}

func adminActor() identity.User {
	return identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}
}

func TestSendCampaignResolvesAudienceAndRendersTemplate(t *testing.T) {
	repo := &repoStub{template: communication.Template{
		ID: "template-1", Key: "weekly.parent", Title: "مرحبًا {{name}}",
		Body: "نتيجتك {{score}} {{missing}}", Subject: "تقرير {{name}}", IsActive: true,
	}}
	audience := &audienceStub{rows: []identity.NotificationRecipient{
		{ID: "user-1", Name: "سارة", Email: "sara@example.com", Phone: "966500000001"},
	}}
	service := NewService(repo, audience)

	out, err := service.SendCampaign(context.Background(), adminActor(), communication.CampaignWrite{
		TemplateKey: "weekly.parent",
		Channels:    []communication.Channel{communication.ChannelInApp, communication.ChannelEmail, communication.ChannelInApp},
		Roles:       []string{"parent"},
		Variables:   map[string]any{"name": "سارة", "score": float64(88)},
	})
	if err != nil {
		t.Fatal(err)
	}
	if audience.limit != MaxCampaignRecipients+1 {
		t.Fatalf("unexpected audience safety limit %d", audience.limit)
	}
	if out.Recipients != 1 || repo.campaignCalls != 1 {
		t.Fatalf("unexpected result %#v calls=%d", out, repo.campaignCalls)
	}
	if repo.campaign.Message.Title != "مرحبًا سارة" ||
		repo.campaign.Message.Body != "نتيجتك 88" ||
		repo.campaign.Message.Subject != "تقرير سارة" {
		t.Fatalf("template was not rendered: %#v", repo.campaign.Message)
	}
	if len(repo.campaign.Message.Channels) != 2 {
		t.Fatalf("channels were not deduplicated: %#v", repo.campaign.Message.Channels)
	}
	if len(repo.campaign.Recipients) != 1 || repo.campaign.Recipients[0].Email != "sara@example.com" {
		t.Fatalf("audience projection not preserved: %#v", repo.campaign.Recipients)
	}
}

func TestSendCampaignFailsClosedAboveAudienceLimit(t *testing.T) {
	rows := make([]identity.NotificationRecipient, MaxCampaignRecipients+1)
	for i := range rows {
		rows[i] = identity.NotificationRecipient{ID: "user"}
	}
	repo := &repoStub{}
	service := NewService(repo, &audienceStub{rows: rows})

	_, err := service.SendCampaign(context.Background(), adminActor(), communication.CampaignWrite{
		Title: "تنبيه", Body: "رسالة", Channels: []communication.Channel{communication.ChannelInApp},
		Roles: []string{"student"},
	})
	if !errors.Is(err, ErrAudienceTooLarge) {
		t.Fatalf("expected audience limit, got %v", err)
	}
	if repo.campaignCalls != 0 {
		t.Fatal("campaign persisted despite oversized audience")
	}
}

func TestSendCampaignRequiresAdmin(t *testing.T) {
	service := NewService(&repoStub{}, &audienceStub{})
	_, err := service.SendCampaign(context.Background(), identity.User{
		ID: "student-1", Roles: []identity.Role{identity.RoleStudent},
	}, communication.CampaignWrite{
		Title: "تنبيه", Body: "رسالة", Channels: []communication.Channel{communication.ChannelInApp},
		UserIDs: []string{"user-1"},
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected admin-only guard, got %v", err)
	}
}

func TestInboxIsAlwaysScopedToCurrentActor(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, &audienceStub{})
	_, err := service.Inbox(context.Background(), identity.User{
		ID: "student-1", Roles: []identity.Role{identity.RoleStudent},
	}, 1, 20)
	if err != nil {
		t.Fatal(err)
	}
	if repo.inboxUser != "student-1" {
		t.Fatalf("inbox read escaped actor scope: %s", repo.inboxUser)
	}
}

func TestTemplateWriteNormalizesVariablesAndRevision(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, &audienceStub{})
	out, err := service.UpsertTemplate(context.Background(), adminActor(), communication.TemplateWrite{
		Key: " exam.reminder ", Name: " تذكير ", Channel: communication.ChannelInApp,
		Title: " عنوان ", Body: " نص ", Variables: []string{"student", "score", "student"},
		IsActive: true, ExpectedRevision: 2,
	})
	if err != nil {
		t.Fatal(err)
	}
	if out.Revision != 3 {
		t.Fatalf("unexpected template revision %#v", out)
	}
	if len(repo.templateWrite.Variables) != 2 || repo.templateWrite.Variables[0] != "score" || repo.templateWrite.Variables[1] != "student" {
		t.Fatalf("variables not normalized: %#v", repo.templateWrite.Variables)
	}
}

type queueStub struct {
	items   []communication.Delivery
	results []bool
}

func (q *queueStub) ClaimPending(context.Context, int, time.Duration) ([]communication.Delivery, error) {
	return q.items, nil
}
func (q *queueStub) CompleteAttempt(_ context.Context, _ string, ok bool, _ communication.DeliveryAttemptResult, _ time.Time) error {
	q.results = append(q.results, ok)
	return nil
}

type senderStub struct{}

func (senderStub) Send(_ context.Context, item communication.Delivery) (communication.DeliveryAttemptResult, bool) {
	if item.ID == "success" {
		return communication.DeliveryAttemptResult{Provider: "console"}, true
	}
	return communication.DeliveryAttemptResult{Provider: "none", FailureReason: "not configured"}, false
}

func TestProcessorTracksSentRetryingAndFailed(t *testing.T) {
	repo := &queueStub{items: []communication.Delivery{
		{ID: "success", RetryCount: 0},
		{ID: "retry", RetryCount: 1},
		{ID: "fail", RetryCount: 3},
	}}
	processor := NewProcessor(repo, senderStub{})
	processor.now = func() time.Time { return time.Date(2026, 9, 27, 0, 0, 0, 0, time.UTC) }

	out, err := processor.ProcessBatch(context.Background(), 25)
	if err != nil {
		t.Fatal(err)
	}
	if out.Claimed != 3 || out.Sent != 1 || out.Retrying != 1 || out.Failed != 1 {
		t.Fatalf("unexpected processor stats %#v", out)
	}
	if len(repo.results) != 3 || !repo.results[0] || repo.results[1] || repo.results[2] {
		t.Fatalf("unexpected completion results %#v", repo.results)
	}
}
