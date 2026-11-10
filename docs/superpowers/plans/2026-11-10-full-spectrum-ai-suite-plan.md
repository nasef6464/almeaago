# Full-Spectrum Educational AI Suite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Full Enterprise AI Suite for ALMEAA (`almeaago`), featuring Arabic Voice-to-Voice AI tutoring, VClasses-grade Multimodal PDF-to-Exam generation with live KaTeX review, School AI Quota Governance, and dynamic Socratic step-by-step whiteboard solvers.

**Architecture:** 
1. **Backend (Go 1.27 + Chi + Gemini Multimodal)**: Extend Gemini client in `internal/ai/provider/client.go` to support multimodal inputs (PDF & image bytes) with strict JSON Schema generation. Expose `POST /api/v1/ai/generate-assessment` in `internal/ai/transport/http/handler.go` and implement `GenerateAssessment` in `internal/ai/application/service.go` with school quota checks against `school_contracts.metadata`.
2. **Client Speech & Vision (`aiMediaClient.ts` + `ChatWidget.tsx`)**: Implement Web Speech API for Arabic (`ar-SA`), phonetic KaTeX-to-spoken-Arabic vocalization, canvas-based image compression for math diagrams, and interactive voice chat.
3. **Teacher Assessment Modal (`AiExamGeneratorModal.tsx`)**: Build an interactive review dialog allowing teachers to drag-and-drop PDF question sheets or paste exam text, preview extracted KaTeX questions, edit options and correct answers, and deposit them directly into the School Assessment Center or Question Bank.
4. **Dynamic Socratic Solver (`StepSolutionPlayer.tsx`)**: Implement `parseChalkboardSteps` to break any Arabic explanation into pedagogical whiteboard scenes with synchronous KaTeX rendering and voice speech.

**Tech Stack:** Go 1.27, Chi v5, PostgreSQL 18 (Neon), Redis, React 19, TypeScript 5.8, Tailwind CSS, KaTeX, Web Speech API (`SpeechRecognition`, `speechSynthesis`), Playwright.

**Spec:** `c:/almeaago/almeaago/docs/superpowers/specs/2026-11-10-full-spectrum-ai-suite-design.md`

## Global Constraints

- Backend must remain strictly in Go 1.27 Chi; all Gemini API keys remain server-side and are NEVER exposed to client browsers.
- Maximum PDF/image file size for AI generation: 10 MB and up to 8 pages per extraction.
- HTTP timeout for AI generation endpoint: 60 seconds with context cancellation.
- All extracted questions must strictly adhere to the Saudi Qudurat & Tahsili multiple-choice format (exactly 4 options, 1 correct answer index 0-3, explanation, KaTeX math notation `$...$` or `$$...$$`).
- Zero-redesign rule: preserve `almeaacodax/main` UI design tokens, RTL layouts, Arabic typography, and Lucide icons.
- No destructive git commands (`git reset --hard`, `git clean -fd`); strictly preserve Codex's worktree (`C:\almeaago\worktrees\taxonomy-path-20261105`).

## Review Focus

1. **PDF/Image with no extractable questions**: Empty or unparseable input must return an informative Arabic error (`لم يتم العثور على أسئلة قابلة للاستخراج من هذا الملف`) instead of failing or producing nulls.
2. **KaTeX syntax errors in AI responses**: Raw formulas containing unescaped characters must be safely sanitized and rendered without crashing the React virtual DOM.
3. **Phonetic Vocalization of Math formulas**: TTS must not spell raw LaTeX tokens like `\frac` or `\sqrt` as letters, but pronounce them as Arabic words ("كسر", "جذر", "تربيع").
4. **School Daily AI Quota Exhaustion**: When a school reaches its daily limit from `school_contracts.metadata`, the system must return HTTP 429 with an Arabic explanatory message and failover gracefully without breaking user sessions.
5. **Interactive Video and Dynamic Blackboard Step Fallback**: If an Arabic explanation lacks explicit numbered steps, `parseChalkboardSteps` must produce a coherent 2-step pedagogical breakdown rather than an empty whiteboard.

---

### Task 1: Backend Multimodal Client & Schema Support for Gemini

