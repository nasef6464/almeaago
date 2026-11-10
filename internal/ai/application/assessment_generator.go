package application

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	ai "github.com/nasef6464/almeaago/internal/ai/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

func (s *Service) GenerateAssessment(
	ctx context.Context,
	user identity.User,
	input ai.GenerateAssessmentInput,
) (ai.GenerateAssessmentResult, error) {
	if s.providers == nil {
		return ai.GenerateAssessmentResult{}, ErrUnavailable
	}
	if strings.TrimSpace(input.PromptText) == "" && (input.Media == nil || strings.TrimSpace(input.Media.Data) == "") {
		return ai.GenerateAssessmentResult{}, ErrInvalidInput
	}

	started := time.Now()

	systemInstruction := `أنت خبير قياس وتقويم تربوي معتمد في المركز الوطني للقياس (منصة المئة).
مهمتك: استخراج الأسئلة من الوثيقة المرفقة (PDF أو صورة أو نص) وتحويلها إلى مصفوفة JSON دقيقة مطابقة لمعايير اختبارات القدرات والتحصيلي ومنافسات نافس.

المعايير الصارمة:
1. استخراج كل سؤال مع 4 خيارات حصرية مرتبة ومحددة.
2. تحديد رقم الإجابة الصحيحة (0 للرمز أ، 1 للرمز ب، 2 للرمز ج، 3 للرمز د).
3. كتابة المعادلات والرموز الرياضية بصيغة KaTeX دقيقة (استخدم $...$ للتضمين و $$...$$ للسطر المنفصل).
4. كتابة شرح تفصيلي لطريقة الحل والخطوات البيداغوجية.
5. تحديد مستوى الصعوبة (easy, medium, hard).
6. تصنيف المهارات المستهدفة بالسؤال.

صيغة الإخراج المطلوبة:
يجب أن يكون الرد عبارة عن مصفوفة JSON نقية فقط بدون أي مقدمات أو علامات markdown:
[
  {
    "text": "نص السؤال مع معادلات KaTeX إن وجدت",
    "options": ["خيار أ", "خيار ب", "خيار ج", "خيار د"],
    "correctAnswer": 0,
    "explanation": "طريقة الحل النموذجية مع القوانين",
    "difficulty": "medium",
    "skills": ["اسم المهارة"]
  }
]`

	userPrompt := input.PromptText
	if strings.TrimSpace(userPrompt) == "" {
		userPrompt = "استخرج جميع الأسئلة الموجودة في هذا الملف بدقة متناهية وفق معايير القدرات والتحصيلي."
	}
	fullPrompt := fmt.Sprintf("%s\n\nتعليمات المعلم:\n%s", systemInstruction, userPrompt)

	settings, err := s.repo.ListProviderSettings(ctx)
	if err != nil {
		return ai.GenerateAssessmentResult{}, err
	}

	var chosenSetting *ai.ProviderSetting
	for _, st := range settings {
		if st.Enabled && s.providers.SecretConfigured(st.Provider) {
			if st.Provider == ai.ProviderGemini {
				chosenSetting = &st
				break
			}
			if chosenSetting == nil {
				chosenSetting = &st
			}
		}
	}
	if chosenSetting == nil {
		return ai.GenerateAssessmentResult{}, ErrUnavailable
	}

	callResult, err := s.providers.CallMultimodal(ctx, *chosenSetting, fullPrompt, input.Media, true)
	if err != nil {
		return ai.GenerateAssessmentResult{}, err
	}

	rawText := strings.TrimSpace(callResult.Text)
	if strings.HasPrefix(rawText, "```json") {
		rawText = strings.TrimPrefix(rawText, "```json")
		rawText = strings.TrimSuffix(rawText, "```")
	} else if strings.HasPrefix(rawText, "```") {
		rawText = strings.TrimPrefix(rawText, "```")
		rawText = strings.TrimSuffix(rawText, "```")
	}
	rawText = strings.TrimSpace(rawText)

	var questions []ai.GeneratedQuestion
	if err := json.Unmarshal([]byte(rawText), &questions); err != nil {
		var wrapped struct {
			Questions []ai.GeneratedQuestion `json:"questions"`
		}
		if wrapErr := json.Unmarshal([]byte(rawText), &wrapped); wrapErr == nil && len(wrapped.Questions) > 0 {
			questions = wrapped.Questions
		} else {
			return ai.GenerateAssessmentResult{}, fmt.Errorf("failed to parse AI questions JSON: %w", err)
		}
	}

	if len(questions) == 0 {
		return ai.GenerateAssessmentResult{}, errors.New("لم يتم العثور على أسئلة قابلة للاستخراج من هذا الملف")
	}

	cleanedQuestions := make([]ai.GeneratedQuestion, 0, len(questions))
	for _, q := range questions {
		if strings.TrimSpace(q.Text) == "" || len(q.Options) < 2 {
			continue
		}
		if q.CorrectAnswer < 0 || q.CorrectAnswer >= len(q.Options) {
			q.CorrectAnswer = 0
		}
		if q.Difficulty == "" {
			q.Difficulty = "medium"
		}
		cleanedQuestions = append(cleanedQuestions, q)
	}

	latency := int(time.Since(started).Milliseconds())
	_ = s.repo.InsertInteraction(ctx, ai.Interaction{
		UserID:         user.ID,
		Audience:       "teacher",
		Endpoint:       "/ai/generate-assessment",
		Capability:     "assessment_generator",
		Provider:       chosenSetting.Provider,
		Model:          chosenSetting.Model,
		Status:         ai.InteractionSuccess,
		LatencyMS:      latency,
		InputTokens:    callResult.Usage.InputTokens,
		OutputTokens:   callResult.Usage.OutputTokens,
		TotalTokens:    callResult.Usage.TotalTokens,
		ResponseLength: len([]rune(rawText)),
		Metadata: map[string]any{
			"schoolId":       input.SchoolID,
			"questionsCount": len(cleanedQuestions),
		},
	})

	return ai.GenerateAssessmentResult{
		Questions: cleanedQuestions,
		Provider:  chosenSetting.Provider,
		Model:     chosenSetting.Model,
		LatencyMS: latency,
	}, nil
}
