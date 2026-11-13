package domain

import (
	"errors"
	"testing"
)

func TestSelfQuizSelectionKeepsTargetedSkillAndScope(t *testing.T) {
	in := validSelfQuiz()
	in.PathID, in.SubjectID = "", "" // derive the target from the skill
	in.SkillIDs, in.EvidenceType, in.QuestionCount = []string{selfSkill}, "remediation", 10
	scopes := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}}
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "target-1", PathID: selfPath, SubjectID: selfSubject, Type: "mcq", SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "target-2", PathID: selfPath, SubjectID: selfSubject, Type: "mcq", SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "other-skill", PathID: selfPath, SubjectID: selfSubject, Type: "mcq", SkillIDs: []string{selfOtherSkill}},
		{Version: 1, ID: "other-subject", PathID: selfPath, SubjectID: selfSection, Type: "mcq", SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "other-path", PathID: selfSection, SubjectID: selfSubject, Type: "mcq", SkillIDs: []string{selfSkill}},
	}
	got, err := SelectSelfQuizQuestions(in, scopes, pool, false, func(int) int { return 0 })
	if err != nil || len(got) != 2 {
		t.Fatalf("target selection: %+v %v", got, err)
	}
	for _, q := range got {
		if q.ID != "target-1" && q.ID != "target-2" {
			t.Fatalf("scope widened: %+v", q)
		}
	}
}

func TestGeneralSelfQuizInfersUniqueSkillScope(t *testing.T) {
	in := validSelfQuiz()
	in.PathID, in.SubjectID, in.SkillIDs, in.QuestionCount = "", "", []string{selfSkill}, 5
	scopes := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}}
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "matching", PathID: selfPath, SubjectID: selfSubject, SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "wrong-context", PathID: selfSection, SubjectID: selfSection, SkillIDs: []string{selfSkill}},
	}
	got, err := SelectSelfQuizQuestions(in, scopes, pool, false, func(int) int { return 0 })
	if err != nil || len(got) != 1 || got[0].ID != "matching" {
		t.Fatalf("general skill scope not inferred: %+v %v", got, err)
	}
}

func TestGeneralSelfQuizMayUseAllAuthorizedPaths(t *testing.T) {
	in := validSelfQuiz()
	in.PathID, in.SubjectID, in.QuestionCount = "", "", 2
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "one", PathID: selfPath, SubjectID: selfSubject},
		{Version: 1, ID: "two", PathID: selfSection, SubjectID: selfSection},
	}
	got, err := SelectSelfQuizQuestions(in, nil, pool, false, func(int) int { return 0 })
	if err != nil || len(got) != 2 {
		t.Fatalf("all authorized paths must remain available: %+v %v", got, err)
	}
}

func TestSelfQuizSelectionPrioritizesMatchesAndFillsGeneralScope(t *testing.T) {
	in := validSelfQuiz()
	in.SkillIDs, in.QuestionCount, in.Difficulty, in.SectionID = []string{selfSkill}, 3, "easy", selfSection
	scopes := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, SectionID: selfSection, Active: true}}
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "other-skill", PathID: selfPath, SubjectID: selfSubject, SectionID: selfSection, Type: "mcq", SkillIDs: []string{selfOtherSkill}},
		{Version: 1, ID: "relaxed-section", PathID: selfPath, SubjectID: selfSubject, Type: "mcq", Difficulty: "easy", SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "strict", PathID: selfPath, SubjectID: selfSubject, SectionID: selfSection, Type: "mcq", Difficulty: "easy", SkillIDs: []string{selfSkill}},
		{Version: 1, ID: "wrong-path", PathID: selfSection, SubjectID: selfSubject, Type: "mcq", SkillIDs: []string{selfSkill}},
	}
	got, err := SelectSelfQuizQuestions(in, scopes, pool, true, func(int) int { return 0 })
	if err != nil || len(got) != 2 || got[0].ID != "strict" || got[1].ID != "other-skill" {
		t.Fatalf("unexpected selection order: %+v %v", got, err)
	}
	if _, err = SelectSelfQuizQuestions(in, scopes, pool, false, func(int) int { return 0 }); !errors.Is(err, ErrSelfQuizSectionUnsupported) {
		t.Fatalf("unsupported section mapping silently ignored: %v", err)
	}
}

