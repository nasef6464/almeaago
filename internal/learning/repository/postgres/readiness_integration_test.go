package postgres

import (
	"context"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"github.com/nasef6464/almeaago/internal/learning/application"
)

// The session-local table copies the migrated schema but never writes durable
// learner data. One pool connection keeps its temporary table visible to reads.
func TestReadinessSingleQueryPostgres(t *testing.T) {
	if os.Getenv("DATABASE_URL") == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	config, err := pgxpool.ParseConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		t.Fatal(err)
	}
	config.MaxConns = 1
	db, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err = db.Exec(ctx, `CREATE TEMP TABLE skill_progress AS SELECT * FROM public.skill_progress WITH NO DATA`); err != nil {
		t.Fatal(err)
	}
	const student = "00000000-0000-0000-0000-000000000001"
	const path = "00000000-0000-0000-0000-000000000002"
	const subject = "00000000-0000-0000-0000-000000000003"
	service := application.NewService(New(db), nil)
	actor := identity.User{ID: student, Roles: []identity.Role{identity.RoleStudent}}
	for _, count := range []int{0, 101, 10000, 10001} {
		if _, err = db.Exec(ctx, `TRUNCATE pg_temp.skill_progress`); err != nil {
			t.Fatal(err)
		}
		if _, err = db.Exec(ctx, `INSERT INTO pg_temp.skill_progress
			(student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,last_evidence_at,created_at,recommended_action)
			SELECT $1::uuid,$2::uuid,$3::uuid,md5(n::text)::uuid,90,'mastered',3,3,now(),now(),'advance'
			FROM generate_series(1,$4::int) n`, student, path, subject, count); err != nil {
			t.Fatal(err)
		}
		// Foreign actor, path, and subject must not enter the scoped result.
		if _, err = db.Exec(ctx, `INSERT INTO pg_temp.skill_progress
			(student_id,path_id,subject_id,skill_id,mastery,status,attempts,evidence_count,created_at,recommended_action)
			VALUES ($3::uuid,$2::uuid,$3::uuid,$1::uuid,0,'weak',1,1,now(),'measure'),
			($1::uuid,$3::uuid,$3::uuid,$1::uuid,0,'weak',1,1,now(),'measure'),
			($1::uuid,$2::uuid,$2::uuid,$1::uuid,0,'weak',1,1,now(),'measure')`, student, path, subject); err != nil {
			t.Fatal(err)
		}
		result, readErr := service.Readiness(ctx, actor, path, subject)
		if count > 10000 {
			if !errors.Is(readErr, application.ErrIncompleteReadiness) {
				t.Fatalf("overflow accepted: count=%d err=%v", count, readErr)
			}
			continue
		}
		if readErr != nil || result.TotalSkills != count || result.TotalEvidence != count*3 {
			t.Fatalf("scoped snapshot count=%d result=%+v err=%v", count, result, readErr)
		}
	}
}
