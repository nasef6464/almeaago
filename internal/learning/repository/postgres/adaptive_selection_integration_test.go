package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"strings"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	learninghttp "github.com/nasef6464/almeaago/internal/learning/transport/http"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/learning/application"
)

func TestAdaptiveSelectionPostgres(t *testing.T) {
	for _, scenario := range []string{"status", "evidence", "recency", "trend", "history student", "history path", "history subject"} {
		t.Run(scenario, func(t *testing.T) {
			f := newEvidenceFixture(t)
			const lower = "00000000-0000-0000-0000-000000000081"
			const priority = "00000000-0000-0000-0000-000000000082"
			seed := func(student, path, subject, skill string, mastery float64, status string, count int, at time.Time) {
				t.Helper()
				_, err := f.db.Exec(f.ctx, `INSERT INTO skill_progress
     (student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,last_evidence_at,recommended_action)
     VALUES($1,$2,$3,$4,$5,$6,3,$7,$8,'old recommendation')`, student, path, subject, skill, mastery, status, count, at)
				if err != nil {
					t.Fatal(err)
				}
			}
			lowStatus, priorityStatus := "average", "average"
			count, last := 3, f.now
			if scenario == "status" {
				lowStatus, priorityStatus = "good", "weak"
			}
			if scenario == "evidence" {
				count = 2
			}
			if scenario == "recency" {
				last = f.now.Add(-150 * 24 * time.Hour)
			}
			seed(evidenceStudent, evidencePath, evidenceSubject, lower, 59, lowStatus, 3, f.now)
			seed(evidenceStudent, evidencePath, evidenceSubject, priority, 60, priorityStatus, count, last)
			if scenario == "trend" || len(scenario) > 7 && scenario[:7] == "history" {
				for i, correct := range []bool{true, false} {
					// Two source events; multiple questions in an event must not become separate trend samples.
					_, err := f.db.Exec(f.ctx, `WITH e AS (INSERT INTO mastery_evidence
      (student_id,evidence_type,source_attempt_id,assessment_id,assessment_version,question_id,question_version,path_id,subject_id,answered,is_correct,occurred_at)
      VALUES($1,'assessment',md5($2)::uuid,$3,1,md5($4)::uuid,1,$5,$6,true,$7,$8) RETURNING id)
      INSERT INTO mastery_evidence_skills(evidence_id,skill_id) SELECT id,$9 FROM e`,
						evidenceStudent, scenario+time.Duration(i).String(), evidencePath, "question"+time.Duration(i).String(), evidencePath, evidenceSubject, correct, f.now.Add(time.Duration(i-2)*24*time.Hour), priority)
					if err != nil {
						t.Fatal(err)
					}
				}
			}
			if len(scenario) > 7 && scenario[:7] == "history" {
				student, path, subject := evidenceStudent, evidencePath, evidenceSubject
				switch scenario {
				case "history student":
					student = evidenceOtherStudent
				case "history path":
					path = evidenceSubject
				case "history subject":
					subject = evidencePath
				}
				for i, correct := range []bool{false, true} {
					_, err := f.db.Exec(f.ctx, `WITH e AS (INSERT INTO mastery_evidence
                    (student_id,evidence_type,source_attempt_id,assessment_id,assessment_version,question_id,question_version,path_id,subject_id,answered,is_correct,occurred_at)
                    VALUES($1,'assessment',md5($2)::uuid,$3,1,md5($4)::uuid,1,$5,$6,true,$7,$8) RETURNING id)
                    INSERT INTO mastery_evidence_skills(evidence_id,skill_id) SELECT id,$9 FROM e`, student, "foreign"+time.Duration(i).String(), evidencePath, "foreign question"+time.Duration(i).String(), path, subject, correct, f.now.Add(time.Duration(i-1)*time.Hour), priority)
					if err != nil {
						t.Fatal(err)
					}
				}
			}
			// Foreign rows are more urgent but must never be selected.
			seed(evidenceOtherStudent, evidencePath, evidenceSubject, priority, 0, "weak", 1, f.now)
			seed(evidenceStudent, evidenceSubject, evidenceSubject, priority, 0, "weak", 1, f.now)
			seed(evidenceStudent, evidencePath, evidencePath, priority, 0, "weak", 1, f.now)
			service := application.NewService(f.repo, nil)
			got, err := service.NextAction(f.ctx, identity.User{ID: evidenceStudent, Roles: []identity.Role{identity.RoleStudent}}, evidencePath, evidenceSubject)
			if err != nil {
				t.Fatal(err)
			}
			if got == nil || got.SkillID != priority || got.PathID != evidencePath || got.SubjectID != evidenceSubject {
				t.Fatalf("source priority not selected: %+v", got)
			}
		})
	}
}

