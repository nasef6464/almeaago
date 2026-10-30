package domain

type PathSettings struct {
	StageSelection   *string `json:"stageSelection,omitempty"`
	StageLabel       *string `json:"stageLabel,omitempty"`
	ShowMockExamCard *bool   `json:"showMockExamCard,omitempty"`
}

type Path struct {
	ShowInHome   *bool
	ShowInNavbar *bool
	Settings     PathSettings
	ID           string
	Code         string
	Name         string
	ParentPathID string
	Description  string
	SortOrder    int
	Status       Status
}

type Level struct {
	ID        string
	PathID    string
	Code      string
	Name      string
	SortOrder int
	Status    Status
}

type Subject struct {
	Icon      string
	Color     string
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
	ParentSkillID string
	Code          string
	Name          string
	Description   string
	Kind          string
	SortOrder     int
	Status        Status
}

type Bootstrap struct {
	Paths    []Path
	Levels   []Level
	Subjects []Subject
	Skills   []Skill
}

func (s *PathSettings) HasValues() bool {
	return s != nil && (s.ShowMockExamCard != nil || s.StageSelection != nil || s.StageLabel != nil)
}
