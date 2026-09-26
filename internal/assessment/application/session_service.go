package application

import (
	"context"
	"crypto/rand"
	"encoding/base32"
	"strings"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

type SessionRepository interface {
	CreateSession(context.Context, string, []identity.Role, assessment.SessionWrite, string) (assessment.Session, error)
	ListSessions(context.Context, string, string, []identity.Role, int, int) (assessment.SessionPage, error)
	GetSession(context.Context, string) (assessment.Session, error)
	SetSessionStatus(context.Context, string, []identity.Role, string, assessment.SessionStatus) (assessment.Session, error)
	StartPublic(context.Context, string, string, string) (assessment.PublicAttempt, error)
	SubmitPublic(context.Context, string, assessment.PublicSubmitInput) (assessment.PublicSubmission, error)
	LiveByCode(context.Context, string, string) (assessment.LiveJoin, error)
	StartLive(context.Context, string, string, string) (assessment.Attempt, error)
}

type SessionService struct {
	repo        SessionRepository
	definitions *Service
}

func NewSessionService(repo SessionRepository, definitions *Service) *SessionService {
	return &SessionService{repo: repo, definitions: definitions}
}

func sessionCode(channel assessment.SessionChannel) (string, error) {
	size := 14
	if channel == assessment.SessionLive {
		size = 6
	}
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	code := strings.TrimRight(base32.StdEncoding.WithPadding(base32.NoPadding).EncodeToString(raw), "=")
	if channel == assessment.SessionLive && len(code) > 8 {
		code = code[:8]
	}
	return strings.ToLower(code), nil
}

func normalizeSessionWrite(w *assessment.SessionWrite) error {
	w.AssessmentID = strings.TrimSpace(w.AssessmentID)
	w.SchoolID = strings.TrimSpace(w.SchoolID)
	w.ClassID = strings.TrimSpace(w.ClassID)
	if w.AssessmentID == "" || !assessment.ValidSessionChannel(w.Channel) {
		return ErrInvalidInput
	}
	if w.OpensAt != nil && w.ClosesAt != nil && !w.ClosesAt.After(*w.OpensAt) {
		return ErrInvalidInput
	}
	if w.MaxSubmissions != nil && (*w.MaxSubmissions < 1 || *w.MaxSubmissions > 100000) {
		return ErrInvalidInput
	}
	if w.ClassID != "" && w.SchoolID == "" {
		return ErrInvalidInput
	}
	if w.Channel != assessment.SessionLive && (w.SchoolID != "" || w.ClassID != "") {
		return ErrInvalidInput
	}
	return nil
}

func (s *SessionService) Create(ctx context.Context, actor identity.User, w assessment.SessionWrite) (assessment.Session, error) {
	if !staff(actor) || s.definitions == nil {
		return assessment.Session{}, ErrForbidden
	}
	if err := normalizeSessionWrite(&w); err != nil {
		return assessment.Session{}, err
	}
	def, err := s.definitions.Get(ctx, actor, w.AssessmentID)
	if err != nil {
		return assessment.Session{}, err
	}
	if def.WorkflowStatus != assessment.WorkflowApproved || !def.IsPublished || def.PublishedVersion == nil {
		return assessment.Session{}, ErrWorkflow
	}
	code, err := sessionCode(w.Channel)
	if err != nil {
		return assessment.Session{}, err
	}
	return s.repo.CreateSession(ctx, actor.ID, actor.Roles, w, code)
}

func (s *SessionService) List(ctx context.Context, actor identity.User, assessmentID string, page, limit int) (assessment.SessionPage, error) {
	if !staff(actor) || s.definitions == nil {
		return assessment.SessionPage{}, ErrForbidden
	}
	assessmentID = strings.TrimSpace(assessmentID)
	if assessmentID == "" {
		return assessment.SessionPage{}, ErrInvalidInput
	}
	if _, err := s.definitions.Get(ctx, actor, assessmentID); err != nil {
		return assessment.SessionPage{}, err
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return assessment.SessionPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}
	return s.repo.ListSessions(ctx, assessmentID, actor.ID, actor.Roles, page, limit)
}

func (s *SessionService) Status(ctx context.Context, actor identity.User, id string, status assessment.SessionStatus) (assessment.Session, error) {
	if !staff(actor) || s.definitions == nil {
		return assessment.Session{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || !assessment.ValidSessionStatus(status) {
		return assessment.Session{}, ErrInvalidInput
	}
	row, err := s.repo.GetSession(ctx, id)
	if err != nil {
		return assessment.Session{}, err
	}
	if _, err = s.definitions.Get(ctx, actor, row.AssessmentID); err != nil {
		return assessment.Session{}, err
	}
	return s.repo.SetSessionStatus(ctx, actor.ID, actor.Roles, id, status)
}

func normalizeOpaque(v string) string {
	v = strings.TrimSpace(v)
	if len(v) < 8 || len(v) > 200 {
		return ""
	}
	return v
}

func (s *SessionService) StartPublic(ctx context.Context, code string, in assessment.PublicStartInput) (assessment.PublicAttempt, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	in.ParticipantKey = normalizeOpaque(in.ParticipantKey)
	in.StartKey = normalizeOpaque(in.StartKey)
	if code == "" || in.ParticipantKey == "" || in.StartKey == "" {
		return assessment.PublicAttempt{}, ErrInvalidInput
	}
	return s.repo.StartPublic(ctx, code, in.ParticipantKey, in.StartKey)
}

func (s *SessionService) SubmitPublic(ctx context.Context, code string, in assessment.PublicSubmitInput) (assessment.PublicSubmission, error) {
	code = strings.ToLower(strings.TrimSpace(code))
	in.ParticipantKey = normalizeOpaque(in.ParticipantKey)
	in.PublicAttemptID = strings.TrimSpace(in.PublicAttemptID)
	in.SubmissionKey = normalizeOpaque(in.SubmissionKey)
	in.ParticipantName = strings.TrimSpace(in.ParticipantName)
	in.SchoolName = strings.TrimSpace(in.SchoolName)
	in.ClassroomName = strings.TrimSpace(in.ClassroomName)
	in.Contact = strings.TrimSpace(in.Contact)
	if code == "" || in.ParticipantKey == "" || in.PublicAttemptID == "" || in.SubmissionKey == "" ||
		len(in.ParticipantName) < 2 || len(in.ParticipantName) > 160 ||
		len(in.SchoolName) > 160 || len(in.ClassroomName) > 120 || len(in.Contact) > 160 ||
		in.TimeSpentSeconds < 0 || in.TimeSpentSeconds > 86400 || len(in.Answers) > 120 {
		return assessment.PublicSubmission{}, ErrInvalidInput
	}
	seen := make(map[string]struct{}, len(in.Answers))
	for _, answer := range in.Answers {
		answer.QuestionID = strings.TrimSpace(answer.QuestionID)
		if answer.QuestionID == "" {
			return assessment.PublicSubmission{}, ErrInvalidInput
		}
		if _, ok := seen[answer.QuestionID]; ok {
			return assessment.PublicSubmission{}, ErrInvalidInput
		}
		seen[answer.QuestionID] = struct{}{}
		if answer.SelectedOptionIndex != nil && *answer.SelectedOptionIndex < 0 {
			return assessment.PublicSubmission{}, ErrInvalidInput
		}
	}
	return s.repo.SubmitPublic(ctx, code, in)
}

func (s *SessionService) Live(ctx context.Context, actor identity.User, code string) (assessment.LiveJoin, error) {
	if requireStudent(actor) != nil {
		return assessment.LiveJoin{}, ErrForbidden
	}
	code = strings.ToLower(strings.TrimSpace(code))
	if code == "" {
		return assessment.LiveJoin{}, ErrInvalidInput
	}
	return s.repo.LiveByCode(ctx, actor.ID, code)
}

func (s *SessionService) StartLive(ctx context.Context, actor identity.User, id, startKey string) (assessment.Attempt, error) {
	if requireStudent(actor) != nil {
		return assessment.Attempt{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	startKey = key(startKey)
	if id == "" || startKey == "" {
		return assessment.Attempt{}, ErrInvalidInput
	}
	return s.repo.StartLive(ctx, actor.ID, id, startKey)
}
