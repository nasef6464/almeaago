package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"sync"
	"time"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var (
	ErrForbidden    = errors.New("ai operation forbidden")
	ErrInvalidInput = errors.New("invalid ai input")
	ErrUnavailable  = errors.New("ai provider unavailable")
	ErrNotFound     = ai.ErrNotFound
	ErrConflict     = ai.ErrConflict
)

const (
	PromptVersionQuestionTutor = "question_tutor.v1"
	CapabilityQuestionTutor    = "question_tutor"
)

type Repository interface {
	ListProviderSettings(context.Context) ([]ai.ProviderSetting, error)
	ProviderSetting(context.Context, ai.Provider) (ai.ProviderSetting, error)
	UpdateProviderSetting(context.Context, string, ai.Provider, ai.ProviderSettingWrite) (ai.ProviderSetting, error)
	RecordProviderSuccess(context.Context, ai.Provider, time.Time) error
	RecordProviderFailure(context.Context, ai.Provider, string, *time.Time, time.Time) error
	CacheEntry(context.Context, string, time.Time) (ai.CacheEntry, error)
	PutCacheEntry(context.Context, ai.CacheEntry) error
	InsertInteraction(context.Context, ai.Interaction) error
	ListInteractions(context.Context, int, int) (ai.InteractionPage, error)
	CountQuestionAssistSince(context.Context, string, time.Time) (int, error)
}

type LearningReader interface {
	GetReviewCard(context.Context, string, string) (learning.ReviewCard, error)
}

type QuestionReader interface {
	ReviewBatch(context.Context, []question.ReviewRef) ([]question.ReviewProjection, error)
}

type ProviderClient interface {
	SecretConfigured(ai.Provider) bool
	Call(context.Context, ai.ProviderSetting, string) (ai.ProviderCallResult, error)
}

type Config struct {
	CacheTTL        time.Duration
	InteractionTTL  time.Duration
	CircuitOpenFor  time.Duration
	PerMinuteLimit  int
	MaxOutputTokens int
}

type Service struct {
	repo      Repository
	learning  LearningReader
	questions QuestionReader
	providers ProviderClient
	cfg       Config
	now       func() time.Time

	mu      sync.Mutex
	flights map[string]*assistFlight
}

type assistFlight struct {
	done chan struct{}
	out  ai.QuestionAssistResult
	err  error
}

func NewService(
	repo Repository,
	learningReader LearningReader,
	questionReader QuestionReader,
	providers ProviderClient,
	cfg Config,
) *Service {
	if cfg.CacheTTL <= 0 {
		cfg.CacheTTL = 30 * time.Minute
	}
	if cfg.InteractionTTL <= 0 {
		cfg.InteractionTTL = 30 * 24 * time.Hour
	}
	if cfg.CircuitOpenFor <= 0 {
		cfg.CircuitOpenFor = time.Minute
	}
	if cfg.PerMinuteLimit <= 0 {
		cfg.PerMinuteLimit = 8
	}
	if cfg.MaxOutputTokens <= 0 {
		cfg.MaxOutputTokens = 450
	}
	if cfg.MaxOutputTokens > 2000 {
		cfg.MaxOutputTokens = 2000
	}
	return &Service{
		repo:      repo,
		learning:  learningReader,
		questions: questionReader,
		providers: providers,
		cfg:       cfg,
		now:       time.Now,
		flights:   map[string]*assistFlight{},
	}
}

func normalizePage(page, limit int) (int, int, error) {
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return 0, 0, ErrInvalidInput
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return page, limit, nil
}

func (s *Service) AdminProviders(
	ctx context.Context,
	actor identity.User,
) ([]ai.ProviderSetting, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	rows, err := s.repo.ListProviderSettings(ctx)
	if err != nil {
		return nil, err
	}
	for i := range rows {
		rows[i].SecretConfigured = s.providers != nil && s.providers.SecretConfigured(rows[i].Provider)
	}
	return rows, nil
}

