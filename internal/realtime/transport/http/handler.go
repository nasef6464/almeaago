package realtimehttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/coder/websocket"
	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	realtimeapp "github.com/nasef6464/almeaago/internal/realtime/application"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service        *realtimeapp.Service
	auth           Authenticator
	stream         realtime.StreamCoordinator
	originPatterns []string
}

func New(
	service *realtimeapp.Service,
	auth Authenticator,
	stream realtime.StreamCoordinator,
	webOrigin string,
) http.Handler {
	h := &Handler{
		service:        service,
		auth:           auth,
		stream:         stream,
		originPatterns: originPatterns(webOrigin),
	}
	r := chi.NewRouter()
	r.Get("/questions", h.questions)
	r.Get("/sessions", h.teacherSessions)
	r.Get("/teacher/sessions", h.teacherSessions)
	r.Post("/sessions", h.createSession)
	r.Post("/join", h.joinByPIN)
	r.Post("/join-by-pin", h.joinByPIN)
	r.Get("/sessions/{sessionId}", h.staffState)
	r.Post("/sessions/{sessionId}/start", h.startSession)
	r.Post("/sessions/{sessionId}/batches", h.appendBatch)
	r.Post("/sessions/{sessionId}/questions/{ordinal}/publish", h.publishQuestion)
	r.Post("/sessions/{sessionId}/publish/{ordinal}", h.publishQuestion)
	r.Post("/sessions/{sessionId}/questions/{ordinal}/reveal", h.revealQuestion)
	r.Post("/sessions/{sessionId}/reveal/{ordinal}", h.revealQuestion)
	r.Post("/sessions/{sessionId}/batches/{batchId}/end", h.endBatch)
	r.Post("/sessions/{sessionId}/join", h.joinSession)
	r.Get("/sessions/{sessionId}/state", h.studentState)
	r.Get("/sessions/{sessionId}/current", h.studentState)
	r.Put("/sessions/{sessionId}/answers/{ordinal}", h.answer)
	r.Get("/sessions/{sessionId}/aggregate", h.aggregate)
	r.Get("/sessions/{sessionId}/presentation", h.presentation)
	r.Patch("/sessions/{sessionId}/attendance/{studentId}", h.attendance)
	r.Patch("/sessions/{sessionId}/participants/{studentId}/attendance", h.attendance)
	r.Post("/sessions/{sessionId}/end", h.endSession)
	r.Get("/sessions/{sessionId}/report", h.report)
	r.Get("/sessions/{sessionId}/stream", h.streamSession)
	return r
}

func originPatterns(raw string) []string {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Host == "" {
		return nil
	}
	return []string{parsed.Scheme + "://" + parsed.Host}
}

func (h *Handler) authenticate(
	w http.ResponseWriter,
	r *http.Request,
	requireCSRF bool,
) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeIdentityError(w, err)
		return identityapp.Authenticated{}, false
	}
	if requireCSRF && h.auth.VerifyCSRF(authenticated, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func (h *Handler) questions(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	page, err := positiveQuery(r, "page", 1, 10000)
	if err != nil {
		writeError(w, err)
		return
	}
	limit, err := positiveQuery(r, "limit", 30, 50)
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Questions(
		r.Context(), authenticated.User,
		r.URL.Query().Get("schoolId"),
		r.URL.Query().Get("classId"),
		r.URL.Query().Get("subjectId"),
		r.URL.Query().Get("search"),
		page, limit,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(out.Items))
	for _, item := range out.Items {
		items = append(items, map[string]any{
			"id": item.ID, "version": item.Version, "questionType": item.QuestionType,
			"text": item.TextContent, "difficulty": item.Difficulty,
		})
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"items": items, "page": out.Page, "limit": out.Limit, "hasMore": out.HasMore,
	})
}

func (h *Handler) teacherSessions(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	items, err := h.service.TeacherSessions(r.Context(), authenticated.User)
	if err != nil {
		writeError(w, err)
		return
	}
	out := make([]map[string]any, 0, len(items))
	for _, item := range items {
		out = append(out, presentSession(item))
	}
	writeJSON(w, http.StatusOK, map[string]any{"sessions": out})
}

