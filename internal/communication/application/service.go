package application

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"time"

	communication "github.com/nasef6464/almeaago/internal/communication/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

var (
	ErrForbidden        = errors.New("notification operation forbidden")
	ErrInvalidInput     = errors.New("invalid notification request")
	ErrAudienceTooLarge = errors.New("notification audience too large")
	ErrNotFound         = communication.ErrNotFound
	ErrConflict         = communication.ErrConflict
)

const (
	MaxCampaignRecipients    = 10000
	campaignAudiencePageSize = 500
)

var templateKeyPattern = regexp.MustCompile("^[A-Za-z0-9_.-]{2,80}$")
var variableNamePattern = regexp.MustCompile("^[A-Za-z0-9_.-]{1,80}$")
var templateVariablePattern = regexp.MustCompile("\\{\\{\\s*([A-Za-z0-9_.-]+)\\s*\\}\\}")

type Repository interface {
	ListTemplates(context.Context, int, int) (communication.TemplatePage, error)
	TemplateByKey(context.Context, string, bool) (communication.Template, error)
	UpsertTemplate(context.Context, string, communication.TemplateWrite) (communication.Template, error)
	CreateCampaign(context.Context, communication.CampaignCommand) (communication.CampaignResult, error)
	ListInbox(context.Context, string, int, int) (communication.DeliveryPage, error)
	UnreadCount(context.Context, string) (int, error)
	MarkRead(context.Context, string, string) (communication.Delivery, error)
	MarkAllRead(context.Context, string) (int64, error)
	ListDeliveries(context.Context, communication.DeliveryFilter) (communication.DeliveryPage, error)
	GetPreferences(context.Context, string) (communication.Preferences, error)
	PreferencesForUsers(context.Context, []string) (map[string]communication.Preferences, error)
	UpdatePreferences(context.Context, string, communication.PreferencesWrite) (communication.Preferences, error)
}

type AudienceResolver interface {
	CountNotificationAudience(context.Context, []string, []identity.Role) (int, error)
	ResolveNotificationAudiencePage(context.Context, []string, []identity.Role, string, int) ([]identity.NotificationRecipient, error)
}

type Service struct {
	repo     Repository
	audience AudienceResolver
	realtime communication.InboxEventPublisher
}

func NewService(repo Repository, audience AudienceResolver) *Service {
	return &Service{repo: repo, audience: audience}
}

func NewServiceWithRealtime(repo Repository, audience AudienceResolver, realtime communication.InboxEventPublisher) *Service {
	return &Service{repo: repo, audience: audience, realtime: realtime}
}

func requireActor(actor identity.User) error {
	if strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	return nil
}

func requireAdmin(actor identity.User) error {
	if requireActor(actor) != nil || !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	return nil
}

func normalizePage(page, limit, maxLimit int) (int, int, error) {
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return 0, 0, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > maxLimit {
		limit = maxLimit
	}
	return page, limit, nil
}

func normalizeTemplateWrite(write communication.TemplateWrite) (communication.TemplateWrite, error) {
	write.Key = strings.TrimSpace(write.Key)
	write.Name = strings.TrimSpace(write.Name)
	write.Subject = strings.TrimSpace(write.Subject)
	write.Title = strings.TrimSpace(write.Title)
	write.Body = strings.TrimSpace(write.Body)
	if !templateKeyPattern.MatchString(write.Key) ||
		len(write.Name) < 2 || len(write.Name) > 160 ||
		!communication.ValidChannel(write.Channel) ||
		len(write.Subject) > 220 ||
		len(write.Title) < 2 || len(write.Title) > 220 ||
		len(write.Body) < 2 || len(write.Body) > 4000 ||
		write.ExpectedRevision < 0 {
		return communication.TemplateWrite{}, ErrInvalidInput
	}

	seen := make(map[string]struct{}, len(write.Variables))
	variables := make([]string, 0, len(write.Variables))
	for _, raw := range write.Variables {
		value := strings.TrimSpace(raw)
		if !variableNamePattern.MatchString(value) {
			return communication.TemplateWrite{}, ErrInvalidInput
		}
		if _, exists := seen[value]; exists {
			continue
		}
		seen[value] = struct{}{}
		variables = append(variables, value)
	}
	if len(variables) > 50 {
		return communication.TemplateWrite{}, ErrInvalidInput
	}
	sort.Strings(variables)
	write.Variables = variables
	return write, nil
}

