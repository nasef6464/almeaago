package domain

import "time"

type QAQuestion struct {
	ID            string    `json:"id"`
	CourseID      string    `json:"courseId,omitempty"`
	CourseTitle   string    `json:"courseTitle,omitempty"`
	PathID        string    `json:"pathId,omitempty"`
	PathName      string    `json:"pathName,omitempty"`
	SubjectID     string    `json:"subjectId,omitempty"`
	SubjectName   string    `json:"subjectName"`
	AuthorID      string    `json:"authorId"`
	AuthorName    string    `json:"authorName"`
	Question      string    `json:"question"`
	LatestReply   string    `json:"latestReply,omitempty"`
	LatestReplyBy string    `json:"latestReplyBy,omitempty"`
	RepliesCount  int       `json:"repliesCount"`
	HasAnswer     bool      `json:"hasAnswer"`
	IsResolved    bool      `json:"isResolved"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type QAReply struct {
	ID           string    `json:"id"`
	QuestionID   string    `json:"questionId"`
	AuthorID     string    `json:"authorId"`
	AuthorName   string    `json:"authorName"`
	Body         string    `json:"body"`
	IsInstructor bool      `json:"isInstructor"`
	CreatedAt    time.Time `json:"createdAt"`
}

type QAStats struct {
	Total    int `json:"total"`
	Answered int `json:"answered"`
	Pending  int `json:"pending"`
}

type QAListResult struct {
	Items []QAQuestion `json:"items"`
	Stats QAStats      `json:"stats"`
}

type LearnerLiveLesson struct {
	ID               string     `json:"id"`
	Title            string     `json:"title"`
	Description      string     `json:"description"`
	Type             string     `json:"type"`
	PathID           string     `json:"pathId"`
	PathName         string     `json:"pathName"`
	SubjectID        string     `json:"subjectId"`
	SubjectName      string     `json:"subjectName"`
	TeacherName      string     `json:"teacherName"`
	MeetingURL       string     `json:"meetingUrl"`
	MeetingDate      *time.Time `json:"meetingDate,omitempty"`
	DurationMinutes  int        `json:"durationMinutes"`
	RecordingURL     string     `json:"recordingUrl"`
	ShowRecording    bool       `json:"showRecording"`
	JoinInstructions string     `json:"joinInstructions"`
	IsLocked         bool       `json:"isLocked"`
}

type LearnerClassroomSession struct {
	ID          string     `json:"id"`
	ClassID     string     `json:"classId"`
	ClassName   string     `json:"className"`
	SubjectID   string     `json:"subjectId"`
	SubjectName string     `json:"subjectName"`
	TeacherName string     `json:"teacherName"`
	Status      string     `json:"status"`
	Day         string     `json:"day"`
	StartedAt   *time.Time `json:"startedAt,omitempty"`
}

type LearnerLiveSessionsFeed struct {
	Lessons           []LearnerLiveLesson       `json:"lessons"`
	ClassroomSessions []LearnerClassroomSession `json:"classroomSessions"`
}