func allowedBaseURL(provider ai.Provider, raw string) bool {
	raw = strings.TrimSuffix(strings.TrimSpace(raw), "/")
	if provider == ai.ProviderOllama || provider == ai.ProviderLMStudio {
		return raw == ""
	}
	allowed := map[ai.Provider]string{
		ai.ProviderGemini:     "https://generativelanguage.googleapis.com",
		ai.ProviderOpenRouter: "https://openrouter.ai/api/v1",
		ai.ProviderQwen:       "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
		ai.ProviderDeepSeek:   "https://api.deepseek.com",
		ai.ProviderOpenAI:     "https://api.openai.com/v1",
	}
	expected, ok := allowed[provider]
	return ok && (raw == "" || raw == expected)
}

func (s *Service) UpdateProvider(
	ctx context.Context,
	actor identity.User,
	provider ai.Provider,
	write ai.ProviderSettingWrite,
) (ai.ProviderSetting, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return ai.ProviderSetting{}, ErrForbidden
	}
	write.Model = strings.TrimSpace(write.Model)
	write.BaseURL = strings.TrimSuffix(strings.TrimSpace(write.BaseURL), "/")
	if !ai.ValidProvider(provider) ||
		len(write.Model) < 1 || len(write.Model) > 200 ||
		write.Priority < 1 || write.Priority > 1000 ||
		write.MaxOutputTokens < 64 || write.MaxOutputTokens > 2000 ||
		write.ExpectedRevision < 1 ||
		!allowedBaseURL(provider, write.BaseURL) {
		return ai.ProviderSetting{}, ErrInvalidInput
	}
	out, err := s.repo.UpdateProviderSetting(ctx, actor.ID, provider, write)
	if err != nil {
		return ai.ProviderSetting{}, err
	}
	out.SecretConfigured = s.providers != nil && s.providers.SecretConfigured(provider)
	return out, nil
}

func (s *Service) TestProvider(
	ctx context.Context,
	actor identity.User,
	provider ai.Provider,
) (ai.ProviderResponse, error) {
	if !actor.HasRole(identity.RoleAdmin) || !ai.ValidProvider(provider) {
		return ai.ProviderResponse{}, ErrForbidden
	}
	if s.providers == nil {
		return ai.ProviderResponse{}, ErrUnavailable
	}
	setting, err := s.repo.ProviderSetting(ctx, provider)
	if err != nil {
		return ai.ProviderResponse{}, err
	}
	if !s.providers.SecretConfigured(provider) {
		return ai.ProviderResponse{}, ErrUnavailable
	}
	started := time.Now()
	result, callErr := s.providers.Call(ctx, setting, "أجب بكلمة OK فقط.")
	latency := int(time.Since(started).Milliseconds())
	now := s.now().UTC()
	if callErr != nil {
		_ = s.recordProviderFailure(ctx, setting, callErr, now)
		_ = s.repo.InsertInteraction(ctx, ai.Interaction{
			UserID: actor.ID, Audience: "admin", Endpoint: "/ai/admin/providers/test",
			Capability: "provider_health", Provider: provider, Model: setting.Model,
			Status: ai.InteractionError, ErrorCategory: errorCategory(callErr),
			LatencyMS: latency, ResponseLength: 0,
			RetentionUntil: timePtr(now.Add(s.cfg.InteractionTTL)),
			Metadata:       map[string]any{"manualTest": true},
		})
		return ai.ProviderResponse{}, ErrUnavailable
	}
	_ = s.repo.RecordProviderSuccess(ctx, provider, now)
	text := truncate(strings.TrimSpace(result.Text), 4000)
	_ = s.repo.InsertInteraction(ctx, ai.Interaction{
		UserID: actor.ID, Audience: "admin", Endpoint: "/ai/admin/providers/test",
		Capability: "provider_health", Provider: provider, Model: firstNonEmpty(result.Model, setting.Model),
		Status: ai.InteractionSuccess, LatencyMS: latency,
		InputTokens: result.Usage.InputTokens, OutputTokens: result.Usage.OutputTokens,
		TotalTokens: result.Usage.TotalTokens, UsageEstimated: result.Usage.Estimated,
		ResponseLength: len([]rune(text)), RetentionUntil: timePtr(now.Add(s.cfg.InteractionTTL)),
		Metadata: map[string]any{"manualTest": true},
	})
	return ai.ProviderResponse{
		Text: text, Provider: provider, Model: firstNonEmpty(result.Model, setting.Model), Usage: result.Usage,
	}, nil
}

