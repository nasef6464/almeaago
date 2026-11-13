package domain

import (
	"errors"
	"reflect"
	"strings"
	"testing"
)

const (
	selfPath       = "11111111-1111-4111-8111-111111111111"
	selfSubject    = "22222222-2222-4222-8222-222222222222"
	selfSection    = "33333333-3333-4333-8333-333333333333"
	selfSkill      = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	selfOtherSkill = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
)

func validSelfQuiz() SelfQuizInput {
	return SelfQuizInput{PathID: selfPath, SubjectID: selfSubject, StartKey: "self-start", QuestionCount: 15, TimeLimitMinutes: 20, EvidenceType: "assessment", QuestionType: "all"}
}

func TestSelfQuizInputBoundariesAndEnums(t *testing.T) {
	for _, tc := range []struct {
		name   string
		mutate func(*SelfQuizInput)
		valid  bool
	}{
		{"minimum", func(v *SelfQuizInput) { v.QuestionCount, v.TimeLimitMinutes = 1, 5 }, true},
		{"maximum", func(v *SelfQuizInput) { v.QuestionCount, v.TimeLimitMinutes = 60, 180 }, true},
		{"zero questions", func(v *SelfQuizInput) { v.QuestionCount = 0 }, false},
		{"too many questions", func(v *SelfQuizInput) { v.QuestionCount = 61 }, false},
		{"short time", func(v *SelfQuizInput) { v.TimeLimitMinutes = 4 }, false},
		{"long time", func(v *SelfQuizInput) { v.TimeLimitMinutes = 181 }, false},
		{"all paths", func(v *SelfQuizInput) { v.PathID = " " }, true},
		{"all subjects", func(v *SelfQuizInput) { v.SubjectID = "" }, true},
		{"all paths and subjects", func(v *SelfQuizInput) { v.PathID, v.SubjectID = "", "" }, true},
		{"invalid path", func(v *SelfQuizInput) { v.PathID = "not-a-uuid" }, false},
		{"zero uuid", func(v *SelfQuizInput) { v.SubjectID = "00000000-0000-0000-0000-000000000000" }, false},
		{"invalid section", func(v *SelfQuizInput) { v.SectionID = "broken" }, false},
		{"missing start key", func(v *SelfQuizInput) { v.StartKey = " " }, false},
		{"long start key", func(v *SelfQuizInput) { v.StartKey = strings.Repeat("x", 161) }, false},
		{"bad skill", func(v *SelfQuizInput) { v.SkillIDs = []string{"invalid"} }, false},
		{"unknown difficulty", func(v *SelfQuizInput) { v.Difficulty = "expert" }, false},
		{"unsupported essay", func(v *SelfQuizInput) { v.QuestionType = "essay" }, false},
		{"unknown evidence", func(v *SelfQuizInput) { v.EvidenceType = "unknown" }, false},
		{"valid type", func(v *SelfQuizInput) { v.QuestionType = "true_false" }, true},
		{"valid section", func(v *SelfQuizInput) { v.SectionID = selfSection }, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			input := validSelfQuiz()
			tc.mutate(&input)
			_, err := NormalizeSelfQuizInput(input)
			if tc.valid && err != nil {
				t.Fatalf("expected valid request: %v", err)
			}
			if !tc.valid && !errors.Is(err, ErrInvalidSelfQuizInput) {
				t.Fatalf("expected invalid request: %v", err)
			}
		})
	}
}

func TestSelfQuizOptionalDefaults(t *testing.T) {
	input := validSelfQuiz()
	input.QuestionType, input.EvidenceType = "", ""
	got, err := NormalizeSelfQuizInput(input)
	if err != nil || got.QuestionType != "all" || got.EvidenceType != "assessment" {
		t.Fatalf("defaults: %+v %v", got, err)
	}
}

func TestSelfQuizTargetedEvidenceRequiresSkills(t *testing.T) {
	for _, kind := range []string{"remediation", "recheck", "mastery_review"} {
		input := validSelfQuiz()
		input.EvidenceType = kind
		if _, err := NormalizeSelfQuizInput(input); !errors.Is(err, ErrInvalidSelfQuizInput) {
			t.Fatalf("%s accepted without target: %v", kind, err)
		}
		input.SkillIDs = []string{selfSkill}
		if _, err := NormalizeSelfQuizInput(input); err != nil {
			t.Fatalf("%s rejected with target: %v", kind, err)
		}
	}
}

