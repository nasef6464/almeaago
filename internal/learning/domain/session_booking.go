package domain

import "time"

type BookingStatus string

const (
	BookingPending   BookingStatus = "pending"
	BookingConfirmed BookingStatus = "confirmed"
	BookingRejected  BookingStatus = "rejected"
	BookingCancelled BookingStatus = "cancelled"
)

func ValidBookingStatus(status BookingStatus) bool {
	switch status {
	case BookingPending, BookingConfirmed, BookingRejected, BookingCancelled:
		return true
	default:
		return false
	}
}

type SessionBooking struct {
	ID                  string        `json:"id"`
	UserID              string        `json:"userId"`
	RequestKey          string        `json:"requestKey"`
	Title               string        `json:"title"`
	TargetLabel         string        `json:"targetLabel"`
	ScheduledDate       string        `json:"scheduledDate"`
	ScheduledTime       string        `json:"scheduledTime"`
	Notes               string        `json:"notes"`
	PathID              string        `json:"pathId,omitempty"`
	StageID             string        `json:"stageId,omitempty"`
	SubjectID           string        `json:"subjectId,omitempty"`
	SectionID           string        `json:"sectionId,omitempty"`
	SkillIDs            []string      `json:"skillIds"`
	BookingStatus       BookingStatus `json:"bookingStatus"`
	TeacherID           string        `json:"teacherId,omitempty"`
	AssignedTeacherName string        `json:"assignedTeacherName,omitempty"`
	SessionID           string        `json:"sessionId,omitempty"`
	AdminNotes          string        `json:"adminNotes,omitempty"`
	StudentName         string        `json:"studentName,omitempty"`
	StudentEmail        string        `json:"studentEmail,omitempty"`
	CreatedAt           time.Time     `json:"createdAt"`
	UpdatedAt           time.Time     `json:"updatedAt"`
}

type SessionBookingCreate struct {
	Title         string   `json:"title"`
	TargetLabel   string   `json:"targetLabel"`
	ScheduledDate string   `json:"scheduledDate"`
	ScheduledTime string   `json:"scheduledTime"`
	Notes         string   `json:"notes"`
	RequestKey    string   `json:"requestKey"`
	PathID        string   `json:"pathId"`
	StageID       string   `json:"stageId"`
	SubjectID     string   `json:"subjectId"`
	SectionID     string   `json:"sectionId"`
	SkillIDs      []string `json:"skillIds"`
}

type SessionBookingAdminPatch struct {
	BookingStatus       string `json:"bookingStatus"`
	TeacherID           string `json:"teacherId"`
	AssignedTeacherName string `json:"assignedTeacherName"`
	AdminNotes          string `json:"adminNotes"`
}
