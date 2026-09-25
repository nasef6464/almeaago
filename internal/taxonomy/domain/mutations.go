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
	Code         string
	Name         string
	ParentPathID string
	Description  string
	SortOrder    int
}

type PathPatch struct {
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
	PathID    string
	LevelID   string
	Code      string
	Name      string
	SortOrder int
}

type SubjectPatch struct {
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
