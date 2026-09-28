package application

import (
	"context"
	"errors"
	"fmt"
	"math"
	"strings"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	parents "github.com/nasef6464/almeaago/internal/parents/domain"
)

const weeklyParentBatchSize = 100

type WeeklyParentReportReader interface {
	WeeklyReportsForParents(context.Context, []string, time.Time) (map[string]parents.WeeklyReport, error)
}

type WeeklyParentReportResult struct {
	ExecutionKey      string `json:"executionKey"`
	ProcessedParents  int    `json:"processedParents"`
	Sent              int    `json:"sent"`
	Reused            int    `json:"reused"`
	SkippedNoLinks    int    `json:"skippedNoLinks"`
	SkippedNoActivity int    `json:"skippedNoActivity"`
	WhatsAppOptIn     int    `json:"whatsappOptIn"`
	Failed            int    `json:"failed"`
}

type WeeklyParentReporter struct {
	communication *Service
	parents       WeeklyParentReportReader
}

func NewWeeklyParentReporter(communicationService *Service, parentReader WeeklyParentReportReader) *WeeklyParentReporter {
	return &WeeklyParentReporter{communication: communicationService, parents: parentReader}
}

func riyadhZone() *time.Location {
	return time.FixedZone("Asia/Riyadh", 3*60*60)
}

func WeeklyParentReportExecutionKey(now time.Time) string {
	local := now.In(riyadhZone())
	daysSinceSunday := int(local.Weekday())
	sunday := time.Date(local.Year(), local.Month(), local.Day()-daysSinceSunday, 0, 0, 0, 0, local.Location())
	return "weekly-parent-report:" + sunday.Format("2006-01-02")
}

func ShouldRunWeeklyParentReport(now time.Time) (string, bool) {
	local := now.In(riyadhZone())
	return WeeklyParentReportExecutionKey(now), local.Weekday() == time.Sunday && local.Hour() == 8
}

func weeklyReportHasActivity(report parents.WeeklyReport) bool {
	for _, child := range report.Children {
		if child.AssessmentCount > 0 {
			return true
		}
	}
	return false
}

func weeklyParentReportBody(report parents.WeeklyReport) string {
	lines := []string{"ملخص الأسبوع لأبنائك:"}
	for _, child := range report.Children {
		if child.AssessmentCount == 0 {
			continue
		}
		line := fmt.Sprintf(
			"%s: %d اختبار · متوسط %d%%",
			child.Name,
			child.AssessmentCount,
			int(math.Round(child.AverageScore)),
		)
		if len(child.WeakSkills) > 0 {
			line += " · أولوية: " + child.WeakSkills[0].SkillName
		}
		if strings.TrimSpace(child.NextAction) != "" {
			line += " · الخطوة التالية: " + strings.TrimSpace(child.NextAction)
		}
		lines = append(lines, line)
		if len(lines) >= 4 {
			break
		}
	}
	return strings.Join(lines, "\n")
}

func (r *WeeklyParentReporter) send(
	ctx context.Context,
	key string,
	recipient identity.NotificationRecipient,
	report parents.WeeklyReport,
	preference communication.Preferences,
) (communication.CampaignResult, error) {
	channels := []communication.Channel{communication.ChannelInApp}
	if preference.ParentWhatsAppDigestEnabled && strings.TrimSpace(recipient.Phone) != "" {
		channels = append(channels, communication.ChannelWhatsApp)
	}
	input := communication.CampaignWrite{
		Title:    "📋 تقريرك الأسبوعي عن أداء أبنائك",
		Subject:  "تقرير ALMEAA الأسبوعي",
		Body:     weeklyParentReportBody(report),
		Channels: channels,
		UserIDs:  []string{recipient.ID},
	}
	message, err := r.communication.resolveMessage(ctx, input, channels)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	command := communication.CampaignCommand{
		IdempotencyKey: key,
		Message:        message,
		Recipients: []communication.CampaignRecipient{{
			UserID: recipient.ID,
			Email:  recipient.Email,
			Phone:  recipient.Phone,
			Name:   recipient.Name,
		}},
	}
	out, err := r.communication.repo.CreateCampaign(ctx, command)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	if !out.Reused {
		r.communication.publishInboxRefreshes(
			ctx,
			out.CampaignID,
			[]identity.NotificationRecipient{recipient},
		)
	}
	return out, nil
}

func (r *WeeklyParentReporter) Run(ctx context.Context, now time.Time) (WeeklyParentReportResult, error) {
	key := WeeklyParentReportExecutionKey(now)
	result := WeeklyParentReportResult{ExecutionKey: key}
	if r == nil || r.communication == nil || r.parents == nil || r.communication.audience == nil {
		return result, errors.New("weekly parent reporter is not configured")
	}
	total, err := r.communication.audience.CountNotificationAudience(ctx, nil, []identity.Role{identity.RoleParent})
	if err != nil {
		return result, err
	}
	if total > MaxCampaignRecipients {
		return result, ErrAudienceTooLarge
	}
	afterID := ""
	for processed := 0; processed < total; {
		limit := weeklyParentBatchSize
		if remaining := total - processed; remaining < limit {
			limit = remaining
		}
		recipients, pageErr := r.communication.audience.ResolveNotificationAudiencePage(
			ctx, nil, []identity.Role{identity.RoleParent}, afterID, limit,
		)
		if pageErr != nil {
			return result, pageErr
		}
		if len(recipients) == 0 {
			break
		}
		parentIDs := make([]string, 0, len(recipients))
		for _, recipient := range recipients {
			parentIDs = append(parentIDs, recipient.ID)
		}
		reports, pageErr := r.parents.WeeklyReportsForParents(ctx, parentIDs, now.UTC())
		if pageErr != nil {
			return result, pageErr
		}
		preferences, pageErr := r.communication.repo.PreferencesForUsers(ctx, parentIDs)
		if pageErr != nil {
			return result, pageErr
		}
		for _, recipient := range recipients {
			result.ProcessedParents++
			report := reports[recipient.ID]
			if len(report.Children) == 0 {
				result.SkippedNoLinks++
				continue
			}
			if !weeklyReportHasActivity(report) {
				result.SkippedNoActivity++
				continue
			}
			preference := preferences[recipient.ID]
			if preference.ParentWhatsAppDigestEnabled && strings.TrimSpace(recipient.Phone) != "" {
				result.WhatsAppOptIn++
			}
			out, sendErr := r.send(ctx, key+":"+recipient.ID, recipient, report, preference)
			if sendErr != nil {
				result.Failed++
				continue
			}
			if out.Reused {
				result.Reused++
			} else {
				result.Sent++
			}
		}
		processed += len(recipients)
		afterID = recipients[len(recipients)-1].ID
	}
	if result.Failed > 0 {
		return result, fmt.Errorf("weekly parent report partial failure: %d", result.Failed)
	}
	return result, nil
}
