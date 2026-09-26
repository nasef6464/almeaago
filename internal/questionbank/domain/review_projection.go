package domain

type ReviewRef struct {
	QuestionID string
	Version    int
}

type ReviewProjection struct {
	ID                     string
	Version                int
	QuestionType           QuestionType
	TextContent            string
	ImageAssetID           string
	ImageAlt               string
	OptionsEmbeddedInImage bool
	CorrectOptionIndex     *int
	Explanation            string
	Hint                   string
	SolvingStrategy        string
	VideoURL               string
	Difficulty             string
	Options                []Option
}
