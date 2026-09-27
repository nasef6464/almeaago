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
	realtimeapp "github.com/nasef6464/almeaago/internal/realtime/application"
	realtime "github.com/nasef6464/almeaago/internal/realtime/domain"
	redisbroker "github.com/nasef6464/almeaago/internal/realtime/infrastructure/redis"
)

type Authenticator interface {
	Authenticate(context.Context, string) (identityapp.Authenticated, error)
	VerifyCSRF(identityapp.Authenticated, string) error
}

type Handler struct {
	service   *realtimeapp.Service
	auth      Authenticator
	broker    *redisbroker.Broker
	webOrigin string
}

func New(
	service *realtimeapp.Service,
	auth Authenticator,
	broker *redisbroker.Broker,
	webOrigin string,
) http.Handler {
	h := &Handler{
		service: service,
		auth: auth,
		broker: broker,
		webOrigin: strings.TrimSpace(webOrigin),
	}
	r := chi.NewRouter()
	r.Get("/teacher/sessions", h.teacherSessions)
	r.Get("/questions", h.questions)
	r.Post("/sessions", h.createSession)
	r.Post("/sessions/{sessionId}/start", h.startSession)
	r.Post("/sessions/{sessionId}/batches", h.appendBatch)
	r.Post("/sessions/{sessionId}/publish/{ordinal}", h.publishQuestion)
	r.Post("/sessions/{sessionId}/reveal/{ordinal}", h.revealQuestion)
	r.Post("/sessions/{sessionId}/batches/{batchId}/end", h.endBatch)
	r.Post("/join-by-pin", h.joinByPIN)
	r.Post("/sessions/{sessionId}/join", h.joinSession)
	r.Get("/sessions/{sessionId}/current", h.studentCurrent)
	r.Put("/sessions/{sessionId}/answers/{ordinal}", h.answer)
	r.Get("/sessions/{sessionId}/aggregate", h.aggregate)
	r.Get("/sessions/{sessionId}/presentation", h.presentation)
	r.Patch("/sessions/{sessionId}/participants/{studentId}/attendance", h.attendance)
	r.Post("/sessions/{sessionId}/end", h.endSession)
	r.Get("/sessions/{sessionId}/report", h.report)
	r.Get("/sessions/{sessionId}/stream", h.stream)
	return r
}

func (h *Handler) authenticate(
	w http.ResponseWriter,
	r *http.Request,
	csrf bool,
) (identityapp.Authenticated, bool) {
	if h.auth == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{"message":"Authentication service unavailable"})
		return identityapp.Authenticated{}, false
	}
	authenticated, err := h.auth.Authenticate(r.Context(), identitysession.Token(r))
	if err != nil {
		writeIdentityError(w, err)
		return identityapp.Authenticated{}, false
	}
	if csrf && h.auth.VerifyCSRF(authenticated, r.Header.Get("X-CSRF-Token")) != nil {
		writeJSON(w, http.StatusForbidden, map[string]string{"message":"Invalid CSRF token"})
		return identityapp.Authenticated{}, false
	}
	return authenticated, true
}

func (h *Handler) teacherSessions(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w,r,false)
	if !ok { return }
	rows, err := h.service.TeacherSessions(r.Context(), auth.User)
	if err != nil { writeError(w,err); return }
	items := make([]map[string]any,0,len(rows))
	for _, row := range rows { items=append(items,presentSession(row)) }
	writeJSON(w,http.StatusOK,map[string]any{"sessions":items})
}

func (h *Handler) questions(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w,r,false)
	if !ok { return }
	page, err := positiveInt(r.URL.Query().Get("page"),1)
	if err != nil { writeError(w,err); return }
	limit, err := positiveInt(r.URL.Query().Get("limit"),30)
	if err != nil || limit > 50 { writeError(w,realtimeapp.ErrInvalidInput); return }
	out, err := h.service.Questions(
		r.Context(),auth.User,
		r.URL.Query().Get("schoolId"),
		r.URL.Query().Get("classId"),
		r.URL.Query().Get("subjectId"),
		r.URL.Query().Get("search"),
		page,limit,
	)
	if err != nil { writeError(w,err); return }
	items := make([]map[string]any,0,len(out.Items))
	for _, item := range out.Items {
		items=append(items,map[string]any{
			"id":item.ID,"version":item.Version,"questionType":item.QuestionType,
			"text":item.TextContent,"difficulty":item.Difficulty,
		})
	}
	writeJSON(w,http.StatusOK,map[string]any{
		"items":items,"page":out.Page,"limit":out.Limit,"hasMore":out.HasMore,
	})
}

