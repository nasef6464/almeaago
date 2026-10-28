package postgres

import (
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/learning/application"
)

func TestAdaptiveSelectionPostgres(t *testing.T) {
	for _, scenario := range []string{"status", "evidence", "recency", "trend", "scoped history"} {
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
			if scenario == "trend" || scenario == "scoped history" {
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
