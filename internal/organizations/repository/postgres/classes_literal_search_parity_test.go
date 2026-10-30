package postgres

import (
	"context"
	"fmt"
	"os"
	"strings"
	"testing"
	"time"

	"github.com/jackc/pgx/v5"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// The class search is a literal user-entered substring, not a SQL LIKE pattern.
// A matching code remains exact and case-insensitive. School/role predicates
// must remain in the same query, independently of the search term.
func TestClassListLiteralSearchQuery(t *testing.T) {
	access := org.AccessContext{
		ActorUserID: "00000000-0000-0000-0000-000000008001",
		ActorRoles:  []identity.Role{identity.RoleSchoolAdmin},
	}
	school := "00000000-0000-0000-0000-000000008002"
	for _, tc := range []struct {
		name, input, want string
		filtered          bool
	}{
		{"percent", "%", "%", true},
		{"underscore", "_", "_", true},
		{"backslash", "\\", "\\", true},
		{"trim and lowercase", "  FIRST  ", "first", true},
		{"empty after trim", "   ", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			where, args := buildClassListWhere(access, school, org.ClassListQuery{Search: tc.input})
			if !strings.Contains(where, "sm.status = 'active'") ||
				!strings.Contains(where, "c.school_id = $1::uuid") {
				t.Fatalf("lost school membership scope: %s", where)
			}
			if tc.filtered {
				if len(args) != 3 || args[2] != tc.want {
					t.Fatalf("search should be literal and normalized: %#v", args)
				}
				if !strings.Contains(where, "strpos(lower(c.name), $3) > 0") ||
					!strings.Contains(where, "lower(c.code) = $3") {
					t.Fatalf("class name must use literal substring and code exact match: %s", where)
				}
			} else if len(args) != 2 {
				t.Fatalf("blank search must not filter classes: %#v", args)
			}
		})
	}
}

func TestClassListLiteralSearchPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for isolated PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(context.Background())
	schema := fmt.Sprintf("class_literal_%d", time.Now().UnixNano())
	if _, err := conn.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	defer conn.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE")
	tx, err := conn.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err := tx.Exec(ctx, "SET LOCAL search_path TO "+schema); err != nil {
		t.Fatal(err)
	}
	for _, ddl := range []string{
		"CREATE TABLE classes (id uuid PRIMARY KEY, school_id uuid NOT NULL, name text NOT NULL, code text NOT NULL, status text NOT NULL)",
		"CREATE TABLE school_memberships (school_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, status text NOT NULL)",
	} {
		if _, err := tx.Exec(ctx, ddl); err != nil {
			t.Fatal(err)
		}
	}
	const actor = "00000000-0000-0000-0000-000000008001"
	const school = "00000000-0000-0000-0000-000000008002"
	const otherSchool = "00000000-0000-0000-0000-000000008003"
	if _, err := tx.Exec(ctx, `INSERT INTO school_memberships (school_id,user_id,role,status)
		VALUES ($1,$2,'school_admin','active')`, school, actor); err != nil {
		t.Fatal(err)
	}
	if _, err := tx.Exec(ctx, `INSERT INTO classes (id,school_id,name,code,status) VALUES
		('00000000-0000-0000-0000-000000008011',$1,'فصل%','PCT','active'),
		('00000000-0000-0000-0000-000000008012',$1,'فصل_','UNDER','active'),
		('00000000-0000-0000-0000-000000008013',$1,'فصل\','SLASH','active'),
		('00000000-0000-0000-0000-000000008014',$1,'الأول ثانوي','FIRST','active'),
		('00000000-0000-0000-0000-000000008015',$1,'صف خامس','P%','active'),
		('00000000-0000-0000-0000-000000008016',$1,'مؤرشف%','ARCH','archived'),
		('00000000-0000-0000-0000-000000008017',$2,'خارج%','FOREIGN','active')`, school, otherSchool); err != nil {
		t.Fatal(err)
	}
	access := org.AccessContext{ActorUserID: actor, ActorRoles: []identity.Role{identity.RoleSchoolAdmin}}
	for _, tc := range []struct {
		search string
		want   int
	}{
		{"%", 2}, {"_", 1}, {"\\", 1},
		{"  P%  ", 1}, {"  الأول ", 1}, {"  first  ", 1},
		{"   ", 5}, {"خارج", 0}, {"مؤرشف", 0}, {"absent", 0},
	} {
		where, args := buildClassListWhere(access, school, org.ClassListQuery{Search: tc.search})
		var got int
		if err := tx.QueryRow(ctx, "SELECT count(*)::int FROM classes c "+where, args...).Scan(&got); err != nil {
			t.Fatalf("search %q: %v", tc.search, err)
		}
		if got != tc.want {
			t.Errorf("search %q: got %d, want %d", tc.search, got, tc.want)
		}
	}
}
