package reportinghttp

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitydomain "github.com/nasef6464/almeaago/internal/identity/domain"
	reportingapp "github.com/nasef6464/almeaago/internal/reporting/application"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

func TestParseDateRangeUsesInclusiveDateTo(t *testing.T) {
	fromAt, toAt, err := parseDateRange("2026-09-01", "2026-09-28")
	if err != nil {
		t.Fatal(err)
	}
	if fromAt == nil || fromAt.Format("2006-01-02") != "2026-09-01" {
		t.Fatalf("unexpected from date: %v", fromAt)
	}
	if toAt == nil || toAt.Format("2006-01-02") != "2026-09-29" {
		t.Fatalf("dateTo must become an exclusive next-day boundary: %v", toAt)
	}
}

func TestParseDateRangeRejectsInvalidOrInvertedDates(t *testing.T) {
	if _, _, err := parseDateRange("not-a-date", ""); !errors.Is(err, reportingapp.ErrInvalidInput) {
		t.Fatalf("expected invalid date error, got %v", err)
	}
	if _, _, err := parseDateRange("2026-09-29", "2026-09-28"); !errors.Is(err, reportingapp.ErrInvalidInput) {
		t.Fatalf("expected inverted range error, got %v", err)
	}
}

func TestParseDateRangeNormalizesUTC(t *testing.T) {
	fromAt, toAt, err := parseDateRange("", "2026-09-28")
	if err != nil {
		t.Fatal(err)
	}
	if fromAt != nil {
		t.Fatalf("unexpected from date: %v", fromAt)
	}
	if toAt == nil || toAt.Location() != time.UTC {
		t.Fatalf("expected UTC exclusive bound: %v", toAt)
	}
}

type stubAuthenticator struct {
	authenticated identityapp.Authenticated
	err           error
}

func (s *stubAuthenticator) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return s.authenticated, s.err
}

type stubReportRepo struct {
	scope      reporting.ResolvedScope
	overview   reporting.Overview
	results    reporting.ResultPage
	exportRows []reporting.ResultItem
	exportTot  int
}

func (s *stubReportRepo) ResolveScope(context.Context, identitydomain.User, reporting.Query) (reporting.ResolvedScope, error) {
	return s.scope, nil
}
func (s *stubReportRepo) Overview(context.Context, reporting.ResolvedScope, reporting.Query) (reporting.Overview, error) {
	return s.overview, nil
}
func (s *stubReportRepo) Results(context.Context, reporting.ResolvedScope, reporting.Query, int, int) (reporting.ResultPage, error) {
	return s.results, nil
}
func (s *stubReportRepo) ExportResults(context.Context, reporting.ResolvedScope, reporting.Query, int) ([]reporting.ResultItem, int, error) {
	return s.exportRows, s.exportTot, nil
}

func TestReportingEndpointsCacheControl(t *testing.T) {
	admin := identitydomain.User{
		ID:    "00000000-0000-0000-0000-000000000001",
		Roles: []identitydomain.Role{identitydomain.RoleAdmin},
	}
	auth := &stubAuthenticator{
		authenticated: identityapp.Authenticated{
			User: admin,
		},
	}
	repo := &stubReportRepo{
		scope: reporting.ResolvedScope{
			Kind:      reporting.ScopePlatform,
			CanDetail: true,
			CanExport: true,
		},
		overview: reporting.Overview{
			Scope: reporting.ScopeSummary{Kind: reporting.ScopePlatform},
		},
		results: reporting.ResultPage{
			Page: 1, Limit: 20, Total: 1, Items: []reporting.ResultItem{},
		},
		exportRows: []reporting.ResultItem{
			{
				AttemptID:         "00000000-0000-0000-0000-000000000002",
				StudentID:         "00000000-0000-0000-0000-000000000003",
				StudentName:       "طالب",
				AssessmentID:      "00000000-0000-0000-0000-000000000004",
				AssessmentVersion: 1,
				Title:             "اختبار",
				Score:             85.0,
				Passed:            true,
				FinalizedAt:       time.Now().UTC(),
			},
		},
		exportTot: 1,
	}
	svc := reportingapp.NewService(repo)
	handler := New(svc, auth)

	// 1. GET /overview
	req := httptest.NewRequest(http.MethodGet, "/overview", nil)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("overview returned code %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("overview Cache-Control = %q, want 'private, no-store'", got)
	}

	// 2. GET /results
	req = httptest.NewRequest(http.MethodGet, "/results?page=1&limit=20", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("results returned code %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("results Cache-Control = %q, want 'private, no-store'", got)
	}

	// 3. GET /results.csv
	req = httptest.NewRequest(http.MethodGet, "/results.csv", nil)
	w = httptest.NewRecorder()
	handler.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("exportResults returned code %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("exportResults Cache-Control = %q, want 'private, no-store'", got)
	}

	// 4. Unauthenticated request to /overview
	unauthHandler := New(svc, &stubAuthenticator{err: errors.New("unauthorized")})
	req = httptest.NewRequest(http.MethodGet, "/overview", nil)
	w = httptest.NewRecorder()
	unauthHandler.ServeHTTP(w, req)
	if w.Code != http.StatusUnauthorized {
		t.Fatalf("unauthenticated overview returned code %d: %s", w.Code, w.Body.String())
	}
	if got := w.Header().Get("Cache-Control"); got != "private, no-store" {
		t.Fatalf("unauthenticated overview Cache-Control = %q, want 'private, no-store'", got)
	}
}