type createSessionPayload struct {
	SchoolID      string
	ClassID       string
	SubjectID     string
	QuestionIDs   []string
	Day           string
	Period        *int
	PublishedMode realtime.PublishedMode
}

func (h *Handler) createSession(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload createSessionPayload
	if !decodeJSON(w, r, &payload) {
		return
	}
	out, err := h.service.Create(r.Context(), authenticated.User, realtimeapp.CreateInput{
		SchoolID: payload.SchoolID, ClassID: payload.ClassID, SubjectID: payload.SubjectID,
		QuestionIDs: payload.QuestionIDs, Day: payload.Day, Period: payload.Period,
		PublishedMode: payload.PublishedMode,
	})
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{
		"session": presentSession(out.Session),
		"pin":     out.PIN,
	})
}

func (h *Handler) staffState(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.StaffState(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, presentStaffState(out))
}

type startPayload struct {
	ExpectedRevision int
}

func (h *Handler) startSession(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload startPayload
	if !decodeOptionalJSON(w, r, &payload) {
		return
	}
	out, err := h.service.Start(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), payload.ExpectedRevision)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": presentSession(out)})
}

type appendBatchPayload struct {
	Label       string
	QuestionIDs []string
}

func (h *Handler) appendBatch(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload appendBatchPayload
	if !decodeJSON(w, r, &payload) {
		return
	}
	out, err := h.service.AppendBatch(
		r.Context(), authenticated.User, chi.URLParam(r, "sessionId"),
		realtimeapp.AppendBatchInput{Label: payload.Label, QuestionIDs: payload.QuestionIDs},
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"batch": presentBatch(out)})
}

func (h *Handler) publishQuestion(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	ordinal, err := ordinalParam(r)
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Publish(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), ordinal)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"session": presentSession(out)})
}

func (h *Handler) revealQuestion(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	ordinal, err := ordinalParam(r)
	if err != nil {
		writeError(w, err)
		return
	}
	out, err := h.service.Reveal(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), ordinal)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"question": presentPinned(out)})
}

func (h *Handler) endBatch(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	out, err := h.service.EndBatch(
		r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), chi.URLParam(r, "batchId"),
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"batch": presentBatch(out)})
}

type joinPayload struct {
	PIN string
}

func (h *Handler) joinByPIN(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload joinPayload
	if !decodeJSON(w, r, &payload) {
		return
	}
	participant, session, err := h.service.JoinByPIN(r.Context(), authenticated.User, payload.PIN)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"participant": presentParticipant(participant), "session": presentSession(session),
	})
}

func (h *Handler) joinSession(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	participant, session, err := h.service.Join(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"participant": presentParticipant(participant), "session": presentSession(session),
	})
}

func (h *Handler) studentState(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.StudentState(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"state": presentStudentState(out)})
}

type answerPayload struct {
	SelectedOptionIndex int
}

func (h *Handler) answer(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	ordinal, err := ordinalParam(r)
	if err != nil {
		writeError(w, err)
		return
	}
	var payload answerPayload
	if !decodeJSON(w, r, &payload) {
		return
	}
	out, err := h.service.Answer(
		r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), ordinal, payload.SelectedOptionIndex,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"response": map[string]any{
			"questionOrdinal": out.QuestionOrdinal,
			"selectedOptionIndex": out.SelectedOptionIndex,
			"submittedAt": out.SubmittedAt,
		},
	})
}

func (h *Handler) aggregate(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Aggregate(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"aggregate": presentAggregate(out)})
}

type attendancePayload struct {
	Status realtime.AttendanceStatus
}

func (h *Handler) presentation(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Presentation(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"presentation": presentPresentation(out)})
}

func (h *Handler) attendance(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload attendancePayload
	if !decodeJSON(w, r, &payload) {
		return
	}
	out, err := h.service.SetAttendance(
		r.Context(), authenticated.User, chi.URLParam(r, "sessionId"), chi.URLParam(r, "studentId"), payload.Status,
	)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"participant": presentParticipant(out)})
}

func (h *Handler) endSession(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	out, err := h.service.End(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"report": json.RawMessage(out.Snapshot), "finalizedAt": out.FinalizedAt,
	})
}

