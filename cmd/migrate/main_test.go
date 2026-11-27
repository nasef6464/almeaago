package main

import (
	"context"
	"io"
	"os"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5"
)

func TestLoadMigrationsRejectsMissingPairAndDuplicateVersion(t *testing.T) {
	for _, files := range []fstest.MapFS{
		{"000001_first.up.sql": {Data: []byte("SELECT 1;")}},
		{
			"000001_first.up.sql": {Data: []byte("SELECT 1;")}, "000001_first.down.sql": {Data: []byte("SELECT 1;")},
			"000001_second.up.sql": {Data: []byte("SELECT 1;")}, "000001_second.down.sql": {Data: []byte("SELECT 1;")},
		},
	} {
		if _, err := loadMigrations(files); err == nil {
			t.Fatal("accepted incomplete migration history")
		}
	}
}

func TestLoadMigrationsAllowsVersionsReservedByOtherBranches(t *testing.T) {
	files := fstest.MapFS{
		"000001_first.up.sql": {Data: []byte("SELECT 1;")}, "000001_first.down.sql": {Data: []byte("SELECT 1;")},
		"000004_fourth.up.sql": {Data: []byte("SELECT 1;")}, "000004_fourth.down.sql": {Data: []byte("SELECT 1;")},
	}
	list, err := loadMigrations(files)
	if err != nil || len(list) != 2 || list[1].name != "000004_fourth" {
		t.Fatalf("branch-local migration pairs: %v, %v", list, err)
	}
}

func TestLocalConnectionPolicy(t *testing.T) {
	for _, tc := range []struct {
		dsn string
		ok  bool
	}{
		{"postgres://dev@127.0.0.1/test", true},
		{"postgres://dev@[::1]/test", true},
		{"host=127.0.0.1,remote.invalid dbname=test", false},
		{"postgres://dev@remote.invalid/test", false},
		{"", false},
	} {
		if _, err := localConfig(tc.dsn); (err == nil) != tc.ok {
			t.Fatalf("connection policy for %q: %v", tc.dsn, err)
		}
	}
}

// Requires a fresh, dedicated local database. Never shares the application database.
func TestMigrationResumePostgres(t *testing.T) {
	dsn := os.Getenv("MIGRATION_TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("fresh local test database not configured")
	}
	config, err := localConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	ctx := context.Background()
	conn, err := pgx.ConnectConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close(ctx)
	first := migration{"000001_first", "CREATE TABLE first_marker (id int);", "DROP TABLE first_marker;"}
	if _, err := conn.Exec(ctx, "CREATE TABLE unmanaged_marker (id int)"); err != nil {
		t.Fatal(err)
	}
	if err := run(ctx, conn, []migration{first}, "up", io.Discard); err == nil {
		t.Fatal("untracked schema was accepted")
	}
	if _, err := conn.Exec(ctx, "DROP TABLE unmanaged_marker"); err != nil {
		t.Fatal(err)
	}
	broken := migration{"000002_second", "CREATE TABLE second_marker (id int); SELECT 1/0;", "DROP TABLE second_marker;"}
	if err := run(ctx, conn, []migration{first, broken}, "up", io.Discard); err == nil {
		t.Fatal("failing migration returned success")
	}
	token := func(table string, want bool) {
		t.Helper()
		var exists bool
		if err := conn.QueryRow(ctx, "SELECT to_regclass($1) IS NOT NULL", table).Scan(&exists); err != nil || exists != want {
			t.Fatalf("%s exists=%v, want %v, error=%v", table, exists, want, err)
		}
	}
	token("first_marker", true)
	token("second_marker", false)
	broken.up = "CREATE TABLE second_marker (id int);"
	for range 2 {
		if err := run(ctx, conn, []migration{first, broken}, "up", io.Discard); err != nil {
			t.Fatal(err)
		}
	}
	token("second_marker", true)
	changed := first
	changed.up += " SELECT 1;"
	if err := run(ctx, conn, []migration{changed, broken}, "up", io.Discard); err == nil {
		t.Fatal("changed migration history was accepted")
	}
	if err := run(ctx, conn, []migration{first, broken}, "down", io.Discard); err != nil {
		t.Fatal(err)
	}
	token("first_marker", false)
	token("second_marker", false)
}
