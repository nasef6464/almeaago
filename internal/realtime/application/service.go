package application

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"math/big"
	"regexp"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

var (
	ErrForbidden    = errors.New("classroom operation forbidden")
	ErrInvalidInput = errors.New("invalid classroom input")
	ErrUnavailable  = errors.New("classroom service unavailable")
	ErrNotFound     = realtime.ErrNotFound
	ErrConflict     = realtime.ErrConflict
)

type Repository interface {
	CreateSession(context.Context, realtime.CreateRecord) (realtime.Session, error)
	GetSession(context.Context, string) (realtime.Session, error)
	FindLiveByPINHash(context.Context, string) (realtime.Session, error)
	ListTeacherSessions(context.Context, string, int) ([]realtime.Session, error)
	SessionQuestions(context.Context, string) ([]realtime.PinnedQuestion, error)
	QuestionByOrdinal(context.Context, string, int) (realtime.PinnedQuestion, error)
	AppendBatch(context.Context, realtime.AppendBatchRecord) (realtime.Batch, error)
	StartSession(context.Context, string, string, int) (realtime.Session, error)
	PublishQuestion(context.Context, string, string, int) (realtime.Session, error)
	RevealQuestion(context.Context, string, string, int) (realtime.PinnedQuestion, error)
	EndBatch(context.Context, string, string, string) (realtime.Batch, error)
	JoinSession(context.Context, string, string) (realtime.Participant, error)
	Participant(context.Context, string, string) (realtime.Participant, error)
	SetAttendance(context.Context, string, string, string, realtime.AttendanceStatus) (realtime.Participant, error)
	UpsertAnswer(context.Context, string, string, int, int, bool) (realtime.Response, error)
	StudentResponses(context.Context, string, string) (map[int]realtime.Response, error)
	Aggregate(context.Context, string) (realtime.Aggregate, error)
	FinalizeSession(context.Context, string, string, []string) (realtime.ReportSnapshot, error)
	GetReport(context.Context, string) (realtime.ReportSnapshot, error)
}

type OrganizationResolver interface {
	SmartClassroomModuleEnabled(context.Context, string) (bool, error)
	ValidateSmartClassroomScope(context.Context, string, string, string) (bool, error)
	CanTeacherControlSmartClassroom(context.Context, string, string, string, string) (bool, error)
	CanStudentJoinSmartClassroom(context.Context, string, string, string) (bool, error)
	CanStaffViewSmartClassroom(context.Context, string, string, string) (bool, error)
	SmartClassroomRoster(context.Context, string, string) ([]string, error)
}

type QuestionResolver interface {
	Resolve(context.Context, []string, string) ([]question.ClassroomQuestion, error)
	ResolveOne(context.Context, string, int) (question.ClassroomQuestion, error)
	ResolveRefs(context.Context, []question.ReviewRef) ([]question.ClassroomQuestion, error)
}

type EventPublisher interface {
	Publish(context.Context, realtime.StreamEvent) error
}

type Service struct {
	repo      Repository
	org       OrganizationResolver
	questions QuestionResolver
	events    EventPublisher
	pinSecret []byte
	now       func() time.Time
}

func NewService(
	repo Repository,
	org OrganizationResolver,
	questions QuestionResolver,
	events EventPublisher,
	pinSecret string,
) *Service {
	return &Service{
		repo: repo, org: org, questions: questions, events: events,
		pinSecret: []byte(strings.TrimSpace(pinSecret)),
		now: time.Now,
	}
}

type CreateInput struct {
	SchoolID      string
	ClassID       string
	SubjectID     string
	QuestionIDs   []string
	Day           string
	Period        *int
	PublishedMode realtime.PublishedMode
}

type CreateResult struct {
	Session realtime.Session
	PIN     string
}

type AppendBatchInput struct {
	Label       string
	QuestionIDs []string
}

