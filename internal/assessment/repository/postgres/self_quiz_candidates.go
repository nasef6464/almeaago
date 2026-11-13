package postgres

import (
	"context"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

// Visible path ancestry and subject/level checks match the snapshot boundary.
const selfQuizVisibleScope = `WITH RECURSIVE visible_paths AS (
 SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true') <> 'false'
 UNION ALL SELECT p.id FROM paths p JOIN visible_paths vp ON p.parent_path_id=vp.id WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false'
), visible_subjects AS (
 SELECT s.id,s.path_id FROM subjects s JOIN visible_paths p ON p.id=s.path_id
 LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=s.path_id
 WHERE s.status='active' AND COALESCE(s.presentation->>'isVisible','true') <> 'false'
 AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true') <> 'false'))
) `

// ResolveSelfQuizSkills rejects unknown, inactive and hidden scopes rather
// than silently widening a targeted attempt.
func (r *Repository) ResolveSelfQuizSkills(ctx context.Context, ids []string) ([]assessment.SelfQuizSkillScope, error) {
	if len(ids) == 0 {
		return []assessment.SelfQuizSkillScope{}, nil
	}
	rows, err := r.db.Query(ctx, selfQuizVisibleScope+`SELECT s.id::text,vs.path_id::text,vs.id::text,COALESCE(sec.id::text,'') FROM skills s JOIN visible_subjects vs ON vs.id=s.subject_id LEFT JOIN skills parent ON parent.id=s.parent_skill_id AND parent.subject_id=s.subject_id AND parent.status='active' LEFT JOIN taxonomy_skill_sections sec ON sec.id=COALESCE(s.section_id,parent.section_id) AND sec.subject_id=s.subject_id AND sec.status='active' WHERE s.status='active' AND (s.parent_skill_id IS NULL OR parent.id IS NOT NULL) AND s.id=ANY($1::uuid[]) ORDER BY s.id`, ids)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := make([]assessment.SelfQuizSkillScope, 0, len(ids))
	for rows.Next() {
		var scope assessment.SelfQuizSkillScope
		if err := rows.Scan(&scope.ID, &scope.PathID, &scope.SubjectID, &scope.SectionID); err != nil {
			return nil, err
		}
		scope.Active = true
		out = append(out, scope)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	wanted := make(map[string]struct{}, len(ids))
	for _, id := range ids {
		wanted[strings.ToLower(strings.TrimSpace(id))] = struct{}{}
	}
	if len(out) != len(wanted) {
		return nil, assessment.ErrSelfQuizScopeMismatch
	}
	return out, nil
}

func (r *Repository) ValidateSelfQuizSection(ctx context.Context, input assessment.SelfQuizInput) error {
	var valid bool
	err := r.db.QueryRow(ctx, selfQuizVisibleScope+`SELECT EXISTS(SELECT 1 FROM taxonomy_skill_sections sec JOIN visible_subjects vs ON vs.id=sec.subject_id WHERE sec.id=$1::uuid AND sec.status='active' AND ($2='' OR vs.path_id=NULLIF($2,'')::uuid) AND ($3='' OR vs.id=NULLIF($3,'')::uuid))`, input.SectionID, input.PathID, input.SubjectID).Scan(&valid)
	if err != nil {
		return err
	}
	if !valid {
		return assessment.ErrSelfQuizScopeMismatch
	}
	return nil
}

// ListSelfQuizCandidates streams all eligible candidates without a page limit.
// Platform question membership in a paid assessment does not itself lock the
// standalone self quiz; legacy access applied package rules to content items.
func (r *Repository) ListSelfQuizCandidates(ctx context.Context, input assessment.SelfQuizInput) ([]assessment.EligibleSelfQuizQuestion, error) {
	in, err := assessment.NormalizeSelfQuizInput(input)
	if err != nil {
		return nil, err
	}
	rows, err := r.db.Query(ctx, selfQuizVisibleScope+`
 SELECT q.id::text,q.current_version,vs.path_id::text,vs.id::text,v.question_type,COALESCE(v.difficulty,''),links.active_skills,COALESCE(q.section_id::text,'')
 FROM questions q
 JOIN question_versions v ON v.question_id=q.id AND v.version=q.current_version
 CROSS JOIN LATERAL (
   SELECT count(DISTINCT s.subject_id)::int AS subjects,
     (array_agg(DISTINCT s.subject_id) FILTER (WHERE s.subject_id IS NOT NULL))[1] AS linked_subject,
     COALESCE(array_agg(s.id::text ORDER BY s.id) FILTER (WHERE s.status='active'),ARRAY[]::text[]) AS active_skills
   FROM question_skill_links l JOIN skills s ON s.id=l.skill_id WHERE l.question_id=q.id
 ) links
 JOIN visible_subjects vs ON vs.id=COALESCE(q.subject_id,CASE WHEN links.subjects=1 THEN links.linked_subject END)
 WHERE q.workflow_status='approved' AND q.owner_type='platform'
 AND (q.path_id IS NULL OR q.path_id=vs.path_id)
 AND (links.subjects=0 OR (links.subjects=1 AND links.linked_subject=vs.id))
 AND v.question_type IN ('mcq','true_false')
 AND EXISTS(SELECT 1 FROM question_options o WHERE o.question_id=q.id AND o.version=q.current_version AND o.option_index=v.correct_option_index)
 AND ($1='' OR vs.path_id=NULLIF($1,'')::uuid) AND ($2='' OR vs.id=NULLIF($2,'')::uuid)
 AND ($3='all' OR v.question_type=$3)
 AND ($4='' OR q.section_id=NULLIF($4,'')::uuid)
 ORDER BY q.id`, in.PathID, in.SubjectID, in.QuestionType, in.SectionID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := []assessment.EligibleSelfQuizQuestion{}
	for rows.Next() {
		var q assessment.EligibleSelfQuizQuestion
		if err = rows.Scan(&q.ID, &q.Version, &q.PathID, &q.SubjectID, &q.Type, &q.Difficulty, &q.SkillIDs, &q.SectionID); err != nil {
			return nil, err
		}
		out = append(out, q)
	}
	return out, rows.Err()
}