func TestSelfQuizNormalizationDoesNotMutateInput(t *testing.T) {
	input := validSelfQuiz()
	input.PathID = "  " + selfPath + " "
	input.Difficulty = " EASY "
	input.QuestionType = " MCQ "
	input.EvidenceType = " ASSESSMENT "
	input.SkillIDs = []string{" " + selfSkill + " ", selfSkill, selfOtherSkill}
	got, err := NormalizeSelfQuizInput(input)
	if err != nil {
		t.Fatal(err)
	}
	if got.PathID != selfPath || got.Difficulty != "easy" || got.QuestionType != "mcq" || got.EvidenceType != "assessment" || !reflect.DeepEqual(got.SkillIDs, []string{selfSkill, selfOtherSkill}) {
		t.Fatalf("unexpected normalized input: %+v", got)
	}
	got.SkillIDs[0] = selfOtherSkill
	if input.SkillIDs[0] != " "+selfSkill+" " {
		t.Fatal("normalization mutated caller input")
	}
}

func TestSelfQuizSkillScopeIsExactAndActive(t *testing.T) {
	input := validSelfQuiz()
	input.SkillIDs = []string{selfSkill, selfOtherSkill}
	input.EvidenceType = "remediation"
	resolved := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}, {ID: selfOtherSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}}
	if err := ValidateSelfQuizSkills(input, resolved); err != nil {
		t.Fatalf("valid target scope: %v", err)
	}
	for _, tc := range []struct {
		name string
		rows []SelfQuizSkillScope
	}{
		{"missing skill", resolved[:1]},
		{"duplicate skill", []SelfQuizSkillScope{resolved[0], resolved[0]}},
		{"other subject", []SelfQuizSkillScope{resolved[0], {ID: selfOtherSkill, PathID: selfPath, SubjectID: selfSection, Active: true}}},
		{"other path", []SelfQuizSkillScope{resolved[0], {ID: selfOtherSkill, PathID: selfSection, SubjectID: selfSubject, Active: true}}},
		{"inactive skill", []SelfQuizSkillScope{resolved[0], {ID: selfOtherSkill, PathID: selfPath, SubjectID: selfSubject}}},
		{"extra skill", append(append([]SelfQuizSkillScope{}, resolved...), SelfQuizSkillScope{ID: selfSection, PathID: selfPath, SubjectID: selfSubject, Active: true})},
	} {
		t.Run(tc.name, func(t *testing.T) {
			if err := ValidateSelfQuizSkills(input, tc.rows); !errors.Is(err, ErrSelfQuizScopeMismatch) {
				t.Fatalf("scope must fail closed: %v", err)
			}
		})
	}
}

func TestSelfQuizOpenScopeAndTargetedInference(t *testing.T) {
	input := validSelfQuiz()
	input.PathID, input.SubjectID = "", ""
	input.SkillIDs = []string{selfSkill, selfOtherSkill}
	input.EvidenceType = "assessment"
	rows := []SelfQuizSkillScope{{ID: selfSkill, PathID: selfPath, SubjectID: selfSubject, Active: true}, {ID: selfOtherSkill, PathID: selfSection, SubjectID: selfSection, Active: true}}
	if _, err := NormalizeSelfQuizInput(input); err != nil {
		t.Fatalf("general all-path request: %v", err)
	}
	if err := ValidateSelfQuizSkills(input, rows); err != nil {
		t.Fatalf("general open scope with separately authorized skills: %v", err)
	}
	input.EvidenceType = "remediation"
	if err := ValidateSelfQuizSkills(input, rows); !errors.Is(err, ErrSelfQuizScopeMismatch) {
		t.Fatalf("targeted skills must share path and subject: %v", err)
	}
	rows[1].PathID, rows[1].SubjectID = selfPath, selfSubject
	if err := ValidateSelfQuizSkills(input, rows); err != nil {
		t.Fatalf("targeted common scope should be inferable: %v", err)
	}
	input.PathID = selfSection
	if err := ValidateSelfQuizSkills(input, rows); !errors.Is(err, ErrSelfQuizScopeMismatch) {
		t.Fatalf("explicit path conflict: %v", err)
	}
}
