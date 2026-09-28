package reportinghttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	reportingapp "github.com/nasef6464/almeaago/internal/reporting/application"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
}

type Handler struct {
	service *reportingapp.Service
	auth    Authenticator
}

func New(service *reportingapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/overview", h.overview)
	r.Get("/results", h.results)
	r.Get("/results.csv", h.exportResults)
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
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return 0, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 {
		return 0, reportingapp.ErrInvalidInput
	}
	return value, nil
}

func parseDateRange(fromRaw, toRaw string) (*time.Time, *time.Time, error) {
	fromRaw = strings.TrimSpace(fromRaw)
	toRaw = strings.TrimSpace(toRaw)
	var fromAt, toAt *time.Time
	if fromRaw != "" {
		value, err := time.Parse("2006-01-02", fromRaw)
		if err != nil {
			return nil, nil, reportingapp.ErrInvalidInput
		}
		value = value.UTC()
		fromAt = &value
	}
	if toRaw != "" {
		value, err := time.Parse("2006-01-02", toRaw)
		if err != nil {
			return nil, nil, reportingapp.ErrInvalidInput
		}
		value = value.UTC().Add(24 * time.Hour)
		toAt = &value
	}
	if fromAt != nil && toAt != nil && !fromAt.Before(*toAt) {
		return nil, nil, reportingapp.ErrInvalidInput
	}
	return fromAt, toAt, nil
}

func queryFromRequest(r *http.Request) (reporting.Query, error) {
	studentLimit, err := parsePositive(r.URL.Query().Get("studentLimit"))
	if err != nil {
		return reporting.Query{}, err
	}
	resultLimit, err := parsePositive(r.URL.Query().Get("resultLimit"))
	if err != nil {
		return reporting.Query{}, err
	}
	attemptLimit, err := parsePositive(r.URL.Query().Get("attemptLimit"))
	if err != nil {
		return reporting.Query{}, err
	}
	fromAt, toAt, err := parseDateRange(r.URL.Query().Get("dateFrom"), r.URL.Query().Get("dateTo"))
	if err != nil {
		return reporting.Query{}, err
	}
	return reporting.Query{
		SchoolID:     strings.TrimSpace(r.URL.Query().Get("schoolId")),
		ClassID:      strings.TrimSpace(r.URL.Query().Get("classId")),
		PathID:       strings.TrimSpace(r.URL.Query().Get("pathId")),
		SubjectID:    strings.TrimSpace(r.URL.Query().Get("subjectId")),
		FromAt:       fromAt,
		ToAt:         toAt,
		StudentLimit: studentLimit,
		ResultLimit:  resultLimit,
		AttemptLimit: attemptLimit,
	}, nil
}

func (h *Handler) overview(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	query, err := queryFromRequest(r)
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Overview(r.Context(), authenticated.User, query)
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
	query, err := queryFromRequest(r)
	if err != nil {
		writeError(w, err)
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
	out, err := h.service.Results(r.Context(), authenticated.User, query, page, limit)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, out)
}

func (h *Handler) exportResults(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authn(w, r)
	if !ok {
		return
	}
	query, err := queryFromRequest(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var buffer bytes.Buffer
	if _, err = h.service.ExportCSV(r.Context(), authenticated.User, query, &buffer); err != nil {
		writeError(w, err)
		return
	}
	fileName := "assessment-results.csv"
	if query.SchoolID != "" {
		fileName = "school-assessment-results.csv"
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%q", fileName))
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(buffer.Bytes())
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, reportingapp.ErrInvalidInput):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid reporting request"})
	case errors.Is(err, reportingapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, reportingapp.ErrTooLarge):
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]any{
			"message": "Export exceeds direct-download limit",
			"maxRows": reportingapp.MaxExportRows,
		})
	case errors.Is(err, reporting.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Reporting scope not found"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}
