package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Real migrations, transaction fixture: a school-wide director assessment
// must be visible AND startable only by an active student at that school.
func TestSchoolWideAssignmentLearnerAudiencePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required; Database CI applies public migrations")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
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
	const schoolA = "00000000-0000-0000-0000-000000005001"
	const schoolB = "00000000-0000-0000-0000-000000005002"
	const actor = "00000000-0000-0000-0000-000000005003"
	const pupilA = "00000000-0000-0000-0000-000000005004"
	const pupilB = "00000000-0000-0000-0000-000000005005"
	const inactive = "00000000-0000-0000-0000-000000005006"
	const path = "00000000-0000-0000-0000-000000005007"
	const assessmentID = "00000000-0000-0000-0000-000000005008"
	const assignmentID = "00000000-0000-0000-0000-000000005009"
	statements := []string{
		`INSERT INTO users(id,email,name,password_hash) VALUES
		 ('` + actor + `','audience-director@ci.invalid','مدير','test'),
		 ('` + pupilA + `','audience-a@ci.invalid','طالب أ','test'),
		 ('` + pupilB + `','audience-b@ci.invalid','طالب ب','test'),
		 ('` + inactive + `','audience-inactive@ci.invalid','طالب معلق','test')`,
		`INSERT INTO schools(id,code,name) VALUES ('` + schoolA + `','AUDIENCE-A','مدرسة أ'),('` + schoolB + `','AUDIENCE-B','مدرسة ب')`,
		`INSERT INTO school_memberships(school_id,user_id,role,status) VALUES
		 ('` + schoolA + `','` + pupilA + `','student','active'),
		 ('` + schoolB + `','` + pupilB + `','student','active'),
		 ('` + schoolA + `','` + inactive + `','student','suspended')`,
		`INSERT INTO paths(id,code,name) VALUES ('` + path + `','AUDIENCE-PATH','قدرات')`,
		`INSERT INTO assessments(id,assessment_code,owner_type,owner_school_id,workflow_status,current_version,published_version,is_published) VALUES
		 ('` + assessmentID + `','AUDIENCE-EXAM','school','` + schoolA + `','approved',1,1,true)`,
		`INSERT INTO assessment_versions(assessment_id,version,title,path_id,assessment_kind,normal_mode,version_status,published_at) VALUES
		 ('` + assessmentID + `',1,'اختبار المدرسة','` + path + `','normal','exam','published',now())`,
		`INSERT INTO assessment_assignments(id,assessment_id,assessment_version,school_id,created_by,targets_entire_school)
		 VALUES ('` + assignmentID + `','` + assessmentID + `',1,'` + schoolA + `','` + actor + `',true)`,
	}
	for _, sql := range statements {
		if _, err := tx.Exec(ctx, sql); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := tx.Exec(ctx, `SET CONSTRAINTS ALL IMMEDIATE`); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		pupil   string
		allowed bool
	}{
		{pupilA, true}, {pupilB, false}, {inactive, false},
	} {
		items, _, err := listLearnerAssignmentsFrom(ctx, tx, tc.pupil, 1, 10)
		if err != nil {
			t.Fatal(err)
		}
		if (len(items) == 1) != tc.allowed {
			t.Fatalf("wrong visible audience for %s: %+v", tc.pupil, items)
		}
		_, _, _, _, err = loadStartAssignedTarget(ctx, tx, tc.pupil, assignmentID)
		if tc.allowed && err != nil {
			t.Fatalf("allowed school pupil cannot start: %v", err)
		}
		if !tc.allowed && !errors.Is(err, pgx.ErrNoRows) {
			t.Fatalf("unauthorized student could start: %v", err)
		}
	}
}