**Files:**
- Modify: `almeaago/internal/ai/provider/client.go:70-184`
- Modify: `almeaago/internal/ai/domain/operations.go:20-50`
- Test: `almeaago/internal/ai/provider/client_multimodal_test.go`

**Interfaces:**
- Consumes: `ai.ProviderSetting`, `ai.ChatImageData`
- Produces: `Client.CallMultimodal(ctx context.Context, setting ai.ProviderSetting, prompt string, media *ai.ChatImageData, responseSchema any) (ai.ProviderCallResult, error)`

- [ ] **Step 1: Write the failing test**

Create `almeaago/internal/ai/provider/client_multimodal_test.go`:
```go
package provider_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	"github.com/nasef6464/almeaago/internal/ai/provider"
)

func testMultimodalGeminiHandler(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Contents []struct {
			Parts []struct {
				Text       string `json:"text"`
				InlineData *struct {
					MimeType string `json:"mimeType"`
					Data     string `json:"data"`
				} `json:"inlineData"`
			} `json:"parts"`
		} `json:"contents"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	if len(body.Contents) == 0 || len(body.Contents[0].Parts) < 2 {
		http.Error(w, "missing multimodal parts", http.StatusBadRequest)
		return
	}
	resp := map[string]any{
		"candidates": []map[string]any{
			{"content": map[string]any{"parts": []map[string]any{{"text": `[{"text":"سؤال اختباري","options":["أ","ب","ج","د"],"correctAnswer":0}]`}}}},
		},
		"usageMetadata": map[string]int{"promptTokenCount": 150, "candidatesTokenCount": 50, "totalTokenCount": 200},
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(resp)
}

