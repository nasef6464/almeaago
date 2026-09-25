package domain

// TeacherWorkspace is the Organizations-owned structural projection for a school
// teacher. Cross-domain product data (assessment, entitlement, realtime, reporting)
// is intentionally not embedded here; those owners enrich the UI through their own
// contracts.
type TeacherWorkspace struct {
	PlatformTrainer bool
	Schools          []TeacherWorkspaceSchool
}

type TeacherWorkspaceSchool struct {
	SchoolID    string
	SchoolName  string
	Source      string
	Assignments []TeacherWorkspaceAssignment
}

type TeacherWorkspaceAssignment struct {
	AssignmentID string
	ClassID      string
	ClassName    string
	SubjectID    string
	StudentCount int
}
