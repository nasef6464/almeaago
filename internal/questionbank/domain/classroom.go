package domain

type ClassroomQuestion struct {
	ID                     string
	Version                int
	QuestionType           QuestionType
	TextContent            string
	ImageAssetID           string
	ImageAlt               string
	OptionsEmbeddedInImage bool
	CorrectOptionIndex     *int
	Explanation            string
	Difficulty             string
	SkillIDs               []string
	Options                []Option
}


type ClassroomQuestionSummary struct {
	ID           string
	Version      int
	QuestionType QuestionType
	TextContent  string
	Difficulty   string
}

type ClassroomQuestionPage struct {
	Items   []ClassroomQuestionSummary
	Page    int
	Limit   int
	HasMore bool
}
