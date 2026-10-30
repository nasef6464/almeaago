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

// Legacy dashboards/admin/SchoolsManager/rosterViewModel.ts uses
// String.includes(search.trim().toLowerCase()), not SQL wildcard matching.
// This is a search-only contract; it does not change roster authorization.
func TestSchoolRosterSearchMatchesLiteralLegacyIncludes(t *testing.T) {
	access := org.AccessContext{
		ActorUserID: "00000000-0000-0000-0000-000000009001",
		ActorRoles:  []identity.Role{identity.RoleSchoolAdmin},
	}
	school := "00000000-0000-0000-0000-000000009002"
	for _, tc := range []struct {
		name     string
		search   string
		want     string
		filtered bool
	}{
		{"percent", "%", "%", true},
		{"underscore", "_", "_", true},
		{"backslash", "\\", "\\", true},
		{"trim and lowercase", "  AHMED  ", "ahmed", true},
		{"blank is no filter", "   ", "", false},
	} {
		t.Run(tc.name, func(t *testing.T) {
			where, args := buildRosterWhere(access, school, org.RosterQuery{Search: tc.search})
			if tc.filtered {
				if len(args) != 3 || args[2] != tc.want {
					t.Fatalf("literal trimmed search argument mismatch: %#v", args)
				}
				if !strings.Contains(where, "strpos(lower(u.name), $3) > 0") ||
					!strings.Contains(where, "strpos(lower(u.email), $3) > 0") {
					t.Fatalf("search must use literal substring semantics, got %s", where)
				}
			} else if len(args) != 2 {
				t.Fatalf("whitespace-only search must not filter: %#v", args)
			}
		})
	}
}

// Database CI proves actual PostgreSQL substring behavior, including school
// isolation. All fixtures live in a disposable schema, never production.
func TestSchoolRosterLiteralSearchPostgres(t *testing.T) {
	dsn := os.Getenv("DATABASE_URL")
	if dsn == "" {
		t.Skip("DATABASE_URL required for PostgreSQL integration")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	conn, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(context.Background())
	schema := fmt.Sprintf("roster_literal_%d", time.Now().UnixNano())
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
		"CREATE TABLE users (id uuid PRIMARY KEY, name text NOT NULL, email text)",
		"CREATE TABLE school_memberships (school_id uuid NOT NULL, user_id uuid NOT NULL, role text NOT NULL, status text NOT NULL)",
	} {
		if _, err := tx.Exec(ctx, ddl); err != nil {
			t.Fatal(err)
		}
	}
	const director = "00000000-0000-0000-0000-000000009001"
	const school = "00000000-0000-0000-0000-000000009002"
	const foreignSchool = "00000000-0000-0000-0000-000000009003"
	const percent = "00000000-0000-0000-0000-000000009011"
	const underscore = "00000000-0000-0000-0000-000000009012"
	const slash = "00000000-0000-0000-0000-000000009013"
	const plain = "00000000-0000-0000-0000-000000009014"
	const foreign = "00000000-0000-0000-0000-000000009015"
	_, err = tx.Exec(ctx, `INSERT INTO users (id,name,email) VALUES
        ($1,'مدير','director@invalid.test'),
        ($2,'نسبة%','percent@invalid.test'),
        ($3,'مؤشر_','underscore@invalid.test'),
        ($4,'مسار\\','slash@invalid.test'),
        ($5,'محمد','ahmed@invalid.test'),
        ($6,'خارج%','foreign@invalid.test')`,
		director, percent, underscore, slash, plain, foreign)
	if err != nil {
		t.Fatal(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO school_memberships (school_id,user_id,role,status) VALUES
        ($1,$3,'school_admin','active'),
        ($1,$4,'student','active'),
        ($1,$5,'student','active'),
        ($1,$6,'student','active'),
        ($1,$7,'student','active'),
        ($2,$8,'student','active')`,
		school, foreignSchool, director, percent, underscore, slash, plain, foreign)
	if err != nil {
		t.Fatal(err)
	}
	access := org.AccessContext{ActorUserID: director, ActorRoles: []identity.Role{identity.RoleSchoolAdmin}}
	for _, tc := range []struct {
		search string
		want   int
	}{
		{"%", 1}, {"_", 1}, {"\\", 1}, {"  محمد  ", 1},
		{"  AHMED  ", 1}, {"   ", 4}, {"absent", 0},
	} {
		where, args := buildRosterWhere(access, school, org.RosterQuery{Search: tc.search})
		var got int
		if err := tx.QueryRow(ctx, "SELECT COUNT(*)::int FROM users u "+where, args...).Scan(&got); err != nil {
			t.Fatalf("search %q: %v", tc.search, err)
		}
		if got != tc.want {
			t.Errorf("search %q: got %d, want %d", tc.search, got, tc.want)
		}
	}
}
