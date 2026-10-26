package postgres

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type materialRow struct {
	conflict bool
	err      error
}

func (r materialRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) == 1 {
		if value, ok := dest[0].(*bool); ok {
			*value = r.conflict
		}
	}
	return nil
}

type materialQuerier struct {
	queries  []string
	conflict bool
	fail     error
}

func (q *materialQuerier) QueryRow(_ context.Context, sql string, _ ...any) pgx.Row {
	q.queries = append(q.queries, sql)
	if q.fail != nil {
		return materialRow{err: q.fail}
	}
	return materialRow{conflict: q.conflict}
}

func TestAssignmentMaterialGuardSerializesAndRejectsDifferentActiveMaterial(t *testing.T) {
	q := &materialQuerier{conflict: true}
	err := ensureAssignmentMaterialTx(context.Background(), q, "school-1", "teacher-1", "subject-2")
	if !errors.Is(err, org.ErrConflict) {
		t.Fatalf("expected material conflict, got %v", err)
	}
	if len(q.queries) != 2 || !strings.Contains(q.queries[0], "FOR UPDATE") || !strings.Contains(q.queries[1], "status = 'active'") {
		t.Fatalf("expected serialized active-scope check, got %#v", q.queries)
	}
}

func TestAssignmentMaterialGuardAcceptsSameSubjectAndPropagatesDBFailure(t *testing.T) {
	q := &materialQuerier{}
	if err := ensureAssignmentMaterialTx(context.Background(), q, "school-1", "teacher-1", "subject-1"); err != nil {
		t.Fatalf("same-subject assignment should be allowed: %v", err)
	}
	failure := errors.New("database unavailable")
	q = &materialQuerier{fail: failure}
	if err := ensureAssignmentMaterialTx(context.Background(), q, "school-1", "teacher-1", "subject-1"); !errors.Is(err, failure) {
		t.Fatalf("expected database failure, got %v", err)
	}
}