// Real repository → application → HTTP, using the existing authenticated item DTO.
func TestAdaptiveSelectionHTTPPostgres(t *testing.T) {
	f := newEvidenceFixture(t)
	const skill = "00000000-0000-0000-0000-000000000082"
	_, err := f.db.Exec(f.ctx, `INSERT INTO skill_progress
 (student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,last_evidence_at,recommended_action)
 VALUES($1,$2,$3,$4,60,'average',8,2,$5,'persisted text')`, evidenceStudent, evidencePath, evidenceSubject, skill, f.now)
	if err != nil {
		t.Fatal(err)
	}
	auth := adaptiveHTTPAuth{actor: identity.User{ID: evidenceStudent, Roles: []identity.Role{identity.RoleStudent}}}
	handler := learninghttp.NewMastery(application.NewService(f.repo, nil), auth)
	request := httptest.NewRequest("GET", "/next-action?pathId="+evidencePath+"&subjectId="+evidenceSubject+"&studentId="+evidenceOtherStudent, nil)
	response := httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	var payload struct {
		Item *learning.SkillProgress `json:"item"`
	}
	if err = json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
		t.Fatal(err)
	}
	if response.Code != 200 || payload.Item == nil || payload.Item.SkillID != skill || payload.Item.Action != "measure" || payload.Item.Trend != "stable" || payload.Item.RecommendedAction != "قياس المهارة لاستكمال الأدلة" {
		t.Fatalf("HTTP recommendation: %d %s", response.Code, response.Body.String())
	}
	var stored string
	if err = f.db.QueryRow(f.ctx, "SELECT recommended_action FROM skill_progress WHERE student_id=$1", evidenceStudent).Scan(&stored); err != nil || stored != "persisted text" {
		t.Fatalf("read changed stored recommendation: %q %v", stored, err)
	}
	for _, c := range []struct {
		url    string
		actor  identity.User
		status int
	}{
		{"/next-action", auth.actor, 400},
		{"/next-action?pathId=" + evidencePath, identity.User{ID: evidenceStudent, Roles: []identity.Role{identity.RoleTeacher}}, 403},
	} {
		response := httptest.NewRecorder()
		learninghttp.NewMastery(application.NewService(f.repo, nil), adaptiveHTTPAuth{actor: c.actor}).ServeHTTP(response, httptest.NewRequest("GET", c.url, nil))
		if response.Code != c.status {
			t.Fatalf("guard %s: %d want %d", c.url, response.Code, c.status)
		}
	}
	if _, err = f.db.Exec(f.ctx, "TRUNCATE skill_progress"); err != nil {
		t.Fatal(err)
	}
	response = httptest.NewRecorder()
	handler.ServeHTTP(response, request)
	if response.Code != 200 || strings.TrimSpace(response.Body.String()) != "{\"item\":null}" {
		t.Fatalf("empty: %d %s", response.Code, response.Body.String())
	}
	cancelled, cancel := context.WithCancel(f.ctx)
	cancel()
	if _, err = f.repo.WeakestSkillProgress(cancelled, evidenceStudent, evidencePath, evidenceSubject); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancelled read: %v", err)
	}
}

type adaptiveHTTPAuth struct{ actor identity.User }

func (a adaptiveHTTPAuth) Authenticate(context.Context, string) (identityapp.Authenticated, error) {
	return identityapp.Authenticated{User: a.actor}, nil
}
func (a adaptiveHTTPAuth) VerifyCSRF(identityapp.Authenticated, string) error { return nil }
