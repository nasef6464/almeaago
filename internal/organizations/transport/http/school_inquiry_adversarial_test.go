package organizationshttp

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// recordingInquiryRepo records the exact input passed to the repository
type recordingInquiryRepo struct {
	lastInput orgdomain.SchoolInquiryCreate
	err       error
}

func (r *recordingInquiryRepo) CreateSchoolInquiry(ctx context.Context, input orgdomain.SchoolInquiryCreate) (orgdomain.SchoolInquiry, error) {
	if r.err != nil {
		return orgdomain.SchoolInquiry{}, r.err
	}
	r.lastInput = input
	ref := input.RefNumber
	if ref == "" {
		ref = "SCH-2026-12345"
	}
	return orgdomain.SchoolInquiry{
		ID:                  "018f2b3e-0000-7000-8000-000000000001",
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

func (r *recordingInquiryRepo) GetSchoolInquiryByID(ctx context.Context, id string) (orgdomain.SchoolInquiry, error) {
	return orgdomain.SchoolInquiry{}, nil
}

func (r *recordingInquiryRepo) GetSchoolInquiryByRef(ctx context.Context, refNumber string) (orgdomain.SchoolInquiry, error) {
	return orgdomain.SchoolInquiry{}, nil
}

func (r *recordingInquiryRepo) ListSchoolInquiries(ctx context.Context, limit, offset int) ([]orgdomain.SchoolInquiry, int, error) {
	return nil, 0, nil
}

// 1. Missing/Blank mandatory fields -> MUST return HTTP 400
func TestAdversarial_MissingOrBlankMandatoryFields(t *testing.T) {
	tests := []struct {
		name string
		body map[string]any
	}{
		{
			name: "completely empty JSON object",
			body: map[string]any{},
		},
		{
			name: "missing schoolName",
			body: map[string]any{
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "+966501234567",
			},
		},
		{
			name: "empty schoolName",
			body: map[string]any{
				"schoolName":   "",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "+966501234567",
			},
		},
		{
			name: "whitespace schoolName with tabs and newlines",
			body: map[string]any{
				"schoolName":   "   \t \n \r  ",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "+966501234567",
			},
		},
		{
			name: "missing directorName",
			body: map[string]any{
				"schoolName": "مدارس الرواد الأهلية",
				"phone":      "+966501234567",
			},
		},
		{
			name: "empty directorName",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "",
				"phone":        "+966501234567",
			},
		},
		{
			name: "whitespace directorName",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": " \t  \n ",
				"phone":        "+966501234567",
			},
		},
		{
			name: "missing phone",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "أ. عبدالله العتيبي",
			},
		},
		{
			name: "empty phone",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "",
			},
		},
		{
			name: "whitespace phone",
			body: map[string]any{
				"schoolName":   "مدارس الرواد الأهلية",
				"directorName": "أ. عبدالله العتيبي",
				"phone":        "     ",
			},
		},
		{
			name: "all mandatory fields whitespace",
			body: map[string]any{
				"schoolName":   "   ",
				"directorName": "   ",
				"phone":        "   ",
			},
		},
	}

	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			payload, _ := json.Marshal(tt.body)
			req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()

			handler.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected HTTP 400 Bad Request, got %d, body: %s", w.Code, w.Body.String())
			}
		})
	}
}

// 2. Zero, negative, or extreme studentCount (-10, 0, 1000000)
func TestAdversarial_StudentCountScenarios(t *testing.T) {
	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	t.Run("zero student count", func(t *testing.T) {
		body := map[string]any{
			"schoolName":   "مدرسة تجريبية",
			"directorName": "أ. مدير المدرسة",
			"phone":        "+966500000000",
			"studentCount": 0,
		}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected HTTP 201 for studentCount=0, got %d: %s", w.Code, w.Body.String())
		}
		if repo.lastInput.StudentCount != 0 {
			t.Fatalf("expected repo studentCount=0, got %d", repo.lastInput.StudentCount)
		}
	})

	t.Run("negative student count (-10) clamped to 0", func(t *testing.T) {
		body := map[string]any{
			"schoolName":   "مدرسة تجريبية",
			"directorName": "أ. مدير المدرسة",
			"phone":        "+966500000000",
			"studentCount": -10,
		}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected HTTP 201 with clamping for studentCount=-10, got %d: %s", w.Code, w.Body.String())
		}
		// Invariant: negative studentCount must be clamped to 0 to respect DB check constraint
		if repo.lastInput.StudentCount < 0 {
			t.Fatalf("studentCount was not clamped, got negative value %d", repo.lastInput.StudentCount)
		}
		if repo.lastInput.StudentCount != 0 {
			t.Fatalf("expected clamped studentCount=0, got %d", repo.lastInput.StudentCount)
		}
	})

	t.Run("extreme student count (1,000,000)", func(t *testing.T) {
		body := map[string]any{
			"schoolName":   "مجموعة المدارس الكبرى",
			"directorName": "أ. مدير المجموعة",
			"phone":        "+966500000000",
			"studentCount": 1000000,
		}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusCreated {
			t.Fatalf("expected HTTP 201 for extreme studentCount=1000000, got %d: %s", w.Code, w.Body.String())
		}
		if repo.lastInput.StudentCount != 1000000 {
			t.Fatalf("expected repo studentCount=1000000, got %d", repo.lastInput.StudentCount)
		}
	})

	t.Run("invalid type string for studentCount returns 400", func(t *testing.T) {
		payload := []byte(`{
			"schoolName": "مدرسة",
			"directorName": "المدير",
			"phone": "+966500000000",
			"studentCount": "one thousand"
		}`)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected HTTP 400 for string studentCount, got %d: %s", w.Code, w.Body.String())
		}
	})
}

