package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5"
	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

// CreateSelfQuizSnapshot is an internal persistence boundary, not an
// authorization API. Its caller must authenticate the student and authorize
// every selected question and scope before calling it. No HTTP route exposes
// this method until that candidate policy is wired and tested.
func (r *Repository) CreateSelfQuizSnapshot(ctx context.Context, studentID string, input assessment.SelfQuizInput, selected []assessment.EligibleSelfQuizQuestion) (string, error) {
	in, err := assessment.NormalizeSelfQuizInput(input)
	if err != nil {
		return "", err
	}
	if strings.TrimSpace(studentID) == "" {
		return "", assessment.ErrInvalidSelfQuizInput
	}
	canonical := in
	canonical.StartKey = ""
	canonical.SkillIDs = append([]string(nil), in.SkillIDs...)
	sort.Strings(canonical.SkillIDs)
	encoded, err := json.Marshal(canonical)
	if err != nil {
		return "", err
	}
	hash := sha256.Sum256(encoded)
	fingerprint := hex.EncodeToString(hash[:])

	tx, err := r.db.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, `SELECT pg_advisory_xact_lock(hashtext('self_quiz_start:' || $1))`, in.StartKey); err != nil {
		return "", err
	}
	var existingID, owner, kind, priorFingerprint string
	err = tx.QueryRow(ctx, `SELECT a.id::text,a.student_id::text,a.attempt_kind,COALESCE(s.request_fingerprint,'') FROM assessment_attempts a LEFT JOIN self_quiz_settings s ON s.attempt_id=a.id WHERE a.start_key=$1`, in.StartKey).Scan(&existingID, &owner, &kind, &priorFingerprint)
	if err == nil {
		if owner != studentID || kind != "self" || priorFingerprint != fingerprint {
			return "", assessment.ErrConflict
		}
		if err = tx.Commit(ctx); err != nil {
			return "", err
		}
		return existingID, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return "", err
	}
	if len(selected) == 0 {
		return "", assessment.ErrNoSelfQuizQuestions
	}
	if len(selected) > in.QuestionCount {
		return "", assessment.ErrInvalidSelfQuizInput
	}
	if in.SectionID != "" {
		var id string
		err = tx.QueryRow(ctx, selfQuizVisibleScope+`SELECT sec.id::text FROM taxonomy_skill_sections sec JOIN visible_subjects vs ON vs.id=sec.subject_id WHERE sec.id=$1::uuid AND sec.status='active' AND ($2='' OR vs.path_id=NULLIF($2,'')::uuid) AND ($3='' OR vs.id=NULLIF($3,'')::uuid) FOR SHARE OF sec`, in.SectionID, in.PathID, in.SubjectID).Scan(&id)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", assessment.ErrSelfQuizScopeMismatch
		}
		if err != nil {
			return "", err
		}
	}

	scopes := make([]assessment.SelfQuizSkillScope, 0, len(in.SkillIDs))
	for _, id := range in.SkillIDs {
		var scope assessment.SelfQuizSkillScope
		err = tx.QueryRow(ctx, `SELECT s.id::text,sub.path_id::text,s.subject_id::text,(s.status='active' AND sub.status='active' AND p.status='active' AND (s.parent_skill_id IS NULL OR parent.id IS NOT NULL)),COALESCE(sec.id::text,'') FROM skills s JOIN subjects sub ON sub.id=s.subject_id JOIN paths p ON p.id=sub.path_id LEFT JOIN skills parent ON parent.id=s.parent_skill_id AND parent.subject_id=s.subject_id AND parent.status='active' LEFT JOIN taxonomy_skill_sections sec ON sec.id=COALESCE(s.section_id,parent.section_id) AND sec.subject_id=s.subject_id AND sec.status='active' WHERE s.id=$1::uuid FOR SHARE OF s,sub,p`, id).Scan(&scope.ID, &scope.PathID, &scope.SubjectID, &scope.Active, &scope.SectionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", assessment.ErrSelfQuizScopeMismatch
		}
		if err != nil {
			return "", err
		}
		scopes = append(scopes, scope)
	}
	if err = assessment.ValidateSelfQuizSkills(in, scopes); err != nil {
		return "", err
	}
	verified := append([]assessment.EligibleSelfQuizQuestion(nil), selected...)
	for i := range verified {
		q := &verified[i]
		var current int
		var questionPath, questionSubject *string
		var correct *int
		var correctOptionExists bool
		err = tx.QueryRow(ctx, `SELECT q.current_version,q.path_id::text,q.subject_id::text,v.question_type,COALESCE(v.difficulty,''),v.correct_option_index,EXISTS(SELECT 1 FROM question_options o WHERE o.question_id=v.question_id AND o.version=v.version AND o.option_index=v.correct_option_index),COALESCE(q.section_id::text,'') FROM questions q JOIN question_versions v ON v.question_id=q.id AND v.version=q.current_version WHERE q.id=$1::uuid AND q.workflow_status='approved' AND q.owner_type='platform' FOR SHARE OF q,v`, q.ID).Scan(&current, &questionPath, &questionSubject, &q.Type, &q.Difficulty, &correct, &correctOptionExists, &q.SectionID)
		if errors.Is(err, pgx.ErrNoRows) {
			return "", assessment.ErrConflict
		}
		if err != nil {
			return "", err
		}
		if q.Version != current || correct == nil || !correctOptionExists || q.PathID == "" || q.SubjectID == "" || (questionPath != nil && !strings.EqualFold(*questionPath, q.PathID)) || (questionSubject != nil && !strings.EqualFold(*questionSubject, q.SubjectID)) {
			return "", assessment.ErrConflict
		}
		var visible bool
		err = tx.QueryRow(ctx, `WITH RECURSIVE visible_paths AS (SELECT id FROM paths WHERE parent_path_id IS NULL AND status='active' AND COALESCE(presentation->>'isVisible','true') <> 'false' UNION ALL SELECT p.id FROM paths p JOIN visible_paths a ON a.id=p.parent_path_id WHERE p.status='active' AND COALESCE(p.presentation->>'isVisible','true') <> 'false') SELECT EXISTS(SELECT 1 FROM subjects s JOIN visible_paths p ON p.id=s.path_id LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=s.path_id WHERE s.id=$1::uuid AND s.path_id=$2::uuid AND s.status='active' AND COALESCE(s.presentation->>'isVisible','true') <> 'false' AND (s.level_id IS NULL OR (l.status='active' AND COALESCE(l.presentation->>'isVisible','true') <> 'false')))`, q.SubjectID, q.PathID).Scan(&visible)
		if err != nil {
			return "", err
		}
		if !visible {
			return "", assessment.ErrConflict
		}
		rows, e := tx.Query(ctx, `SELECT s.id::text,s.subject_id::text FROM question_skill_links l JOIN skills s ON s.id=l.skill_id WHERE l.question_id=$1::uuid AND s.status='active' ORDER BY s.id`, q.ID)
		if e != nil {
			return "", e
		}
		q.SkillIDs = nil
		for rows.Next() {
			var skill, skillSubject string
			if e = rows.Scan(&skill, &skillSubject); e != nil {
				break
			}
			if !strings.EqualFold(skillSubject, q.SubjectID) {
				e = assessment.ErrSelfQuizScopeMismatch
				break
			}
			q.SkillIDs = append(q.SkillIDs, skill)
		}
		if e == nil {
			e = rows.Err()
		}
		rows.Close()
		if e != nil {
			return "", e
		}
		// A legacy question without an explicit subject can only inherit a
		// subject from an actual, unambiguous set of linked skills.
		if questionSubject == nil && len(q.SkillIDs) == 0 {
			return "", assessment.ErrSelfQuizScopeMismatch
		}
	}
	checked, err := assessment.SelectSelfQuizQuestions(in, scopes, verified, in.SectionID != "", func(int) int { return 0 })
	if err != nil {
		return "", err
	}
	if len(checked) != len(verified) {
		return "", assessment.ErrConflict
	}

	var id string
	err = tx.QueryRow(ctx, `INSERT INTO assessment_attempts(student_id,attempt_kind,attempt_number,start_key,expires_at) VALUES($1::uuid,'self',1,$2,now()+make_interval(mins=>$3)) RETURNING id::text`, studentID, in.StartKey, in.TimeLimitMinutes).Scan(&id)
	if err != nil {
		return "", mapError(err)
	}
	_, err = tx.Exec(ctx, `INSERT INTO self_quiz_settings(attempt_id,path_id,subject_id,difficulty,question_type,evidence_type,question_count,time_limit_minutes,request_fingerprint,section_id) VALUES($1::uuid,NULLIF($2,'')::uuid,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,NULLIF($10,'')::uuid)`, id, in.PathID, in.SubjectID, in.Difficulty, in.QuestionType, in.EvidenceType, in.QuestionCount, in.TimeLimitMinutes, fingerprint, in.SectionID)
	if err != nil {
		return "", mapError(err)
	}
	for i, skillID := range in.SkillIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO self_quiz_target_skills(attempt_id,skill_id,sort_order) VALUES($1::uuid,$2::uuid,$3)`, id, skillID, i); err != nil {
			return "", mapError(err)
		}
	}
	for i, q := range verified {
		if _, err = tx.Exec(ctx, `INSERT INTO self_quiz_questions(attempt_id,question_id,question_version,path_id,subject_id,sort_order) VALUES($1::uuid,$2::uuid,$3,$4::uuid,$5::uuid,$6)`, id, q.ID, q.Version, q.PathID, q.SubjectID, i+1); err != nil {
			return "", mapError(err)
		}
		for _, skillID := range q.SkillIDs {
			if _, err = tx.Exec(ctx, `INSERT INTO self_quiz_question_skills(attempt_id,question_id,subject_id,skill_id) VALUES($1::uuid,$2::uuid,$3::uuid,$4::uuid)`, id, q.ID, q.SubjectID, skillID); err != nil {
				return "", mapError(err)
			}
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: studentID, Action: "assessment.self_quiz.start", ResourceType: "assessment_attempt", ResourceID: id, Metadata: map[string]any{"evidenceType": in.EvidenceType, "questionCount": len(verified)}}); err != nil {
		return "", err
	}
	if err = tx.Commit(ctx); err != nil {
		return "", err
	}
	return id, nil
}
