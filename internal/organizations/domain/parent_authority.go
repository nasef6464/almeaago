package domain

type ParentStudentRelationship struct {
	ID        string
	ParentID  string
	StudentID string
	SchoolID  string
	Status    string
	Source    string
}

type ParentAuthority struct {
	Relationships []ParentStudentRelationship
}