func (s *Service) AdminInteractions(
	ctx context.Context,
	actor identity.User,
	page, limit int,
) (ai.InteractionPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return ai.InteractionPage{}, ErrForbidden
	}
	page, limit, err := normalizePage(page, limit)
	if err != nil {
		return ai.InteractionPage{}, err
	}
	return s.repo.ListInteractions(ctx, page, limit)
}

func (s *Service) QuestionAssist(
	ctx context.Context,
	actor identity.User,
	input ai.QuestionAssistInput,
) (ai.QuestionAssistResult, error) {
	if !actor.HasRole(identity.RoleStudent) || s.learning == nil || s.questions == nil {
		return ai.QuestionAssistResult{}, ErrForbidden
	}
	input.ReviewCardID = strings.TrimSpace(input.ReviewCardID)
	input.Message = strings.TrimSpace(input.Message)
	if input.ReviewCardID == "" || !ai.ValidHelpLevel(input.HelpLevel) || len([]rune(input.Message)) > 500 {
		return ai.QuestionAssistResult{}, ErrInvalidInput
	}
	card, err := s.learning.GetReviewCard(ctx, actor.ID, input.ReviewCardID)
	if err != nil {
		if errors.Is(err, learning.ErrNotFound) {
			return ai.QuestionAssistResult{}, ErrNotFound
		}
		return ai.QuestionAssistResult{}, err
	}
	rows, err := s.questions.ReviewBatch(ctx, []question.ReviewRef{{
		QuestionID: card.QuestionID, Version: card.QuestionVersion,
	}})
	if err != nil {
		return ai.QuestionAssistResult{}, err
	}
	if len(rows) != 1 {
		return ai.QuestionAssistResult{}, ErrNotFound
	}
	q := rows[0]
	now := s.now().UTC()
	cacheKey := buildCacheKey(actor.ID, card, input)
	cached, cacheErr := s.repo.CacheEntry(ctx, cacheKey, now)
	if cacheErr == nil {
		out := ai.QuestionAssistResult{
			Text: cached.ResponseText, HelpLevel: input.HelpLevel,
			Provider: cached.Provider, Model: cached.Model,
			UsedFallback: cached.Provider == ai.ProviderNone, CacheHit: true,
			PromptVersion: cached.PromptVersion,
		}
		_ = s.recordInteraction(ctx, actor, card, input, out, 0, ai.ProviderUsage{}, "")
		return out, nil
	}
	if !errors.Is(cacheErr, ai.ErrNotFound) {
		return ai.QuestionAssistResult{}, cacheErr
	}
	count, err := s.repo.CountQuestionAssistSince(ctx, actor.ID, now.Add(-time.Minute))
	if err != nil {
		return ai.QuestionAssistResult{}, err
	}
	if count >= s.cfg.PerMinuteLimit {
		out := ai.QuestionAssistResult{
			Text:          truncate("تم الوصول إلى حد المحاولات القصير للمساعد. استخدم الشرح الموثوق الحالي ثم أعد المحاولة بعد قليل.\n\n"+trustedFallback(q, input.HelpLevel), 4000),
			HelpLevel:     input.HelpLevel,
			Provider:      ai.ProviderNone,
			Model:         "trusted-fallback",
			UsedFallback:  true,
			CacheHit:      false,
			PromptVersion: PromptVersionQuestionTutor,
		}
		_ = s.recordInteraction(ctx, actor, card, input, out, 0, ai.ProviderUsage{}, "rate_limited")
		return out, nil
	}

	return s.doSingleFlight(ctx, cacheKey, func() (ai.QuestionAssistResult, error) {
		second, secondErr := s.repo.CacheEntry(ctx, cacheKey, s.now().UTC())
		if secondErr == nil {
			return ai.QuestionAssistResult{
				Text: second.ResponseText, HelpLevel: input.HelpLevel,
				Provider: second.Provider, Model: second.Model,
				UsedFallback: second.Provider == ai.ProviderNone, CacheHit: true,
				PromptVersion: second.PromptVersion,
			}, nil
		}
		if !errors.Is(secondErr, ai.ErrNotFound) {
			return ai.QuestionAssistResult{}, secondErr
		}
		return s.generateQuestionAssist(ctx, actor, card, q, input, cacheKey)
	})
}

