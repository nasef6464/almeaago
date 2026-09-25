package domain

import "time"

type ListQuery struct {
	Page                     int
	Limit                    int
	Search                   string
	PathID                   string
	SubjectID                string
	MainSkillID              string
	SkillIDs                 []string
	Linked                   *bool
	Difficulty               string
	QuestionType             QuestionType
	ExamType                 string
	Source                   string
	Year                     *int
	WorkflowStatus           WorkflowStatus
	WithVideo                *bool
	WithExplanation          *bool
	TeacherScopeUserID       string
	TeacherScopePrevalidated bool
}

type QuestionSummary struct {
	ID                string
	QuestionCode      string
	CurrentVersion    int
	WorkflowStatus    WorkflowStatus
	OwnerType         OwnerType
	OwnerID           string
	PathID            string
	SubjectID         string
	AssignedTeacherID string
	QuestionType      QuestionType
	Difficulty        string
	ExamType          string
	Source            string
	SourceYear        *int
	HasImage          bool
	HasVideo          bool
	HasExplanation    bool
	MainSkillID       string
	SkillIDs          []string
	UpdatedAt         time.Time
}

type QuestionPage struct {
	Items   []QuestionSummary
	Page    int
	Limit   int
	HasMore bool
}

type CoverageQuery struct {
	ListQuery
	SkillPage  int
	SkillLimit int
}

type SkillCoverage struct {
	SkillID       string
	RelationType  RelationType
	QuestionCount int
}

type Coverage struct {
	QuestionsTotal    int
	Approved          int
	PendingReview     int
	Unlinked          int
	MainSkillCoverage int
	SubSkillCoverage  int
	Skills            []SkillCoverage
	SkillPage         int
	SkillLimit        int
	SkillsHasMore     bool
}
