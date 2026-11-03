package domain

import "time"

type CourseEnrollmentResponse struct {
	Success         bool      `json:"success"`
	Enrolled        bool      `json:"enrolled"`
	AlreadyEnrolled bool      `json:"alreadyEnrolled"`
	CourseID        string    `json:"courseId"`
	EnrolledAt      time.Time `json:"enrolledAt"`
	Message         string    `json:"message"`
}
