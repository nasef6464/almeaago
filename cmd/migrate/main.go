// Command migrate runs ALMEAA's versioned SQL on local development and CI databases.
package main

import (
	"context"
	"crypto/sha256"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"net/netip"
	"os"
	"os/signal"
	"regexp"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
)

type migration struct{ name, up, down string }

const ledger = "public.almeaa_local_migrations"
const lockID int64 = 0x414c4d454141

var migrationName = regexp.MustCompile(`^([0-9]{6})_[a-z0-9_]+\.(up|down)\.sql$`)
var transactionLine = regexp.MustCompile(`(?im)^[ \t]*(BEGIN|COMMIT|ROLLBACK)[ \t]*;[ \t]*$`)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt)
	defer stop()
	if err := command(ctx, os.Args[1:]); err != nil {
		fmt.Fprintln(os.Stderr, "migrate:", err)
		os.Exit(1)
	}
}

func command(ctx context.Context, args []string) error {
	if len(args) != 1 || (args[0] != "up" && args[0] != "down") {
		return errors.New("usage: go run ./cmd/migrate up|down")
	}
	if args[0] == "down" && os.Getenv("MIGRATE_ALLOW_DOWN") != "1" {
		return errors.New("rolling back all migrations requires MIGRATE_ALLOW_DOWN=1 on a disposable database")
	}
	cfg, err := localConfig(os.Getenv("DATABASE_URL"))
	if err != nil {
		return err
	}
	migrations, err := loadMigrations(os.DirFS("migrations"))
	if err != nil {
		return err
	}
	conn, err := pgx.ConnectConfig(ctx, cfg)
	if err != nil {
		return fmt.Errorf("connect to local PostgreSQL: %w", err)
	}
	defer conn.Close(context.Background())
	return run(ctx, conn, migrations, args[0], os.Stdout)
}

func localConfig(dsn string) (*pgx.ConnConfig, error) {
	if strings.TrimSpace(dsn) == "" {
		return nil, errors.New("DATABASE_URL is required")
	}
	cfg, err := pgx.ParseConfig(dsn)
	if err != nil {
		return nil, errors.New("invalid DATABASE_URL")
	}
	local := func(host string) bool {
		ip, err := netip.ParseAddr(host)
		return host == "localhost" || err == nil && ip.IsLoopback()
	}
	if !local(cfg.Host) {
		return nil, errors.New("the migration command requires a loopback PostgreSQL host")
	}
	for _, fallback := range cfg.Fallbacks {
		if !local(fallback.Host) {
			return nil, errors.New("a non-local PostgreSQL fallback is not allowed")
		}
	}
	cfg.RuntimeParams["search_path"] = "public"
	return cfg, nil
}

func loadMigrations(dir fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(dir, ".")
	if err != nil {
		return nil, err
	}
	pairs := map[string]migration{}
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasSuffix(name, ".sql") {
			continue
		}
		parts := migrationName.FindStringSubmatch(name)
		if parts == nil {
			return nil, fmt.Errorf("invalid migration filename %s", name)
		}
		key := strings.TrimSuffix(name, "."+parts[2]+".sql")
		data, err := fs.ReadFile(dir, name)
		if err != nil {
			return nil, err
		}
		sql, err := migrationBody(string(data))
		if err != nil {
			return nil, fmt.Errorf("%s: %w", name, err)
		}
		pair := pairs[key]
		pair.name = key
		if parts[2] == "up" {
			pair.up = sql
		} else {
			pair.down = sql
		}
		pairs[key] = pair
	}
	list := make([]migration, 0, len(pairs))
	for _, pair := range pairs {
		list = append(list, pair)
	}
	sort.Slice(list, func(i, j int) bool { return list[i].name < list[j].name })
	if len(list) == 0 {
		return nil, errors.New("no migrations found")
	}
	previous := "000000"
	for _, pair := range list {
		version := pair.name[:6]
		if version == previous {
			return nil, fmt.Errorf("invalid or duplicate migration version %s", version)
		}
		if pair.up == "" || pair.down == "" {
			return nil, fmt.Errorf("missing migration pair for %s", pair.name)
		}
		previous = version
	}
	return list, nil
}