func (h *Handler) createSession(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w,r,true)
	if !ok { return }
	var input struct{
		SchoolID string `json:"schoolId"`
		ClassID string `json:"classId"`
		SubjectID string `json:"subjectId"`
		QuestionIDs []string `json:"questionIds"`
		Day string `json:"day"`
		Period *int `json:"period"`
		PublishedMode realtime.PublishedMode `json:"publishedMode"`
	}
	if !decodeJSON(w,r,&input) { return }
	out,err:=h.service.Create(r.Context(),auth.User,realtimeapp.CreateInput{
		SchoolID:input.SchoolID,ClassID:input.ClassID,SubjectID:input.SubjectID,
		QuestionIDs:input.QuestionIDs,Day:input.Day,Period:input.Period,PublishedMode:input.PublishedMode,
	})
	if err!=nil { writeError(w,err); return }
	writeJSON(w,http.StatusCreated,map[string]any{"session":presentSession(out.Session),"pin":out.PIN})
}

func (h *Handler) startSession(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	var input struct{ExpectedRevision int `json:"expectedRevision"`}
	if !decodeJSON(w,r,&input){return}
	out,err:=h.service.Start(r.Context(),auth.User,chi.URLParam(r,"sessionId"),input.ExpectedRevision)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"session":presentSession(out)})
}

func (h *Handler) appendBatch(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	var input struct{Label string `json:"label"`;QuestionIDs []string `json:"questionIds"`}
	if !decodeJSON(w,r,&input){return}
	out,err:=h.service.AppendBatch(r.Context(),auth.User,chi.URLParam(r,"sessionId"),realtimeapp.AppendBatchInput{
		Label:input.Label,QuestionIDs:input.QuestionIDs,
	})
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusCreated,map[string]any{"batch":presentBatch(out)})
}

func (h *Handler) publishQuestion(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	ordinal,err:=nonNegativeInt(chi.URLParam(r,"ordinal"));if err!=nil{writeError(w,err);return}
	out,err:=h.service.Publish(r.Context(),auth.User,chi.URLParam(r,"sessionId"),ordinal)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"session":presentSession(out)})
}

func (h *Handler) revealQuestion(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	ordinal,err:=nonNegativeInt(chi.URLParam(r,"ordinal"));if err!=nil{writeError(w,err);return}
	out,err:=h.service.Reveal(r.Context(),auth.User,chi.URLParam(r,"sessionId"),ordinal)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"question":presentPinned(out)})
}

func (h *Handler) endBatch(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	out,err:=h.service.EndBatch(r.Context(),auth.User,chi.URLParam(r,"sessionId"),chi.URLParam(r,"batchId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"batch":presentBatch(out)})
}

func (h *Handler) joinByPIN(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	var input struct{PIN string `json:"pin"`}
	if !decodeJSON(w,r,&input){return}
	participant,session,err:=h.service.JoinByPIN(r.Context(),auth.User,input.PIN)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{
		"joined":true,"session":presentSession(session),"participant":presentParticipant(participant),
	})
}

func (h *Handler) joinSession(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	participant,session,err:=h.service.Join(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{
		"joined":true,"session":presentSession(session),"participant":presentParticipant(participant),
	})
}

func (h *Handler) studentCurrent(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,false);if !ok{return}
	out,err:=h.service.StudentState(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"state":presentStudentState(out)})
}

