package organizationshttp

import (
	"net/http"

	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type teacherWorkspaceResponse struct {
	Personas struct {
		PlatformTrainer bool `json:"platformTrainer"`
		SchoolTeacher   bool `json:"schoolTeacher"`
	} `json:"personas"`
	Schools []teacherWorkspaceSchoolResponse `json:"schools"`
}

type teacherWorkspaceSchoolResponse struct {
	SchoolID    string                               `json:"schoolId"`
	SchoolName  string                               `json:"schoolName"`
	Source      string                               `json:"source"`
	Assignments []teacherWorkspaceAssignmentResponse `json:"assignments"`
}

type teacherWorkspaceAssignmentResponse struct {
	AssignmentID string `json:"assignmentId"`
	ClassID      string `json:"classId"`
	ClassName    string `json:"className"`
	SubjectID    string `json:"subjectId"`
	StudentCount int    `json:"studentCount"`
}

func (h *Handler) teacherWorkspace(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	workspace, err := h.service.TeacherWorkspace(r.Context(), auth.User)
	if err != nil {
		writeError(w, err)
		return
	}

	response := teacherWorkspaceResponse{
		Schools: make([]teacherWorkspaceSchoolResponse, 0, len(workspace.Schools)),
	}
	// Platform-trainer scope belongs to Content/Taxonomy and must not be inferred
	// from Organizations data. It stays false until that owner exposes its contract.
	response.Personas.SchoolTeacher = len(workspace.Schools) > 0

	for _, school := range workspace.Schools {
		response.Schools = append(response.Schools, presentTeacherWorkspaceSchool(school))
	}
	writeJSON(w, http.StatusOK, response)
}

func presentTeacherWorkspaceSchool(school orgdomain.TeacherWorkspaceSchool) teacherWorkspaceSchoolResponse {
	assignments := make([]teacherWorkspaceAssignmentResponse, 0, len(school.Assignments))
	for _, assignment := range school.Assignments {
		assignments = append(assignments, teacherWorkspaceAssignmentResponse{
			AssignmentID: assignment.AssignmentID,
			ClassID:      assignment.ClassID,
			ClassName:    assignment.ClassName,
			SubjectID:    assignment.SubjectID,
			StudentCount: assignment.StudentCount,
		})
	}
	return teacherWorkspaceSchoolResponse{
		SchoolID:    school.SchoolID,
		SchoolName:  school.SchoolName,
		Source:      school.Source,
		Assignments: assignments,
	}
}