func (s *Service) AdminTemplates(
	ctx context.Context,
	actor identity.User,
	page, limit int,
) (communication.TemplatePage, error) {
	if requireAdmin(actor) != nil {
		return communication.TemplatePage{}, ErrForbidden
	}
	page, limit, err := normalizePage(page, limit, 100)
	if err != nil {
		return communication.TemplatePage{}, err
	}
	return s.repo.ListTemplates(ctx, page, limit)
}

func (s *Service) UpsertTemplate(
	ctx context.Context,
	actor identity.User,
	write communication.TemplateWrite,
) (communication.Template, error) {
	if requireAdmin(actor) != nil {
		return communication.Template{}, ErrForbidden
	}
	write, err := normalizeTemplateWrite(write)
	if err != nil {
		return communication.Template{}, err
	}
	return s.repo.UpsertTemplate(ctx, actor.ID, write)
}

func normalizeChannels(values []communication.Channel) ([]communication.Channel, error) {
	seen := map[communication.Channel]struct{}{}
	out := make([]communication.Channel, 0, len(values))
	for _, channel := range values {
		if !communication.ValidChannel(channel) {
			return nil, ErrInvalidInput
		}
		if _, exists := seen[channel]; exists {
			continue
		}
		seen[channel] = struct{}{}
		out = append(out, channel)
	}
	if len(out) < 1 || len(out) > 3 {
		return nil, ErrInvalidInput
	}
	return out, nil
}

func normalizeAudience(input communication.CampaignWrite) ([]string, []identity.Role, error) {
	userSeen := map[string]struct{}{}
	userIDs := make([]string, 0, len(input.UserIDs))
	for _, raw := range input.UserIDs {
		value := strings.TrimSpace(raw)
		if value == "" {
			continue
		}
		if len(value) > 120 {
			return nil, nil, ErrInvalidInput
		}
		if _, exists := userSeen[value]; exists {
			continue
		}
		userSeen[value] = struct{}{}
		userIDs = append(userIDs, value)
	}
	roleSeen := map[identity.Role]struct{}{}
	roles := make([]identity.Role, 0, len(input.Roles))
	for _, raw := range input.Roles {
		role := identity.Role(strings.TrimSpace(raw))
		if !identity.ValidRole(role) {
			return nil, nil, ErrInvalidInput
		}
		if _, exists := roleSeen[role]; exists {
			continue
		}
		roleSeen[role] = struct{}{}
		roles = append(roles, role)
	}
	if len(userIDs) == 0 && len(roles) == 0 {
		return nil, nil, ErrInvalidInput
	}
	return userIDs, roles, nil
}

func render(source string, variables map[string]any) (string, error) {
	if len(variables) > 100 {
		return "", ErrInvalidInput
	}
	values := make(map[string]string, len(variables))
	for key, value := range variables {
		if !variableNamePattern.MatchString(key) {
			return "", ErrInvalidInput
		}
		switch typed := value.(type) {
		case nil:
			values[key] = ""
		case string:
			values[key] = typed
		case float64, bool:
			values[key] = fmt.Sprint(typed)
		default:
			return "", ErrInvalidInput
		}
	}
	rendered := templateVariablePattern.ReplaceAllStringFunc(source, func(match string) string {
		parts := templateVariablePattern.FindStringSubmatch(match)
		if len(parts) != 2 {
			return ""
		}
		return values[parts[1]]
	})
	return strings.TrimSpace(rendered), nil
}