// 3. SQL Injection characters in text fields
func TestAdversarial_SQLInjectionResilience(t *testing.T) {
	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	sqlInjectionPayloads := []struct {
		name         string
		schoolName   string
		directorName string
		phone        string
		city         string
		notes        string
	}{
		{
			name:         "classic SQL drop table injection",
			schoolName:   "Robert'); DROP TABLE school_inquiries;--",
			directorName: "Admin' OR '1'='1",
			phone:        "+966501234567'; --",
			city:         "Riyadh'; SELECT pg_sleep(10); --",
			notes:        "'); DELETE FROM users WHERE ('1'='1",
		},
		{
			name:         "UNION SELECT injection",
			schoolName:   "' UNION SELECT id, password_hash, email FROM users --",
			directorName: "Normal Director",
			phone:        "+966500000001",
			city:         "' UNION ALL SELECT null, null, null --",
			notes:        "Normal notes",
		},
		{
			name:         "stacked queries and comments",
			schoolName:   "/*comment*/ Al-Rowad School",
			directorName: "Director; EXEC sp_msforeachtable 'DROP TABLE ?'--",
			phone:        "+966500000002",
			city:         "Jeddah",
			notes:        "test",
		},
	}

	for _, tt := range sqlInjectionPayloads {
		t.Run(tt.name, func(t *testing.T) {
			body := map[string]any{
				"schoolName":   tt.schoolName,
				"directorName": tt.directorName,
				"phone":        tt.phone,
				"city":         tt.city,
				"notes":        tt.notes,
			}
			payload, _ := json.Marshal(body)
			req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			// Handler should successfully accept and sanitize/pass parameters safely to repo
			if w.Code != http.StatusCreated {
				t.Fatalf("expected HTTP 201 (safe handling of SQL string literals), got %d: %s", w.Code, w.Body.String())
			}

			// Verify input was preserved as literal string, not executed or mangled
			if repo.lastInput.SchoolName != strings.TrimSpace(tt.schoolName) {
				t.Fatalf("expected literal schoolName %q, got %q", tt.schoolName, repo.lastInput.SchoolName)
			}
		})
	}
}

// 4. Duplicate reference number collision
func TestAdversarial_DuplicateRefNumberCollision(t *testing.T) {
	repo := &recordingInquiryRepo{
		err: orgdomain.ErrConflict,
	}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	body := map[string]any{
		"refNumber":    "SCH-2026-84920",
		"schoolName":   "مدارس الرواد الأهلية",
		"directorName": "أ. عبدالله العتيبي",
		"phone":        "+966501234567",
	}

	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusConflict {
		t.Fatalf("expected HTTP 409 Conflict, got %d, body: %s", w.Code, w.Body.String())
	}

	var res map[string]string
	if err := json.Unmarshal(w.Body.Bytes(), &res); err != nil {
		t.Fatalf("failed to parse conflict response: %v", err)
	}
	if !strings.Contains(res["message"], "already exists") {
		t.Fatalf("expected conflict message indicating inquiry exists, got: %v", res)
	}
}

