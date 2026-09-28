package postgres

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/jackc/pgx/v5"

	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type taxonomyRow struct {
	value bool
	err   error
}

func (r taxonomyRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if len(dest) != 1 {
		return fmt.Errorf("unexpected destination count %d", len(dest))
	}
	out, ok := dest[0].(*bool)
	if !ok {
		return fmt.Errorf("unexpected destination type %T", dest[0])
	}
	*out = r.value
	return nil
}

type taxonomyQueryStub struct {
	rows []taxonomyRow
	next int
}

func (q *taxonomyQueryStub) QueryRow(context.Context, string, ...any) pgx.Row {
	if q.next >= len(q.rows) {
		return taxonomyRow{err: fmt.Errorf("unexpected query %d", q.next+1)}
	}
	row := q.rows[q.next]
	q.next++
	return row
}

func mainLink(id string) question.SkillLink {
	return question.SkillLink{SkillID: id, RelationType: question.RelationMain}
}

func subLink(id string) question.SkillLink {
	return question.SkillLink{SkillID: id, RelationType: question.RelationSub}
}

func TestValidateTaxonomyRejectsForeignSubject(t *testing.T) {
	q := &taxonomyQueryStub{rows: []taxonomyRow{{value: false}}}
	err := (&Repository{}).validateTaxonomyTx(context.Background(), q, "path-1", "subject-foreign", []question.SkillLink{mainLink("main-1")})
	if !errors.Is(err, question.ErrInvalidTaxonomy) {
		t.Fatalf("expected invalid taxonomy for foreign subject, got %v", err)
	}
}

func TestValidateTaxonomyRejectsForeignMainSkill(t *testing.T) {
	q := &taxonomyQueryStub{rows: []taxonomyRow{{value: true}, {value: false}}}
	err := (&Repository{}).validateTaxonomyTx(context.Background(), q, "path-1", "subject-1", []question.SkillLink{mainLink("main-foreign")})
	if !errors.Is(err, question.ErrInvalidTaxonomy) {
		t.Fatalf("expected invalid taxonomy for foreign main skill, got %v", err)
	}
}

func TestValidateTaxonomyRejectsSubskillOutsideMainBranch(t *testing.T) {
	q := &taxonomyQueryStub{rows: []taxonomyRow{{value: true}, {value: true}, {value: false}}}
	err := (&Repository{}).validateTaxonomyTx(context.Background(), q, "path-1", "subject-1", []question.SkillLink{mainLink("main-1"), subLink("sub-foreign")})
	if !errors.Is(err, question.ErrInvalidTaxonomy) {
		t.Fatalf("expected invalid taxonomy for foreign subskill, got %v", err)
	}
}

func TestValidateTaxonomyRequiresSubskillWhenMainHasActiveChildren(t *testing.T) {
	q := &taxonomyQueryStub{rows: []taxonomyRow{{value: true}, {value: true}, {value: true}}}
	err := (&Repository{}).validateTaxonomyTx(context.Background(), q, "path-1", "subject-1", []question.SkillLink{mainLink("main-1")})
	if !errors.Is(err, question.ErrInvalidTaxonomy) {
		t.Fatalf("expected required-subskill rejection, got %v", err)
	}
}

func TestValidateTaxonomyAcceptsExactActiveBranch(t *testing.T) {
	q := &taxonomyQueryStub{rows: []taxonomyRow{{value: true}, {value: true}, {value: true}, {value: true}}}
	err := (&Repository{}).validateTaxonomyTx(context.Background(), q, "path-1", "subject-1", []question.SkillLink{mainLink("main-1"), subLink("sub-1")})
	if err != nil {
		t.Fatalf("expected exact active taxonomy branch, got %v", err)
	}
	if q.next != len(q.rows) {
		t.Fatalf("expected all validation queries to be consumed, got %d/%d", q.next, len(q.rows))
	}
}
