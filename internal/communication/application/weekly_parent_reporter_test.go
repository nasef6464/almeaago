package application

import (
	"context"
	"testing"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	parents "github.com/nasef6464/almeaago/internal/parents/domain"
)

type weeklyParentReaderStub struct {
	reports map[string]parents.WeeklyReport
	ids     []string
}

func (s *weeklyParentReaderStub) WeeklyReportsForParents(
	_ context.Context,
	ids []string,
	_ time.Time,
) (map[string]parents.WeeklyReport, error) {
	s.ids = append([]string(nil), ids...)
	return s.reports, nil
}

func TestWeeklyParentScheduleUsesSundayEightRiyadh(t *testing.T) {
	due := time.Date(2026, 9, 27, 5, 15, 0, 0, time.UTC)
	key, ok := ShouldRunWeeklyParentReport(due)
	if !ok || key != "weekly-parent-report:2026-09-27" {
		t.Fatalf("unexpected schedule key=%s due=%v", key, ok)
	}
	_, ok = ShouldRunWeeklyParentReport(due.Add(time.Hour))
	if ok {
		t.Fatal("weekly report must not run outside the 08:00 Riyadh hour")
	}
}

func TestWeeklyParentReporterUsesCanonicalReportAndExplicitWhatsAppOptIn(t *testing.T) {
	repo := &repoStub{preferences: map[string]communication.Preferences{
		"parent-1": {
			UserID:                      "parent-1",
			ParentWhatsAppDigestEnabled: true,
			Revision:                    1,
		},
	}}
	audience := &audienceStub{rows: []identity.NotificationRecipient{
		{ID: "parent-1", Name: "ولي 1", Phone: "966500000001", Roles: []identity.Role{identity.RoleParent}},
		{ID: "parent-2", Name: "ولي 2", Phone: "966500000002", Roles: []identity.Role{identity.RoleParent}},
	}}
	service := NewService(repo, audience)
	parentReader := &weeklyParentReaderStub{reports: map[string]parents.WeeklyReport{
		"parent-1": {
			Children: []parents.WeeklyChildReport{{
				LinkedStudent:   parents.LinkedStudent{StudentID: "student-1", Name: "سارة"},
				AssessmentCount: 2,
				AverageScore:    71.5,
				WeakSkills: []learning.ParentWeakSkill{{
					SkillID:           "skill-1",
					SkillName:         "النسبة",
					Mastery:           42,
					RecommendedAction: "شرح + تدريب + إعادة قياس",
				}},
				NextAction: "شرح + تدريب + إعادة قياس",
			}},
		},
		"parent-2": {
			Children: []parents.WeeklyChildReport{{
				LinkedStudent: parents.LinkedStudent{StudentID: "student-2", Name: "أحمد"},
			}},
		},
	}}
	reporter := NewWeeklyParentReporter(service, parentReader)
	now := time.Date(2026, 9, 27, 5, 5, 0, 0, time.UTC)
	out, err := reporter.Run(context.Background(), now)
	if err != nil {
		t.Fatal(err)
	}
	if out.ProcessedParents != 2 || out.Sent != 1 || out.SkippedNoActivity != 1 || out.WhatsAppOptIn != 1 {
		t.Fatalf("unexpected weekly result %#v", out)
	}
	if repo.campaign.IdempotencyKey != "weekly-parent-report:2026-09-27:parent-1" {
		t.Fatalf("unexpected idempotency key %q", repo.campaign.IdempotencyKey)
	}
	if len(repo.campaign.Message.Channels) != 2 ||
		repo.campaign.Message.Channels[0] != communication.ChannelInApp ||
		repo.campaign.Message.Channels[1] != communication.ChannelWhatsApp {
		t.Fatalf("unexpected weekly channels %#v", repo.campaign.Message.Channels)
	}
	if repo.campaign.Message.Body == "" || repo.campaign.Message.Body == "سارة" {
		t.Fatalf("unexpected weekly body %q", repo.campaign.Message.Body)
	}
}
