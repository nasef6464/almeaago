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
