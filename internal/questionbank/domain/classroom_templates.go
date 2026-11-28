package domain

import "time"

type ClassroomPreparedTemplate struct {
	ID           string    `json:"id"`
	SchoolID     string    `json:"schoolId"`
	TeacherID    string    `json:"teacherId"`
	Title        string    `json:"title"`
	QuestionIDs  []string  `json:"questionIds"`
	ChallengeIDs []string  `json:"challengeIds"`
	CreatedAt    time.Time `json:"createdAt"`
	UpdatedAt    time.Time `json:"updatedAt"`
}

type CreateClassroomTemplateCommand struct {
	SchoolID     string
	TeacherID    string
	Title        string
	QuestionIDs  []string
	ChallengeIDs []string
}
