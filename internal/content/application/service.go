package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
)

var (
	ErrInvalidInput = errors.New("invalid content input")
	ErrForbidden = errors.New("content operation forbidden")
	ErrWorkflow = errors.New("invalid content workflow transition")
)

type Repository interface {
	CanManageSchool(ctx context.Context, userID, schoolID string) (bool, error)

	CreateCourse(ctx context.Context, actorUserID string, command content.CourseCommand) (content.Course, error)
	UpdateCourse(ctx context.Context, actorUserID, courseID string, expectedRevision int, command content.CourseCommand) (content.Course, error)
	GetCourse(ctx context.Context, courseID string) (content.Course, error)
	ListCourses(ctx context.Context, query content.ListQuery) (content.CoursePage, error)
	SetCourseWorkflow(ctx context.Context, actorUserID, courseID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.Course, error)
	CreateCourseModule(ctx context.Context, actorUserID, courseID, title, description string, sortOrder int) (content.CourseModule, error)
	PlaceCourseLesson(ctx context.Context, actorUserID, courseID, moduleID, lessonID string, sortOrder int, preview bool) error

	CreateLesson(ctx context.Context, actorUserID string, command content.LessonCommand) (content.Lesson, error)
	UpdateLesson(ctx context.Context, actorUserID, lessonID string, expectedRevision int, command content.LessonCommand) (content.Lesson, error)
	GetLesson(ctx context.Context, lessonID string) (content.Lesson, error)
	ListLessons(ctx context.Context, query content.ListQuery) (content.LessonPage, error)
	SetLessonWorkflow(ctx context.Context, actorUserID, lessonID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.Lesson, error)

	CreateTopic(ctx context.Context, actorUserID string, command content.TopicCommand) (content.FoundationTopic, error)
	UpdateTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int, command content.TopicCommand) (content.FoundationTopic, error)
	GetTopic(ctx context.Context, topicID string) (content.FoundationTopic, error)
	ListTopics(ctx context.Context, query content.ListQuery) (content.TopicPage, error)
	ArchiveTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int) (content.FoundationTopic, error)
	LinkTopicLesson(ctx context.Context, actorUserID, topicID, lessonID string, sortOrder int) error
	LinkTopicLibrary(ctx context.Context, actorUserID, topicID, libraryItemID string, sortOrder int) error

	CreateLibraryItem(ctx context.Context, actorUserID string, command content.LibraryCommand) (content.LibraryItem, error)
	UpdateLibraryItem(ctx context.Context, actorUserID, itemID string, expectedRevision int, command content.LibraryCommand) (content.LibraryItem, error)
	GetLibraryItem(ctx context.Context, itemID string) (content.LibraryItem, error)
	ListLibraryItems(ctx context.Context, query content.ListQuery) (content.LibraryPage, error)
	SetLibraryWorkflow(ctx context.Context, actorUserID, itemID string, expectedRevision int, status content.WorkflowStatus, notes string) (content.LibraryItem, error)
}

type Service struct {
	repo Repository
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo}
}

type CourseInput struct {
	PathID string
	SubjectID string
	Title string
	Description string
	InstructorName string
	DurationMinutes int
	Level string
	OwnerType content.OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	DripContentEnabled bool
	CertificateEnabled bool
	ThumbnailAssetID string
	Presentation json.RawMessage
	SkillLinks []content.SkillLink
}

type LessonInput struct {
	PathID string
	SubjectID string
	Title string
	Description string
	LessonType string
	ContentText string
	DurationSeconds int
	VideoURL string
	VideoSource string
	MeetingURL string
	MeetingAt *string
	RecordingURL string
	JoinInstructions string
	ShowRecording bool
	OwnerType content.OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	IsLocked bool
	SkillLinks []content.SkillLink
	Assets []content.AssetLink
}

type TopicInput struct {
	PathID string
	SubjectID string
	ParentTopicID string
	Code string
	Title string
	Description string
	SortOrder int
	IsVisible bool
	IsLocked bool
	SkillLinks []content.SkillLink
}

type LibraryInput struct {
	PathID string
	SubjectID string
	Title string
	Description string
	ItemType string
	ExternalURL string
	OwnerType content.OwnerType
	OwnerUserID string
	OwnerSchoolID string
	AssignedTeacherID string
	IsVisible bool
	IsLocked bool
	SkillLinks []content.SkillLink
	Assets []content.AssetLink
}

