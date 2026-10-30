package domain

type Status string

const (
	StatusActive   Status = "active"
	StatusInactive Status = "inactive"
	StatusArchived Status = "archived"
)

func ValidStatus(status Status) bool {
	switch status {
	case StatusActive, StatusInactive, StatusArchived:
		return true
	default:
		return false
	}
}

type PathWrite struct {
	ShowInHome       *bool         `json:"showInHome,omitempty"`
	ShowInNavbar     *bool         `json:"showInNavbar,omitempty"`
	ShowSubjectCards *bool         `json:"showSubjectCards,omitempty"`
	ShowMockExamCard *bool         `json:"showMockExamCard,omitempty"`
	ShowPackageCard  *bool         `json:"showPackageCard,omitempty"`
	Color            *string       `json:"color,omitempty"`
	Icon             *string       `json:"icon,omitempty"`
	IconURL          *string       `json:"iconUrl,omitempty"`
	IconStyle        *string       `json:"iconStyle,omitempty"`
	Settings         *PathSettings `json:"settings,omitempty"`
	Code             string        `json:"code"`
	Name             string        `json:"name"`
	ParentPathID     string        `json:"parentPathId,omitempty"`
	Description      string        `json:"description,omitempty"`
	SortOrder        int           `json:"sortOrder,omitempty"`
}

type PathPatch struct {
	ShowInHome       *bool         `json:"showInHome,omitempty"`
	ShowInNavbar     *bool         `json:"showInNavbar,omitempty"`
	ShowSubjectCards *bool         `json:"showSubjectCards,omitempty"`
	ShowMockExamCard *bool         `json:"showMockExamCard,omitempty"`
	ShowPackageCard  *bool         `json:"showPackageCard,omitempty"`
	Color            *string       `json:"color,omitempty"`
	Icon             *string       `json:"icon,omitempty"`
	IconURL          *string       `json:"iconUrl,omitempty"`
	IconStyle        *string       `json:"iconStyle,omitempty"`
	Settings         *PathSettings `json:"settings,omitempty"`
	Name             *string       `json:"name,omitempty"`
	ParentPathID     *string       `json:"parentPathId,omitempty"`
	Description      *string       `json:"description,omitempty"`
	SortOrder        *int          `json:"sortOrder,omitempty"`
	Status           *Status       `json:"status,omitempty"`
}

type LevelWrite struct {
	PathID    string  `json:"pathId"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sortOrder,omitempty"`
	Icon      *string `json:"icon,omitempty"`
	IconURL   *string `json:"iconUrl,omitempty"`
}

type LevelPatch struct {
	Name      *string `json:"name,omitempty"`
	SortOrder *int    `json:"sortOrder,omitempty"`
	Status    *Status `json:"status,omitempty"`
	Icon      *string `json:"icon,omitempty"`
	IconURL   *string `json:"iconUrl,omitempty"`
}

type SubjectWrite struct {
	Icon      *string `json:"icon,omitempty"`
	IconURL   *string `json:"iconUrl,omitempty"`
	IconStyle *string `json:"iconStyle,omitempty"`
	Color     *string `json:"color,omitempty"`
	PathID    string  `json:"pathId"`
	LevelID   string  `json:"levelId,omitempty"`
	Code      string  `json:"code"`
	Name      string  `json:"name"`
	SortOrder int     `json:"sortOrder,omitempty"`
}

type SubjectPatch struct {
	Icon      *string `json:"icon,omitempty"`
	IconURL   *string `json:"iconUrl,omitempty"`
	IconStyle *string `json:"iconStyle,omitempty"`
	Color     *string `json:"color,omitempty"`
	Name      *string `json:"name,omitempty"`
	LevelID   *string `json:"levelId,omitempty"`
	SortOrder *int    `json:"sortOrder,omitempty"`
	Status    *Status `json:"status,omitempty"`
}

type SkillWrite struct {
	SubjectID     string `json:"subjectId"`
	ParentSkillID string `json:"parentSkillId,omitempty"`
	Code          string `json:"code"`
	Name          string `json:"name"`
	Description   string `json:"description,omitempty"`
	Kind          string `json:"kind,omitempty"`
	SortOrder     int    `json:"sortOrder,omitempty"`
}

type SkillPatch struct {
	Name          *string `json:"name,omitempty"`
	ParentSkillID *string `json:"parentSkillId,omitempty"`
	Description   *string `json:"description,omitempty"`
	SortOrder     *int    `json:"sortOrder,omitempty"`
	Status        *Status `json:"status,omitempty"`
}
