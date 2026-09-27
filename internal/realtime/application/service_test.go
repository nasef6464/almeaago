package application

import (
	"context"
	"errors"
	"regexp"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

type repoStub struct {
	session         realtime.Session
	createRecord    realtime.CreateRecord
	pinned          []realtime.PinnedQuestion
	participant     realtime.Participant
	responses       map[int]realtime.Response
	aggregate       realtime.Aggregate
	answerCorrect   bool
	answerSelection int
	answerCalls     int
	finalizeRoster  []string
}

func (r *repoStub) CreateSession(_ context.Context, record realtime.CreateRecord) (realtime.Session, error) {
	r.createRecord = record
	if r.session.ID == "" {
		r.session = realtime.Session{
			ID:            record.SchoolID + "-session",
			SchoolID:      record.SchoolID,
			ClassID:       record.ClassID,
			SubjectID:     record.SubjectID,
			TeacherID:     record.TeacherID,
			Status:        realtime.SessionDraft,
			PublishedMode: record.PublishedMode,
			PINExpiresAt:  record.PINExpiresAt,
			Revision:      1,
		}
	}
	return r.session, nil
}
func (r *repoStub) GetSession(context.Context, string) (realtime.Session, error) {
	return r.session, nil
}
func (r *repoStub) FindLiveByPINHash(context.Context, string) (realtime.Session, error) {
	return r.session, nil
}
func (r *repoStub) ListTeacherSessions(context.Context, string, int) ([]realtime.Session, error) {
	return []realtime.Session{r.session}, nil
}
func (r *repoStub) SessionQuestions(context.Context, string) ([]realtime.PinnedQuestion, error) {
	return r.pinned, nil
}
func (r *repoStub) QuestionByOrdinal(_ context.Context, _ string, ordinal int) (realtime.PinnedQuestion, error) {
	for _, item := range r.pinned {
		if item.Ordinal == ordinal {
			return item, nil
		}
	}
	return realtime.PinnedQuestion{}, realtime.ErrNotFound
}
func (r *repoStub) AppendBatch(context.Context, realtime.AppendBatchRecord) (realtime.Batch, error) {
	return realtime.Batch{ID: "batch-2", SessionID: r.session.ID, BatchNumber: 2}, nil
}
func (r *repoStub) StartSession(context.Context, string, string, int) (realtime.Session, error) {
	r.session.Status = realtime.SessionLive
	return r.session, nil
}
func (r *repoStub) PublishQuestion(context.Context, string, string, int) (realtime.Session, error) {
	return r.session, nil
}
func (r *repoStub) RevealQuestion(context.Context, string, string, int) (realtime.PinnedQuestion, error) {
	return r.pinned[0], nil
}
func (r *repoStub) EndBatch(context.Context, string, string, string) (realtime.Batch, error) {
	return realtime.Batch{ID: "batch-1", SessionID: r.session.ID, BatchNumber: 1}, nil
}
func (r *repoStub) JoinSession(_ context.Context, sessionID, studentID string) (realtime.Participant, error) {
	r.participant = realtime.Participant{SessionID: sessionID, StudentID: studentID, AttendanceStatus: realtime.AttendancePresent}
	return r.participant, nil
}
func (r *repoStub) Participant(context.Context, string, string) (realtime.Participant, error) {
	if r.participant.StudentID == "" {
		return realtime.Participant{}, realtime.ErrNotFound
	}
	return r.participant, nil
}
func (r *repoStub) SetAttendance(_ context.Context, sessionID, studentID, _ string, status realtime.AttendanceStatus) (realtime.Participant, error) {
	return realtime.Participant{SessionID: sessionID, StudentID: studentID, AttendanceStatus: status}, nil
}
func (r *repoStub) UpsertAnswer(_ context.Context, sessionID, studentID string, ordinal, selected int, correct bool) (realtime.Response, error) {
	r.answerCalls++
	r.answerCorrect = correct
	r.answerSelection = selected
	return realtime.Response{
		SessionID: sessionID, StudentID: studentID, QuestionOrdinal: ordinal,
		SelectedOptionIndex: selected, IsCorrect: correct,
	}, nil
}
func (r *repoStub) StudentResponses(context.Context, string, string) (map[int]realtime.Response, error) {
	if r.responses == nil {
		return map[int]realtime.Response{}, nil
	}
	return r.responses, nil
}
func (r *repoStub) Aggregate(context.Context, string) (realtime.Aggregate, error) {
	return r.aggregate, nil
}
func (r *repoStub) FinalizeSession(_ context.Context, sessionID, _ string, roster []string) (realtime.ReportSnapshot, error) {
	r.finalizeRoster = append([]string(nil), roster...)
	return realtime.ReportSnapshot{SessionID: sessionID, Snapshot: []byte(`{"status":"ended"}`)}, nil
}
func (r *repoStub) GetReport(context.Context, string) (realtime.ReportSnapshot, error) {
	return realtime.ReportSnapshot{SessionID: r.session.ID, Snapshot: []byte(`{"status":"ended"}`)}, nil
}

type orgStub struct {
	moduleEnabled bool
	scopeOK       bool
	teacherOK     bool
	studentOK     bool
	staffOK       bool
	roster        []string
}

func (o *orgStub) SmartClassroomModuleEnabled(context.Context, string) (bool, error) {
	return o.moduleEnabled, nil
}
func (o *orgStub) ValidateSmartClassroomScope(context.Context, string, string, string) (bool, error) {
	return o.scopeOK, nil
}
func (o *orgStub) CanTeacherControlSmartClassroom(context.Context, string, string, string, string) (bool, error) {
	return o.teacherOK, nil
}
func (o *orgStub) CanStudentJoinSmartClassroom(context.Context, string, string, string) (bool, error) {
	return o.studentOK, nil
}
func (o *orgStub) CanStaffViewSmartClassroom(context.Context, string, string, string) (bool, error) {
	return o.staffOK, nil
}
func (o *orgStub) SmartClassroomRoster(context.Context, string, string) ([]string, error) {
	return append([]string(nil), o.roster...), nil
}

type questionStub struct {
	rows []question.ClassroomQuestion
}

func (q *questionStub) List(context.Context, string, string, int, int) (question.ClassroomQuestionPage, error) {
	return question.ClassroomQuestionPage{Items: []question.ClassroomQuestionSummary{}, Page: 1, Limit: 30}, nil
}
func (q *questionStub) Resolve(context.Context, []string, string) ([]question.ClassroomQuestion, error) {
	return q.rows, nil
}
func (q *questionStub) ResolveOne(_ context.Context, questionID string, version int) (question.ClassroomQuestion, error) {
	for _, row := range q.rows {
		if row.ID == questionID && row.Version == version {
			return row, nil
		}
	}
	return question.ClassroomQuestion{}, errors.New("question missing")
}
func (q *questionStub) ResolveRefs(_ context.Context, refs []question.ReviewRef) ([]question.ClassroomQuestion, error) {
	out := make([]question.ClassroomQuestion, 0, len(refs))
	for _, ref := range refs {
		for _, row := range q.rows {
			if row.ID == ref.QuestionID && row.Version == ref.Version {
				out = append(out, row)
				break
			}
		}
	}
	return out, nil
}

type eventStub struct {
	events []realtime.StreamEvent
}

func (e *eventStub) Publish(_ context.Context, event realtime.StreamEvent) error {
	e.events = append(e.events, event)
	return nil
}

func teacher() identity.User {
	return identity.User{ID: "teacher-1", Roles: []identity.Role{identity.RoleTeacher}}
}
func student() identity.User {
	return identity.User{ID: "student-1", Roles: []identity.Role{identity.RoleStudent}}
}
func classroomQuestion() question.ClassroomQuestion {
	correct := 1
	return question.ClassroomQuestion{
		ID: "question-1", Version: 3, QuestionType: question.QuestionMCQ,
		TextContent: "2 + 2 = ?", CorrectOptionIndex: &correct, Explanation: "4",
		Options: []question.Option{{Index: 0, Text: "3"}, {Index: 1, Text: "4"}},
	}
}
func liveSession() realtime.Session {
	active := 0
	return realtime.Session{
		ID: "session-1", SchoolID: "school-1", ClassID: "class-1", SubjectID: "subject-1",
		TeacherID: "teacher-1", Status: realtime.SessionLive, PublishedMode: realtime.PublishedSingle,
		ActiveBatchID: "batch-1", ActiveQuestionOrdinal: &active,
	}
}

func TestCreatePinsCanonicalQuestionsAndHashesSixDigitPIN(t *testing.T) {
	repo := &repoStub{}
	org := &orgStub{moduleEnabled: true, scopeOK: true, teacherOK: true}
	questions := &questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}}
	service := NewService(repo, org, questions, &eventStub{}, "test-secret")
	fixedNow := time.Date(2026, 9, 27, 8, 0, 0, 0, time.UTC)
	service.now = func() time.Time { return fixedNow }

	out, err := service.Create(context.Background(), teacher(), CreateInput{
		SchoolID: "school-1", ClassID: "class-1", SubjectID: "subject-1",
		QuestionIDs: []string{"question-1"}, PublishedMode: realtime.PublishedSingle,
	})
	if err != nil {
		t.Fatal(err)
	}
	if !regexp.MustCompile(`^[0-9]{6}$`).MatchString(out.PIN) {
		t.Fatalf("unexpected PIN %q", out.PIN)
	}
	if repo.createRecord.PINHash == out.PIN || !regexp.MustCompile(`^[0-9a-f]{64}$`).MatchString(repo.createRecord.PINHash) {
		t.Fatalf("PIN was not stored as a keyed hash: %q", repo.createRecord.PINHash)
	}
	if !repo.createRecord.PINExpiresAt.Equal(fixedNow.Add(30 * time.Minute)) {
		t.Fatalf("unexpected PIN expiry %s", repo.createRecord.PINExpiresAt)
	}
	if len(repo.createRecord.Questions) != 1 ||
		repo.createRecord.Questions[0].ID != "question-1" ||
		repo.createRecord.Questions[0].Version != 3 {
		t.Fatalf("question version was not pinned: %#v", repo.createRecord.Questions)
	}
}

