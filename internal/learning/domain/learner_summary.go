package domain

import "time"

type LearnerTimelineItem struct {
	ID       string    `json:"id"`
	Type     string    `json:"type"`
	Title    string    `json:"title"`
	Subtitle string    `json:"subtitle"`
	Date     time.Time `json:"date"`
}

type LearnerAchievementsSummary struct {
	CompletedLessons  int                   `json:"completedLessons"`
	CompletedQuizzes  int                   `json:"completedQuizzes"`
	PerfectQuizzes    int                   `json:"perfectQuizzes"`
	MasteredSkills    int                   `json:"masteredSkills"`
	EnrolledCourses   int                   `json:"enrolledCourses"`
	ActivityCount     int                   `json:"activityCount"`
	StreakDays        int                   `json:"streakDays"`
	CertificatesCount int                   `json:"certificatesCount"`
	Points            int                   `json:"points"`
	Level             int                   `json:"level"`
	Timeline          []LearnerTimelineItem `json:"timeline"`
}

type LearnerCourseLessonPreview struct {
	ID              string `json:"id"`
	Title           string `json:"title"`
	DurationSeconds int    `json:"durationSeconds"`
	Completed       bool   `json:"completed"`
}

type LearnerCourseModulePreview struct {
	ID      string                       `json:"id"`
	Title   string                       `json:"title"`
	Lessons []LearnerCourseLessonPreview `json:"lessons"`
}

type LearnerCourseProgressSummary struct {
	ID                    string                       `json:"id"`
	PathID                string                       `json:"pathId"`
	PathName              string                       `json:"pathName"`
	SubjectID             string                       `json:"subjectId"`
	SubjectName           string                       `json:"subjectName"`
	Category              string                       `json:"category"`
	Title                 string                       `json:"title"`
	Description           string                       `json:"description"`
	InstructorName        string                       `json:"instructorName"`
	ThumbnailAssetID      string                       `json:"thumbnailAssetId"`
	ThumbnailURL          string                       `json:"thumbnailUrl"`
	CertificateEnabled    bool                         `json:"certificateEnabled"`
	IsEnrolled            bool                         `json:"isEnrolled"`
	LessonsCount          int                          `json:"lessonsCount"`
	CompletedLessonsCount int                          `json:"completedLessonsCount"`
	Progress              int                          `json:"progress"`
	Modules               []LearnerCourseModulePreview `json:"modules"`
}

type CourseCertificate struct {
	ID                   string    `json:"id"`
	UserID               string    `json:"userId"`
	CourseID             string    `json:"courseId"`
	VerificationCode     string    `json:"verificationCode"`
	CourseName           string    `json:"courseName,omitempty"`
	StudentName          string    `json:"studentName,omitempty"`
	CompletionPercentage int       `json:"completionPercentage,omitempty"`
	IssuedAt             time.Time `json:"issuedAt"`
}

// CertificateVerification is the public information printed on a shared certificate.
type CertificateVerification struct {
	VerificationCode     string    `json:"verificationCode"`
	CourseName           string    `json:"courseName"`
	StudentName          string    `json:"studentName"`
	CompletionPercentage int       `json:"completionPercentage"`
	IssuedAt             time.Time `json:"issuedAt"`
}