func (s *Service) generateQuestionAssist(
	ctx context.Context,
	actor identity.User,
	card learning.ReviewCard,
	q question.ReviewProjection,
	input ai.QuestionAssistInput,
	cacheKey string,
) (ai.QuestionAssistResult, error) {
	prompt := buildQuestionPrompt(card, q, input)
	fallback := trustedFallback(q, input.HelpLevel)
	started := time.Now()
	now := s.now().UTC()
	providerResponse, providerErr := s.callProviderChain(ctx, prompt)
	latency := int(time.Since(started).Milliseconds())

	out := ai.QuestionAssistResult{
		HelpLevel:     input.HelpLevel,
		Provider:      ai.ProviderNone,
		Model:         "trusted-fallback",
		UsedFallback:  true,
		CacheHit:      false,
		PromptVersion: PromptVersionQuestionTutor,
	}
	usage := ai.ProviderUsage{}
	errorName := ""
	ttl := minDuration(2*time.Minute, s.cfg.CacheTTL)
	if providerErr == nil && strings.TrimSpace(providerResponse.Text) != "" {
		out.Text = truncate(strings.TrimSpace(providerResponse.Text), 4000)
		out.Provider = providerResponse.Provider
		out.Model = providerResponse.Model
		out.UsedFallback = false
		usage = providerResponse.Usage
		ttl = s.cfg.CacheTTL
	} else {
		out.Text = truncate(strings.TrimSpace(fallback), 4000)
		errorName = errorCategory(providerErr)
		if out.Text == "" {
			out.Text = "استخدم التلميح الموجود في السؤال وحاول تقسيم الحل إلى خطوة صغيرة واحدة قبل إعادة المحاولة."
		}
	}

	if err := s.repo.PutCacheEntry(ctx, ai.CacheEntry{
		CacheKey:        cacheKey,
		UserID:          actor.ID,
		ReviewCardID:    card.ID,
		QuestionID:      card.QuestionID,
		QuestionVersion: card.QuestionVersion,
		HelpLevel:       input.HelpLevel,
		PromptVersion:   PromptVersionQuestionTutor,
		ResponseText:    out.Text,
		Provider:        out.Provider,
		Model:           out.Model,
		ExpiresAt:       now.Add(ttl),
	}); err != nil {
		return ai.QuestionAssistResult{}, err
	}
	_ = s.recordInteraction(ctx, actor, card, input, out, latency, usage, errorName)
	return out, nil
}

func (s *Service) callProviderChain(
	ctx context.Context,
	prompt string,
) (ai.ProviderResponse, error) {
	if s.providers == nil {
		return ai.ProviderResponse{}, ErrUnavailable
	}
	settings, err := s.repo.ListProviderSettings(ctx)
	if err != nil {
		return ai.ProviderResponse{}, err
	}
	now := s.now().UTC()
	var errorsSeen []string
	for _, setting := range settings {
		if !setting.Enabled || !s.providers.SecretConfigured(setting.Provider) {
			continue
		}
		if setting.Health.OpenUntil != nil && setting.Health.OpenUntil.After(now) {
			errorsSeen = append(errorsSeen, string(setting.Provider)+":circuit_open")
			continue
		}
		if setting.MaxOutputTokens > s.cfg.MaxOutputTokens {
			setting.MaxOutputTokens = s.cfg.MaxOutputTokens
		}
		result, callErr := s.providers.Call(ctx, setting, prompt)
		if callErr != nil {
			errorsSeen = append(errorsSeen, string(setting.Provider)+":"+errorCategory(callErr))
			_ = s.recordProviderFailure(ctx, setting, callErr, now)
			continue
		}
		if strings.TrimSpace(result.Text) == "" {
			errorsSeen = append(errorsSeen, string(setting.Provider)+":empty_response")
			_ = s.recordProviderFailure(ctx, setting, errors.New("provider_empty_response"), now)
			continue
		}
		_ = s.repo.RecordProviderSuccess(ctx, setting.Provider, now)
		return ai.ProviderResponse{
			Text:     result.Text,
			Provider: setting.Provider,
			Model:    firstNonEmpty(result.Model, setting.Model),
			Usage:    result.Usage,
		}, nil
	}
	if len(errorsSeen) == 0 {
		return ai.ProviderResponse{}, ErrUnavailable
	}
	return ai.ProviderResponse{}, fmt.Errorf("provider_chain_failed:%s", strings.Join(errorsSeen, "|"))
}

