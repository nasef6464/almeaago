package domain

import "time"

type LessonProgressContext string

const (
	LessonProgressCourse     LessonProgressContext = "course"
	LessonProgressFoundation LessonProgressContext = "foundation"
)

type LessonProgressStatus string

const (
	LessonNotStarted LessonProgressStatus = "not_started"
	LessonInProgress LessonProgressStatus = "in_progress"
	LessonCompleted  LessonProgressStatus = "completed"
)

type LessonProgress struct {
	LessonID        string                `json:"lessonId"`
	ContextType     LessonProgressContext `json:"contextType"`
	CourseID        string                `json:"courseId"`
	TopicID         string                `json:"topicId"`
	Status          LessonProgressStatus  `json:"status"`
	PositionSeconds int                   `json:"positionSeconds"`
	CompletedAt     *time.Time            `json:"completedAt"`
	UpdatedAt       *time.Time            `json:"updatedAt"`
}

type LessonProgressContextInput struct {
	ContextType LessonProgressContext `json:"contextType"`
	CourseID    string                `json:"courseId"`
	TopicID     string                `json:"topicId"`
}

type VideoProgressWrite struct {
	LessonProgressContextInput
	PositionSeconds int `json:"positionSeconds"`
}