// 5. Payload bomb (>64KB)
func TestAdversarial_PayloadBomb(t *testing.T) {
	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	t.Run("70KB payload exceeds 64KB limit", func(t *testing.T) {
		largeNotes := strings.Repeat("A", 70*1024)
		body := map[string]any{
			"schoolName":   "مدرسة",
			"directorName": "مدير",
			"phone":        "+966500000000",
			"notes":        largeNotes,
		}
		payload, _ := json.Marshal(body)
		if len(payload) <= 64*1024 {
			t.Fatalf("expected payload > 64KB, got %d bytes", len(payload))
		}

		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected HTTP 400 for payload bomb (>64KB), got %d, body: %s", w.Code, w.Body.String())
		}
	})

	t.Run("500KB massive payload bomb", func(t *testing.T) {
		massiveData := strings.Repeat("X", 500*1024)
		payload := []byte(fmt.Sprintf(`{"schoolName": "Large", "directorName": "Admin", "phone": "123", "notes": "%s"}`, massiveData))

		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusBadRequest {
			t.Fatalf("expected HTTP 400 for 500KB payload bomb, got %d, body: %s", w.Code, w.Body.String())
		}
	})
}

// 6. Malformed JSON
func TestAdversarial_MalformedJSON(t *testing.T) {
	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	malformedCases := []struct {
		name string
		raw  string
	}{
		{
			name: "truncated json",
			raw:  `{"schoolName": "مدارس الرواد", "directorName": `,
		},
		{
			name: "plain non-json string",
			raw:  `hello world this is not json`,
		},
		{
			name: "unclosed brace",
			raw:  `{"schoolName": "مدارس الرواد", "directorName": "مدير"`,
		},
		{
			name: "raw number instead of object",
			raw:  `123456`,
		},
		{
			name: "raw boolean instead of object",
			raw:  `true`,
		},
		{
			name: "xml payload",
			raw:  `<inquiry><schoolName>Test</schoolName></inquiry>`,
		},
		{
			name: "null body",
			raw:  `null`,
		},
	}

	for _, tt := range malformedCases {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(http.MethodPost, "/inquiries", strings.NewReader(tt.raw))
			req.Header.Set("Content-Type", "application/json")
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, req)

			if w.Code != http.StatusBadRequest {
				t.Fatalf("expected HTTP 400 for malformed json %q, got %d: %s", tt.name, w.Code, w.Body.String())
			}
		})
	}
}

// 7. Unicode, Arabic, RTL, and Special Characters
func TestAdversarial_ArabicAndUnicodeIntegrity(t *testing.T) {
	repo := &recordingInquiryRepo{}
	inqService := orgapp.NewSchoolInquiryService(repo)
	handler := New(nil, authStub{}, inqService)

	body := map[string]any{
		"schoolName":          "مدرسة الفضيلة الأهلية للبنين والبنات 🏫✨",
		"directorName":        "د. عبدالعزيز بن عبدالرحمن آل سعود",
		"city":                "المدينة المنورة",
		"phone":               "+966 50 123 4567",
		"email":               "info@al-fadeelah.edu.sa",
		"studentCount":        850,
		"tierId":              "tier_excellence",
		"tierName":            "باقة التميز والتفوق الأكاديمي",
		"paths":               []string{"qudrat_verbal", "qudrat_quantitative", "tahsili_scientific"},
		"notes":               "ملاحظات خاصة: تشمل فصول الموهوبين والأولمبياد العلمي \u200E(Special Notes)\u200F",
		"totalAnnualEstimate": 45000.50,
	}

	payload, _ := json.Marshal(body)
	req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected HTTP 201 for Arabic unicode payload, got %d: %s", w.Code, w.Body.String())
	}

	if repo.lastInput.SchoolName != "مدرسة الفضيلة الأهلية للبنين والبنات 🏫✨" {
		t.Fatalf("Unicode Arabic string corrupted, got: %s", repo.lastInput.SchoolName)
	}
}

// 8. Service unavailable and internal error mapping
func TestAdversarial_ErrorHandling(t *testing.T) {
	t.Run("nil service returns 503", func(t *testing.T) {
		handler := New(nil, authStub{}, nil)
		body := map[string]any{"schoolName": "test", "directorName": "test", "phone": "123"}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusServiceUnavailable {
			t.Fatalf("expected HTTP 503 for nil inquiry service, got %d", w.Code)
		}
	})

	t.Run("unexpected repo error returns 500", func(t *testing.T) {
		repo := &recordingInquiryRepo{
			err: errors.New("database connection refused"),
		}
		inqService := orgapp.NewSchoolInquiryService(repo)
		handler := New(nil, authStub{}, inqService)

		body := map[string]any{"schoolName": "test", "directorName": "test", "phone": "123"}
		payload, _ := json.Marshal(body)
		req := httptest.NewRequest(http.MethodPost, "/inquiries", bytes.NewReader(payload))
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)

		if w.Code != http.StatusInternalServerError {
			t.Fatalf("expected HTTP 500 for unexpected error, got %d", w.Code)
		}
	})
}