func (s *Service) CreateCourse(ctx context.Context, actor identity.User, input CourseInput) (content.Course, error) {
	command, err := s.normalizeCourse(ctx, actor, input)
	if err != nil {
		return content.Course{}, err
	}
	return s.repo.CreateCourse(ctx, actor.ID, command)
}

func (s *Service) UpdateCourse(ctx context.Context, actor identity.User, id string, expectedRevision int, input CourseInput) (content.Course, error) {
	current, err := s.repo.GetCourse(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Course{}, err
	}
	if err := s.requireEditable(ctx, actor, current.Ownership); err != nil {
		return content.Course{}, err
	}
	if current.Ownership.WorkflowStatus == content.WorkflowApproved || current.Ownership.WorkflowStatus == content.WorkflowArchived {
		return content.Course{}, ErrWorkflow
	}
	if expectedRevision < 1 {
		return content.Course{}, ErrInvalidInput
	}
	command, err := s.normalizeCourse(ctx, actor, input)
	if err != nil {
		return content.Course{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		command.OwnerType = current.Ownership.OwnerType
		command.OwnerUserID = current.Ownership.OwnerUserID
		command.OwnerSchoolID = current.Ownership.OwnerSchoolID
		command.AssignedTeacherID = current.Ownership.AssignedTeacherID
	}
	return s.repo.UpdateCourse(ctx, actor.ID, current.ID, expectedRevision, command)
}

func (s *Service) StaffGetCourse(ctx context.Context, actor identity.User, id string) (content.Course, error) {
	row, err := s.repo.GetCourse(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Course{}, err
	}
	if err := s.requireEditable(ctx, actor, row.Ownership); err != nil {
		return content.Course{}, err
	}
	return row, nil
}

func (s *Service) ListCourses(ctx context.Context, actor identity.User, query content.ListQuery) (content.CoursePage, error) {
	if err := s.normalizeList(actor, &query, true); err != nil {
		return content.CoursePage{}, err
	}
	return s.repo.ListCourses(ctx, query)
}

func (s *Service) CourseWorkflow(ctx context.Context, actor identity.User, id string, command content.WorkflowCommand) (content.Course, error) {
	row, err := s.repo.GetCourse(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Course{}, err
	}
	if err := s.authorizeWorkflow(ctx, actor, row.Ownership, command); err != nil {
		return content.Course{}, err
	}
	return s.repo.SetCourseWorkflow(ctx, actor.ID, row.ID, command.ExpectedRevision, command.Status, strings.TrimSpace(command.ReviewerNotes))
}

func (s *Service) CreateCourseModule(ctx context.Context, actor identity.User, courseID, title, description string, sortOrder int) (content.CourseModule, error) {
	row, err := s.repo.GetCourse(ctx, strings.TrimSpace(courseID))
	if err != nil {
		return content.CourseModule{}, err
	}
	if err := s.requireEditable(ctx, actor, row.Ownership); err != nil {
		return content.CourseModule{}, err
	}
	title, description = strings.TrimSpace(title), strings.TrimSpace(description)
	if row.Ownership.WorkflowStatus == content.WorkflowArchived || title == "" || len(title) > 240 || len(description) > 4000 || sortOrder < 0 {
		return content.CourseModule{}, ErrInvalidInput
	}
	return s.repo.CreateCourseModule(ctx, actor.ID, row.ID, title, description, sortOrder)
}

func (s *Service) PlaceCourseLesson(ctx context.Context, actor identity.User, courseID, moduleID, lessonID string, sortOrder int, preview bool) error {
	courseRow, err := s.repo.GetCourse(ctx, strings.TrimSpace(courseID))
	if err != nil {
		return err
	}
	if err := s.requireEditable(ctx, actor, courseRow.Ownership); err != nil {
		return err
	}
	lessonRow, err := s.repo.GetLesson(ctx, strings.TrimSpace(lessonID))
	if err != nil {
		return err
	}
	if lessonRow.PathID != courseRow.PathID || lessonRow.SubjectID != courseRow.SubjectID || sortOrder < 0 {
		return content.ErrConflict
	}
	return s.repo.PlaceCourseLesson(ctx, actor.ID, courseRow.ID, strings.TrimSpace(moduleID), lessonRow.ID, sortOrder, preview)
}

func (s *Service) CreateLesson(ctx context.Context, actor identity.User, input LessonInput) (content.Lesson, error) {
	command, err := s.normalizeLesson(ctx, actor, input)
	if err != nil {
		return content.Lesson{}, err
	}
	return s.repo.CreateLesson(ctx, actor.ID, command)
}

func (s *Service) UpdateLesson(ctx context.Context, actor identity.User, id string, expectedRevision int, input LessonInput) (content.Lesson, error) {
	current, err := s.repo.GetLesson(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Lesson{}, err
	}
	if err := s.requireEditable(ctx, actor, current.Ownership); err != nil {
		return content.Lesson{}, err
	}
	if current.Ownership.WorkflowStatus == content.WorkflowApproved || current.Ownership.WorkflowStatus == content.WorkflowArchived || expectedRevision < 1 {
		return content.Lesson{}, ErrWorkflow
	}
	command, err := s.normalizeLesson(ctx, actor, input)
	if err != nil {
		return content.Lesson{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		command.OwnerType = current.Ownership.OwnerType
		command.OwnerUserID = current.Ownership.OwnerUserID
		command.OwnerSchoolID = current.Ownership.OwnerSchoolID
		command.AssignedTeacherID = current.Ownership.AssignedTeacherID
	}
	return s.repo.UpdateLesson(ctx, actor.ID, current.ID, expectedRevision, command)
}

func (s *Service) StaffGetLesson(ctx context.Context, actor identity.User, id string) (content.Lesson, error) {
	row, err := s.repo.GetLesson(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Lesson{}, err
	}
	if err := s.requireEditable(ctx, actor, row.Ownership); err != nil {
		return content.Lesson{}, err
	}
	return row, nil
}

func (s *Service) ListLessons(ctx context.Context, actor identity.User, query content.ListQuery) (content.LessonPage, error) {
	if err := s.normalizeList(actor, &query, true); err != nil {
		return content.LessonPage{}, err
	}
	return s.repo.ListLessons(ctx, query)
}

func (s *Service) LessonWorkflow(ctx context.Context, actor identity.User, id string, command content.WorkflowCommand) (content.Lesson, error) {
	row, err := s.repo.GetLesson(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.Lesson{}, err
	}
	if err := s.authorizeWorkflow(ctx, actor, row.Ownership, command); err != nil {
		return content.Lesson{}, err
	}
	return s.repo.SetLessonWorkflow(ctx, actor.ID, row.ID, command.ExpectedRevision, command.Status, strings.TrimSpace(command.ReviewerNotes))
}

func (s *Service) CreateTopic(ctx context.Context, actor identity.User, input TopicInput) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	command, err := normalizeTopic(input)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	return s.repo.CreateTopic(ctx, actor.ID, command)
}

func (s *Service) UpdateTopic(ctx context.Context, actor identity.User, id string, expectedRevision int, input TopicInput) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	if expectedRevision < 1 {
		return content.FoundationTopic{}, ErrInvalidInput
	}
	command, err := normalizeTopic(input)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	return s.repo.UpdateTopic(ctx, actor.ID, strings.TrimSpace(id), expectedRevision, command)
}

