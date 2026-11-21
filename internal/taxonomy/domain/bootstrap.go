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
	IsVisible        *bool        `json:"isVisible,omitempty"`
	ShowInHome       *bool        `json:"showInHome,omitempty"`
	ShowInNavbar     *bool        `json:"showInNavbar,omitempty"`
	ShowSubjectCards *bool        `json:"showSubjectCards,omitempty"`
	ShowMockExamCard *bool        `json:"showMockExamCard,omitempty"`
	ShowPackageCard  *bool        `json:"showPackageCard,omitempty"`
	Color            string       `json:"color,omitempty"`
	Icon             string       `json:"icon,omitempty"`
	IconURL          string       `json:"iconUrl,omitempty"`
	IconStyle        string       `json:"iconStyle,omitempty"`
	Settings         PathSettings `json:"settings,omitempty"`
	ID               string       `json:"id"`
	Code             string       `json:"code"`
	Name             string       `json:"name"`
	ParentPathID     string       `json:"parentPathId,omitempty"`
	Description      string       `json:"description,omitempty"`
	SortOrder        int          `json:"sortOrder"`
	Status           Status       `json:"status,omitempty"`
}

type Level struct {
	IsVisible *bool  `json:"isVisible,omitempty"`
	ID        string `json:"id"`
	PathID    string `json:"pathId"`
	Code      string `json:"code"`
	Name      string `json:"name"`
	SortOrder int    `json:"sortOrder"`
	Status    Status `json:"status,omitempty"`
	Icon      string `json:"icon,omitempty"`
	IconURL   string `json:"iconUrl,omitempty"`
}

type Subject struct {
	IsVisible *bool          `json:"isVisible,omitempty"`
	Icon      string         `json:"icon,omitempty"`
	IconURL   string         `json:"iconUrl,omitempty"`
	IconStyle string         `json:"iconStyle,omitempty"`
	Color     string         `json:"color,omitempty"`
	Settings  map[string]any `json:"settings,omitempty"`
	ID        string         `json:"id"`
	PathID    string         `json:"pathId"`
	LevelID   string         `json:"levelId,omitempty"`
	Code      string         `json:"code"`
	Name      string         `json:"name"`
	SortOrder int            `json:"sortOrder"`
	Status    Status         `json:"status,omitempty"`
}

type Skill struct {
	ID            string `json:"id"`
	SubjectID     string `json:"subjectId"`
	SectionID     string `json:"sectionId,omitempty"`
	ParentSkillID string `json:"parentSkillId,omitempty"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description,omitempty"`
	Kind          string `json:"kind"`
	SortOrder     int    `json:"sortOrder"`
	Status        Status `json:"status,omitempty"`
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
	Paths    []Path         `json:"paths"`
	Levels   []Level        `json:"levels"`
	Subjects []Subject      `json:"subjects"`
	Sections []SkillSection `json:"sections,omitempty"`
	Skills   []Skill        `json:"skills"`
}

func (s *PathSettings) HasValues() bool {
	return s != nil && (s.ShowMockExamCard != nil || s.ShowSubjectCards != nil || s.ShowPackageCard != nil || s.StudentTemplate != nil || s.StageSelection != nil || s.StageLabel != nil)
}