func (h *Handler) report(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	out, err := h.service.Report(r.Context(), authenticated.User, chi.URLParam(r, "sessionId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"report": json.RawMessage(out.Snapshot), "finalizedAt": out.FinalizedAt,
	})
}

func (h *Handler) streamSession(w http.ResponseWriter, r *http.Request) {
	authenticated, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	sessionID := strings.TrimSpace(chi.URLParam(r, "sessionId"))
	snapshot, err := h.service.StreamSnapshot(r.Context(), authenticated.User, sessionID)
	if err != nil {
		writeError(w, err)
		return
	}
	if h.stream == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Realtime fanout unavailable"})
		return
	}
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{OriginPatterns: h.originPatterns})
	if err != nil {
		return
	}
	defer conn.Close(websocket.StatusNormalClosure, "")
	conn.SetReadLimit(4 << 10)

	ctx := conn.CloseRead(context.Background())
	subscription, err := h.stream.Subscribe(ctx, sessionID)
	if err != nil {
		_ = conn.Close(websocket.StatusTryAgainLater, "fanout unavailable")
		return
	}
	defer subscription.Close()

	role := actorStreamRole(authenticated.User)
	count, err := h.stream.TouchPresence(ctx, sessionID, authenticated.User.ID, role)
	if err != nil {
		_ = conn.Close(websocket.StatusTryAgainLater, "presence unavailable")
		return
	}
	_ = h.stream.Publish(ctx, realtime.StreamEvent{
		Type: "presence.count", SessionID: sessionID, At: time.Now().UTC(),
		Data: map[string]any{"count": count},
	})
	defer func() {
		count, dropErr := h.stream.RemovePresence(context.Background(), sessionID, authenticated.User.ID, role)
		if dropErr == nil {
			_ = h.stream.Publish(context.Background(), realtime.StreamEvent{
				Type: "presence.count", SessionID: sessionID, At: time.Now().UTC(),
				Data: map[string]any{"count": count},
			})
		}
	}()

	if err = writeSocketJSON(ctx, conn, realtime.StreamEvent{
		Type: "snapshot", SessionID: sessionID, At: time.Now().UTC(), Data: snapshot,
	}); err != nil {
		return
	}
	if err = writeSocketJSON(ctx, conn, realtime.StreamEvent{
		Type: "presence.count", SessionID: sessionID, At: time.Now().UTC(),
		Data: map[string]any{"count": count},
	}); err != nil {
		return
	}

	ticker := time.NewTicker(20 * time.Second)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			if _, err = h.stream.TouchPresence(ctx, sessionID, authenticated.User.ID, role); err != nil {
				return
			}
			pingCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
			err = conn.Ping(pingCtx)
			cancel()
			if err != nil {
				return
			}
		case event, open := <-subscription.Events():
			if !open {
				return
			}
			safe, send := safeStreamEvent(authenticated.User, event)
			if !send {
				continue
			}
			if err = writeSocketJSON(ctx, conn, safe); err != nil {
				return
			}
		case <-subscription.Errors():
			return
		}
	}
}

func safeStreamEvent(user identity.User, event realtime.StreamEvent) (realtime.StreamEvent, bool) {
	if !user.HasRole(identity.RoleStudent) {
		return event, true
	}
	switch event.Type {
	case "session.started", "question.published", "question.revealed", "batch.ended", "session.ended", "presence.count":
		return event, true
	default:
		return realtime.StreamEvent{}, false
	}
}

func writeSocketJSON(ctx context.Context, conn *websocket.Conn, value any) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return conn.Write(ctx, websocket.MessageText, raw)
}

func presentSession(item realtime.Session) map[string]any {
	return map[string]any{
		"id": item.ID, "schoolId": item.SchoolID, "classId": item.ClassID,
		"subjectId": item.SubjectID, "teacherId": item.TeacherID, "status": item.Status,
		"day": item.Day, "period": item.Period, "publishedMode": item.PublishedMode,
		"activeBatchId": item.ActiveBatchID, "activeQuestionOrdinal": item.ActiveQuestionOrdinal,
		"pinExpiresAt": item.PINExpiresAt, "revision": item.Revision,
		"startedAt": item.StartedAt, "endedAt": item.EndedAt,
		"createdAt": item.CreatedAt, "updatedAt": item.UpdatedAt,
	}
}

