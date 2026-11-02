package postgres

import "testing"

func TestMultiSubjectAssessmentEvidenceScopesAndReplayPostgres(t *testing.T) {
	f := newEvidenceFixture(t)
	event := f.assessment(evidenceStudent, 801, true)
	event.SubjectID = ""
	event.Questions[0].PathID = evidencePath
	event.Questions[0].SubjectID = evidenceSubject
	other := event.Questions[0]
	other.QuestionID = "00000000-0000-0000-0000-000000000991"
	other.SubjectID = "00000000-0000-0000-0000-000000000992"
	other.SkillIDs = []string{"00000000-0000-0000-0000-000000000993"}
	other.Correct = false
	event.Questions = append(event.Questions, other)
	result, err := f.repo.ApplyAssessmentEvidence(f.ctx, event)
	if err != nil {
		t.Fatal(err)
	}
	if result.InsertedEvidence != 2 || result.AffectedSkills != 2 {
		t.Fatalf("incorrect evidence apply: %+v", result)
	}
	for _, item := range event.Questions {
		var evidenceSubject, cardSubject, progressSubject string
		err = f.db.QueryRow(f.ctx, `SELECT me.subject_id::text,rc.subject_id::text,sp.subject_id::text FROM mastery_evidence me JOIN review_cards rc ON rc.student_id=me.student_id AND rc.question_id=me.question_id JOIN skill_progress sp ON sp.student_id=me.student_id AND sp.skill_id=$3::uuid WHERE me.source_attempt_id=$1::uuid AND me.question_id=$2::uuid`, event.AttemptID, item.QuestionID, item.SkillIDs[0]).Scan(&evidenceSubject, &cardSubject, &progressSubject)
		if err != nil {
			t.Fatal(err)
		}
		if evidenceSubject != item.SubjectID || cardSubject != item.SubjectID || progressSubject != item.SubjectID {
			t.Fatalf("question scope leaked: evidence=%s card=%s progress=%s want=%s", evidenceSubject, cardSubject, progressSubject, item.SubjectID)
		}
	}
	replay, err := f.repo.ApplyAssessmentEvidence(f.ctx, event)
	if err != nil || replay.InsertedEvidence != 0 {
		t.Fatalf("replay duplicated evidence: %+v %v", replay, err)
	}
	var count int
	if err = f.db.QueryRow(f.ctx, `SELECT count(*) FROM mastery_evidence WHERE source_attempt_id=$1::uuid`, event.AttemptID).Scan(&count); err != nil || count != 2 {
		t.Fatalf("replay count=%d err=%v", count, err)
	}
}
