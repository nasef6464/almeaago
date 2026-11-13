package domain

import (
	"encoding/hex"
	"errors"
	"strings"
)

var (
	ErrInvalidSelfQuizInput  = errors.New("invalid self quiz input")
	ErrSelfQuizScopeMismatch = errors.New("self quiz skill scope mismatch")
)

// SelfQuizInput is a request contract only; it does not authorize access to
// any question or create an attempt. Resolved scope and entitlements must be
// checked by the application before drawing the sample.
type SelfQuizInput struct {
	PathID           string   `json:"pathId"`
	SubjectID        string   `json:"subjectId"`
	SectionID        string   `json:"sectionId,omitempty"`
	SkillIDs         []string `json:"skillIds"`
	Difficulty       string   `json:"difficulty,omitempty"`
	QuestionType     string   `json:"questionType"`
	EvidenceType     string   `json:"evidenceType"`
	QuestionCount    int      `json:"questionCount"`
	TimeLimitMinutes int      `json:"timeLimitMinutes"`
	StartKey         string   `json:"startKey"`
}

// SelfQuizSkillScope must be resolved from authoritative taxonomy data; an
// incoming client must never be allowed to assert Active or scope values.
type SelfQuizSkillScope struct {
	ID        string
	PathID    string
	SubjectID string
	SectionID string
	Active    bool
}

// NormalizeSelfQuizInput returns a detached canonical request and rejects
// invalid bounds rather than silently widening a server-side selection.
// A syntactically valid SectionID still needs scope and visibility validation.
func NormalizeSelfQuizInput(input SelfQuizInput) (SelfQuizInput, error) {
	out := input
	var ok bool
	out.PathID = strings.TrimSpace(input.PathID)
	if out.PathID != "" {
		if out.PathID, ok = canonicalSelfQuizUUID(out.PathID); !ok {
			return SelfQuizInput{}, ErrInvalidSelfQuizInput
		}
	}
	out.SubjectID = strings.TrimSpace(input.SubjectID)
	if out.SubjectID != "" {
		if out.SubjectID, ok = canonicalSelfQuizUUID(out.SubjectID); !ok {
			return SelfQuizInput{}, ErrInvalidSelfQuizInput
		}
	}
	out.SectionID = strings.TrimSpace(input.SectionID)
	if out.SectionID != "" {
		if out.SectionID, ok = canonicalSelfQuizUUID(out.SectionID); !ok {
			return SelfQuizInput{}, ErrInvalidSelfQuizInput
		}
	}
	out.StartKey = strings.TrimSpace(input.StartKey)
	if out.StartKey == "" || len(out.StartKey) > 160 || input.QuestionCount < 1 || input.QuestionCount > 60 || input.TimeLimitMinutes < 5 || input.TimeLimitMinutes > 180 {
		return SelfQuizInput{}, ErrInvalidSelfQuizInput
	}
	out.Difficulty = strings.ToLower(strings.TrimSpace(input.Difficulty))
	if out.Difficulty != "" && out.Difficulty != "easy" && out.Difficulty != "medium" && out.Difficulty != "hard" {
		return SelfQuizInput{}, ErrInvalidSelfQuizInput
	}
	out.QuestionType = strings.ToLower(strings.TrimSpace(input.QuestionType))
	if out.QuestionType == "" {
		out.QuestionType = "all"
	}
	if out.QuestionType != "all" && out.QuestionType != "mcq" && out.QuestionType != "true_false" {
		return SelfQuizInput{}, ErrInvalidSelfQuizInput
	}
	out.EvidenceType = strings.ToLower(strings.TrimSpace(input.EvidenceType))
	if out.EvidenceType == "" {
		out.EvidenceType = "assessment"
	}
	if out.EvidenceType != "assessment" && out.EvidenceType != "remediation" && out.EvidenceType != "recheck" && out.EvidenceType != "mastery_review" {
		return SelfQuizInput{}, ErrInvalidSelfQuizInput
	}
	out.SkillIDs = make([]string, 0, len(input.SkillIDs))
	seen := make(map[string]struct{}, len(input.SkillIDs))
	for _, id := range input.SkillIDs {
		id, ok = canonicalSelfQuizUUID(id)
		if !ok {
			return SelfQuizInput{}, ErrInvalidSelfQuizInput
		}
		if _, exists := seen[id]; !exists {
			seen[id] = struct{}{}
			out.SkillIDs = append(out.SkillIDs, id)
		}
	}
	if out.EvidenceType != "assessment" && len(out.SkillIDs) == 0 {
		return SelfQuizInput{}, ErrInvalidSelfQuizInput
	}
	return out, nil
}

// ValidateSelfQuizSkills prevents mixed or missing skill scope, even if a
// repository accidentally returns duplicate, unrelated or inactive rows.
func ValidateSelfQuizSkills(input SelfQuizInput, resolved []SelfQuizSkillScope) error {
	input, err := NormalizeSelfQuizInput(input)
	if err != nil {
		return err
	}
	if len(input.SkillIDs) != len(resolved) {
		return ErrSelfQuizScopeMismatch
	}
	wanted := make(map[string]struct{}, len(input.SkillIDs))
	for _, id := range input.SkillIDs {
		wanted[id] = struct{}{}
	}
	var targetedPath, targetedSubject string
	for _, skill := range resolved {
		id, idOK := canonicalSelfQuizUUID(skill.ID)
		path, pathOK := canonicalSelfQuizUUID(skill.PathID)
		subject, subjectOK := canonicalSelfQuizUUID(skill.SubjectID)
		if _, exists := wanted[id]; !idOK || !pathOK || !subjectOK || !exists || !skill.Active || (input.PathID != "" && path != input.PathID) || (input.SubjectID != "" && subject != input.SubjectID) || (input.SectionID != "" && !strings.EqualFold(skill.SectionID, input.SectionID)) {
			return ErrSelfQuizScopeMismatch
		}
		if input.EvidenceType != "assessment" {
			if targetedPath == "" {
				targetedPath, targetedSubject = path, subject
			}
			if path != targetedPath || subject != targetedSubject {
				return ErrSelfQuizScopeMismatch
			}
		}
		delete(wanted, id)
	}
	if len(wanted) != 0 {
		return ErrSelfQuizScopeMismatch
	}
	return nil
}

func canonicalSelfQuizUUID(value string) (string, bool) {
	value = strings.ToLower(strings.TrimSpace(value))
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return "", false
	}
	compact := strings.ReplaceAll(value, "-", "")
	if len(compact) != 32 || compact == "00000000000000000000000000000000" {
		return "", false
	}
	_, err := hex.DecodeString(compact)
	return value, err == nil
}
