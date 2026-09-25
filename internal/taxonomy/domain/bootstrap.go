package domain

type Path struct {
	ID           string
	Code         string
	Name         string
	ParentPathID string
	Description  string
	SortOrder    int
}

type Level struct {
	ID        string
	PathID    string
	Code      string
	Name      string
	SortOrder int
}

type Subject struct {
	ID        string
	PathID    string
	LevelID   string
	Code      string
	Name      string
	SortOrder int
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
}

type Bootstrap struct {
	Paths    []Path
	Levels   []Level
	Subjects []Subject
	Skills   []Skill
}
