package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// This test uses temporary tables on one transaction and never modifies the
// shared schema. The DSN must still point to a disposable local database.
func TestAssessmentSectionSubjectScopePostgres(t *testing.T) {
	dsn := os.Getenv("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("ASSESSMENT_ATTEMPT_TEST_DATABASE_URL required: use disposable local PostgreSQL")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 90*time.Second)
	defer cancel()
	db, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	tx, err := db.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	_, err = tx.Exec(ctx, `
CREATE TEMP TABLE paths(id uuid, status text);
CREATE TEMP TABLE subjects(id uuid, path_id uuid, status text);
CREATE TEMP TABLE questions(id uuid, subject_id uuid, workflow_status text);
CREATE TEMP TABLE question_versions(question_id uuid, version int);
INSERT INTO paths VALUES ('00000000-0000-0000-0000-000000000001','active'),('00000000-0000-0000-0000-000000000002','active');
INSERT INTO subjects VALUES ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','active'),('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','active'),('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000002','active');
INSERT INTO questions VALUES ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000011','approved'),('00000000-0000-0000-0000-000000000022',NULL,'approved');
INSERT INTO question_versions SELECT id,1 FROM questions;
`)
	if err != nil {
		t.Fatal(err)
	}
	const path = "00000000-0000-0000-0000-000000000001"
	const matching = "00000000-0000-0000-0000-000000000011"
	const otherSubject = "00000000-0000-0000-0000-000000000012"
	const otherPathSubject = "00000000-0000-0000-0000-000000000013"
	const sectionID = "00000000-0000-0000-0000-000000000031"
	const question = "00000000-0000-0000-0000-000000000021"
	const unscopedQuestion = "00000000-0000-0000-0000-000000000022"
	cases := []struct {
		name, sectionSubject, questionID string
		conflict                         bool
	}{
		{"matching section subject", matching, question, false},
		{"section outside assessment path", otherPathSubject, question, true},
		{"question differs from section subject", otherSubject, question, true},
		{"general section allows mixed subjects", "", question, false},
		{"unscoped legacy question remains valid", matching, unscopedQuestion, false},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			w := assessment.Write{Version: assessment.Version{PathID: path, Kind: assessment.KindMock}, Sections: []assessment.Section{{ID: sectionID, SubjectID: tc.sectionSubject}}, Questions: []assessment.QuestionPlacement{{QuestionID: tc.questionID, QuestionVersion: 1, SectionID: sectionID}}}
			err := New(db, nil).validateRefs(ctx, tx, w)
			if tc.conflict && !errors.Is(err, assessment.ErrConflict) {
				t.Fatalf("expected conflict, got %v", err)
			}
			if !tc.conflict && err != nil {
				t.Fatalf("unexpected validation error: %v", err)
			}
		})
	}
}