func TestSelfQuizSelectionRejectsEmptyAndInvalidRandomness(t *testing.T) {
	in := validSelfQuiz()
	if _, err := SelectSelfQuizQuestions(in, nil, nil, false, func(int) int { return 0 }); !errors.Is(err, ErrNoSelfQuizQuestions) {
		t.Fatalf("empty bank must produce a clear error: %v", err)
	}
	pool := []EligibleSelfQuizQuestion{{Version: 1, ID: "one", PathID: selfPath, SubjectID: selfSubject}, {Version: 1, ID: "two", PathID: selfPath, SubjectID: selfSubject}}
	if _, err := SelectSelfQuizQuestions(in, nil, pool, false, func(n int) int { return n }); !errors.Is(err, ErrInvalidSelfQuizInput) {
		t.Fatalf("invalid random source: %v", err)
	}
}

func TestSelfQuizDuplicateCandidatesDoNotHideAValidScopedQuestion(t *testing.T) {
	in := validSelfQuiz()
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "same", PathID: selfSection, SubjectID: selfSubject},
		{Version: 1, ID: "same", PathID: selfPath, SubjectID: selfSubject},
	}
	got, err := SelectSelfQuizQuestions(in, nil, pool, false, func(int) int { return 0 })
	if err != nil || len(got) != 1 || got[0].PathID != selfPath {
		t.Fatalf("valid scope hidden by duplicate: %+v %v", got, err)
	}
}

func TestSelfQuizDuplicateCandidateKeepsBestMatchPriority(t *testing.T) {
	in := validSelfQuiz()
	in.SkillIDs, in.QuestionCount = []string{selfSkill}, 1
	scopes := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}}
	pool := []EligibleSelfQuizQuestion{
		{Version: 1, ID: "same", PathID: selfPath, SubjectID: selfSubject, SkillIDs: []string{selfOtherSkill}},
		{Version: 1, ID: "other", PathID: selfPath, SubjectID: selfSubject, SkillIDs: []string{selfOtherSkill}},
		{Version: 1, ID: "same", PathID: selfPath, SubjectID: selfSubject, SkillIDs: []string{selfSkill}},
	}
	got, err := SelectSelfQuizQuestions(in, scopes, pool, false, func(int) int { return 0 })
	if err != nil || len(got) != 1 || got[0].ID != "same" {
		t.Fatalf("best match lost: %+v %v", got, err)
	}
}

func TestSelfQuizRejectsUnversionedCandidate(t *testing.T) {
	in := validSelfQuiz()
	pool := []EligibleSelfQuizQuestion{{Version: 0, ID: "unversioned", PathID: selfPath, SubjectID: selfSubject}}
	if _, err := SelectSelfQuizQuestions(in, nil, pool, false, func(int) int { return 0 }); !errors.Is(err, ErrInvalidSelfQuizInput) {
		t.Fatalf("unversioned question cannot be snapshotted: %v", err)
	}
}

func TestSelfQuizDrawsOnlyRequestedCountWithoutReplacement(t *testing.T) {
	in := validSelfQuiz()
	in.QuestionCount = 1
	pool := []EligibleSelfQuizQuestion{{Version: 1, ID: "first", PathID: selfPath, SubjectID: selfSubject}, {Version: 1, ID: "second", PathID: selfPath, SubjectID: selfSubject}}
	calls := 0
	got, err := SelectSelfQuizQuestions(in, nil, pool, false, func(n int) int { calls++; return n - 1 })
	if err != nil || len(got) != 1 || got[0].ID != "second" || calls != 1 {
		t.Fatalf("partial draw: %+v calls=%d err=%v", got, calls, err)
	}
}