func presentBatch(item realtime.Batch) map[string]any {
	questions := make([]map[string]any, 0, len(item.Questions))
	for _, item := range item.Questions {
		questions = append(questions, presentPinned(item))
	}
	return map[string]any{
		"id": item.ID, "sessionId": item.SessionID, "batchNumber": item.BatchNumber,
		"label": item.Label, "startedAt": item.StartedAt, "endedAt": item.EndedAt,
		"createdAt": item.CreatedAt, "questions": questions,
	}
}

func presentPinned(item realtime.PinnedQuestion) map[string]any {
	return map[string]any{
		"ordinal": item.Ordinal, "batchId": item.BatchID, "questionId": item.QuestionID,
		"questionVersion": item.QuestionVersion, "publishedAt": item.PublishedAt, "revealedAt": item.RevealedAt,
	}
}

func presentParticipant(item realtime.Participant) map[string]any {
	return map[string]any{
		"sessionId": item.SessionID, "studentId": item.StudentID, "joinedAt": item.JoinedAt,
		"attendanceStatus": item.AttendanceStatus,
		"attendanceOverriddenBy": item.AttendanceOverriddenBy,
		"attendanceOverriddenAt": item.AttendanceOverriddenAt,
	}
}

func presentAggregate(item realtime.Aggregate) map[string]any {
	questions := make([]map[string]any, 0, len(item.Questions))
	for _, item := range item.Questions {
		questions = append(questions, map[string]any{
			"ordinal": item.Ordinal, "questionId": item.QuestionID,
			"responseCount": item.ResponseCount, "correctCount": item.CorrectCount,
			"distribution": item.Distribution,
		})
	}
	return map[string]any{
		"sessionId": item.SessionID, "status": item.Status, "activeBatchId": item.ActiveBatchID,
		"activeQuestionOrdinal": item.ActiveQuestionOrdinal, "joinedCount": item.JoinedCount,
		"questions": questions,
	}
}

func presentStudentState(item realtime.StudentState) map[string]any {
	questions := make([]map[string]any, 0, len(item.Questions))
	for _, item := range item.Questions {
		options := make([]map[string]any, 0, len(item.Options))
		for _, option := range item.Options {
			options = append(options, map[string]any{
				"index": option.Index, "text": option.Text, "assetId": option.AssetID,
			})
		}
		row := map[string]any{
			"ordinal": item.Ordinal, "questionId": item.QuestionID,
			"questionVersion": item.QuestionVersion, "text": item.Text,
			"imageAssetId": item.ImageAssetID, "imageAlt": item.ImageAlt,
			"optionsEmbeddedInImage": item.OptionsEmbeddedInImage,
			"options": options, "difficulty": item.Difficulty, "revealed": item.Revealed,
			"selectedOptionIndex": item.SelectedOptionIndex,
		}
		if item.Revealed {
			row["correctOptionIndex"] = item.CorrectOptionIndex
			row["explanation"] = item.Explanation
		}
		questions = append(questions, row)
	}
	return map[string]any{
		"sessionId": item.SessionID, "status": item.Status, "publishedMode": item.PublishedMode,
		"activeBatchId": item.ActiveBatchID, "activeQuestionOrdinal": item.ActiveQuestionOrdinal,
		"questions": questions,
	}
}

func presentPresentation(item realtime.Presentation) map[string]any {
	questions := make([]map[string]any, 0, len(item.Questions))
	for _, row := range item.Questions {
		options := make([]map[string]any, 0, len(row.Options))
		for _, option := range row.Options {
			options = append(options, map[string]any{
				"index": option.Index, "text": option.Text, "assetId": option.AssetID,
			})
		}
		questionRow := map[string]any{
			"ordinal": row.Ordinal, "questionId": row.QuestionID, "questionVersion": row.QuestionVersion,
			"text": row.Text, "imageAssetId": row.ImageAssetID, "imageAlt": row.ImageAlt,
			"optionsEmbeddedInImage": row.OptionsEmbeddedInImage, "options": options,
			"difficulty": row.Difficulty, "revealed": row.Revealed,
			"selectedOptionIndex": row.SelectedOptionIndex,
		}
		if row.Revealed {
			questionRow["correctOptionIndex"] = row.CorrectOptionIndex
			questionRow["explanation"] = row.Explanation
		}
		questions = append(questions, questionRow)
	}
	return map[string]any{
		"sessionId": item.SessionID,
		"status": item.Status,
		"publishedMode": item.PublishedMode,
		"activeBatchId": item.ActiveBatchID,
		"activeQuestionOrdinal": item.ActiveQuestionOrdinal,
		"questions": questions,
		"aggregate": presentAggregate(item.Aggregate),
	}
}

