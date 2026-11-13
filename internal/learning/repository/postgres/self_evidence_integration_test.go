package postgres

import (
	"testing"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// This exercises the learning writer and replay over isolated tables. The
// assessment schema integration test separately enforces snapshot FKs.
func TestSelfQuizEvidenceWriterMultiPathAndReplay(t *testing.T) {
	f := newEvidenceFixture(t)
	_, err := f.db.Exec(f.ctx, `ALTER TABLE mastery_evidence
		DROP CONSTRAINT mastery_evidence_evidence_type_check,
		DROP CONSTRAINT mastery_evidence_source_shape,
		ADD COLUMN self_attempt_id uuid, ADD COLUMN self_attempt_kind text`)
	if err != nil {
		t.Fatal(err)
	}
	event := learning.SubmissionEvidence{StudentID: evidenceStudent, AttemptID: "00000000-0000-0000-0000-000000000101", SourceKind: "self", EvidenceType: "recheck", OccurredAt: f.now, Questions: []learning.QuestionEvidence{
		{QuestionID: "00000000-0000-0000-0000-000000000201", QuestionVersion: 1, PathID: evidencePath, SubjectID: evidenceSubject, Answered: true, Correct: true, SkillIDs: []string{evidenceSkill}},
		{QuestionID: "00000000-0000-0000-0000-000000000202", QuestionVersion: 1, PathID: "00000000-0000-0000-0000-000000000081", SubjectID: "00000000-0000-0000-0000-000000000082", SkillIDs: []string{"00000000-0000-0000-0000-000000000083"}},
	}}
	first, err := f.repo.ApplyAssessmentEvidence(f.ctx, event)
	if err != nil || first.InsertedEvidence != 2 || first.AffectedSkills != 2 {
		t.Fatalf("first write %+v %v", first, err)
	}
	retry, err := f.repo.ApplyAssessmentEvidence(f.ctx, event)
	if err != nil || retry.InsertedEvidence != 0 {
		t.Fatalf("retry %+v %v", retry, err)
	}
	var total, scopes, skills int
	err = f.db.QueryRow(f.ctx, `SELECT count(*), count(DISTINCT path_id), (SELECT count(*) FROM skill_progress WHERE student_id=$1) FROM mastery_evidence WHERE student_id=$1 AND evidence_type='recheck' AND self_attempt_id=$2 AND self_attempt_kind='self' AND assessment_id IS NULL`, evidenceStudent, event.AttemptID).Scan(&total, &scopes, &skills)
	if err != nil || total != 2 || scopes != 2 || skills != 2 {
		t.Fatalf("wrong stored evidence: %d %d %d %v", total, scopes, skills, err)
	}
}