func (s *Service) StaffGetTopic(ctx context.Context, actor identity.User, id string) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	return s.repo.GetTopic(ctx, strings.TrimSpace(id))
}

func (s *Service) ListTopics(ctx context.Context, actor identity.User, query content.ListQuery) (content.TopicPage, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.TopicPage{}, ErrForbidden
	}
	if err := s.normalizeList(actor, &query, false); err != nil {
		return content.TopicPage{}, err
	}
	return s.repo.ListTopics(ctx, query)
}

func (s *Service) ArchiveTopic(ctx context.Context, actor identity.User, id string, expectedRevision int) (content.FoundationTopic, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return content.FoundationTopic{}, ErrForbidden
	}
	if expectedRevision < 1 {
		return content.FoundationTopic{}, ErrInvalidInput
	}
	return s.repo.ArchiveTopic(ctx, actor.ID, strings.TrimSpace(id), expectedRevision)
}

func (s *Service) LinkTopicLesson(ctx context.Context, actor identity.User, topicID, lessonID string, sortOrder int) error {
	if !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	if sortOrder < 0 {
		return ErrInvalidInput
	}
	return s.repo.LinkTopicLesson(ctx, actor.ID, strings.TrimSpace(topicID), strings.TrimSpace(lessonID), sortOrder)
}