func TestCreateFailsClosedWithoutSmartClassroomModule(t *testing.T) {
	service := NewService(
		&repoStub{},
		&orgStub{moduleEnabled: false, scopeOK: true, teacherOK: true},
		&questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}},
		nil,
		"test-secret",
	)
	_, err := service.Create(context.Background(), teacher(), CreateInput{
		SchoolID: "school-1", ClassID: "class-1", SubjectID: "subject-1",
		QuestionIDs: []string{"question-1"},
	})
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected contract denial, got %v", err)
	}
}

func TestStudentJoinRequiresCanonicalClassMembership(t *testing.T) {
	repo := &repoStub{session: liveSession()}
	service := NewService(
		repo,
		&orgStub{moduleEnabled: true, studentOK: false},
		&questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}},
		nil,
		"test-secret",
	)
	_, _, err := service.Join(context.Background(), student(), "session-1")
	if !errors.Is(err, ErrForbidden) {
		t.Fatalf("expected roster denial, got %v", err)
	}
	if repo.participant.StudentID != "" {
		t.Fatal("participant was persisted despite roster denial")
	}
}

func TestStudentStateHidesAnswerUntilReveal(t *testing.T) {
	published := time.Date(2026, 9, 27, 8, 1, 0, 0, time.UTC)
	repo := &repoStub{
		session:     liveSession(),
		participant: realtime.Participant{SessionID: "session-1", StudentID: "student-1"},
		pinned: []realtime.PinnedQuestion{{
			Ordinal: 0, BatchID: "batch-1", QuestionID: "question-1", QuestionVersion: 3,
			PublishedAt: &published,
		}},
		responses: map[int]realtime.Response{0: {
			SessionID: "session-1", StudentID: "student-1", QuestionOrdinal: 0, SelectedOptionIndex: 0,
		}},
	}
	service := NewService(
		repo,
		&orgStub{moduleEnabled: true},
		&questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}},
		nil,
		"test-secret",
	)

	before, err := service.StudentState(context.Background(), student(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(before.Questions) != 1 {
		t.Fatalf("expected one published question, got %#v", before.Questions)
	}
	if before.Questions[0].CorrectOptionIndex != nil || before.Questions[0].Explanation != "" {
		t.Fatalf("answer key leaked before reveal: %#v", before.Questions[0])
	}
	if before.Questions[0].SelectedOptionIndex == nil || *before.Questions[0].SelectedOptionIndex != 0 {
		t.Fatalf("student answer was not resumed: %#v", before.Questions[0])
	}

	revealed := published.Add(time.Minute)
	repo.pinned[0].RevealedAt = &revealed
	after, err := service.StudentState(context.Background(), student(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if after.Questions[0].CorrectOptionIndex == nil || *after.Questions[0].CorrectOptionIndex != 1 {
		t.Fatalf("answer key missing after reveal: %#v", after.Questions[0])
	}
	if after.Questions[0].Explanation != "4" {
		t.Fatalf("explanation missing after reveal: %#v", after.Questions[0])
	}
}

func TestAnswerUsesPinnedServerOwnedCorrectKey(t *testing.T) {
	repo := &repoStub{
		session:     liveSession(),
		participant: realtime.Participant{SessionID: "session-1", StudentID: "student-1"},
		pinned: []realtime.PinnedQuestion{{
			Ordinal: 0, BatchID: "batch-1", QuestionID: "question-1", QuestionVersion: 3,
		}},
	}
	service := NewService(
		repo,
		&orgStub{moduleEnabled: true},
		&questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}},
		nil,
		"test-secret",
	)
	out, err := service.Answer(context.Background(), student(), "session-1", 0, 1)
	if err != nil {
		t.Fatal(err)
	}
	if repo.answerCalls != 1 || !repo.answerCorrect || repo.answerSelection != 1 || !out.IsCorrect {
		t.Fatalf("server scoring mismatch: %#v correct=%v selection=%d", out, repo.answerCorrect, repo.answerSelection)
	}
	_, err = service.Answer(context.Background(), student(), "session-1", 0, 2)
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid option denial, got %v", err)
	}
}

