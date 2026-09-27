package application

import (
	"context"
	"errors"
	"strings"
	"sync"
	"testing"
	"time"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type repoStub struct {
	settings      []ai.ProviderSetting
	cache         map[string]ai.CacheEntry
	interactions  []ai.Interaction
	successes     []ai.Provider
	failures      []failureRecord
	updateWrite   ai.ProviderSettingWrite
	updateProvider ai.Provider
	minuteCount    int
}

type failureRecord struct {
	provider ai.Provider
	openUntil *time.Time
	category string
}

func (r *repoStub) ListProviderSettings(context.Context) ([]ai.ProviderSetting, error) {
	return append([]ai.ProviderSetting(nil), r.settings...), nil
}
func (r *repoStub) ProviderSetting(_ context.Context, provider ai.Provider) (ai.ProviderSetting, error) {
	for _, row := range r.settings {
		if row.Provider == provider {
			return row, nil
		}
	}
	return ai.ProviderSetting{}, ai.ErrNotFound
}
func (r *repoStub) UpdateProviderSetting(_ context.Context, _ string, provider ai.Provider, write ai.ProviderSettingWrite) (ai.ProviderSetting, error) {
	r.updateProvider, r.updateWrite = provider, write
	return ai.ProviderSetting{
		Provider: provider, Enabled: write.Enabled, Model: write.Model, BaseURL: write.BaseURL,
		Priority: write.Priority, MaxOutputTokens: write.MaxOutputTokens, Revision: write.ExpectedRevision + 1,
	}, nil
}
func (r *repoStub) RecordProviderSuccess(_ context.Context, provider ai.Provider, _ time.Time) error {
	r.successes = append(r.successes, provider)
	return nil
}
func (r *repoStub) RecordProviderFailure(_ context.Context, provider ai.Provider, category string, openUntil *time.Time, _ time.Time) error {
	r.failures = append(r.failures, failureRecord{provider: provider, openUntil: openUntil, category: category})
	return nil
}
func (r *repoStub) CacheEntry(_ context.Context, key string, now time.Time) (ai.CacheEntry, error) {
	if r.cache == nil {
		return ai.CacheEntry{}, ai.ErrNotFound
	}
	row, ok := r.cache[key]
	if !ok || !row.ExpiresAt.After(now) {
		return ai.CacheEntry{}, ai.ErrNotFound
	}
	return row, nil
}
func (r *repoStub) PutCacheEntry(_ context.Context, row ai.CacheEntry) error {
	if r.cache == nil {
		r.cache = map[string]ai.CacheEntry{}
	}
	r.cache[row.CacheKey] = row
	return nil
}
func (r *repoStub) InsertInteraction(_ context.Context, row ai.Interaction) error {
	r.interactions = append(r.interactions, row)
	return nil
}
func (r *repoStub) ListInteractions(_ context.Context, page, limit int) (ai.InteractionPage, error) {
	return ai.InteractionPage{Items: append([]ai.Interaction(nil), r.interactions...), Page: page, Limit: limit}, nil
}
func (r *repoStub) CountQuestionAssistSince(context.Context, string, time.Time) (int, error) {
	return r.minuteCount, nil
}

type learningStub struct {
	card        learning.ReviewCard
	lastStudent string
	lastCardID  string
	err         error
}

func (l *learningStub) GetReviewCard(_ context.Context, student, cardID string) (learning.ReviewCard, error) {
	l.lastStudent, l.lastCardID = student, cardID
	if l.err != nil {
		return learning.ReviewCard{}, l.err
	}
	return l.card, nil
}

type questionStub struct {
	row  question.ReviewProjection
	refs []question.ReviewRef
	err  error
}

func (q *questionStub) ReviewBatch(_ context.Context, refs []question.ReviewRef) ([]question.ReviewProjection, error) {
	q.refs = append([]question.ReviewRef(nil), refs...)
	if q.err != nil {
		return nil, q.err
	}
	return []question.ReviewProjection{q.row}, nil
}

type providerStub struct {
	configured map[ai.Provider]bool
	results    map[ai.Provider]ai.ProviderCallResult
	errors     map[ai.Provider]error
	calls      []ai.Provider
	prompts    []string
	maxTokens  []int
	mu         sync.Mutex
}

func (p *providerStub) SecretConfigured(provider ai.Provider) bool {
	return p.configured[provider]
}
func (p *providerStub) Call(_ context.Context, setting ai.ProviderSetting, prompt string) (ai.ProviderCallResult, error) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.calls = append(p.calls, setting.Provider)
	p.prompts = append(p.prompts, prompt)
	p.maxTokens = append(p.maxTokens, setting.MaxOutputTokens)
	if err := p.errors[setting.Provider]; err != nil {
		return ai.ProviderCallResult{}, err
	}
	return p.results[setting.Provider], nil
}