func TestCallMultimodal_GeminiSuccess(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(testMultimodalGeminiHandler))
	defer srv.Close()

	c := provider.New(provider.Config{GeminiAPIKey: "test-key"})
	setting := ai.ProviderSetting{
		Provider:        ai.ProviderGemini,
		Model:           "gemini-2.5-flash",
		BaseURL:         srv.URL,
		MaxOutputTokens: 2048,
	}
	media := &ai.ChatImageData{
		Data:     "JVBERi0xLjQKJeLjz9MK...",
		MimeType: "application/pdf",
	}
	res, err := c.CallMultimodal(context.Background(), setting, "Extract questions", media, true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if res.Text == "" {
		t.Fatalf("expected non-empty text")
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test -v ./internal/ai/provider -run TestCallMultimodal_GeminiSuccess` inside `almeaago`
Expected: FAIL with `c.CallMultimodal undefined`

- [ ] **Step 3: Implement `CallMultimodal` in `internal/ai/provider/client.go`**

Add `CallMultimodal` to `*Client`:
- If `media != nil && media.Data != ""`, add `inlineData: { mimeType: media.MimeType, data: media.Data }` part to Gemini request contents.
- If `jsonResponse == true`, set `generationConfig: { responseMimeType: "application/json", maxOutputTokens: setting.MaxOutputTokens }`.
- Parse response and return `ai.ProviderCallResult`.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test -v ./internal/ai/provider -run TestCallMultimodal_GeminiSuccess`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/ai/provider/client.go internal/ai/provider/client_multimodal_test.go
git commit -m "feat(ai): add multimodal and structured json support for Gemini provider"
```

---

### Task 2: Backend Assessment Generation Service & Domain Types

**Files:**
- Create: `almeaago/internal/ai/domain/assessment_generator.go`
- Modify: `almeaago/internal/ai/application/service.go:80-120`
- Create: `almeaago/internal/ai/application/assessment_generator.go`
- Test: `almeaago/internal/ai/application/assessment_generator_test.go`

**Interfaces:**
- Consumes: `Client.CallMultimodal`, `Repository.InsertInteraction`
- Produces: `Service.GenerateAssessment(ctx context.Context, user identity.User, input ai.GenerateAssessmentInput) (ai.GenerateAssessmentResult, error)`

- [ ] **Step 1: Write the failing test**

Create `almeaago/internal/ai/application/assessment_generator_test.go`:
```go
package application_test

import (
	"context"
	"testing"

	"github.com/google/uuid"
	aiapp "github.com/nasef6464/almeaago/internal/ai/application"
	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type mockMultimodalClient struct {
	result ai.ProviderCallResult
	err    error
}

func (m *mockMultimodalClient) SecretConfigured(p ai.Provider) bool { return true }
func (m *mockMultimodalClient) Call(ctx context.Context, s ai.ProviderSetting, prompt string) (ai.ProviderCallResult, error) {
	return m.result, m.err
}
func (m *mockMultimodalClient) CallMultimodal(ctx context.Context, s ai.ProviderSetting, prompt string, media *ai.ChatImageData, jsonResponse bool) (ai.ProviderCallResult, error) {
	return m.result, m.err
}

func TestGenerateAssessment_ParsesValidJsonQuestions(t *testing.T) {
	mockJson := `[
		{
			"text": "إذا كانت س + ص = 10 و س - ص = 4، فما قيمة س؟",
			"options": ["7", "6", "5", "3"],
			"correctAnswer": 0,
			"explanation": "بجمع المعادلتين: 2س = 14 => س = 7",
			"difficulty": "medium",
			"skills": ["معادلات الدرجة الأولى", "الجبر"]
		}
	]`
	client := &mockMultimodalClient{
		result: ai.ProviderCallResult{
			Text:     mockJson,
			Provider: ai.ProviderGemini,
			Model:    "gemini-2.5-flash",
		},
	}
	repo := newMockRepo() // existing test mock
	svc := aiapp.NewService(repo, nil, nil, client, nil, aiapp.Config{})

	u := identity.User{ID: uuid.NewString(), Roles: []string{"teacher"}}
	res, err := svc.GenerateAssessment(context.Background(), u, ai.GenerateAssessmentInput{
		PromptText: "قم باستخراج الأسئلة من النص",
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(res.Questions) != 1 {
		t.Fatalf("expected 1 question, got %d", len(res.Questions))
	}
	if res.Questions[0].CorrectAnswer != 0 {
		t.Fatalf("expected correct answer index 0, got %d", res.Questions[0].CorrectAnswer)
	}
	if res.Questions[0].Text != "إذا كانت س + ص = 10 و س - ص = 4، فما قيمة س؟" {
		t.Fatalf("unexpected question text: %s", res.Questions[0].Text)
	}
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `go test -v ./internal/ai/application -run TestGenerateAssessment_ParsesValidJsonQuestions`
Expected: FAIL with `svc.GenerateAssessment undefined`

- [ ] **Step 3: Define Domain Types and Implement `GenerateAssessment`**

Create `almeaago/internal/ai/domain/assessment_generator.go`:
```go
package domain

type GeneratedQuestion struct {
	Text          string   `json:"text"`
	Options       []string `json:"options"`
	CorrectAnswer int      `json:"correctAnswer"`
	Explanation   string   `json:"explanation"`
	Difficulty    string   `json:"difficulty"`
	Skills        []string `json:"skills"`
}

type GenerateAssessmentInput struct {
	SchoolID   string         `json:"schoolId,omitempty"`
	PromptText string         `json:"promptText"`
	Media      *ChatImageData `json:"media,omitempty"`
}

type GenerateAssessmentResult struct {
	Questions []GeneratedQuestion `json:"questions"`
	Provider  Provider            `json:"provider"`
	Model     string              `json:"model"`
	LatencyMS int                 `json:"latencyMs"`
}
```

Implement `GenerateAssessment` in `almeaago/internal/ai/application/assessment_generator.go`:
- Construct system prompt: strictly requiring JSON output conforming to Saudi Qudurat/Tahsili standards with KaTeX math formatting.
- Call `s.providers.CallMultimodal` with `jsonResponse = true`.
- Clean any markdown fences (` ```json `), decode JSON into `[]ai.GeneratedQuestion`.
- Validate that each question has at least 2 options and a valid `CorrectAnswer` index (0 to len-1).
- Record interaction into `s.repo.InsertInteraction`.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test -v ./internal/ai/application -run TestGenerateAssessment_ParsesValidJsonQuestions`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/ai/domain/assessment_generator.go internal/ai/application/assessment_generator.go internal/ai/application/assessment_generator_test.go
git commit -m "feat(ai): implement assessment generation application service with schema validation"
```

---

### Task 3: Backend HTTP Route `POST /api/v1/ai/generate-assessment` & Quota Checks

**Files:**
- Modify: `almeaago/internal/ai/transport/http/handler.go:30-60`
- Test: `almeaago/internal/ai/transport/http/assessment_generator_http_test.go`

**Interfaces:**
- Consumes: `GenerateAssessment` service, `Authenticator`
- Produces: `POST /api/v1/ai/generate-assessment` endpoint accepting multipart form (`file` + `prompt` + `schoolId`) or JSON payload.

- [ ] **Step 1: Write the failing HTTP test**

Create `almeaago/internal/ai/transport/http/assessment_generator_http_test.go`:
```go
package aihttp_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	aihttp "github.com/nasef6464/almeaago/internal/ai/transport/http"
)

func TestGenerateAssessmentEndpoint_RequiresAuth(t *testing.T) {
	h := aihttp.New(nil, nil)
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/generate-assessment", bytes.NewBufferString("{}"))

	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusUnauthorized && rec.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected 401 or 503, got %d", rec.Code)
	}
}
```

- [ ] **Step 2: Run test to verify it fails (route not registered or returns 404/405)**

Run: `go test -v ./internal/ai/transport/http -run TestGenerateAssessmentEndpoint_RequiresAuth`
Expected: FAIL or route not found (404)

- [ ] **Step 3: Register route and implement handler in `handler.go`**

In `internal/ai/transport/http/handler.go`:
- Register `r.Post("/generate-assessment", h.generateAssessment)`
- Support `multipart/form-data`:
  - `file`: read up to 10 MB, detect MIME type (`application/pdf`, `image/jpeg`, `image/png`, `image/webp`). Encode base64 into `ai.ChatImageData`.
  - `prompt`: text extraction instructions.
  - `schoolId`: target school for assessment ownership and quota tracking.
- Or fallback to `application/json` with base64 `media` or raw `promptText`.
- Verify teacher/admin/supervisor role.
- Call `h.service.GenerateAssessment(ctx, user, input)`.
- Return 200 with `{ questions: [...], provider, model, latencyMs }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `go test -v ./internal/ai/transport/http -run TestGenerateAssessmentEndpoint_RequiresAuth`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add internal/ai/transport/http/handler.go internal/ai/transport/http/assessment_generator_http_test.go
git commit -m "feat(ai): expose POST /api/v1/ai/generate-assessment endpoint"
```

---

### Task 4: Client Speech Recognition & Arabic Phonetic Vocalization (`aiMediaClient.ts`)

**Files:**
- Create: `almeaago/apps/web/src/features/ai/services/aiMediaClient.ts`
- Test: `almeaago/apps/web/src/features/ai/services/aiMediaClient.test.ts`

**Interfaces:**
- Consumes: Browser Web Speech API (`SpeechRecognition`, `speechSynthesis`), Canvas API
- Produces:
  - `browserSpeechInputSupported(): boolean`
  - `recognizeArabicOnce(): Promise<string>`
  - `speakArabic(text: string): boolean`
  - `phoneticArabicFromKatex(text: string): string`
  - `compressImageForAi(file: File): Promise<BoundedAiImage>`

- [ ] **Step 1: Write the failing unit test**

Create `almeaago/apps/web/src/features/ai/services/aiMediaClient.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { phoneticArabicFromKatex } from './aiMediaClient';

describe('phoneticArabicFromKatex', () => {
  it('converts fractions and powers to natural spoken Arabic words', () => {
    const raw = 'حل المعادلة: $x^2 + 5 = 9$ و الكسر $\\frac{1}{2}$';
    const spoken = phoneticArabicFromKatex(raw);
    expect(spoken).not.toContain('\\frac');
    expect(spoken).not.toContain('^2');
    expect(spoken).toContain('تربيع');
    expect(spoken).toContain('نصف');
  });

  it('cleans square roots and basic arithmetic signs', () => {
    const raw = 'احسب $\\sqrt{16} + 4$';
    const spoken = phoneticArabicFromKatex(raw);
    expect(spoken).not.toContain('\\sqrt');
    expect(spoken).toContain('جذر');
    expect(spoken).toContain('زائد');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- aiMediaClient.test.ts` (or node scratch runner) in `almeaago/apps/web`
Expected: FAIL with `phoneticArabicFromKatex undefined`

- [ ] **Step 3: Implement `aiMediaClient.ts`**

Create `almeaago/apps/web/src/features/ai/services/aiMediaClient.ts`:
- Implement `phoneticArabicFromKatex(raw: string)`:
  - Replace `\frac{1}{2}` with "نصف", `\frac{1}{4}` with "ربع", `\frac{a}{b}` with "أ على ب".
  - Replace `^2` with " تربيع", `^3` with " تكعيب", `^{n}` with " أس n".
  - Replace `\sqrt{x}` with "جذر x".
  - Replace `+` with " زائد ", `-` with " ناقص ", `\times` with " ضرب ", `\div` with " قسمة ", `=` with " يساوي ".
  - Strip formatting tokens `\text{...}`, `\mathbf{...}`, `$$`, `$`.
- Implement `browserSpeechInputSupported`, `recognizeArabicOnce` with `recognition.lang = 'ar-SA'`.
- Implement `speakArabic(text)`:
  - Clean text via `phoneticArabicFromKatex`.
  - Set `utterance.lang = 'ar-SA'` and `utterance.rate = 0.95`.
  - Cancel any ongoing synthesis and speak.
- Implement `compressImageForAi(file)` using HTML5 Canvas with JPEG quality scaling to guarantee <= 450 KB.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/features/ai/services/aiMediaClient.test.ts` or vitest
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/ai/services/aiMediaClient.ts apps/web/src/features/ai/services/aiMediaClient.test.ts
git commit -m "feat(ai): implement Arabic voice recognition, canvas compression, and phonetic KaTeX vocalization"
```

---

### Task 5: Voice & Multimodal Interactive AI Chat Widget (`ChatWidget.tsx`)

**Files:**
- Create: `almeaago/apps/web/src/features/ai/components/ChatWidget.tsx`
- Modify: `almeaago/apps/web/src/features/ai/api/ai-client.ts`
- Modify: `almeaago/apps/web/src/App.tsx` (mount ChatWidget globally or in student/school pages)

**Interfaces:**
- Consumes: `aiMediaClient.ts`, `aiClient.chat`
- Produces: Floating voice-enabled Arabic tutor widget with live mic transcription, audio auto-speak toggle, KaTeX formula rendering, and photo upload for math problems.

- [ ] **Step 1: Write component contract test**

Create `almeaago/apps/web/src/features/ai/components/ChatWidget.test.tsx` verifying:
- Renders mic button and speaks toggle button.
- Accepts Arabic voice transcript and updates input text.
- Renders KaTeX math formula when bot returns LaTeX equations.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run apps/web/src/features/ai/components/ChatWidget.test.tsx` (or contract script)
Expected: FAIL with `ChatWidget not found`

- [ ] **Step 3: Implement `ChatWidget.tsx`**

Create `almeaago/apps/web/src/features/ai/components/ChatWidget.tsx`:
- Zero-redesign match with `almeaacodax/components/ChatWidget.tsx`.
- Microphone button (`Mic`) with pulsing recording state (`isListening`).
- Audio toggle button (`Volume2`) to toggle `autoSpeak`.
- Image attachment button (`ImagePlus`) with preview badge and remove button.
- Responsive mobile drawer and desktop floating window (bottom-left / bottom-right RTL aligned).
- KaTeX math formula rendering via `questionHtml.ts`.
- Multi-provider badge display (Gemini, OpenRouter, DeepSeek).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsc --noEmit` in `almeaago/apps/web`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/ai/components/ChatWidget.tsx apps/web/src/features/ai/api/ai-client.ts
git commit -m "feat(ai): add multimodal voice-enabled AI ChatWidget with Arabic speech and KaTeX support"
```

---

### Task 6: VClasses-Grade AI Exam Generator Modal (`AiExamGeneratorModal.tsx`)

**Files:**
- Create: `almeaago/apps/web/src/features/assessment/components/AiExamGeneratorModal.tsx`
- Modify: `almeaago/apps/web/src/features/schools/pages/SchoolsAdminPage.tsx`
- Modify: `almeaago/apps/web/src/features/director/pages/SchoolDirectorDashboardPage.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/ai/generate-assessment`, `SchoolContext`
- Produces: Modal with 3 modes:
  1. File dropzone (PDF/images up to 10MB) or text paste tab.
  2. 3-stage animated extraction progress indicator.
  3. Interactive review table with KaTeX math rendering, options editor, correct answer selector, and 1-click publishing to School Assessments or Question Bank.

- [ ] **Step 1: Write modal contract test**

Create `almeaago/apps/web/src/features/assessment/components/AiExamGeneratorModal.test.ts` asserting:
- Renders file upload dropzone and text tab.
- Formats extracted questions into editable form fields.
- Exports questions into assessment payload with `owner_type: 'school'` and `owner_id`.

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/features/assessment/components/AiExamGeneratorModal.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `AiExamGeneratorModal.tsx`**

Implement `AiExamGeneratorModal.tsx`:
- Drag-and-drop zone with animated upload icon and size validation (<10MB, `.pdf, .jpg, .png`).
- Direct text paste textarea tab for teachers copying from Word or test banks.
- Processing spinner with 3 step states:
  1. *قراءة وتحليل ملف الـ PDF...*
  2. *استخراج الأسئلة والمعادلات الرياضية بصيغة KaTeX...*
  3. *تحديد الخيارات وصياغة شروحات الحل النموذجية...*
- Review & Edit table:
  - Live KaTeX preview of question text and options.
  - Option radio buttons for selecting correct answer (0, 1, 2, 3).
  - Add / Delete question buttons.
  - Difficulty badge (easy / medium / hard).
- Action buttons:
  - «نشر كاختبار مدرسي فوري» (`createSchoolAssessment`).
  - «حفظ في بنك أسئلة المدرسة» (`saveToSchoolQuestionBank`).

- [ ] **Step 4: Run typecheck to verify 0 errors**

Run: `npx tsc --noEmit` in `almeaago/apps/web`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/assessment/components/AiExamGeneratorModal.tsx
git commit -m "feat(assessment): implement VClasses-grade AI PDF-to-Exam generator modal with KaTeX review"
```

---

### Task 7: Dynamic Blackboard Socratic Step Solver (`StepSolutionPlayer.tsx`)

**Files:**
- Modify: `almeaago/apps/web/src/features/classroom/components/StepSolutionPlayer.tsx`
- Create: `almeaago/apps/web/src/features/classroom/utils/chalkboardParser.ts`
- Test: `almeaago/apps/web/src/features/classroom/utils/chalkboardParser.test.ts`

**Interfaces:**
- Consumes: Any Arabic question explanation text or raw LaTeX string
- Produces: `parseChalkboardSteps(explanation: string): BlackboardStep[]` dynamically generating pedagogical scenes for blackboard presentation and voice vocalization.

- [ ] **Step 1: Write unit test for `parseChalkboardSteps`**

Create `almeaago/apps/web/src/features/classroom/utils/chalkboardParser.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { parseChalkboardSteps } from './chalkboardParser';

describe('parseChalkboardSteps', () => {
  it('parses Arabic multi-step solution into ordered blackboard scenes', () => {
    const explanation = `
    أولاً: نحدد المعطيات في المسالة: س + ص = 10.
    ثانياً: نطرح ص من الطرفين للحصول على س = 10 - ص.
    النتيجة النهائية: س = 7.
    `;
    const steps = parseChalkboardSteps(explanation);
    expect(steps.length).toBeGreaterThanOrEqual(3);
    expect(steps[0].title).toContain('المعطيات');
    expect(steps[steps.length - 1].title).toContain('النتيجة');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test apps/web/src/features/classroom/utils/chalkboardParser.test.ts`
Expected: FAIL with `parseChalkboardSteps undefined`

- [ ] **Step 3: Implement `chalkboardParser.ts` and integrate into `StepSolutionPlayer.tsx`**

Implement `chalkboardParser.ts`:
- Port the dynamic parsing logic from legacy `almeaacodax/whiteboardParser.tsx`.
- Detect numbered lists (`1-`, `2-`), ordinal words («أولاً»، «ثانياً»، «الخطوة الأولى»، «القاعدة»، «الحساب»، «النتيجة»).
- Extract KaTeX formulas into step equations.
- In `StepSolutionPlayer.tsx`: use `parseChalkboardSteps(explanation)` as fallback whenever `steps` prop is omitted or empty.
- Connect Arabic speech synthesis so each step is vocalized automatically when the player advances.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test apps/web/src/features/classroom/utils/chalkboardParser.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/classroom/utils/chalkboardParser.ts apps/web/src/features/classroom/components/StepSolutionPlayer.tsx
git commit -m "feat(classroom): add dynamic chalkboard step parser with Arabic speech and KaTeX equations"
```

---

### Task 8: AI Governance & School Quota Controls (`AiAdminPage.tsx`)

**Files:**
- Modify: `almeaago/apps/web/src/features/ai/pages/AiAdminPage.tsx`
- Modify: `almeaago/internal/ai/application/service.go`

**Interfaces:**
- Consumes: `aiClient.providers`, `aiClient.usage`, `school_contracts.metadata`
- Produces: School AI quota allocation matrix, real-time Gemini latency monitor, and circuit breaker recovery actions.

- [ ] **Step 1: Write contract test**

Create verification test asserting `AiAdminPage.tsx` displays quota controls and interaction metrics.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsc --noEmit` in `almeaago/apps/web`
Expected: PASS/FAIL depending on draft state

- [ ] **Step 3: Update `AiAdminPage.tsx`**

In `apps/web/src/features/ai/pages/AiAdminPage.tsx`:
- Add "إدارة كوتة المدارس والذكاء الاصطناعي المؤسسي" card.
- Show school quotas allocated in `school_contracts.metadata` (e.g., Al-Amal High School: 5,000 queries/day).
- Add live latency indicator (ms) for Gemini and active providers.
- Display circuit breaker auto-recovery countdown and manual reset button.

- [ ] **Step 4: Run typecheck to verify 0 errors**

Run: `npx tsc --noEmit` in `almeaago/apps/web`
Expected: 0 errors

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/ai/pages/AiAdminPage.tsx
git commit -m "feat(ai): add enterprise school quota matrix and live provider latency metrics to AiAdminPage"
```

---

### Task 9: Full-Spectrum Verification, E2E Screenshots & Audit Report

**Files:**
- Create: `almeaago/scratch/test_ai_suite_full_spectrum.mjs`
- Create: `C:/Users/nasef/.gemini/antigravity/brain/3387613e-8116-41d7-a510-0d9d92453cb5/ENTERPRISE_AI_SUITE_AUDIT_REPORT.md`

- [ ] **Step 1: Recompile Go Backend and Run Backend Tests**

Run:
```powershell
cd C:\almeaago\almeaago
go test -v ./internal/ai/...
go build -o bin/api.exe ./cmd/api
```
Expected: All Go tests pass, `bin/api.exe` builds cleanly.

- [ ] **Step 2: Run Frontend Typecheck**

Run:
```powershell
cd C:\almeaago\almeaago\apps\web
npx tsc --noEmit
```
Expected: 0 errors.

- [ ] **Step 3: Execute Playwright E2E Script and Capture Screenshots**

Run Playwright script `scratch/test_ai_suite_full_spectrum.mjs`:
- Capture `401_ai_voice_chat_widget_listening.png` (Voice chat with mic and Arabic TTS).
- Capture `402_ai_pdf_exam_generator_katex_preview.png` (PDF dropzone and KaTeX question review table).
- Capture `403_ai_admin_governance_quotas.png` (AI governance page with school quota matrix).

- [ ] **Step 4: Generate Final Audit Report**

Create `ENTERPRISE_AI_SUITE_AUDIT_REPORT.md` detailing:
- 100% parity with legacy `almeaacodax` and market benchmark `VClasses`.
- Multimodal extraction benchmark results.
- Voice vocalization KaTeX phonetic cleaning accuracy.
- School quota enforcement architecture.
- Clickable links to screenshots and source code.

- [ ] **Step 5: Commit**

```bash
git add scratch/test_ai_suite_full_spectrum.mjs
git commit -m "test(ai): add full-spectrum empirical verification script for enterprise AI suite"
```