func TestPresentationHidesKeyUntilRevealAndKeepsAggregate(t *testing.T) {
	published := time.Date(2026, 9, 27, 8, 1, 0, 0, time.UTC)
	repo := &repoStub{
		session: liveSession(),
		pinned: []realtime.PinnedQuestion{{
			Ordinal: 0, BatchID: "batch-1", QuestionID: "question-1", QuestionVersion: 3,
			PublishedAt: &published,
		}},
		aggregate: realtime.Aggregate{SessionID: "session-1", JoinedCount: 7},
	}
	service := NewService(
		repo,
		&orgStub{moduleEnabled: true, teacherOK: true},
		&questionStub{rows: []question.ClassroomQuestion{classroomQuestion()}},
		nil,
		"test-secret",
	)
	out, err := service.Presentation(context.Background(), teacher(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(out.Questions) != 1 || out.Questions[0].CorrectOptionIndex != nil || out.Aggregate.JoinedCount != 7 {
		t.Fatalf("unsafe or incomplete projector state: %#v", out)
	}
}

func TestEndUsesCanonicalOrganizationsRoster(t *testing.T) {
	repo := &repoStub{session: liveSession()}
	service := NewService(
		repo,
		&orgStub{
			moduleEnabled: true, teacherOK: true,
			roster: []string{"student-1", "student-2"},
		},
		&questionStub{},
		nil,
		"test-secret",
	)
	_, err := service.End(context.Background(), teacher(), "session-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.finalizeRoster) != 2 || repo.finalizeRoster[0] != "student-1" {
		t.Fatalf("canonical roster was not used: %#v", repo.finalizeRoster)
	}
}