func (s *Service) resolveMessage(
	ctx context.Context,
	input communication.CampaignWrite,
	channels []communication.Channel,
) (communication.CampaignMessage, error) {
	var template communication.Template
	var err error
	if strings.TrimSpace(input.TemplateKey) != "" {
		template, err = s.repo.TemplateByKey(ctx, strings.TrimSpace(input.TemplateKey), true)
		if err != nil {
			return communication.CampaignMessage{}, err
		}
	}

	title := strings.TrimSpace(input.Title)
	subject := strings.TrimSpace(input.Subject)
	body := strings.TrimSpace(input.Body)
	if title == "" {
		title = template.Title
	}
	if subject == "" {
		subject = template.Subject
	}
	if subject == "" {
		subject = title
	}
	if body == "" {
		body = template.Body
	}

	title, err = render(title, input.Variables)
	if err != nil {
		return communication.CampaignMessage{}, err
	}
	subject, err = render(subject, input.Variables)
	if err != nil {
		return communication.CampaignMessage{}, err
	}
	body, err = render(body, input.Variables)
	if err != nil {
		return communication.CampaignMessage{}, err
	}
	if len(title) < 2 || len(title) > 220 || len(subject) > 220 || len(body) < 2 || len(body) > 4000 {
		return communication.CampaignMessage{}, ErrInvalidInput
	}

	return communication.CampaignMessage{
		TemplateID: template.ID, TemplateKey: template.Key,
		Title: title, Subject: subject, Body: body, Channels: channels,
	}, nil
}

func (s *Service) resolveAudience(
	ctx context.Context,
	userIDs []string,
	roles []identity.Role,
) ([]identity.NotificationRecipient, error) {
	total, err := s.audience.CountNotificationAudience(ctx, userIDs, roles)
	if err != nil {
		return nil, err
	}
	if total > MaxCampaignRecipients {
		return nil, ErrAudienceTooLarge
	}
	if total == 0 {
		return []identity.NotificationRecipient{}, nil
	}

	out := make([]identity.NotificationRecipient, 0, total)
	afterID := ""
	for len(out) < total {
		remaining := total - len(out)
		limit := campaignAudiencePageSize
		if remaining < limit {
			limit = remaining
		}
		page, pageErr := s.audience.ResolveNotificationAudiencePage(ctx, userIDs, roles, afterID, limit)
		if pageErr != nil {
			return nil, pageErr
		}
		if len(page) == 0 {
			break
		}
		out = append(out, page...)
		afterID = page[len(page)-1].ID
	}
	if len(out) != total {
		return nil, errors.New("notification audience changed during resolution")
	}
	return out, nil
}

func hasChannel(channels []communication.Channel, target communication.Channel) bool {
	for _, channel := range channels {
		if channel == target {
			return true
		}
	}
	return false
}

func (s *Service) publishInboxRefreshes(
	ctx context.Context,
	campaignID string,
	recipients []identity.NotificationRecipient,
) {
	if s.realtime == nil || len(recipients) == 0 {
		return
	}
	now := time.Now().UTC()
	events := make([]communication.InboxEvent, 0, len(recipients))
	for _, recipient := range recipients {
		events = append(events, communication.InboxEvent{
			Type: "refresh", UserID: recipient.ID, CampaignID: campaignID, At: now,
		})
	}
	if batch, ok := s.realtime.(communication.InboxEventBatchPublisher); ok {
		_ = batch.PublishBatch(ctx, events)
		return
	}
	for _, event := range events {
		_ = s.realtime.Publish(ctx, event)
	}
}

func (s *Service) sendCampaign(
	ctx context.Context,
	actorID string,
	input communication.CampaignWrite,
	idempotencyKey string,
) (communication.CampaignResult, error) {
	if s.audience == nil {
		return communication.CampaignResult{}, errors.New("notification audience resolver is not configured")
	}
	channels, err := normalizeChannels(input.Channels)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	userIDs, roles, err := normalizeAudience(input)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	message, err := s.resolveMessage(ctx, input, channels)
	if err != nil {
		return communication.CampaignResult{}, err
	}

	recipients, err := s.resolveAudience(ctx, userIDs, roles)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	command := communication.CampaignCommand{
		ActorUserID:    actorID,
		IdempotencyKey: strings.TrimSpace(idempotencyKey),
		Message:        message,
		Recipients:     make([]communication.CampaignRecipient, 0, len(recipients)),
	}
	for _, recipient := range recipients {
		command.Recipients = append(command.Recipients, communication.CampaignRecipient{
			UserID: recipient.ID, Email: recipient.Email, Phone: recipient.Phone, Name: recipient.Name,
		})
	}
	out, err := s.repo.CreateCampaign(ctx, command)
	if err != nil {
		return communication.CampaignResult{}, err
	}
	if !out.Reused && hasChannel(channels, communication.ChannelInApp) {
		s.publishInboxRefreshes(ctx, out.CampaignID, recipients)
	}
	return out, nil
}