func (s *Service) emit(ctx context.Context, eventType, sessionID string, data any) {
	if s.events == nil {
		return
	}
	_ = s.events.Publish(ctx, realtime.StreamEvent{
		Type: eventType, SessionID: sessionID, At: s.now().UTC(), Data: data,
	})
}

func (s *Service) moduleEnabled(ctx context.Context, schoolID string) (bool, error) {
	if s.org == nil {
		return false, ErrUnavailable
	}
	return s.org.SmartClassroomModuleEnabled(ctx, schoolID)
}

func (s *Service) validateScope(ctx context.Context, schoolID, classID, subjectID string) error {
	if s.org == nil {
		return ErrUnavailable
	}
	ok, err := s.org.ValidateSmartClassroomScope(ctx, schoolID, classID, subjectID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	enabled, err := s.moduleEnabled(ctx, schoolID)
	if err != nil {
		return err
	}
	if !enabled {
		return ErrForbidden
	}
	return nil
}

func (s *Service) canControl(ctx context.Context, actor identity.User, session realtime.Session) error {
	if actor.HasRole(identity.RoleAdmin) {
		return s.validateScope(ctx, session.SchoolID, session.ClassID, session.SubjectID)
	}
	if !actor.HasRole(identity.RoleTeacher) || actor.ID != session.TeacherID || s.org == nil {
		return ErrForbidden
	}
	enabled, err := s.moduleEnabled(ctx, session.SchoolID)
	if err != nil {
		return err
	}
	if !enabled {
		return ErrForbidden
	}
	ok, err := s.org.CanTeacherControlSmartClassroom(
		ctx, actor.ID, session.SchoolID, session.ClassID, session.SubjectID,
	)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

func (s *Service) canView(ctx context.Context, actor identity.User, session realtime.Session) error {
	if actor.HasRole(identity.RoleAdmin) {
		return nil
	}
	enabled, err := s.moduleEnabled(ctx, session.SchoolID)
	if err != nil {
		return err
	}
	if !enabled || s.org == nil {
		return ErrForbidden
	}
	if actor.HasRole(identity.RoleTeacher) {
		if actor.ID != session.TeacherID {
			return ErrForbidden
		}
		ok, err := s.org.CanTeacherControlSmartClassroom(
			ctx, actor.ID, session.SchoolID, session.ClassID, session.SubjectID,
		)
		if err != nil {
			return err
		}
		if !ok {
			return ErrForbidden
		}
		return nil
	}
	if !actor.HasRole(identity.RoleSupervisor) && !actor.HasRole(identity.RoleSchoolAdmin) {
		return ErrForbidden
	}
	ok, err := s.org.CanStaffViewSmartClassroom(ctx, actor.ID, session.SchoolID, session.ClassID)
	if err != nil {
		return err
	}
	if !ok {
		return ErrForbidden
	}
	return nil
}

func (s *Service) Create(
	ctx context.Context,
	actor identity.User,
	input CreateInput,
) (CreateResult, error) {
	input.SchoolID = strings.TrimSpace(input.SchoolID)
	input.ClassID = strings.TrimSpace(input.ClassID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	input.Day = strings.TrimSpace(input.Day)
	if input.PublishedMode == "" {
		input.PublishedMode = realtime.PublishedSingle
	}
	if input.SchoolID == "" || input.ClassID == "" || input.SubjectID == "" ||
		len(input.QuestionIDs) < 1 || len(input.QuestionIDs) > 30 ||
		len(input.Day) > 40 ||
		(input.PublishedMode != realtime.PublishedSingle && input.PublishedMode != realtime.PublishedBatch) ||
		(input.Period != nil && (*input.Period < 1 || *input.Period > 12)) {
		return CreateResult{}, ErrInvalidInput
	}
	if !actor.HasRole(identity.RoleAdmin) && !actor.HasRole(identity.RoleTeacher) {
		return CreateResult{}, ErrForbidden
	}
	if len(s.pinSecret) == 0 || s.questions == nil || s.org == nil {
		return CreateResult{}, ErrUnavailable
	}
	if err := s.validateScope(ctx, input.SchoolID, input.ClassID, input.SubjectID); err != nil {
		return CreateResult{}, err
	}
	if actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		ok, err := s.org.CanTeacherControlSmartClassroom(
			ctx, actor.ID, input.SchoolID, input.ClassID, input.SubjectID,
		)
		if err != nil {
			return CreateResult{}, err
		}
		if !ok {
			return CreateResult{}, ErrForbidden
		}
	}
	rows, err := s.questions.Resolve(ctx, input.QuestionIDs, input.SubjectID)
	if err != nil {
		return CreateResult{}, err
	}
	refs := make([]realtime.QuestionRef, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, realtime.QuestionRef{ID: row.ID, Version: row.Version})
	}
	pin, err := generatePIN()
	if err != nil {
		return CreateResult{}, err
	}
	hash := s.hashPIN(pin)
	session, err := s.repo.CreateSession(ctx, realtime.CreateRecord{
		ActorUserID: actor.ID,
		SchoolID: input.SchoolID,
		ClassID: input.ClassID,
		SubjectID: input.SubjectID,
		TeacherID: actor.ID,
		Day: input.Day,
		Period: input.Period,
		PublishedMode: input.PublishedMode,
		PINHash: hash,
		PINExpiresAt: s.now().UTC().Add(30 * time.Minute),
		Questions: refs,
	})
	if err != nil {
		return CreateResult{}, err
	}
	return CreateResult{Session: session, PIN: pin}, nil
}

func (s *Service) TeacherSessions(
	ctx context.Context,
	actor identity.User,
) ([]realtime.Session, error) {
	if !actor.HasRole(identity.RoleTeacher) && !actor.HasRole(identity.RoleAdmin) {
		return nil, ErrForbidden
	}
	return s.repo.ListTeacherSessions(ctx, actor.ID, 50)
}

func (s *Service) Start(
	ctx context.Context,
	actor identity.User,
	sessionID string,
	expectedRevision int,
) (realtime.Session, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Session{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.Session{}, err
	}
	out, err := s.repo.StartSession(ctx, session.ID, actor.ID, expectedRevision)
	if err == nil {
		s.emit(ctx, "session.started", session.ID, map[string]any{"status": out.Status})
	}
	return out, err
}

func (s *Service) AppendBatch(
	ctx context.Context,
	actor identity.User,
	sessionID string,
	input AppendBatchInput,
) (realtime.Batch, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Batch{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.Batch{}, err
	}
	input.Label = strings.TrimSpace(input.Label)
	if len(input.Label) > 160 || len(input.QuestionIDs) < 1 || len(input.QuestionIDs) > 20 {
		return realtime.Batch{}, ErrInvalidInput
	}
	rows, err := s.questions.Resolve(ctx, input.QuestionIDs, session.SubjectID)
	if err != nil {
		return realtime.Batch{}, err
	}
	refs := make([]realtime.QuestionRef, 0, len(rows))
	for _, row := range rows {
		refs = append(refs, realtime.QuestionRef{ID: row.ID, Version: row.Version})
	}
	out, err := s.repo.AppendBatch(ctx, realtime.AppendBatchRecord{
		ActorUserID: actor.ID, SessionID: session.ID, Label: input.Label, Questions: refs,
	})
	if err == nil {
		s.emit(ctx, "batch.appended", session.ID, map[string]any{"batchId": out.ID, "batchNumber": out.BatchNumber})
	}
	return out, err
}

func (s *Service) Publish(
	ctx context.Context,
	actor identity.User,
	sessionID string,
	ordinal int,
) (realtime.Session, error) {
	if ordinal < 0 {
		return realtime.Session{}, ErrInvalidInput
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Session{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.Session{}, err
	}
	out, err := s.repo.PublishQuestion(ctx, session.ID, actor.ID, ordinal)
	if err == nil {
		s.emit(ctx, "question.published", session.ID, map[string]any{"ordinal": ordinal, "mode": out.PublishedMode})
	}
	return out, err
}

func (s *Service) Reveal(
	ctx context.Context,
	actor identity.User,
	sessionID string,
	ordinal int,
) (realtime.PinnedQuestion, error) {
	if ordinal < 0 {
		return realtime.PinnedQuestion{}, ErrInvalidInput
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.PinnedQuestion{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.PinnedQuestion{}, err
	}
	out, err := s.repo.RevealQuestion(ctx, session.ID, actor.ID, ordinal)
	if err == nil {
		s.emit(ctx, "question.revealed", session.ID, map[string]any{"ordinal": ordinal})
	}
	return out, err
}

func (s *Service) EndBatch(
	ctx context.Context,
	actor identity.User,
	sessionID, batchID string,
) (realtime.Batch, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Batch{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.Batch{}, err
	}
	out, err := s.repo.EndBatch(ctx, session.ID, strings.TrimSpace(batchID), actor.ID)
	if err == nil {
		s.emit(ctx, "batch.ended", session.ID, map[string]any{"batchId": out.ID})
	}
	return out, err
}

func (s *Service) JoinByPIN(
	ctx context.Context,
	actor identity.User,
	pin string,
) (realtime.Participant, realtime.Session, error) {
	if !actor.HasRole(identity.RoleStudent) || !regexp.MustCompile("^[0-9]{6}$").MatchString(strings.TrimSpace(pin)) {
		return realtime.Participant{}, realtime.Session{}, ErrForbidden
	}
	if len(s.pinSecret) == 0 || s.org == nil {
		return realtime.Participant{}, realtime.Session{}, ErrUnavailable
	}
	session, err := s.repo.FindLiveByPINHash(ctx, s.hashPIN(strings.TrimSpace(pin)))
	if err != nil {
		return realtime.Participant{}, realtime.Session{}, err
	}
	participant, err := s.joinSession(ctx, actor, session)
	return participant, session, err
}

func (s *Service) Join(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (realtime.Participant, realtime.Session, error) {
	if !actor.HasRole(identity.RoleStudent) {
		return realtime.Participant{}, realtime.Session{}, ErrForbidden
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Participant{}, realtime.Session{}, err
	}
	if session.Status != realtime.SessionLive {
		return realtime.Participant{}, realtime.Session{}, ErrNotFound
	}
	participant, err := s.joinSession(ctx, actor, session)
	return participant, session, err
}

func (s *Service) joinSession(
	ctx context.Context,
	actor identity.User,
	session realtime.Session,
) (realtime.Participant, error) {
	enabled, err := s.moduleEnabled(ctx, session.SchoolID)
	if err != nil {
		return realtime.Participant{}, err
	}
	if !enabled {
		return realtime.Participant{}, ErrForbidden
	}
	ok, err := s.org.CanStudentJoinSmartClassroom(ctx, actor.ID, session.SchoolID, session.ClassID)
	if err != nil {
		return realtime.Participant{}, err
	}
	if !ok {
		return realtime.Participant{}, ErrForbidden
	}
	participant, err := s.repo.JoinSession(ctx, session.ID, actor.ID)
	if err == nil {
		s.emit(ctx, "participant.joined", session.ID, map[string]any{"studentId": actor.ID})
	}
	return participant, err
}

func (s *Service) StudentState(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (realtime.StudentState, error) {
	if !actor.HasRole(identity.RoleStudent) {
		return realtime.StudentState{}, ErrForbidden
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.StudentState{}, err
	}
	if _, err = s.repo.Participant(ctx, session.ID, actor.ID); err != nil {
		return realtime.StudentState{}, ErrForbidden
	}
	enabled, err := s.moduleEnabled(ctx, session.SchoolID)
	if err != nil {
		return realtime.StudentState{}, err
	}
	if !enabled && session.Status == realtime.SessionLive {
		return realtime.StudentState{}, ErrForbidden
	}
	pinned, err := s.repo.SessionQuestions(ctx, session.ID)
	if err != nil {
		return realtime.StudentState{}, err
	}
	selected := make([]realtime.PinnedQuestion, 0, len(pinned))
	for _, item := range pinned {
		if item.PublishedAt == nil {
			continue
		}
		if session.PublishedMode == realtime.PublishedSingle {
			if session.ActiveQuestionOrdinal != nil && item.Ordinal == *session.ActiveQuestionOrdinal {
				selected = append(selected, item)
			}
			continue
		}
		if session.ActiveBatchID != "" && item.BatchID == session.ActiveBatchID {
			selected = append(selected, item)
		}
	}
	refs := make([]question.ReviewRef, 0, len(selected))
	for _, item := range selected {
		refs = append(refs, question.ReviewRef{QuestionID: item.QuestionID, Version: item.QuestionVersion})
	}
	resolved, err := s.questions.ResolveRefs(ctx, refs)
	if err != nil {
		return realtime.StudentState{}, err
	}
	byRef := map[string]question.ClassroomQuestion{}
	for _, row := range resolved {
		byRef[row.ID+":"+itoa(row.Version)] = row
	}
	responses, err := s.repo.StudentResponses(ctx, session.ID, actor.ID)
	if err != nil {
		return realtime.StudentState{}, err
	}
	out := realtime.StudentState{
		SessionID: session.ID,
		Status: session.Status,
		PublishedMode: session.PublishedMode,
		ActiveBatchID: session.ActiveBatchID,
		ActiveQuestionOrdinal: session.ActiveQuestionOrdinal,
		Questions: []realtime.StudentQuestion{},
	}
	for _, item := range selected {
		row, ok := byRef[item.QuestionID+":"+itoa(item.QuestionVersion)]
		if !ok {
			continue
		}
		studentQuestion := realtime.StudentQuestion{
			Ordinal: item.Ordinal,
			QuestionID: item.QuestionID,
			QuestionVersion: item.QuestionVersion,
			Text: row.TextContent,
			ImageAssetID: row.ImageAssetID,
			ImageAlt: row.ImageAlt,
			OptionsEmbeddedInImage: row.OptionsEmbeddedInImage,
			Difficulty: row.Difficulty,
			Revealed: item.RevealedAt != nil,
			Options: make([]realtime.StudentOption,0,len(row.Options)),
		}
		for _, option := range row.Options {
			studentQuestion.Options = append(studentQuestion.Options,realtime.StudentOption{
				Index: option.Index,Text: option.Text,AssetID: option.AssetID,
			})
		}
		if response, ok := responses[item.Ordinal]; ok {
			value := response.SelectedOptionIndex
			studentQuestion.SelectedOptionIndex = &value
		}
		if item.RevealedAt != nil {
			studentQuestion.CorrectOptionIndex = row.CorrectOptionIndex
			studentQuestion.Explanation = row.Explanation
		}
		out.Questions = append(out.Questions, studentQuestion)
	}
	return out, nil
}

func (s *Service) Answer(
	ctx context.Context,
	actor identity.User,
	sessionID string,
	ordinal, selectedOptionIndex int,
) (realtime.Response, error) {
	if !actor.HasRole(identity.RoleStudent) || ordinal < 0 || selectedOptionIndex < 0 {
		return realtime.Response{}, ErrForbidden
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Response{}, err
	}
	enabled, err := s.moduleEnabled(ctx, session.SchoolID)
	if err != nil {
		return realtime.Response{}, err
	}
	if !enabled {
		return realtime.Response{}, ErrForbidden
	}
	if _, err = s.repo.Participant(ctx, session.ID, actor.ID); err != nil {
		return realtime.Response{}, ErrForbidden
	}
	pinned, err := s.repo.QuestionByOrdinal(ctx, session.ID, ordinal)
	if err != nil {
		return realtime.Response{}, err
	}
	row, err := s.questions.ResolveOne(ctx, pinned.QuestionID, pinned.QuestionVersion)
	if err != nil {
		return realtime.Response{}, err
	}
	if selectedOptionIndex >= len(row.Options) || row.CorrectOptionIndex == nil {
		return realtime.Response{}, ErrInvalidInput
	}
	out, err := s.repo.UpsertAnswer(
		ctx, session.ID, actor.ID, ordinal, selectedOptionIndex, selectedOptionIndex == *row.CorrectOptionIndex,
	)
	if err == nil {
		s.emit(ctx, "response.updated", session.ID, map[string]any{"ordinal": ordinal})
	}
	return out, err
}

func (s *Service) Aggregate(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (realtime.Aggregate, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Aggregate{}, err
	}
	if err = s.canView(ctx, actor, session); err != nil {
		return realtime.Aggregate{}, err
	}
	return s.repo.Aggregate(ctx, session.ID)
}

func (s *Service) SetAttendance(
	ctx context.Context,
	actor identity.User,
	sessionID, studentID string,
	status realtime.AttendanceStatus,
) (realtime.Participant, error) {
	if !realtime.ValidAttendanceStatus(status) || strings.TrimSpace(studentID) == "" {
		return realtime.Participant{}, ErrInvalidInput
	}
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.Participant{}, err
	}
	if err = s.canControl(ctx, actor, session); err != nil {
		return realtime.Participant{}, err
	}
	out, err := s.repo.SetAttendance(ctx, session.ID, strings.TrimSpace(studentID), actor.ID, status)
	if err == nil {
		s.emit(ctx, "attendance.updated", session.ID, map[string]any{"studentId": studentID, "status": status})
	}
	return out, err
}

func (s *Service) End(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (realtime.ReportSnapshot, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	if !actor.HasRole(identity.RoleAdmin) {
		if !actor.HasRole(identity.RoleTeacher) || actor.ID != session.TeacherID {
			return realtime.ReportSnapshot{}, ErrForbidden
		}
	}
	if s.org == nil {
		return realtime.ReportSnapshot{}, ErrUnavailable
	}
	roster, err := s.org.SmartClassroomRoster(ctx, session.SchoolID, session.ClassID)
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	report, err := s.repo.FinalizeSession(ctx, session.ID, actor.ID, roster)
	if err == nil {
		s.emit(ctx, "session.ended", session.ID, map[string]any{"status": realtime.SessionEnded})
	}
	return report, err
}

func (s *Service) Report(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (realtime.ReportSnapshot, error) {
	session, err := s.repo.GetSession(ctx, strings.TrimSpace(sessionID))
	if err != nil {
		return realtime.ReportSnapshot{}, err
	}
	if err = s.canView(ctx, actor, session); err != nil {
		return realtime.ReportSnapshot{}, err
	}
	return s.repo.GetReport(ctx, session.ID)
}

func (s *Service) StreamSnapshot(
	ctx context.Context,
	actor identity.User,
	sessionID string,
) (any, error) {
	if actor.HasRole(identity.RoleStudent) {
		return s.StudentState(ctx, actor, sessionID)
	}
	return s.Aggregate(ctx, actor, sessionID)
}

func (s *Service) hashPIN(pin string) string {
	mac := hmac.New(sha256.New, s.pinSecret)
	_, _ = mac.Write([]byte(pin))
	return hex.EncodeToString(mac.Sum(nil))
}

func generatePIN() (string, error) {
	value, err := rand.Int(rand.Reader, big.NewInt(900000))
	if err != nil {
		return "", err
	}
	return leftPadSix(int(value.Int64()) + 100000), nil
}

func leftPadSix(value int) string {
	raw := itoa(value)
	for len(raw) < 6 {
		raw = "0" + raw
	}
	return raw
}

func itoa(value int) string {
	if value == 0 {
		return "0"
	}
	negative := value < 0
	if negative {
		value = -value
	}
	buffer := [32]byte{}
	position := len(buffer)
	for value > 0 {
		position--
		buffer[position] = byte('0' + value%10)
		value /= 10
	}
	if negative {
		position--
		buffer[position] = '-'
	}
	return string(buffer[position:])
}
