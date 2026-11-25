package application

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

var (
	ErrBookingPastDate = errors.New("scheduled date must be today or later")
	bookingUUIDPattern = regexp.MustCompile("^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$")
	riyadhLocation     = time.FixedZone("Asia/Riyadh", 3*60*60)
)

type SessionBookingRepository interface {
	CreateSessionBooking(context.Context, string, learning.SessionBookingCreate) (learning.SessionBooking, bool, error)
	ListMySessionBookings(context.Context, string, int) ([]learning.SessionBooking, error)
	CancelMySessionBooking(context.Context, string, string) (learning.SessionBooking, error)
	ListTeacherSessionBookings(context.Context, string, int) ([]learning.SessionBooking, error)
	RejectTeacherSessionBooking(context.Context, string, string) (learning.SessionBooking, error)
	ListAdminSessionBookings(context.Context, string, int) ([]learning.SessionBooking, error)
	AdminUpdateSessionBooking(context.Context, string, string, learning.SessionBookingAdminPatch) (learning.SessionBooking, error)
}

type SessionBookingService struct {
	repo SessionBookingRepository
	now  func() time.Time
}

func NewSessionBookingService(repo SessionBookingRepository) *SessionBookingService {
	return &SessionBookingService{
		repo: repo,
		now:  func() time.Time { return time.Now().In(riyadhLocation) },
	}
}

func isValidOptionalUUID(value string) bool {
	value = strings.TrimSpace(value)
	return value == "" || bookingUUIDPattern.MatchString(value)
}

func (s *SessionBookingService) Create(ctx context.Context, actor identity.User, input learning.SessionBookingCreate) (learning.SessionBooking, bool, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
		return learning.SessionBooking{}, false, ErrForbidden
	}

	input.Title = strings.TrimSpace(input.Title)
	input.TargetLabel = strings.TrimSpace(input.TargetLabel)
	input.ScheduledDate = strings.TrimSpace(input.ScheduledDate)
	input.ScheduledTime = strings.TrimSpace(input.ScheduledTime)
	input.Notes = strings.TrimSpace(input.Notes)
	input.RequestKey = strings.TrimSpace(input.RequestKey)
	input.PathID = strings.TrimSpace(input.PathID)
	input.StageID = strings.TrimSpace(input.StageID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	input.SectionID = strings.TrimSpace(input.SectionID)

	if input.Title == "" && input.TargetLabel != "" {
		input.Title = "طلب حصة خاصة: " + input.TargetLabel
	}
	if utf8.RuneCountInString(input.Title) < 2 || utf8.RuneCountInString(input.Title) > 240 {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}
	if utf8.RuneCountInString(input.TargetLabel) > 240 || utf8.RuneCountInString(input.Notes) > 2000 {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}
	if len(input.RequestKey) < 8 || len(input.RequestKey) > 100 {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}
	if len(input.ScheduledTime) < 3 || len(input.ScheduledTime) > 40 {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}

	parsedDate, err := time.ParseInLocation("2006-01-02", input.ScheduledDate, riyadhLocation)
	if err != nil {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}
	todayStr := s.now().In(riyadhLocation).Format("2006-01-02")
	if parsedDate.Format("2006-01-02") < todayStr {
		return learning.SessionBooking{}, false, ErrBookingPastDate
	}

	if !isValidOptionalUUID(input.PathID) || !isValidOptionalUUID(input.StageID) || !isValidOptionalUUID(input.SubjectID) || !isValidOptionalUUID(input.SectionID) {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}

	if len(input.SkillIDs) > 20 {
		return learning.SessionBooking{}, false, ErrInvalidInput
	}
	cleanSkills := make([]string, 0, len(input.SkillIDs))
	seen := make(map[string]struct{}, len(input.SkillIDs))
	for _, skillID := range input.SkillIDs {
		skillID = strings.TrimSpace(skillID)
		if skillID == "" {
			continue
		}
		if !bookingUUIDPattern.MatchString(skillID) {
			return learning.SessionBooking{}, false, ErrInvalidInput
		}
		if _, exists := seen[skillID]; !exists {
			seen[skillID] = struct{}{}
			cleanSkills = append(cleanSkills, skillID)
		}
	}
	input.SkillIDs = cleanSkills

	return s.repo.CreateSessionBooking(ctx, actor.ID, input)
}

func (s *SessionBookingService) ListMine(ctx context.Context, actor identity.User, limit int) ([]learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
		return nil, ErrForbidden
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListMySessionBookings(ctx, actor.ID, limit)
}

func (s *SessionBookingService) CancelMine(ctx context.Context, actor identity.User, bookingID string) (learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleStudent) {
		return learning.SessionBooking{}, ErrForbidden
	}
	bookingID = strings.TrimSpace(bookingID)
	if !bookingUUIDPattern.MatchString(bookingID) {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	return s.repo.CancelMySessionBooking(ctx, actor.ID, bookingID)
}

func (s *SessionBookingService) ListTeacher(ctx context.Context, actor identity.User, limit int) ([]learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || (!actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin)) {
		return nil, ErrForbidden
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListTeacherSessionBookings(ctx, actor.ID, limit)
}

func (s *SessionBookingService) RejectTeacher(ctx context.Context, actor identity.User, bookingID string) (learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || (!actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin)) {
		return learning.SessionBooking{}, ErrForbidden
	}
	bookingID = strings.TrimSpace(bookingID)
	if !bookingUUIDPattern.MatchString(bookingID) {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	return s.repo.RejectTeacherSessionBooking(ctx, actor.ID, bookingID)
}

func (s *SessionBookingService) ListAdmin(ctx context.Context, actor identity.User, status string, limit int) ([]learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	status = strings.TrimSpace(status)
	if status != "" && status != "all" && !learning.ValidBookingStatus(learning.BookingStatus(status)) {
		return nil, ErrInvalidInput
	}
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListAdminSessionBookings(ctx, status, limit)
}

func (s *SessionBookingService) AdminUpdate(ctx context.Context, actor identity.User, bookingID string, patch learning.SessionBookingAdminPatch) (learning.SessionBooking, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleAdmin) {
		return learning.SessionBooking{}, ErrForbidden
	}
	bookingID = strings.TrimSpace(bookingID)
	if !bookingUUIDPattern.MatchString(bookingID) {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	patch.BookingStatus = strings.TrimSpace(patch.BookingStatus)
	patch.TeacherID = strings.TrimSpace(patch.TeacherID)
	patch.AssignedTeacherName = strings.TrimSpace(patch.AssignedTeacherName)
	patch.AdminNotes = strings.TrimSpace(patch.AdminNotes)
	if patch.BookingStatus != "" && !learning.ValidBookingStatus(learning.BookingStatus(patch.BookingStatus)) {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	if !isValidOptionalUUID(patch.TeacherID) {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	if utf8.RuneCountInString(patch.AssignedTeacherName) > 160 || utf8.RuneCountInString(patch.AdminNotes) > 2000 {
		return learning.SessionBooking{}, ErrInvalidInput
	}
	return s.repo.AdminUpdateSessionBooking(ctx, actor.ID, bookingID, patch)
}