func (s *Service) recordProviderFailure(
	ctx context.Context,
	setting ai.ProviderSetting,
	callErr error,
	now time.Time,
) error {
	nextFailures := setting.Health.ConsecutiveFailures + 1
	var openUntil *time.Time
	if nextFailures >= 3 {
		value := now.Add(s.cfg.CircuitOpenFor)
		openUntil = &value
	}
	return s.repo.RecordProviderFailure(ctx, setting.Provider, errorCategory(callErr), openUntil, now)
}

func (s *Service) recordInteraction(
	ctx context.Context,
	actor identity.User,
	card learning.ReviewCard,
	input ai.QuestionAssistInput,
	out ai.QuestionAssistResult,
	latency int,
	usage ai.ProviderUsage,
	errorName string,
) error {
	status := ai.InteractionSuccess
	if out.UsedFallback {
		status = ai.InteractionFallback
	}
	now := s.now().UTC()
	return s.repo.InsertInteraction(ctx, ai.Interaction{
		UserID:          actor.ID,
		Audience:        "student",
		Endpoint:        "/ai/question-assistant",
		Capability:      CapabilityQuestionTutor,
		Provider:        out.Provider,
		Model:           out.Model,
		Status:          status,
		UsedFallback:    out.UsedFallback,
		CacheHit:        out.CacheHit,
		QuestionID:      card.QuestionID,
		QuestionVersion: card.QuestionVersion,
		ReviewCardID:    card.ID,
		PromptVersion:   out.PromptVersion,
		LatencyMS:       latency,
		InputTokens:     usage.InputTokens,
		OutputTokens:    usage.OutputTokens,
		TotalTokens:     usage.TotalTokens,
		UsageEstimated:  usage.Estimated,
		ResponseLength:  len([]rune(out.Text)),
		ErrorCategory:   errorName,
		Metadata: map[string]any{
			"helpLevel":       input.HelpLevel,
			"messageProvided": input.Message != "",
		},
		RetentionUntil: timePtr(now.Add(s.cfg.InteractionTTL)),
	})
}

func buildQuestionPrompt(
	card learning.ReviewCard,
	q question.ReviewProjection,
	input ai.QuestionAssistInput,
) string {
	options := make([]string, 0, len(q.Options))
	for _, option := range q.Options {
		options = append(options, fmt.Sprintf("%d) %s", option.Index+1, truncate(strings.TrimSpace(option.Text), 500)))
	}
	parts := []string{
		"أنت مساعد تعليمي عربي. ساعد الطالب على الفهم ولا تدّعِ أن إجابتك جزء من الدرجة أو من حقيقة الإتقان.",
		"لا تطلب أو تعرض تاريخ الطالب الكامل. استخدم سياق السؤال الموثوق أدناه فقط.",
		"لا تذكر رقم الخيار الصحيح مباشرة. قدّم مساعدة تدريجية تناسب مستوى الطلب.",
		"معرف السؤال: " + card.QuestionID,
		"نسخة السؤال: " + fmt.Sprint(card.QuestionVersion),
		"نص السؤال: " + truncate(strings.TrimSpace(q.TextContent), 5000),
	}
	if len(options) > 0 {
		parts = append(parts, "الخيارات:\n"+strings.Join(options, "\n"))
	}
	if strings.TrimSpace(q.Hint) != "" {
		parts = append(parts, "تلميح موثوق: "+truncate(strings.TrimSpace(q.Hint), 1200))
	}
	if strings.TrimSpace(q.SolvingStrategy) != "" {
		parts = append(parts, "استراتيجية موثوقة: "+truncate(strings.TrimSpace(q.SolvingStrategy), 1600))
	}
	if strings.TrimSpace(q.Explanation) != "" {
		parts = append(parts, "شرح موثوق: "+truncate(strings.TrimSpace(q.Explanation), 2200))
	}
	parts = append(parts, "مستوى المساعدة: "+string(input.HelpLevel))
	if input.Message != "" {
		parts = append(parts, "طلب الطالب: "+truncate(input.Message, 500))
	}
	return truncate(strings.Join(parts, "\n\n"), 12000)
}