func student() identity.User {
	return identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
}
func admin() identity.User {
	return identity.User{ID: "admin-1", Roles: []identity.Role{identity.RoleAdmin}}
}
func reviewCard() learning.ReviewCard {
	return learning.ReviewCard{
		ID: "card-1", QuestionID: "question-1", QuestionVersion: 3,
		PathID: "path-1", SubjectID: "subject-1", HasMistake: true,
	}
}
func reviewQuestion() question.ReviewProjection {
	answer := 1
	return question.ReviewProjection{
		ID: "question-1", Version: 3, QuestionType: question.QuestionMCQ,
		TextContent: "ما ناتج 2 + 2؟",
		CorrectOptionIndex: &answer,
		Hint: "اجمع العددين.", SolvingStrategy: "استخدم الجمع المباشر.",
		Explanation: "اجمع 2 مع 2.",
		Options: []question.Option{{Index: 0, Text: "3"}, {Index: 1, Text: "4"}},
	}
}

func TestQuestionAssistUsesOwnedReviewCardAndProviderWithoutAnswerKey(t *testing.T) {
	repo := &repoStub{settings: []ai.ProviderSetting{{
		Provider: ai.ProviderGemini, Enabled: true, Model: "test-model", Priority: 10, MaxOutputTokens: 800,
	}}}
	learningReader := &learningStub{card: reviewCard()}
	questionReader := &questionStub{row: reviewQuestion()}
	providers := &providerStub{
		configured: map[ai.Provider]bool{ai.ProviderGemini: true},
		results: map[ai.Provider]ai.ProviderCallResult{
			ai.ProviderGemini: {Text: "فكر في عملية الجمع أولًا.", Model: "test-model", Usage: ai.ProviderUsage{TotalTokens: 12}},
		},
		errors: map[ai.Provider]error{},
	}
	service := NewService(repo, learningReader, questionReader, providers, Config{})
	service.now = func() time.Time { return time.Date(2026, 9, 27, 8, 0, 0, 0, time.UTC) }

	out, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "card-1", HelpLevel: ai.HelpHint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if learningReader.lastStudent != "student-1" || learningReader.lastCardID != "card-1" {
		t.Fatalf("review ownership not scoped: student=%q card=%q", learningReader.lastStudent, learningReader.lastCardID)
	}
	if len(questionReader.refs) != 1 || questionReader.refs[0].QuestionID != "question-1" || questionReader.refs[0].Version != 3 {
		t.Fatalf("question version was not pinned: %#v", questionReader.refs)
	}
	if out.Provider != ai.ProviderGemini || out.UsedFallback || out.CacheHit {
		t.Fatalf("unexpected result %#v", out)
	}
	if len(providers.prompts) != 1 {
		t.Fatalf("expected one provider call, got %d", len(providers.prompts))
	}
	if len(providers.maxTokens) != 1 || providers.maxTokens[0] != 450 {
		t.Fatalf("question assistant output cap not enforced: %#v", providers.maxTokens)
	}
	if strings.Contains(providers.prompts[0], "CorrectOptionIndex") || strings.Contains(providers.prompts[0], "الإجابة الصحيحة: 2") {
		t.Fatalf("prompt leaked answer-key metadata: %s", providers.prompts[0])
	}
	if len(repo.interactions) != 1 || repo.interactions[0].Provider != ai.ProviderGemini {
		t.Fatalf("interaction not recorded: %#v", repo.interactions)
	}
}