func presentStaffState(item realtimeapp.StaffState) map[string]any {
	pinned := make([]map[string]any, 0, len(item.Pinned))
	for _, row := range item.Pinned {
		pinned = append(pinned, presentPinned(row))
	}
	questions := make([]map[string]any, 0, len(item.Questions))
	for _, row := range item.Questions {
		questions = append(questions, presentStaffQuestion(row))
	}
	return map[string]any{
		"session": presentSession(item.Session),
		"pinned": pinned,
		"questions": questions,
		"aggregate": presentAggregate(item.Aggregate),
	}
}

func presentStaffQuestion(item question.ClassroomQuestion) map[string]any {
	options := make([]map[string]any, 0, len(item.Options))
	for _, option := range item.Options {
		options = append(options, map[string]any{
			"index": option.Index, "text": option.Text, "assetId": option.AssetID,
		})
	}
	return map[string]any{
		"id": item.ID, "version": item.Version, "type": item.QuestionType, "text": item.TextContent,
		"imageAssetId": item.ImageAssetID, "imageAlt": item.ImageAlt,
		"optionsEmbeddedInImage": item.OptionsEmbeddedInImage,
		"correctOptionIndex": item.CorrectOptionIndex, "explanation": item.Explanation,
		"difficulty": item.Difficulty, "skillIds": item.SkillIDs, "options": options,
	}
}

func ordinalParam(r *http.Request) (int, error) {
	value, err := strconv.Atoi(chi.URLParam(r, "ordinal"))
	if err != nil || value < 0 {
		return 0, realtimeapp.ErrInvalidInput
	}
	return value, nil
}

func positiveQuery(r *http.Request, key string, fallback, max int) (int, error) {
	raw := strings.TrimSpace(r.URL.Query().Get(key))
	if raw == "" {
		return fallback, nil
	}
	value, err := strconv.Atoi(raw)
	if err != nil || value < 1 || value > max {
		return 0, realtimeapp.ErrInvalidInput
	}
	return value, nil
}

func decodeJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request"})
		return false
	}
	return true
}

func decodeOptionalJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	if r.Body == nil || r.ContentLength == 0 {
		return true
	}
	return decodeJSON(w, r, dst)
}

func writeIdentityError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, identityapp.ErrUnauthenticated):
		writeJSON(w, http.StatusUnauthorized, map[string]string{"message": "Authentication required"})
	case errors.Is(err, identityapp.ErrCSRF), errors.Is(err, identityapp.ErrAccountDisabled):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeError(w http.ResponseWriter, err error) {
	switch {
	case errors.Is(err, realtimeapp.ErrInvalidInput), errors.Is(err, questionapp.ErrInvalidInput),
		errors.Is(err, questionapp.ErrClassroomQuestionUnavailable):
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid classroom request"})
	case errors.Is(err, realtimeapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "Forbidden"})
	case errors.Is(err, realtimeapp.ErrNotFound):
		writeJSON(w, http.StatusNotFound, map[string]string{"message": "Classroom session not found"})
	case errors.Is(err, realtimeapp.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "Classroom state conflict"})
	case errors.Is(err, realtimeapp.ErrUnavailable):
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message": "Realtime service unavailable"})
	default:
		writeJSON(w, http.StatusInternalServerError, map[string]string{"message": "Internal server error"})
	}
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func actorStreamRole(user identity.User) string {
	for _, role := range []identity.Role{
		identity.RoleStudent, identity.RoleTeacher, identity.RoleSupervisor,
		identity.RoleSchoolAdmin, identity.RoleAdmin,
	} {
		if user.HasRole(role) {
			return string(role)
		}
	}
	return "authenticated"
}