func (s *Service) SendCampaign(
	ctx context.Context,
	actor identity.User,
	input communication.CampaignWrite,
) (communication.CampaignResult, error) {
	if requireAdmin(actor) != nil {
		return communication.CampaignResult{}, ErrForbidden
	}
	return s.sendCampaign(ctx, actor.ID, input, "")
}

func (s *Service) SendSystemCampaign(
	ctx context.Context,
	idempotencyKey string,
	input communication.CampaignWrite,
) (communication.CampaignResult, error) {
	if strings.TrimSpace(idempotencyKey) == "" {
		return communication.CampaignResult{}, ErrInvalidInput
	}
	return s.sendCampaign(ctx, "", input, idempotencyKey)
}

func (s *Service) Preferences(ctx context.Context, actor identity.User) (communication.Preferences, error) {
	if requireActor(actor) != nil {
		return communication.Preferences{}, ErrForbidden
	}
	return s.repo.GetPreferences(ctx, actor.ID)
}

func (s *Service) PreferencesForUser(ctx context.Context, userID string) (communication.Preferences, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return communication.Preferences{}, ErrInvalidInput
	}
	return s.repo.GetPreferences(ctx, userID)
}

func (s *Service) UpdatePreferences(
	ctx context.Context,
	actor identity.User,
	write communication.PreferencesWrite,
) (communication.Preferences, error) {
	if requireActor(actor) != nil || !actor.HasRole(identity.RoleParent) {
		return communication.Preferences{}, ErrForbidden
	}
	if write.ExpectedRevision < 0 {
		return communication.Preferences{}, ErrInvalidInput
	}
	return s.repo.UpdatePreferences(ctx, actor.ID, write)
}

func (s *Service) Inbox(
	ctx context.Context,
	actor identity.User,
	page, limit int,
) (communication.DeliveryPage, error) {
	if requireActor(actor) != nil {
		return communication.DeliveryPage{}, ErrForbidden
	}
	page, limit, err := normalizePage(page, limit, 100)
	if err != nil {
		return communication.DeliveryPage{}, err
	}
	return s.repo.ListInbox(ctx, actor.ID, page, limit)
}

func (s *Service) UnreadCount(ctx context.Context, actor identity.User) (int, error) {
	if requireActor(actor) != nil {
		return 0, ErrForbidden
	}
	return s.repo.UnreadCount(ctx, actor.ID)
}

func (s *Service) MarkRead(
	ctx context.Context,
	actor identity.User,
	deliveryID string,
) (communication.Delivery, error) {
	if requireActor(actor) != nil {
		return communication.Delivery{}, ErrForbidden
	}
	if strings.TrimSpace(deliveryID) == "" {
		return communication.Delivery{}, ErrInvalidInput
	}
	return s.repo.MarkRead(ctx, actor.ID, deliveryID)
}

func (s *Service) MarkAllRead(ctx context.Context, actor identity.User) (int64, error) {
	if requireActor(actor) != nil {
		return 0, ErrForbidden
	}
	return s.repo.MarkAllRead(ctx, actor.ID)
}

func (s *Service) AdminDeliveries(
	ctx context.Context,
	actor identity.User,
	filter communication.DeliveryFilter,
) (communication.DeliveryPage, error) {
	if requireAdmin(actor) != nil {
		return communication.DeliveryPage{}, ErrForbidden
	}
	page, limit, err := normalizePage(filter.Page, filter.Limit, 100)
	if err != nil {
		return communication.DeliveryPage{}, err
	}
	filter.Page, filter.Limit = page, limit
	if filter.Status != "" && !communication.ValidDeliveryStatus(filter.Status) {
		return communication.DeliveryPage{}, ErrInvalidInput
	}
	if filter.Channel != "" && !communication.ValidChannel(filter.Channel) {
		return communication.DeliveryPage{}, ErrInvalidInput
	}
	return s.repo.ListDeliveries(ctx, filter)
}