func TestQuestionAssistFallsBackAndCachesWhenProvidersUnavailable(t *testing.T) {
	repo := &repoStub{settings: []ai.ProviderSetting{{
		Provider: ai.ProviderGemini, Enabled: true, Model: "m", Priority: 10, MaxOutputTokens: 400,
	}}}
	providers := &providerStub{
		configured: map[ai.Provider]bool{ai.ProviderGemini: false},
		results: map[ai.Provider]ai.ProviderCallResult{},
		errors: map[ai.Provider]error{},
	}
	service := NewService(repo, &learningStub{card: reviewCard()}, &questionStub{row: reviewQuestion()}, providers, Config{CacheTTL: 30 * time.Minute})
	service.now = func() time.Time { return time.Date(2026, 9, 27, 8, 0, 0, 0, time.UTC) }

	first, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "card-1", HelpLevel: ai.HelpHint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !first.UsedFallback || first.Provider != ai.ProviderNone || first.Text != "اجمع العددين." {
		t.Fatalf("unexpected fallback %#v", first)
	}
	second, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "card-1", HelpLevel: ai.HelpHint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !second.CacheHit || second.Provider != ai.ProviderNone {
		t.Fatalf("fallback cache not reused %#v", second)
	}
	if len(providers.calls) != 0 {
		t.Fatalf("unconfigured provider was called: %#v", providers.calls)
	}
}

func TestQuestionAssistRejectsForeignReviewCardBeforeProvider(t *testing.T) {
	providers := &providerStub{configured: map[ai.Provider]bool{}, results: map[ai.Provider]ai.ProviderCallResult{}, errors: map[ai.Provider]error{}}
	service := NewService(&repoStub{}, &learningStub{err: learning.ErrNotFound}, &questionStub{}, providers, Config{})

	_, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "foreign-card", HelpLevel: ai.HelpHint,
	})
	if !errors.Is(err, ErrNotFound) {
		t.Fatalf("expected not found, got %v", err)
	}
	if len(providers.calls) != 0 {
		t.Fatal("provider called for unauthorized review card")
	}
}

func TestCircuitOpensOnThirdConsecutiveFailureAndFallsBack(t *testing.T) {
	repo := &repoStub{settings: []ai.ProviderSetting{{
		Provider: ai.ProviderOpenAI, Enabled: true, Model: "m", Priority: 10, MaxOutputTokens: 400,
		Health: ai.ProviderHealth{ConsecutiveFailures: 2},
	}}}
	providers := &providerStub{
		configured: map[ai.Provider]bool{ai.ProviderOpenAI: true},
		results: map[ai.Provider]ai.ProviderCallResult{},
		errors: map[ai.Provider]error{ai.ProviderOpenAI: errors.New("provider_http_429")},
	}
	service := NewService(repo, &learningStub{card: reviewCard()}, &questionStub{row: reviewQuestion()}, providers, Config{CircuitOpenFor: 2 * time.Minute})
	now := time.Date(2026, 9, 27, 8, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return now }

	out, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "card-1", HelpLevel: ai.HelpSteps,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !out.UsedFallback || len(repo.failures) != 1 || repo.failures[0].openUntil == nil {
		t.Fatalf("circuit did not open on third failure: out=%#v failures=%#v", out, repo.failures)
	}
	if !repo.failures[0].openUntil.Equal(now.Add(2 * time.Minute)) {
		t.Fatalf("unexpected circuit deadline %v", repo.failures[0].openUntil)
	}
}