func (h *Handler) answer(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	ordinal,err:=nonNegativeInt(chi.URLParam(r,"ordinal"));if err!=nil{writeError(w,err);return}
	var input struct{SelectedOptionIndex int `json:"selectedOptionIndex"`}
	if !decodeJSON(w,r,&input){return}
	out,err:=h.service.Answer(r.Context(),auth.User,chi.URLParam(r,"sessionId"),ordinal,input.SelectedOptionIndex)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"response":map[string]any{
		"questionOrdinal":out.QuestionOrdinal,"selectedOptionIndex":out.SelectedOptionIndex,
		"submittedAt":out.SubmittedAt,"updatedAt":out.UpdatedAt,
	}})
}

func (h *Handler) aggregate(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,false);if !ok{return}
	out,err:=h.service.Aggregate(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"aggregate":presentAggregate(out)})
}

func (h *Handler) presentation(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,false);if !ok{return}
	out,err:=h.service.Presentation(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"presentation":presentPresentation(out)})
}

func (h *Handler) attendance(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	var input struct{Status realtime.AttendanceStatus `json:"status"`}
	if !decodeJSON(w,r,&input){return}
	out,err:=h.service.SetAttendance(
		r.Context(),auth.User,chi.URLParam(r,"sessionId"),chi.URLParam(r,"studentId"),input.Status,
	)
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"participant":presentParticipant(out)})
}

func (h *Handler) endSession(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,true);if !ok{return}
	out,err:=h.service.End(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"report":json.RawMessage(out.Snapshot),"finalizedAt":out.FinalizedAt})
}

func (h *Handler) report(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,false);if !ok{return}
	out,err:=h.service.Report(r.Context(),auth.User,chi.URLParam(r,"sessionId"))
	if err!=nil{writeError(w,err);return}
	writeJSON(w,http.StatusOK,map[string]any{"report":json.RawMessage(out.Snapshot),"finalizedAt":out.FinalizedAt})
}

func (h *Handler) stream(w http.ResponseWriter,r *http.Request){
	auth,ok:=h.authenticate(w,r,false);if !ok{return}
	sessionID:=strings.TrimSpace(chi.URLParam(r,"sessionId"))
	snapshot,err:=h.service.StreamSnapshot(r.Context(),auth.User,sessionID)
	if err!=nil{writeError(w,err);return}
	if h.broker==nil{
		writeJSON(w,http.StatusServiceUnavailable,map[string]string{"message":"Realtime fanout unavailable"});return
	}
	origins:=originPatterns(h.webOrigin)
	options:=&websocket.AcceptOptions{}
	if len(origins)>0{options.OriginPatterns=origins}
	conn,err:=websocket.Accept(w,r,options)
	if err!=nil{return}
	defer conn.Close(websocket.StatusNormalClosure,"")
	ctx:=conn.CloseRead(r.Context())
	role:=streamRole(auth.User)
	if err=h.broker.TouchPresence(ctx,sessionID,auth.User.ID,role);err!=nil{
		_ = conn.Close(websocket.StatusTryAgainLater,"presence unavailable");return
	}
	defer h.broker.DropPresence(context.Background(),sessionID,auth.User.ID)
	_ = h.broker.Publish(ctx,realtime.StreamEvent{
		Type:"presence.changed",SessionID:sessionID,At:time.Now().UTC(),Data:map[string]any{"role":role,"delta":1},
	})
	defer h.broker.Publish(context.Background(),realtime.StreamEvent{
		Type:"presence.changed",SessionID:sessionID,At:time.Now().UTC(),Data:map[string]any{"role":role,"delta":-1},
	})
	subscription,err:=h.broker.Subscribe(ctx,sessionID)
	if err!=nil{
		_ = conn.Close(websocket.StatusTryAgainLater,"fanout unavailable");return
	}
	defer subscription.Close()
	if err=writeSocketJSON(ctx,conn,map[string]any{
		"type":"snapshot","sessionId":sessionID,"at":time.Now().UTC(),"data":presentSocketSnapshot(snapshot),
	});err!=nil{return}
	ticker:=time.NewTicker(redisbroker.PresenceRefreshInterval())
	defer ticker.Stop()
	for{
		select{
		case <-ctx.Done():
			return
		case <-ticker.C:
			if err=h.broker.TouchPresence(ctx,sessionID,auth.User.ID,role);err!=nil{return}
		case raw,open:=<-subscription.Events:
			if !open{return}
			if err=conn.Write(ctx,websocket.MessageText,raw);err!=nil{return}
		}
	}
}

