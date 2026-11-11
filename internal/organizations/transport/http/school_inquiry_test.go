package organizationshttp

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type mockInquiryRepo struct {
	created orgdomain.SchoolInquiry
	err     error
}

func (m *mockInquiryRepo) CreateSchoolInquiry(ctx context.Context, input orgdomain.SchoolInquiryCreate) (orgdomain.SchoolInquiry, error) {
	if m.err != nil {
		return orgdomain.SchoolInquiry{}, m.err
	}
	ref := input.RefNumber
	if ref == "" {
		ref = "SCH-2026-99999"
	}
	return orgdomain.SchoolInquiry{
		ID:                  "018f2b3e-4a5c-7d9e-b123-456789abcdef",
		RefNumber:           ref,
		SchoolName:          input.SchoolName,
		City:                input.City,
		DirectorName:        input.DirectorName,
		Phone:               input.Phone,
		Email:               input.Email,
		StudentCount:        input.StudentCount,
		TierID:              input.TierID,
		TierName:            input.TierName,
		Paths:               input.Paths,
		Notes:               input.Notes,
		TotalAnnualEstimate: input.TotalAnnualEstimate,
	}, nil
}

func (m *mockInquiryRepo) GetSchoolInquiryByID(ctx context.Context, id string) (orgdomain.SchoolInquiry, error) {
	return m.created, nil
}

func (m *mockInquiryRepo) GetSchoolInquiryByRef(ctx context.Context, refNumber string) (orgdomain.SchoolInquiry, error) {
	return m.created, nil
}

func (m *mockInquiryRepo) ListSchoolInquiries(ctx context.Context, limit, offset int) ([]orgdomain.SchoolInquiry, int, error) {
	return []orgdomain.SchoolInquiry{m.created}, 1, nil
}

func TestCreateSchoolInquiry_Validation(t *testing.T) {
	tests := []struct {
		name       string
		body       map[string]any
		wantStatus int
	}{
		{
			name: "missing schoolName returns 400",
			body: map[string]any{
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "+966501234567",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "whitespace schoolName returns 400",
			body: map[string]any{
				"schoolName":   "   ",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "+966501234567",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing directorName returns 400",
			body: map[string]any{
				"schoolName": "مدارس الرواد الأهلية",
				"phone":      "+966501234567",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "whitespace directorName returns 400",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "   ",
				"phone":        "+966501234567",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "missing phone returns 400",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "أ. عبدالله العتيبي",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "whitespace phone returns 400",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "    ",
			},
			wantStatus: http.StatusBadRequest,
		},
		{
			name: "valid full payload returns 201",
			body: map[string]any{
				"refNumber":           "SCH-2026-84920",
				"schoolName":          "مدارس الرواد الأهلية",
				"city":                "الرياض",
				"directorName":        "أ. عبدالله العتيبي",
				"phone":               "+966501234567",
				"email":               "info@alrowaad.edu.sa",
				"studentCount":        350,
				"tierId":              "tier_excellence",
				"tierName":            "باقة التميز الأكاديمي",
				"paths":               []string{"qudrat", "tahsili"},
				"notes":               "نرغب بتدريب طلاب الثالث الثانوي",
				"totalAnnualEstimate": 22312,
			},
			wantStatus: http.StatusCreated,
		},
	}

	repo := &mockInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != tt.wantStatus {
				t.Fatalf("expected status %d, got %d, body: %s", tt.wantStatus, w.Code, w.Body.String())
			}

			if tt.wantStatus == http.StatusCreated {
				var res createSchoolInquiryResponse
				if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if !res.Success || res.RefNumber != "SCH-2026-84920" || res.ID == "" {
					t.Fatalf("unexpected response content: %+v", res)
				}
			}
		})
	}
}

func TestCreateSchoolInquiry_AutoGeneratesRefNumber(t *testing.T) {
	repo := &mockInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	body := map[string]any{
		"schoolName":   "مدارس النور الاهلية",
		"directorName": "أ. سعد الغامدي",
		"phone":        "+966555123456",
	}

	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201, got %d, body: %s", w.Code, w.Body.String())
	}

	var res createSchoolInquiryResponse
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !res.Success || !strings.HasPrefix(res.RefNumber, "SCH-") || res.ID == "" {
		t.Fatalf("expected generated refNumber starting with SCH-, got: %+v", res)
	}
}

func TestCreateSchoolInquiry_Conflict(t *testing.T) {
	repo := &mockInquiryRepo{
		err: orgdomain.ErrConflict,
	}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	body := map[string]any{
		"refNumber":    "SCH-2026-EXISTS",
		"schoolName":   "مدارس النور الاهلية",
		"directorName": "أ. سعد الغامدي",
		"phone":        "+966555123456",
	}

	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	handler.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected status 409 Conflict, got %d, body: %s", w.Code, w.Body.String())
	}
}
