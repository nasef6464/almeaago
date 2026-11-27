package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func TestScopedLearningEvidencePostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("disposable migrated PostgreSQL required")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	// Copy actual migrated columns into session-local fixtures.
	for _, table := range []string{
		"users", "user_roles", "schools", "classes", "teaching_assignments", "class_memberships",
		"school_memberships", "school_membership_permissions", "school_contracts", "school_contract_modules",
		"school_supervisor_scopes", "assessments", "mastery_evidence", "mastery_evidence_skills", "skills",
		"subjects", "paths",
	} {
		if _, err := db.Exec(ctx, "CREATE TEMP TABLE "+table+" AS SELECT * FROM public."+table+" WITH NO DATA"); err != nil {
			t.Fatal(err)
		}
	}
	_, err = db.Exec(ctx, `
		INSERT INTO users(id,name,email,status) VALUES
			('10000000-0000-0000-0000-000000000001','طالبة أ','a@example.invalid','active'),
			('10000000-0000-0000-0000-000000000002','طالبة ب','b@example.invalid','active');
		INSERT INTO user_roles(user_id,role)
			SELECT id,'student' FROM users;
		INSERT INTO schools(id,status) VALUES
			('10000000-0000-0000-0000-000000000003','active'),('10000000-0000-0000-0000-000000000004','active');
		INSERT INTO paths(id,status) VALUES ('10000000-0000-0000-0000-000000000012','active');
		INSERT INTO subjects(id,path_id,status)
			VALUES('10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000012','active');
		INSERT INTO classes(id,school_id,status) VALUES
			('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000003','active'),
			('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000004','active');
		INSERT INTO class_memberships(user_id,class_id,status) VALUES
			('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','active'),
			('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000006','active');
		INSERT INTO school_memberships(id,school_id,user_id,role,status) VALUES
			(uuidv7(),'10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000001','student','active'),
			(uuidv7(),'10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000002','student','active'),
			(uuidv7(),'10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000007','teacher','active'),
			(uuidv7(),'10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000007','teacher','active'),
			(uuidv7(),'10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000008','supervisor','active'),
			('10000000-0000-0000-0000-000000000013','10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000009','school_admin','active');
		INSERT INTO teaching_assignments(school_id,teacher_id,class_id,subject_id,status)
			SELECT school_id,'10000000-0000-0000-0000-000000000007',id,'10000000-0000-0000-0000-000000000010','active' FROM classes;
		INSERT INTO school_supervisor_scopes(school_id,supervisor_user_id,scope_type,status)
			VALUES('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000008','school','active');
		INSERT INTO school_contracts(id,school_id,status)
			VALUES('10000000-0000-0000-0000-000000000014','10000000-0000-0000-0000-000000000003','active');
		INSERT INTO school_contract_modules(contract_id,module_code,enabled)
			VALUES('10000000-0000-0000-0000-000000000014','SCHOOL_INTELLIGENCE',true);
		INSERT INTO school_membership_permissions(membership_id,permission)
			VALUES('10000000-0000-0000-0000-000000000013','SCHOOL_REPORTS_DETAILED_VIEW');
		INSERT INTO assessments(id,owner_type,owner_school_id) VALUES
			('10000000-0000-0000-0000-000000000015','school','10000000-0000-0000-0000-000000000003'),
			('10000000-0000-0000-0000-000000000016','school','10000000-0000-0000-0000-000000000004');
		INSERT INTO skills(id,name) VALUES ('10000000-0000-0000-0000-000000000011','الجبر');
		INSERT INTO mastery_evidence(id,student_id,subject_id,assessment_id,source_attempt_id,self_attempt_id,answered,is_correct,occurred_at)
		VALUES
			(uuidv7(),'10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000015',uuidv7(),NULL,true,true,now()),
			(uuidv7(),'10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010','10000000-0000-0000-0000-000000000016',uuidv7(),NULL,true,false,now()),
			(uuidv7(),'10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000010',NULL,NULL,uuidv7(),true,false,now());
		INSERT INTO mastery_evidence_skills(evidence_id,skill_id)
			SELECT id,'10000000-0000-0000-0000-000000000011' FROM mastery_evidence;
	`)
	if err != nil {
		t.Fatal(err)
	}

	service := learningapp.NewEvidenceService(New(db))
	teacher := identity.User{ID: "10000000-0000-0000-0000-000000000007", Roles: []identity.Role{identity.RoleTeacher}}
	supervisor := identity.User{ID: "10000000-0000-0000-0000-000000000008", Roles: []identity.Role{identity.RoleSupervisor}}
	director := identity.User{ID: "10000000-0000-0000-0000-000000000009", Roles: []identity.Role{identity.RoleSchoolAdmin}}
	q := learning.LearningEvidenceQuery{
		Source: "school_assessment", SubjectID: "10000000-0000-0000-0000-000000000010",
		SchoolID: "10000000-0000-0000-0000-000000000003", ClassID: "10000000-0000-0000-0000-000000000005",
	}
	for _, actor := range []identity.User{teacher, supervisor, director} {
		report, err := service.Read(ctx, actor, q)
		if err != nil || report.Total != 1 || len(report.Students) != 1 || len(report.Students[0].Skills) != 1 {
			t.Fatalf("school evidence for %v: %+v %v", actor.Roles, report, err)
		}
		skill := report.Students[0].Skills[0]
		if skill.Questions != 1 || skill.Correct != 1 || skill.Tests != 1 {
			t.Fatalf("other owner or self practice leaked into school results: %+v", skill)
		}
	}

	q.Source = "platform_self_study"
	report, err := service.Read(ctx, teacher, q)
	if err != nil || len(report.Students) != 1 || len(report.Students[0].Skills) != 1 {
		t.Fatalf("self evidence: %+v %v", report, err)
	}
	skill := report.Students[0].Skills[0]
	if skill.Questions != 1 || skill.Correct != 0 || skill.Tests != 1 {
		t.Fatalf("self evidence should contain only the self attempt: %+v", skill)
	}
	q.ClassID = "10000000-0000-0000-0000-000000000006"
	if _, err := service.Read(ctx, teacher, q); !errors.Is(err, learningapp.ErrForbidden) {
		t.Fatalf("cross-school class was accepted: %v", err)
	}
	q.ClassID = ""
	if _, err := db.Exec(ctx, "UPDATE pg_temp.school_contract_modules SET enabled=false"); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Read(ctx, director, q); !errors.Is(err, learningapp.ErrForbidden) {
		t.Fatalf("director with revoked contract module was accepted: %v", err)
	}
}
