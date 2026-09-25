package questionhttp

import (
	"net/http"
	"strconv"
	"strings"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (h *Handler) staffList(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, valid := parseListQuery(r)
	if !valid {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid question filters"})
		return
	}
	page, err := h.service.StaffList(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items":   presentSummaries(page.Items),
		"page":    page.Page,
		"limit":   page.Limit,
		"hasMore": page.HasMore,
	})
}

func (h *Handler) coverage(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	listQuery, valid := parseListQuery(r)
	if !valid {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid question filters"})
		return
	}
	skillPage, ok := parsePositiveInt(r.URL.Query().Get("skillPage"))
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid skillPage"})
		return
	}
	skillLimit, ok := parsePositiveInt(r.URL.Query().Get("skillLimit"))
	if !ok {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid skillLimit"})
		return
	}

	result, err := h.service.Coverage(r.Context(), auth.User, question.CoverageQuery{
		ListQuery:  listQuery,
		SkillPage:  skillPage,
		SkillLimit: skillLimit,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"questionsTotal":    result.QuestionsTotal,
		"approved":          result.Approved,
		"pendingReview":     result.PendingReview,
		"unlinked":          result.Unlinked,
		"mainSkillCoverage": result.MainSkillCoverage,
		"subSkillCoverage":  result.SubSkillCoverage,
		"skills":            presentSkillCoverage(result.Skills),
		"skillPage":         result.SkillPage,
		"skillLimit":        result.SkillLimit,
		"skillsHasMore":     result.SkillsHasMore,
	})
}

func parseListQuery(r *http.Request) (question.ListQuery, bool) {
	values := r.URL.Query()
	page, ok := parsePositiveInt(values.Get("page"))
	if !ok {
		return question.ListQuery{}, false
	}
	limit, ok := parsePositiveInt(values.Get("limit"))
	if !ok {
		return question.ListQuery{}, false
	}
	year, ok := parseOptionalInt(values.Get("year"))
	if !ok {
		return question.ListQuery{}, false
	}
	linked, ok := parseOptionalBool(values.Get("linked"))
	if !ok {
		return question.ListQuery{}, false
	}
	withVideo, ok := parseOptionalBool(values.Get("withVideo"))
	if !ok {
		return question.ListQuery{}, false
	}
	withExplanation, ok := parseOptionalBool(values.Get("withExplanation"))
	if !ok {
		return question.ListQuery{}, false
	}

	skillIDs := append([]string(nil), values["skillId"]...)
	if raw := strings.TrimSpace(values.Get("skillIds")); raw != "" {
		for _, item := range strings.Split(raw, ",") {
			if value := strings.TrimSpace(item); value != "" {
				skillIDs = append(skillIDs, value)
			}
		}
	}

	return question.ListQuery{
		Page:            page,
		Limit:           limit,
		Search:          values.Get("search"),
		PathID:          values.Get("pathId"),
		SubjectID:       values.Get("subjectId"),
		MainSkillID:     values.Get("mainSkillId"),
		SkillIDs:        skillIDs,
		Linked:          linked,
		Difficulty:      values.Get("difficulty"),
		QuestionType:    question.QuestionType(values.Get("type")),
		ExamType:        values.Get("examType"),
		Source:          values.Get("source"),
		Year:            year,
		WorkflowStatus:  question.WorkflowStatus(values.Get("workflowStatus")),
		WithVideo:       withVideo,
		WithExplanation: withExplanation,
	}, true
}

func parsePositiveInt(raw string) (int, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, false
	}
	return value, true
}

func parseOptionalInt(raw string) (*int, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	value, err := strconv.Atoi(raw)
	if err != nil {
		return nil, false
	}
	return &value, true
}

func parseOptionalBool(raw string) (*bool, bool) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, true
	}
	value, err := strconv.ParseBool(raw)
	if err != nil {
		return nil, false
	}
	return &value, true
}

func presentSummaries(rows []question.QuestionSummary) []map[string]any {
	result := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		result = append(result, map[string]any{
			"id":                row.ID,
			"questionCode":      row.QuestionCode,
			"currentVersion":    row.CurrentVersion,
			"workflowStatus":    row.WorkflowStatus,
			"ownerType":         row.OwnerType,
			"ownerId":           row.OwnerID,
			"pathId":            row.PathID,
			"subjectId":         row.SubjectID,
			"assignedTeacherId": row.AssignedTeacherID,
			"type":              row.QuestionType,
			"difficulty":        row.Difficulty,
			"examType":          row.ExamType,
			"source":            row.Source,
			"year":              row.SourceYear,
			"hasImage":          row.HasImage,
			"hasVideo":          row.HasVideo,
			"hasExplanation":    row.HasExplanation,
			"mainSkillId":       row.MainSkillID,
			"skillIds":          row.SkillIDs,
			"updatedAt":         row.UpdatedAt,
		})
	}
	return result
}

func presentSkillCoverage(rows []question.SkillCoverage) []map[string]any {
	result := make([]map[string]any, 0, len(rows))
	for _, row := range rows {
		result = append(result, map[string]any{
			"skillId":       row.SkillID,
			"relationType":  row.RelationType,
			"questionCount": row.QuestionCount,
		})
	}
	return result
}