func (s *Service) LinkTopicLibrary(ctx context.Context, actor identity.User, topicID, itemID string, sortOrder int) error {
	if !actor.HasRole(identity.RoleAdmin) {
		return ErrForbidden
	}
	if sortOrder < 0 {
		return ErrInvalidInput
	}
	return s.repo.LinkTopicLibrary(ctx, actor.ID, strings.TrimSpace(topicID), strings.TrimSpace(itemID), sortOrder)
}

func (s *Service) CreateLibraryItem(ctx context.Context, actor identity.User, input LibraryInput) (content.LibraryItem, error) {
	command, err := s.normalizeLibrary(ctx, actor, input)
	if err != nil {
		return content.LibraryItem{}, err
	}
	return s.repo.CreateLibraryItem(ctx, actor.ID, command)
}

func (s *Service) UpdateLibraryItem(ctx context.Context, actor identity.User, id string, expectedRevision int, input LibraryInput) (content.LibraryItem, error) {
	current, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.requireEditable(ctx, actor, current.Ownership); err != nil {
		return content.LibraryItem{}, err
	}
	if current.Ownership.WorkflowStatus == content.WorkflowApproved || current.Ownership.WorkflowStatus == content.WorkflowArchived || expectedRevision < 1 {
		return content.LibraryItem{}, ErrWorkflow
	}
	command, err := s.normalizeLibrary(ctx, actor, input)
	if err != nil {
		return content.LibraryItem{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		command.OwnerType = current.Ownership.OwnerType
		command.OwnerUserID = current.Ownership.OwnerUserID
		command.OwnerSchoolID = current.Ownership.OwnerSchoolID
		command.AssignedTeacherID = current.Ownership.AssignedTeacherID
	}
	return s.repo.UpdateLibraryItem(ctx, actor.ID, current.ID, expectedRevision, command)
}

func (s *Service) StaffGetLibraryItem(ctx context.Context, actor identity.User, id string) (content.LibraryItem, error) {
	row, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.requireEditable(ctx, actor, row.Ownership); err != nil {
		return content.LibraryItem{}, err
	}
	return row, nil
}

func (s *Service) ListLibraryItems(ctx context.Context, actor identity.User, query content.ListQuery) (content.LibraryPage, error) {
	if err := s.normalizeList(actor, &query, true); err != nil {
		return content.LibraryPage{}, err
	}
	return s.repo.ListLibraryItems(ctx, query)
}

func (s *Service) LibraryWorkflow(ctx context.Context, actor identity.User, id string, command content.WorkflowCommand) (content.LibraryItem, error) {
	row, err := s.repo.GetLibraryItem(ctx, strings.TrimSpace(id))
	if err != nil {
		return content.LibraryItem{}, err
	}
	if err := s.authorizeWorkflow(ctx, actor, row.Ownership, command); err != nil {
		return content.LibraryItem{}, err
	}
	return s.repo.SetLibraryWorkflow(ctx, actor.ID, row.ID, command.ExpectedRevision, command.Status, strings.TrimSpace(command.ReviewerNotes))
}

func (s *Service) normalizeCourse(ctx context.Context, actor identity.User, input CourseInput) (content.CourseCommand, error) {
	input.PathID, input.SubjectID = strings.TrimSpace(input.PathID), strings.TrimSpace(input.SubjectID)
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	input.InstructorName, input.Level = strings.TrimSpace(input.InstructorName), strings.ToLower(strings.TrimSpace(input.Level))
	input.ThumbnailAssetID = strings.TrimSpace(input.ThumbnailAssetID)
	if !validUUID(input.PathID) || !validUUID(input.SubjectID) || input.Title == "" || len(input.Title) > 240 ||
		len(input.Description) > 20000 || len(input.InstructorName) > 240 || input.DurationMinutes < 0 ||
		(input.Level != "beginner" && input.Level != "intermediate" && input.Level != "advanced") {
		return content.CourseCommand{}, ErrInvalidInput
	}
	ownerType, ownerUserID, ownerSchoolID, assignedTeacherID, err := s.normalizeOwnership(ctx, actor, input.OwnerType, input.OwnerUserID, input.OwnerSchoolID, input.AssignedTeacherID)
	if err != nil {
		return content.CourseCommand{}, err
	}
	links, err := normalizeSkillLinks(input.SkillLinks, false)
	if err != nil {
		return content.CourseCommand{}, err
	}
	presentation := input.Presentation
	if len(presentation) == 0 {
		presentation = json.RawMessage("{}")
	}
	if len(presentation) > 32768 || !json.Valid(presentation) || (input.ThumbnailAssetID != "" && !validUUID(input.ThumbnailAssetID)) {
		return content.CourseCommand{}, ErrInvalidInput
	}
	return content.CourseCommand{
		PathID: input.PathID, SubjectID: input.SubjectID, Title: input.Title, Description: input.Description,
		InstructorName: input.InstructorName, DurationMinutes: input.DurationMinutes, Level: input.Level,
		OwnerType: ownerType, OwnerUserID: ownerUserID, OwnerSchoolID: ownerSchoolID, AssignedTeacherID: assignedTeacherID,
		IsVisible: input.IsVisible, DripContentEnabled: input.DripContentEnabled, CertificateEnabled: input.CertificateEnabled,
		ThumbnailAssetID: input.ThumbnailAssetID, Presentation: presentation, SkillLinks: links,
	}, nil
}

func (s *Service) normalizeLesson(ctx context.Context, actor identity.User, input LessonInput) (content.LessonCommand, error) {
	input.PathID, input.SubjectID = strings.TrimSpace(input.PathID), strings.TrimSpace(input.SubjectID)
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	input.LessonType = strings.ToLower(strings.TrimSpace(input.LessonType))
	input.ContentText, input.VideoURL, input.VideoSource = strings.TrimSpace(input.ContentText), strings.TrimSpace(input.VideoURL), strings.ToLower(strings.TrimSpace(input.VideoSource))
	input.MeetingURL, input.RecordingURL, input.JoinInstructions = strings.TrimSpace(input.MeetingURL), strings.TrimSpace(input.RecordingURL), strings.TrimSpace(input.JoinInstructions)
	if !validUUID(input.PathID) || !validUUID(input.SubjectID) || input.Title == "" || len(input.Title) > 240 || len(input.Description) > 20000 ||
		len(input.ContentText) > 100000 || input.DurationSeconds < 0 || !validLessonType(input.LessonType) ||
		len(input.JoinInstructions) > 10000 {
		return content.LessonCommand{}, ErrInvalidInput
	}
	var meetingAt *timeValue
	if input.MeetingAt != nil {
		value, ok := parseTime(*input.MeetingAt)
		if !ok {
			return content.LessonCommand{}, ErrInvalidInput
		}
		meetingAt = &timeValue{value: value}
	}
	ownerType, ownerUserID, ownerSchoolID, assignedTeacherID, err := s.normalizeOwnership(ctx, actor, input.OwnerType, input.OwnerUserID, input.OwnerSchoolID, input.AssignedTeacherID)
	if err != nil {
		return content.LessonCommand{}, err
	}
	links, err := normalizeSkillLinks(input.SkillLinks, false)
	if err != nil {
		return content.LessonCommand{}, err
	}
	assets, err := normalizeAssets(input.Assets, map[string]bool{"video": true, "file": true, "recording": true, "attachment": true})
	if err != nil {
		return content.LessonCommand{}, err
	}
	command := content.LessonCommand{
		PathID: input.PathID, SubjectID: input.SubjectID, Title: input.Title, Description: input.Description,
		LessonType: input.LessonType, ContentText: input.ContentText, DurationSeconds: input.DurationSeconds,
		VideoURL: input.VideoURL, VideoSource: input.VideoSource, MeetingURL: input.MeetingURL,
		RecordingURL: input.RecordingURL, JoinInstructions: input.JoinInstructions, ShowRecording: input.ShowRecording,
		OwnerType: ownerType, OwnerUserID: ownerUserID, OwnerSchoolID: ownerSchoolID, AssignedTeacherID: assignedTeacherID,
		IsVisible: input.IsVisible, IsLocked: input.IsLocked, SkillLinks: links, Assets: assets,
	}
	if meetingAt != nil {
		command.MeetingAt = &meetingAt.value
	}
	if command.VideoSource != "" && command.VideoSource != "upload" && command.VideoSource != "youtube" && command.VideoSource != "vimeo" {
		return content.LessonCommand{}, ErrInvalidInput
	}
	return command, nil
}

type timeValue struct{ value time.Time }

func parseTime(value string) (time.Time, bool) {
	parsed, err := time.Parse(time.RFC3339, strings.TrimSpace(value))
	return parsed, err == nil
}

func normalizeTopic(input TopicInput) (content.TopicCommand, error) {
	input.PathID, input.SubjectID = strings.TrimSpace(input.PathID), strings.TrimSpace(input.SubjectID)
	input.ParentTopicID, input.Code = strings.TrimSpace(input.ParentTopicID), strings.ToUpper(strings.TrimSpace(input.Code))
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	if !validUUID(input.PathID) || !validUUID(input.SubjectID) || input.Title == "" || input.Code == "" ||
		len(input.Title) > 240 || len(input.Description) > 20000 || len(input.Code) > 100 || input.SortOrder < 0 {
		return content.TopicCommand{}, ErrInvalidInput
	}
	if input.ParentTopicID != "" && !validUUID(input.ParentTopicID) {
		return content.TopicCommand{}, ErrInvalidInput
	}
	for _, ch := range input.Code {
		if !((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_') {
			return content.TopicCommand{}, ErrInvalidInput
		}
	}
	links, err := normalizeSkillLinks(input.SkillLinks, true)
	if err != nil {
		return content.TopicCommand{}, err
	}
	return content.TopicCommand{
		PathID: input.PathID, SubjectID: input.SubjectID, ParentTopicID: input.ParentTopicID,
		Code: input.Code, Title: input.Title, Description: input.Description, SortOrder: input.SortOrder,
		IsVisible: input.IsVisible, IsLocked: input.IsLocked, SkillLinks: links,
	}, nil
}

func (s *Service) normalizeLibrary(ctx context.Context, actor identity.User, input LibraryInput) (content.LibraryCommand, error) {
	input.PathID, input.SubjectID = strings.TrimSpace(input.PathID), strings.TrimSpace(input.SubjectID)
	input.Title, input.Description = strings.TrimSpace(input.Title), strings.TrimSpace(input.Description)
	input.ItemType, input.ExternalURL = strings.ToLower(strings.TrimSpace(input.ItemType)), strings.TrimSpace(input.ExternalURL)
	if !validUUID(input.PathID) || !validUUID(input.SubjectID) || input.Title == "" || len(input.Title) > 240 ||
		len(input.Description) > 20000 || (input.ItemType != "pdf" && input.ItemType != "doc" && input.ItemType != "video" && input.ItemType != "link") ||
		(input.ItemType == "link" && input.ExternalURL == "") {
		return content.LibraryCommand{}, ErrInvalidInput
	}
	ownerType, ownerUserID, ownerSchoolID, assignedTeacherID, err := s.normalizeOwnership(ctx, actor, input.OwnerType, input.OwnerUserID, input.OwnerSchoolID, input.AssignedTeacherID)
	if err != nil {
		return content.LibraryCommand{}, err
	}
	links, err := normalizeSkillLinks(input.SkillLinks, false)
	if err != nil {
		return content.LibraryCommand{}, err
	}
	assets, err := normalizeAssets(input.Assets, map[string]bool{"primary": true, "preview": true, "attachment": true})
	if err != nil {
		return content.LibraryCommand{}, err
	}
	if input.ItemType != "link" && input.ExternalURL == "" && len(assets) == 0 {
		return content.LibraryCommand{}, ErrInvalidInput
	}
	return content.LibraryCommand{
		PathID: input.PathID, SubjectID: input.SubjectID, Title: input.Title, Description: input.Description,
		ItemType: input.ItemType, ExternalURL: input.ExternalURL, OwnerType: ownerType, OwnerUserID: ownerUserID,
		OwnerSchoolID: ownerSchoolID, AssignedTeacherID: assignedTeacherID, IsVisible: input.IsVisible, IsLocked: input.IsLocked,
		SkillLinks: links, Assets: assets,
	}, nil
}

func (s *Service) normalizeOwnership(ctx context.Context, actor identity.User, ownerType content.OwnerType, ownerUserID, ownerSchoolID, assignedTeacherID string) (content.OwnerType, string, string, string, error) {
	ownerUserID, ownerSchoolID, assignedTeacherID = strings.TrimSpace(ownerUserID), strings.TrimSpace(ownerSchoolID), strings.TrimSpace(assignedTeacherID)
	if actor.HasRole(identity.RoleAdmin) {
		if ownerType == "" {
			ownerType = content.OwnerPlatform
		}
		switch ownerType {
		case content.OwnerPlatform:
			ownerUserID, ownerSchoolID = "", ""
		case content.OwnerTeacher:
			if !validUUID(ownerUserID) {
				return "", "", "", "", ErrInvalidInput
			}
			ownerSchoolID = ""
		case content.OwnerSchool:
			if !validUUID(ownerSchoolID) {
				return "", "", "", "", ErrInvalidInput
			}
			ownerUserID = ""
		default:
			return "", "", "", "", ErrInvalidInput
		}
		if assignedTeacherID != "" && !validUUID(assignedTeacherID) {
			return "", "", "", "", ErrInvalidInput
		}
		return ownerType, ownerUserID, ownerSchoolID, assignedTeacherID, nil
	}
	if actor.HasRole(identity.RoleTeacher) {
		return content.OwnerTeacher, actor.ID, "", actor.ID, nil
	}
	if actor.HasRole(identity.RoleSchoolAdmin) {
		if !validUUID(ownerSchoolID) {
			return "", "", "", "", ErrInvalidInput
		}
		ok, err := s.repo.CanManageSchool(ctx, actor.ID, ownerSchoolID)
		if err != nil {
			return "", "", "", "", err
		}
		if !ok {
			return "", "", "", "", ErrForbidden
		}
		return content.OwnerSchool, "", ownerSchoolID, "", nil
	}
	return "", "", "", "", ErrForbidden
}

func (s *Service) requireEditable(ctx context.Context, actor identity.User, ownership content.Ownership) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	if actor.HasRole(identity.RoleTeacher) && (ownership.OwnerUserID == actor.ID || ownership.AssignedTeacherID == actor.ID) {
		return nil
	}
	if actor.HasRole(identity.RoleSchoolAdmin) && ownership.OwnerSchoolID != "" {
		ok, err := s.repo.CanManageSchool(ctx, actor.ID, ownership.OwnerSchoolID)
		if err != nil {
			return err
		}
		if ok {
			return nil
		}
	}
	return ErrForbidden
}

func (s *Service) authorizeWorkflow(ctx context.Context, actor identity.User, current content.Ownership, command content.WorkflowCommand) error {
	if command.ExpectedRevision < 1 || !content.ValidWorkflowStatus(command.Status) || len(strings.TrimSpace(command.ReviewerNotes)) > 4000 {
		return ErrInvalidInput
	}
	if current.WorkflowStatus == content.WorkflowArchived {
		return ErrWorkflow
	}
	if actor.HasRole(identity.RoleAdmin) {
		if validAdminTransition(current.WorkflowStatus, command.Status) {
			return nil
		}
		return ErrWorkflow
	}
	if err := s.requireEditable(ctx, actor, current); err != nil {
		return err
	}
	allowed := (current.WorkflowStatus == content.WorkflowDraft || current.WorkflowStatus == content.WorkflowRejected) && command.Status == content.WorkflowPendingReview
	allowed = allowed || (current.WorkflowStatus == content.WorkflowPendingReview && command.Status == content.WorkflowDraft)
	if !allowed {
		return ErrWorkflow
	}
	return nil
}

func validAdminTransition(from, to content.WorkflowStatus) bool {
	switch from {
	case content.WorkflowDraft, content.WorkflowRejected:
		return to == content.WorkflowPendingReview || to == content.WorkflowArchived
	case content.WorkflowPendingReview:
		return to == content.WorkflowApproved || to == content.WorkflowRejected || to == content.WorkflowDraft || to == content.WorkflowArchived
	case content.WorkflowApproved:
		return to == content.WorkflowArchived
	default:
		return false
	}
}

func (s *Service) normalizeList(actor identity.User, query *content.ListQuery, scoped bool) error {
	if query.Page == 0 {
		query.Page = 1
	}
	if query.Limit == 0 {
		query.Limit = 50
	}
	query.Search = strings.TrimSpace(query.Search)
	query.PathID = strings.TrimSpace(query.PathID)
	query.SubjectID = strings.TrimSpace(query.SubjectID)
	query.ActorUserID = actor.ID
	if query.Page < 1 || query.Limit < 1 || query.Limit > 100 || len(query.Search) > 200 {
		return ErrInvalidInput
	}
	if query.PathID != "" && !validUUID(query.PathID) || query.SubjectID != "" && !validUUID(query.SubjectID) {
		return ErrInvalidInput
	}
	if query.Workflow != "" && !content.ValidWorkflowStatus(query.Workflow) {
		return ErrInvalidInput
	}
	if actor.HasRole(identity.RoleAdmin) {
		query.StaffScope = content.ScopeAdmin
		return nil
	}
	if !scoped {
		return ErrForbidden
	}
	if actor.HasRole(identity.RoleSchoolAdmin) {
		query.StaffScope = content.ScopeSchoolAdmin
		return nil
	}
	if actor.HasRole(identity.RoleTeacher) {
		query.StaffScope = content.ScopeTeacher
		return nil
	}
	return ErrForbidden
}

func normalizeSkillLinks(input []content.SkillLink, foundation bool) ([]content.SkillLink, error) {
	if len(input) == 0 || len(input) > 50 {
		return nil, ErrInvalidInput
	}
	seen := map[string]bool{}
	primary := 0
	result := make([]content.SkillLink, 0, len(input))
	for _, item := range input {
		id := strings.TrimSpace(item.SkillID)
		relation := strings.ToLower(strings.TrimSpace(item.RelationType))
		if !validUUID(id) || seen[id] {
			return nil, ErrInvalidInput
		}
		seen[id] = true
		if foundation {
			if relation != "primary" && relation != "secondary" {
				return nil, ErrInvalidInput
			}
			if relation == "primary" {
				primary++
			}
		} else if relation != "target" && relation != "prerequisite" && relation != "secondary" {
			return nil, ErrInvalidInput
		}
		result = append(result, content.SkillLink{SkillID: id, RelationType: relation})
	}
	if foundation && primary != 1 {
		return nil, ErrInvalidInput
	}
	return result, nil
}

func normalizeAssets(input []content.AssetLink, allowed map[string]bool) ([]content.AssetLink, error) {
	if len(input) > 20 {
		return nil, ErrInvalidInput
	}
	seen := map[string]bool{}
	result := make([]content.AssetLink, 0, len(input))
	for _, item := range input {
		id := strings.TrimSpace(item.AssetID)
		purpose := strings.ToLower(strings.TrimSpace(item.Purpose))
		title := strings.TrimSpace(item.Title)
		key := id + "|" + purpose
		if !validUUID(id) || !allowed[purpose] || item.SortOrder < 0 || len(title) > 240 || seen[key] {
			return nil, ErrInvalidInput
		}
		seen[key] = true
		result = append(result, content.AssetLink{AssetID: id, Purpose: purpose, Title: title, SortOrder: item.SortOrder})
	}
	return result, nil
}

func validLessonType(value string) bool {
	switch value {
	case "video", "file", "text", "assignment", "live_youtube", "zoom", "google_meet", "teams":
		return true
	default:
		return false
	}
}

func validUUID(value string) bool {
	if len(value) != 36 || value[8] != '-' || value[13] != '-' || value[18] != '-' || value[23] != '-' {
		return false
	}
	for i, ch := range value {
		if i == 8 || i == 13 || i == 18 || i == 23 {
			continue
		}
		if !((ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') || (ch >= 'A' && ch <= 'F')) {
			return false
		}
	}
	return true
}
