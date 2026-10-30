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
	ShowInHome   *bool         `json:"showInHome,omitempty"`
	ShowInNavbar *bool         `json:"showInNavbar,omitempty"`
	Settings     *PathSettings `json:"settings,omitempty"`
	Code         string
	Name         string
	ParentPathID string
	Description  string
	SortOrder    int
}

type PathPatch struct {
	ShowInHome   *bool         `json:"showInHome,omitempty"`
	ShowInNavbar *bool         `json:"showInNavbar,omitempty"`
	Settings     *PathSettings `json:"settings,omitempty"`
	Name         *string
	ParentPathID *string
	Description  *string
	SortOrder    *int
	Status       *Status
}

type LevelWrite struct {
	PathID    string
	Code      string
	Name      string
	SortOrder int
}

type LevelPatch struct {
	Name      *string
	SortOrder *int
	Status    *Status
}

type SubjectWrite struct {
	Icon      *string `json:"icon,omitempty"`
	Color     *string `json:"color,omitempty"`
	PathID    string
	LevelID   string
	Code      string
	Name      string
	SortOrder int
}

type SubjectPatch struct {
	Icon      *string `json:"icon,omitempty"`
	Color     *string `json:"color,omitempty"`
	Name      *string
	LevelID   *string
	SortOrder *int
	Status    *Status
}

type SkillWrite struct {
	SubjectID     string
	ParentSkillID string
	Code          string
	Name          string
	Description   string
	Kind          string
	SortOrder     int
}

type SkillPatch struct {
	Name          *string
	ParentSkillID *string
	Description   *string
	SortOrder     *int
	Status        *Status
}