func trustedFallback(q question.ReviewProjection, level ai.HelpLevel) string {
	hint := strings.TrimSpace(q.Hint)
	strategy := strings.TrimSpace(q.SolvingStrategy)
	explanation := strings.TrimSpace(q.Explanation)
	switch level {
	case ai.HelpHint:
		return firstNonEmpty(hint, strategy, explanation, "ابدأ بتحديد المعطيات وما المطلوب قبل اختيار الإجابة.")
	case ai.HelpStrongerHint:
		return joinNonEmpty("تلميح أقوى:", hint, strategy, explanation)
	case ai.HelpConcept:
		return joinNonEmpty("راجع الفكرة الأساسية المرتبطة بالسؤال:", hint, strategy)
	case ai.HelpSteps:
		return joinNonEmpty("قسّم الحل إلى خطوات:", strategy, explanation, hint)
	case ai.HelpFollowUp:
		return firstNonEmpty(explanation, strategy, hint, "أعد صياغة المعطيات ثم جرّب استبعاد الخيارات غير المتوافقة معها.")
	default:
		return ""
	}
}

func joinNonEmpty(prefix string, values ...string) string {
	out := []string{prefix}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value != "" {
			out = append(out, value)
		}
	}
	if len(out) == 1 {
		return ""
	}
	return strings.Join(out, "\n")
}

func buildCacheKey(
	userID string,
	card learning.ReviewCard,
	input ai.QuestionAssistInput,
) string {
	normalizedMessage := strings.Join(strings.Fields(input.Message), " ")
	raw := strings.Join([]string{
		userID,
		card.ID,
		card.QuestionID,
		fmt.Sprint(card.QuestionVersion),
		string(input.HelpLevel),
		normalizedMessage,
		PromptVersionQuestionTutor,
	}, "|")
	sum := sha256.Sum256([]byte(raw))
	return hex.EncodeToString(sum[:])
}

func (s *Service) doSingleFlight(
	ctx context.Context,
	key string,
	fn func() (ai.QuestionAssistResult, error),
) (ai.QuestionAssistResult, error) {
	s.mu.Lock()
	if existing, ok := s.flights[key]; ok {
		s.mu.Unlock()
		select {
		case <-ctx.Done():
			return ai.QuestionAssistResult{}, ctx.Err()
		case <-existing.done:
			return existing.out, existing.err
		}
	}
	flight := &assistFlight{done: make(chan struct{})}
	s.flights[key] = flight
	s.mu.Unlock()

	flight.out, flight.err = fn()
	close(flight.done)

	s.mu.Lock()
	delete(s.flights, key)
	s.mu.Unlock()
	return flight.out, flight.err
}

func errorCategory(err error) string {
	if err == nil {
		return ""
	}
	raw := strings.ToLower(strings.TrimSpace(err.Error()))
	if len(raw) > 160 {
		raw = raw[:160]
	}
	return raw
}

func truncate(value string, max int) string {
	runes := []rune(value)
	if len(runes) <= max {
		return value
	}
	return string(runes[:max])
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func minDuration(a, b time.Duration) time.Duration {
	if a < b {
		return a
	}
	return b
}

func timePtr(value time.Time) *time.Time {
	return &value
}