func TestAdminProviderUpdateGuardsRoleAndBaseURL(t *testing.T) {
	repo := &repoStub{}
	service := NewService(repo, &learningStub{}, &questionStub{}, &providerStub{configured: map[ai.Provider]bool{}}, Config{})
	write := ai.ProviderSettingWrite{
		Enabled: true, Model: "gpt-4.1-mini", BaseURL: "https://evil.example/v1",
		Priority: 50, MaxOutputTokens: 800, ExpectedRevision: 1,
	}
	if _, err := service.UpdateProvider(context.Background(), admin(), ai.ProviderOpenAI, write); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected URL validation, got %v", err)
	}
	write.BaseURL = "https://api.openai.com/v1"
	if _, err := service.UpdateProvider(context.Background(), identity.User{ID: "teacher", Roles: []identity.Role{identity.RoleTeacher}}, ai.ProviderOpenAI, write); !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected admin guard, got %v", err)
	}
	out, err := service.UpdateProvider(context.Background(), admin(), ai.ProviderOpenAI, write)
	if err != nil {
		t.Fatal(err)
	}
	if out.Revision != 2 || repo.updateProvider != ai.ProviderOpenAI {
		t.Fatalf("unexpected update %#v", out)
	}
}


func TestQuestionAssistServesCacheBeforeMinuteLimit(t *testing.T) {
	repo := &repoStub{minuteCount: 8, cache: map[string]ai.CacheEntry{}}
	card := reviewCard()
	input := ai.QuestionAssistInput{ReviewCardID: card.ID, HelpLevel: ai.HelpHint}
	key := buildCacheKey("student-1", card, input)
	now := time.Date(2026, 9, 27, 8, 0, 0, 0, time.UTC)
	repo.cache[key] = ai.CacheEntry{
		CacheKey: key, UserID: "student-1", ReviewCardID: card.ID,
		QuestionID: card.QuestionID, QuestionVersion: card.QuestionVersion,
		HelpLevel: ai.HelpHint, PromptVersion: PromptVersionQuestionTutor,
		ResponseText: "cached help", Provider: ai.ProviderGemini, Model: "m",
		ExpiresAt: now.Add(10 * time.Minute),
	}
	providers := &providerStub{configured: map[ai.Provider]bool{}, results: map[ai.Provider]ai.ProviderCallResult{}, errors: map[ai.Provider]error{}}
	service := NewService(repo, &learningStub{card: card}, &questionStub{row: reviewQuestion()}, providers, Config{PerMinuteLimit: 8})
	service.now = func() time.Time { return now }

	out, err := service.QuestionAssist(context.Background(), student(), input)
	if err != nil {
		t.Fatal(err)
	}
	if !out.CacheHit || out.Text != "cached help" {
		t.Fatalf("cache should bypass minute provider budget: %#v", out)
	}
}

func TestQuestionAssistMinuteLimitUsesTrustedFallbackWithoutProvider(t *testing.T) {
	repo := &repoStub{minuteCount: 8}
	providers := &providerStub{
		configured: map[ai.Provider]bool{ai.ProviderGemini: true},
		results: map[ai.Provider]ai.ProviderCallResult{ai.ProviderGemini: {Text: "provider"}},
		errors: map[ai.Provider]error{},
	}
	service := NewService(repo, &learningStub{card: reviewCard()}, &questionStub{row: reviewQuestion()}, providers, Config{PerMinuteLimit: 8})

	out, err := service.QuestionAssist(context.Background(), student(), ai.QuestionAssistInput{
		ReviewCardID: "card-1", HelpLevel: ai.HelpHint,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !out.UsedFallback || !strings.Contains(out.Text, "حد المحاولات") || len(providers.calls) != 0 {
		t.Fatalf("minute policy did not fail to trusted fallback: out=%#v calls=%#v", out, providers.calls)
	}
}
