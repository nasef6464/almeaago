package domain

import (
	"errors"
	"strings"
)

var ErrSelfQuizSectionUnsupported = errors.New("self quiz section mapping is not supported")
var ErrNoSelfQuizQuestions = errors.New("no eligible self quiz questions")

// EligibleSelfQuizQuestion describes a candidate that the application has
// already verified is published, scorable and accessible to this student.
// This type and selector do not authorize access to the question bank.
type EligibleSelfQuizQuestion struct {
	ID, PathID, SubjectID, SectionID, Type, Difficulty string
	Version                                            int
	SkillIDs                                           []string
}

// SelectSelfQuizQuestions implements the old selector's priority and samples
// without replacement. next must return a uniformly random integer in [0,n).
// The caller must resolve skills and authorize every candidate beforehand.
func SelectSelfQuizQuestions(input SelfQuizInput, skills []SelfQuizSkillScope, authorized []EligibleSelfQuizQuestion, sectionSupported bool, next func(int) int) ([]EligibleSelfQuizQuestion, error) {
	in, err := NormalizeSelfQuizInput(input)
	if err != nil {
		return nil, err
	}
	if err = ValidateSelfQuizSkills(in, skills); err != nil {
		return nil, err
	}
	if in.SectionID != "" && !sectionSupported {
		return nil, ErrSelfQuizSectionUnsupported
	}
	if next == nil {
		return nil, ErrInvalidSelfQuizInput
	}
	path, subject := in.PathID, in.SubjectID
	if len(skills) > 0 {
		paths, subjects := map[string]struct{}{}, map[string]struct{}{}
		for _, skill := range skills {
			p, _ := canonicalSelfQuizUUID(skill.PathID)
			s, _ := canonicalSelfQuizUUID(skill.SubjectID)
			paths[p], subjects[s] = struct{}{}, struct{}{}
		}
		if path == "" && len(paths) == 1 {
			for p := range paths {
				path = p
			}
		}
		if subject == "" && len(subjects) == 1 {
			for s := range subjects {
				subject = s
			}
		}
	}
	wanted := make(map[string]struct{}, len(in.SkillIDs))
	for _, id := range in.SkillIDs {
		wanted[id] = struct{}{}
	}
	var buckets [7][]EligibleSelfQuizQuestion
	type rankedQuestion struct {
		question EligibleSelfQuizQuestion
		tier     int
	}
	best := make(map[string]rankedQuestion, len(authorized))
	var order []string
	for _, q := range authorized {
		if q.ID == "" {
			continue
		}
		if (path != "" && !strings.EqualFold(q.PathID, path)) || (subject != "" && !strings.EqualFold(q.SubjectID, subject)) || (in.QuestionType != "all" && !strings.EqualFold(q.Type, in.QuestionType)) {
			continue
		}
		matchesSkill := len(wanted) == 0
		for _, skill := range q.SkillIDs {
			if _, ok := wanted[strings.ToLower(strings.TrimSpace(skill))]; ok {
				matchesSkill = true
				break
			}
		}
		if in.EvidenceType != "assessment" && !matchesSkill {
			continue
		}
		if q.Version < 1 {
			return nil, ErrInvalidSelfQuizInput
		}
		matchesSection := in.SectionID == "" || strings.EqualFold(q.SectionID, in.SectionID)
		if !matchesSection {
			continue
		}
		matchesDifficulty := in.Difficulty == "" || strings.EqualFold(q.Difficulty, in.Difficulty)
		tier := 6
		switch {
		case matchesSkill && matchesSection && matchesDifficulty:
			tier = 0
		case matchesSkill && len(wanted) > 0 && matchesDifficulty:
			tier = 1
		case matchesSkill && matchesSection:
			tier = 2
		case matchesSkill && len(wanted) > 0:
			tier = 3
		case matchesSkill:
			tier = 4
		case matchesSection:
			tier = 5
		}
		previous, exists := best[q.ID]
		if !exists {
			order = append(order, q.ID)
		}
		if !exists || tier < previous.tier {
			best[q.ID] = rankedQuestion{question: q, tier: tier}
		}
	}
	for _, id := range order {
		candidate := best[id]
		buckets[candidate.tier] = append(buckets[candidate.tier], candidate.question)
	}
	selected := make([]EligibleSelfQuizQuestion, 0, in.QuestionCount)
	for _, bucket := range buckets {
		for i := 0; i < len(bucket) && len(selected) < in.QuestionCount; i++ {
			remaining := len(bucket) - i
			j := next(remaining)
			if j < 0 || j >= remaining {
				return nil, ErrInvalidSelfQuizInput
			}
			j += i
			bucket[i], bucket[j] = bucket[j], bucket[i]
			selected = append(selected, bucket[i])
		}
		if len(selected) == in.QuestionCount {
			break
		}
	}
	if len(selected) == 0 {
		return nil, ErrNoSelfQuizQuestions
	}
	return selected, nil
}