func presentSession(s realtime.Session) map[string]any{
	return map[string]any{
		"id":s.ID,"schoolId":s.SchoolID,"classId":s.ClassID,"subjectId":s.SubjectID,
		"teacherId":s.TeacherID,"status":s.Status,"day":s.Day,"period":s.Period,
		"publishedMode":s.PublishedMode,"activeBatchId":s.ActiveBatchID,
		"activeQuestionOrdinal":s.ActiveQuestionOrdinal,"pinExpiresAt":s.PINExpiresAt,
		"revision":s.Revision,"startedAt":s.StartedAt,"endedAt":s.EndedAt,
		"createdAt":s.CreatedAt,"updatedAt":s.UpdatedAt,
	}
}
func presentPinned(q realtime.PinnedQuestion) map[string]any{
	return map[string]any{"ordinal":q.Ordinal,"batchId":q.BatchID,"questionId":q.QuestionID,
		"questionVersion":q.QuestionVersion,"publishedAt":q.PublishedAt,"revealedAt":q.RevealedAt}
}
func presentBatch(b realtime.Batch) map[string]any{
	qs:=make([]map[string]any,0,len(b.Questions));for _,q:=range b.Questions{qs=append(qs,presentPinned(q))}
	return map[string]any{"id":b.ID,"sessionId":b.SessionID,"batchNumber":b.BatchNumber,"label":b.Label,
		"startedAt":b.StartedAt,"endedAt":b.EndedAt,"createdAt":b.CreatedAt,"questions":qs}
}
func presentParticipant(p realtime.Participant) map[string]any{
	return map[string]any{"sessionId":p.SessionID,"studentId":p.StudentID,"joinedAt":p.JoinedAt,
		"attendanceStatus":p.AttendanceStatus,"attendanceOverriddenBy":p.AttendanceOverriddenBy,
		"attendanceOverriddenAt":p.AttendanceOverriddenAt}
}
func presentStudentQuestion(q realtime.StudentQuestion) map[string]any{
	options:=make([]map[string]any,0,len(q.Options));for _,o:=range q.Options{options=append(options,map[string]any{"index":o.Index,"text":o.Text,"assetId":o.AssetID})}
	return map[string]any{"ordinal":q.Ordinal,"questionId":q.QuestionID,"questionVersion":q.QuestionVersion,
		"text":q.Text,"imageAssetId":q.ImageAssetID,"imageAlt":q.ImageAlt,
		"optionsEmbeddedInImage":q.OptionsEmbeddedInImage,"options":options,"difficulty":q.Difficulty,
		"revealed":q.Revealed,"correctOptionIndex":q.CorrectOptionIndex,"explanation":q.Explanation,
		"selectedOptionIndex":q.SelectedOptionIndex}
}
func presentStudentState(s realtime.StudentState) map[string]any{
	qs:=make([]map[string]any,0,len(s.Questions));for _,q:=range s.Questions{qs=append(qs,presentStudentQuestion(q))}
	return map[string]any{"sessionId":s.SessionID,"status":s.Status,"publishedMode":s.PublishedMode,
		"activeBatchId":s.ActiveBatchID,"activeQuestionOrdinal":s.ActiveQuestionOrdinal,"questions":qs}
}
func presentAggregate(a realtime.Aggregate) map[string]any{
	qs:=make([]map[string]any,0,len(a.Questions));for _,q:=range a.Questions{qs=append(qs,map[string]any{
		"ordinal":q.Ordinal,"questionId":q.QuestionID,"responseCount":q.ResponseCount,
		"correctCount":q.CorrectCount,"distribution":q.Distribution,
	})}
	return map[string]any{"sessionId":a.SessionID,"status":a.Status,"activeBatchId":a.ActiveBatchID,
		"activeQuestionOrdinal":a.ActiveQuestionOrdinal,"joinedCount":a.JoinedCount,"questions":qs}
}
func presentPresentation(p realtime.Presentation) map[string]any{
	qs:=make([]map[string]any,0,len(p.Questions));for _,q:=range p.Questions{qs=append(qs,presentStudentQuestion(q))}
	return map[string]any{"sessionId":p.SessionID,"status":p.Status,"publishedMode":p.PublishedMode,
		"activeBatchId":p.ActiveBatchID,"activeQuestionOrdinal":p.ActiveQuestionOrdinal,
		"questions":qs,"aggregate":presentAggregate(p.Aggregate)}
}
func presentSocketSnapshot(value any) any{
	switch typed:=value.(type){
	case realtime.StudentState:return presentStudentState(typed)
	case realtime.Aggregate:return presentAggregate(typed)
	case realtime.Presentation:return presentPresentation(typed)
	default:return typed
	}
}

