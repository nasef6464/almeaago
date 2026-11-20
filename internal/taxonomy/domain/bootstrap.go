package domain

type PathSettings struct {
	StageSelection   *string `json:"stageSelection,omitempty"`
	StageLabel       *string `json:"stageLabel,omitempty"`
	StudentTemplate  *string `json:"studentTemplate,omitempty"`
	ShowSubjectCards *bool   `json:"showSubjectCards,omitempty"`
	ShowMockExamCard *bool   `json:"showMockExamCard,omitempty"`
	ShowPackageCard  *bool   `json:"showPackageCard,omitempty"`
}

type Path struct {
	IsVisible        *bool
	ShowInHome       *bool
	ShowInNavbar     *bool
	ShowSubjectCards *bool
	ShowMockExamCard *bool
	ShowPackageCard  *bool
	Color            string
	Icon             string
	IconURL          string
	IconStyle        string
	Settings         PathSettings
	ID               string
	Code             string
	Name             string
	ParentPathID     string
	Description      string
	SortOrder        int
	Status           Status
}

type Level struct {
	IsVisible *bool
	ID        string
	PathID    string
	Code      string
	Name      string
	SortOrder int
	Status    Status
	Icon      string
	IconURL   string
}

type Subject struct {
	IsVisible *bool
	Icon      string
	IconURL   string
	IconStyle string
	Color     string
	Settings  map[string]any
	ID        string
	PathID    string
	LevelID   string
	Code      string
	Name      string
	SortOrder int
	Status    Status
}

type Skill struct {
	ID            string
	SubjectID     string
	SectionID     string
	ParentSkillID string
	Code          string
	Name          string
	Description   string
	Kind          string
	SortOrder     int
	Status        Status
}

// SkillSection groups skills within a subject; it is not an exam section.
type SkillSection struct {
	ID        string
	SubjectID string
	Name      string
	SortOrder int
	Status    Status
}

type Bootstrap struct {
	Paths    []Path
	Levels   []Level
	Subjects []Subject
	Sections []SkillSection
	Skills   []Skill
}

func (s *PathSettings) HasValues() bool {
	return s != nil && (s.ShowMockExamCard != nil || s.ShowSubjectCards != nil || s.ShowPackageCard != nil || s.StudentTemplate != nil || s.StageSelection != nil || s.StageLabel != nil)
}
