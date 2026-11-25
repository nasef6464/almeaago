package parentshttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	parentapp "github.com/nasef6464/almeaago/internal/parents/application"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
}

type Handler struct {
	service *parentapp.Service
	auth    Authenticator
}

func New(service *parentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/authority", h.authority)
	r.Get("/dashboard", h.dashboard)
	r.Get("/children/{studentId}/results", h.results)
	r.Get("/weekly-report", h.weeklyReport)
	r.Post("/weekly-report/send", h.sendWeeklyReport)
	r.Get("/approvals", h.approvals)
	r.Post("/approvals/{requestId}/approve", h.approveRequest)
	r.Post("/approvals/{requestId}/reject", h.rejectRequest)
	r.Post("/linked-students", h.linkStudentFailClosed)
	r.Delete("/linked-students/{studentId}", h.unlinkStudent)
	return r
}

func (h *Handler) authn(w http.ResponseWriter, r *http.Request) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func parsePositive(raw string) (int, error) {
	if strings.TrimSpace(raw) == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, parentapp.ErrInvalidInput
	}
	return value, nil
}

func (h *Handler) authority(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	out, err := h.service.Authority(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	studentIDs := make([]string, 0, len(out.Relationships))
	relationships := make([]map[string]string, 0, len(out.Relationships))
	for _, row := range out.Relationships {
		studentIDs = append(studentIDs, row.StudentID)
		item := map[string]string{"id": row.ID, "studentId": row.StudentID, "source": row.Source}
		if row.SchoolID != "" {
			item["schoolId"] = row.SchoolID
		}
		relationships = append(relationships, item)
	}
	writeJSON(w, http.StatusOK, map[string]any{"studentIds": studentIDs, "relationships": relationships})
}

func (h *Handler) dashboard(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	page, err := parsePositive(r.URL.Query().Get("page"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Dashboard(r.Context(), authenticated.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) results(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	page, err := parsePositive(r.URL.Query().Get("page"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Results(r.Context(), authenticated.User, chi.URLParam(r, "studentId"), page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) weeklyReport(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	page, err := parsePositive(r.URL.Query().Get("page"))
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.WeeklyReport(r.Context(), authenticated.User, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) sendWeeklyReport(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	out, err := h.service.SendWeeklyReport(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) approvals(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	items, err := h.service.Approvals(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items})
}

type approvalDecisionPayload struct {
	ExpectedRevision int `json:"expectedRevision"`
}

func (h *Handler) decideApproval(w http.ResponseWriter, r *http.Request, decision string) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	var payload approvalDecisionPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, parentapp.ErrInvalidInput)
		return
	}
	out, err := h.service.DecideApproval(
		r.Context(),
		authenticated.User,
		chi.URLParam(r, "requestId"),
		decision,
		payload.ExpectedRevision,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	msg := "تم اعتماد طلب ولي الأمر بنجاح."
	if decision == "rejected" {
		msg = "تم رفض الطلب بنجاح."
	}
	writeJSON(w, http.StatusOK, map[string]any{"approval": out, "message": msg})
}

func (h *Handler) approveRequest(w http.ResponseWriter, r *http.Request) {
	h.decideApproval(w, r, "approved")
}

func (h *Handler) rejectRequest(w http.ResponseWriter, r *http.Request) {
	h.decideApproval(w, r, "rejected")
}

func (h *Handler) linkStudentFailClosed(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	writeError(w, h.service.LinkStudentFailClosed(r.Context(), authenticated.User))
}

func (h *Handler) unlinkStudent(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	out, err := h.service.UnlinkStudent(r.Context(), authenticated.User, chi.URLParam(r, "studentId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, parentapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid parent request"})
	case errors.Is(err, parentapp.ErrNoLinkedChildren):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "لا يوجد أبناء مرتبطون بحساب ولي الأمر."})
	case errors.Is(err, parentapp.ErrSelfLinkRequiresVerification):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "ربط الطالب يتطلب اعتمادًا موثقًا من إدارة المدرسة أو موافقة الطالب."})
	case errors.Is(err, parentapp.ErrForbidden), errors.Is(err, orgapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, parentapp.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "الطلب غير موجود"})
	case errors.Is(err, parentapp.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "تعارض في حالة أو نسخة الطلب، يرجى التحديث والمحاولة مجددًا."})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