func streamRole(user identity.User) string{
	for _,role:=range []identity.Role{identity.RoleStudent,identity.RoleTeacher,identity.RoleSupervisor,identity.RoleSchoolAdmin,identity.RoleAdmin}{
		if user.HasRole(role){return string(role)}
	}
	return "authenticated"
}
func originPatterns(raw string)[]string{
	parsed,err:=url.Parse(strings.TrimSpace(raw));if err!=nil||parsed.Host==""{return nil}
	return []string{parsed.Host}
}
func writeSocketJSON(ctx context.Context,conn *websocket.Conn,value any)error{
	raw,err:=json.Marshal(value);if err!=nil{return err}
	return conn.Write(ctx,websocket.MessageText,raw)
}
func positiveInt(raw string,fallback int)(int,error){
	if strings.TrimSpace(raw)==""{return fallback,nil}
	value,err:=strconv.Atoi(raw);if err!=nil||value<1{return 0,realtimeapp.ErrInvalidInput};return value,nil
}
func nonNegativeInt(raw string)(int,error){
	value,err:=strconv.Atoi(strings.TrimSpace(raw));if err!=nil||value<0{return 0,realtimeapp.ErrInvalidInput};return value,nil
}
func decodeJSON(w http.ResponseWriter,r *http.Request,dst any)bool{
	r.Body=http.MaxBytesReader(w,r.Body,128<<10)
	decoder:=json.NewDecoder(r.Body);decoder.DisallowUnknownFields()
	if err:=decoder.Decode(dst);err!=nil{writeJSON(w,http.StatusBadRequest,map[string]string{"message":"Invalid request"});return false}
	return true
}
func writeIdentityError(w http.ResponseWriter,err error){
	switch{
	case errors.Is(err,identityapp.ErrUnauthenticated):writeJSON(w,http.StatusUnauthorized,map[string]string{"message":"Authentication required"})
	case errors.Is(err,identityapp.ErrCSRF):writeJSON(w,http.StatusForbidden,map[string]string{"message":"Invalid CSRF token"})
	case errors.Is(err,identityapp.ErrAccountDisabled):writeJSON(w,http.StatusForbidden,map[string]string{"message":"Account disabled"})
	default:writeJSON(w,http.StatusInternalServerError,map[string]string{"message":"Internal server error"})
	}
}
func writeError(w http.ResponseWriter,err error){
	switch{
	case errors.Is(err,realtimeapp.ErrInvalidInput):writeJSON(w,http.StatusBadRequest,map[string]string{"message":"Invalid classroom request"})
	case errors.Is(err,realtimeapp.ErrForbidden):writeJSON(w,http.StatusForbidden,map[string]string{"message":"Classroom access denied"})
	case errors.Is(err,realtimeapp.ErrNotFound):writeJSON(w,http.StatusNotFound,map[string]string{"message":"Classroom resource not found"})
	case errors.Is(err,realtimeapp.ErrConflict):writeJSON(w,http.StatusConflict,map[string]string{"message":"Classroom state conflict"})
	case errors.Is(err,realtimeapp.ErrUnavailable):writeJSON(w,http.StatusServiceUnavailable,map[string]string{"message":"Classroom service unavailable"})
	default:writeJSON(w,http.StatusInternalServerError,map[string]string{"message":"Internal server error"})
	}
}
func writeJSON(w http.ResponseWriter,status int,body any){
	w.Header().Set("Content-Type","application/json; charset=utf-8");w.WriteHeader(status);_ = json.NewEncoder(w).Encode(body)
}
