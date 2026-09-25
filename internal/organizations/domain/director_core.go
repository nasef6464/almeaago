package domain

type DirectorStudent struct {
	StudentID string
	Name      string
	Email     string
	Phone     string
	Active    bool
	ClassID   string
	ClassName string
}

type DirectorStudentQuery struct {
	Page   int
	Limit  int
	Search string
}

type DirectorStudentPage struct {
	Students []DirectorStudent
	Page     int
	Limit    int
	Total    int
}

type DirectorStudentCreate struct {
	Name     string
	Email    string
	Password string
	ClassID  string
}

type DirectorStudentBasicPatch struct {
	Name  *string
	Phone *string
}

type DirectorStudentMutationResult struct {
	Student    DirectorStudent
	Created    bool
	Idempotent bool
}

type DirectorTeacher struct {
	TeacherID string
	Name      string
	Email     string
	Active    bool
}

type DirectorTeacherWorkspace struct {
	Teachers    []DirectorTeacher
	Assignments []TeachingAssignment
}
