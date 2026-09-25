package questionhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handler struct {
	service *questionapp.Service
	auth    Authenticator
}

func New(service *questionapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.staffList)
	r.Post("/", h.create)
	r.Get("/coverage", h.coverage)
	r.Get("/{id}", h.learnerGet)
	r.Get("/{id}/staff", h.staffGet)
	r.Post("/{id}/versions", h.appendVersion)
	r.Patch("/{id}/workflow", h.setWorkflow)
	return r
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input questionapp.CreateInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.Create(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"question": presentStaff(row)})
}

func (h *Handler) appendVersion(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		ExpectedCurrentVersion int                      `json:"expectedCurrentVersion"`
		Version                questionapp.VersionInput `json:"version"`
	}
	if !decodeJSON(w, r, &payload) {
		return
	}
	row, err := h.service.AppendVersion(r.Context(), auth.User, chi.URLParam(r, "id"), payload.ExpectedCurrentVersion, payload.Version)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": presentStaff(row)})
}

func (h *Handler) setWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input questionapp.WorkflowInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.SetWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": presentStaff(row)})
}

func (h *Handler) staffGet(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffGet(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": presentStaff(row)})
}

func (h *Handler) learnerGet(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.LearnerGet(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": presentLearner(row)})
}

func (h *Handler) authenticate(w http.ResponseWriter, r *http.Request, csrf bool) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	auth, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	if csrf {
		if err := h.auth.VerifyCSRF(auth, r.Header.Get("X-CSRF-Token")); err != nil {
			writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
			return identityapp.Authenticated{}, false
		}
	}
	return auth, true
}

func presentStaff(row question.Question) map[string]any {
	return map[string]any{
		"id": row.ID, "questionCode": row.QuestionCode, "currentVersion": row.CurrentVersion,
		"workflowStatus": row.WorkflowStatus, "ownerType": row.OwnerType, "ownerId": row.OwnerID,
		"pathId": row.PathID, "subjectId": row.SubjectID, "assignedTeacherId": row.AssignedTeacherID,
		"approvedBy": row.ApprovedBy, "approvedAt": row.ApprovedAt, "reviewerNotes": row.ReviewerNotes,
		"revenueSharePercentage": row.RevenueSharePercentage,
		"version": map[string]any{
			"version": row.Version.Version, "type": row.Version.QuestionType, "text": row.Version.TextContent,
			"imageAssetId": row.Version.ImageAssetID, "imageAlt": row.Version.ImageAlt,
			"optionsEmbeddedInImage": row.Version.OptionsEmbeddedInImage, "correctOptionIndex": row.Version.CorrectOptionIndex,
			"explanation": row.Version.Explanation, "hint": row.Version.Hint, "solvingStrategy": row.Version.SolvingStrategy,
			"videoUrl": row.Version.VideoURL, "sourceMeta": json.RawMessage(row.Version.SourceMeta), "aiContext": json.RawMessage(row.Version.AIContext),
			"voiceExplanation": json.RawMessage(row.Version.VoiceExplanation), "difficulty": row.Version.Difficulty,
			"examType": row.Version.ExamType, "source": row.Version.Source, "year": row.Version.SourceYear,
			"revisionNote": row.Version.RevisionNote,
		},
		"options":    presentOptions(row.Options),
		"skillLinks": presentSkillLinks(row.SkillLinks),
	}
}

func presentLearner(row question.Question) map[string]any {
	return map[string]any{
		"id": row.ID, "questionCode": row.QuestionCode, "version": row.CurrentVersion,
		"pathId": row.PathID, "subjectId": row.SubjectID, "type": row.Version.QuestionType,
		"text": row.Version.TextContent, "imageAssetId": row.Version.ImageAssetID, "imageAlt": row.Version.ImageAlt,
		"optionsEmbeddedInImage": row.Version.OptionsEmbeddedInImage, "videoUrl": row.Version.VideoURL,
		"difficulty": row.Version.Difficulty, "examType": row.Version.ExamType,
		"embeddedOptionTexts": learnerEmbeddedOptionTexts(row.Version.AIContext),
		"options":             presentOptions(row.Options), "skillLinks": presentSkillLinks(row.SkillLinks),
	}
}

func presentOptions(options []question.Option) []map[string]any {
	result := make([]map[string]any, 0, len(options))
	for _, option := range options {
		result = append(result, map[string]any{"index": option.Index, "text": option.Text, "assetId": option.AssetID})
	}
	return result
}

func presentSkillLinks(links []question.SkillLink) []map[string]any {
	result := make([]map[string]any, 0, len(links))
	for _, link := range links {
		result = append(result, map[string]any{"skillId": link.SkillID, "relationType": link.RelationType})
	}
	return result
}

func learnerEmbeddedOptionTexts(raw json.RawMessage) []string {
	var value struct {
		OptionTexts []string `json:"optionTexts"`
	}
	if json.Unmarshal(raw, &value) != nil {
		return []string{}
	}
	result := make([]string, 0, len(value.OptionTexts))
	for _, item := range value.OptionTexts {
		if item != "" {
			result = append(result, item)
		}
	}
	return result
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 256<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, questionapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid question request"})
	case errors.Is(err, questionapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, questionapp.ErrVersionConflict), errors.Is(err, questionapp.ErrWorkflow), errors.Is(err, question.ErrConflict), errors.Is(err, question.ErrInvalidTaxonomy):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Question state conflicts with the requested operation"})
	case errors.Is(err, question.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Question not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