// The runner owns the transaction so the SQL and its ledger entry commit together.
func migrationBody(sql string) (string, error) {
	sql = strings.ReplaceAll(strings.TrimPrefix(sql, "\ufeff"), "\r\n", "\n")
	lines := transactionLine.FindAllStringSubmatchIndex(sql, -1)
	if len(lines) == 0 && strings.TrimSpace(sql) != "" {
		return sql, nil
	}
	if len(lines) == 2 {
		begin, end := lines[0], lines[1]
		commentsOnly := func(text string) bool {
			for _, line := range strings.Split(text, "\n") {
				line = strings.TrimSpace(line)
				if line != "" && !strings.HasPrefix(line, "--") {
					return false
				}
			}
			return true
		}
		if strings.EqualFold(sql[begin[2]:begin[3]], "BEGIN") &&
			strings.EqualFold(sql[end[2]:end[3]], "COMMIT") &&
			commentsOnly(sql[:begin[0]]) && commentsOnly(sql[end[1]:]) {
			body := sql[begin[1]:end[0]]
			if strings.TrimSpace(body) != "" {
				return sql[:begin[0]] + body + sql[end[1]:], nil
			}
		}
	}
	return "", errors.New("expected SQL with at most one outer BEGIN/COMMIT pair")
}

func run(ctx context.Context, conn *pgx.Conn, migrations []migration, direction string, log io.Writer) error {
	if _, err := conn.Exec(ctx, "SELECT pg_advisory_lock($1)", lockID); err != nil {
		return err
	}
	defer conn.Exec(context.Background(), "SELECT pg_advisory_unlock($1)", lockID)

	count, err := appliedCount(ctx, conn, migrations)
	if err != nil {
		return err
	}
	changed := len(migrations) - count
	if direction == "down" {
		changed = count
		for i := count - 1; i >= 0; i-- {
			if err := change(ctx, conn, migrations[i], false, log); err != nil {
				return err
			}
		}
	} else {
		for _, m := range migrations[count:] {
			if err := change(ctx, conn, m, true, log); err != nil {
				return err
			}
		}
	}
	fmt.Fprintf(log, "%s complete (%d migrations changed)\n", direction, changed)
	return nil
}

func appliedCount(ctx context.Context, conn *pgx.Conn, migrations []migration) (int, error) {
	var tracked, populated bool
	err := conn.QueryRow(ctx, `SELECT to_regclass($1) IS NOT NULL,
		EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
		WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f'))`, ledger).Scan(&tracked, &populated)
	if err != nil {
		return 0, err
	}
	if !tracked {
		if populated {
			return 0, errors.New("database has an untracked public schema; use a fresh local database")
		}
		_, err := conn.Exec(ctx, "CREATE TABLE "+ledger+" (name text PRIMARY KEY, digest text NOT NULL)")
		return 0, err
	}
	rows, err := conn.Query(ctx, "SELECT name, digest FROM "+ledger+" ORDER BY name")
	if err != nil {
		return 0, err
	}
	defer rows.Close()
	count := 0
	for rows.Next() {
		var name, digest string
		if err := rows.Scan(&name, &digest); err != nil {
			return 0, err
		}
		if count >= len(migrations) || name != migrations[count].name || digest != checksum(migrations[count]) {
			return 0, fmt.Errorf("recorded migration %s does not match local migration history", name)
		}
		count++
	}
	return count, rows.Err()
}

func checksum(m migration) string {
	return fmt.Sprintf("%x", sha256.Sum256([]byte(m.up+"\x00"+m.down)))
}

func change(ctx context.Context, conn *pgx.Conn, m migration, up bool, log io.Writer) error {
	direction, sql := "down", m.down
	if up {
		direction, sql = "up", m.up
	}
	fmt.Fprintf(log, "%s %s\n", direction, m.name)
	err := pgx.BeginFunc(ctx, conn, func(tx pgx.Tx) error {
		if _, err := tx.Exec(ctx, sql); err != nil {
			return err
		}
		if up {
			_, err := tx.Exec(ctx, "INSERT INTO "+ledger+" (name, digest) VALUES ($1, $2)", m.name, checksum(m))
			return err
		}
		_, err := tx.Exec(ctx, "DELETE FROM "+ledger+" WHERE name = $1", m.name)
		return err
	})
	if err != nil {
		return fmt.Errorf("%s %s: %w", direction, m.name, err)
	}
	return nil
}
