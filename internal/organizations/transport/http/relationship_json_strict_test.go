package organizationshttp

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
)

// A relationship mutation must consume exactly one JSON document. Otherwise a
// second document can silently contradict a membership, director or teaching
// assignment change while the first one is persisted.
func TestSchoolRelationshipWritesRejectTrailingJSONWithoutMutation(t *testing.T) {
	cases := []struct {
		name   string
		path   string
		body   string
		legacy bool
		kind   string
	}{
		{
			name: "canonical membership",
			path: "/school-1/memberships",
			body: `{"userId":"student-1","role":"student","status":"active"}`,
			kind: "membership",
		},
		{
			name: "canonical director",
			path: "/school-1/directors/director-1",
			body: `{"status":"active","permissions":[]}`,
			kind: "director",
		},
		{
			name: "canonical assignment",
			path: "/school-1/assignments",
			body: `{"teacherId":"teacher-1","classId":"class-1","subjectId":"subject-1","status":"active"}`,
			kind: "assignment",
		},
		{
			name:   "legacy facade membership",
			path:   "/memberships",
			body:   `{"schoolId":"school-1","userId":"student-1","role":"student","status":"active"}`,
			legacy: true,
			kind:   "membership",
		},
		{
			name:   "legacy facade director",
			path:   "/directors/school-1/director-1",
			body:   `{"status":"active","permissions":[]}`,
			legacy: true,
			kind:   "director",
		},
		{
			name:   "legacy facade assignment",
			path:   "/assignments",
			body:   `{"schoolId":"school-1","teacherId":"teacher-1","classId":"class-1","subjectId":"subject-1","status":"active"}`,
			legacy: true,
			kind:   "assignment",
		},
	}
	for _, tc := range cases {
		for _, suffix := range []struct {
			name  string
			value string
		}{
			{name: "second document", value: `{"status":"inactive"}`},
			{name: "trailing garbage", value: "unexpected"},
		} {
			t.Run(tc.name+"/"+suffix.name, func(t *testing.T) {
				repo := &repoStub{}
				service := orgapp.NewService(repo)
				handler := New(service, authStub{auth: adminAuth()})
				if tc.legacy {
					handler = NewLegacy(service, authStub{auth: adminAuth()})
				}
				request := httptest.NewRequest(http.MethodPut, tc.path, strings.NewReader(tc.body+suffix.value))
				request.Header.Set("Content-Type", "application/json")
				response := httptest.NewRecorder()
				handler.ServeHTTP(response, request)

				if response.Code != http.StatusBadRequest {
					t.Fatalf("expected 400 for ambiguous write, got %d: %s", response.Code, response.Body.String())
				}
				switch tc.kind {
				case "membership":
					if repo.membershipWrite.UserID != "" {
						t.Fatalf("membership write reached repository: %#v", repo.membershipWrite)
					}
				case "director":
					if repo.directorWrite.UserID != "" {
						t.Fatalf("director write reached repository: %#v", repo.directorWrite)
					}
				case "assignment":
					if repo.assignmentWrite.TeacherID != "" {
						t.Fatalf("assignment write reached repository: %#v", repo.assignmentWrite)
					}
				}
			})
		}
	}
}

func TestSchoolRelationshipWriteAllowsTrailingWhitespace(t *testing.T) {
	repo := &repoStub{}
	handler := New(orgapp.NewService(repo), authStub{auth: adminAuth()})
	request := httptest.NewRequest(http.MethodPut, "/school-1/memberships",
		strings.NewReader("{\n\t\"userId\":\"student-1\",\"role\":\"student\",\"status\":\"active\"}  \n\t"))
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != http.StatusOK {
		t.Fatalf("valid single JSON with whitespace should succeed, got %d: %s", response.Code, response.Body.String())
	}
	if repo.membershipWrite.UserID != "student-1" {
		t.Fatalf("expected canonical membership write, got %#v", repo.membershipWrite)
	}
}
