package taxonomyhttp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	identityapp "github.com/nasef6464/almeaago/internal/identity/application"
	identitysession "github.com/nasef6464/almeaago/internal/identity/transport/session"
	taxonomyapp "github.com/nasef6464/almeaago/internal/taxonomy/application"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type Authenticator interface {
	Authenticate(ctx context.Context, rawToken string) (identityapp.Authenticated, error)
	VerifyCSRF(auth identityapp.Authenticated, rawToken string) error
}

type Handler struct {
	service *taxonomyapp.Service
	auth    Authenticator
}

func New(service *taxonomyapp.Service, authenticators ...Authenticator) http.Handler {
	h := &Handler{service: service}
	if len(authenticators) > 0 { h.auth = authenticators[0] }
	r := chi.NewRouter()
	r.Get("/bootstrap", h.bootstrap)
	r.Post("/admin/paths", h.createPath)
	r.Patch("/admin/paths/{id}", h.updatePath)
	r.Post("/admin/levels", h.createLevel)
	r.Patch("/admin/levels/{id}", h.updateLevel)
	r.Post("/admin/subjects", h.createSubject)
	r.Patch("/admin/subjects/{id}", h.updateSubject)
	r.Post("/admin/skills", h.createSkill)
	r.Patch("/admin/skills/{id}", h.updateSkill)
	return r
}

func (h *Handler) authenticateMutation(w http.ResponseWriter, r *http.Request) (identityapp.Authenticated, bool) {
	if h.auth == nil { writeJSON(w,http.StatusServiceUnavailable,map[string]string{"message":"Authentication service unavailable"}); return identityapp.Authenticated{},false }
	auth,err:=h.auth.Authenticate(r.Context(),identitysession.Token(r))
	if err!=nil { writeJSON(w,http.StatusUnauthorized,map[string]string{"message":"Authentication required"}); return identityapp.Authenticated{},false }
	if err:=h.auth.VerifyCSRF(auth,r.Header.Get("X-CSRF-Token"));err!=nil { writeJSON(w,http.StatusForbidden,map[string]string{"message":"Invalid CSRF token"}); return identityapp.Authenticated{},false }
	return auth,true
}

func (h *Handler) createPath(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.PathWrite;if !decodeJSON(w,r,&p){return};row,err:=h.service.CreatePath(r.Context(),auth.User,p);writeMutation(w,http.StatusCreated,map[string]any{"path":row},err)}
func (h *Handler) updatePath(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.PathPatch;if !decodeJSON(w,r,&p){return};row,err:=h.service.UpdatePath(r.Context(),auth.User,chi.URLParam(r,"id"),p);writeMutation(w,http.StatusOK,map[string]any{"path":row},err)}
func (h *Handler) createLevel(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.LevelWrite;if !decodeJSON(w,r,&p){return};row,err:=h.service.CreateLevel(r.Context(),auth.User,p);writeMutation(w,http.StatusCreated,map[string]any{"level":row},err)}
func (h *Handler) updateLevel(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.LevelPatch;if !decodeJSON(w,r,&p){return};row,err:=h.service.UpdateLevel(r.Context(),auth.User,chi.URLParam(r,"id"),p);writeMutation(w,http.StatusOK,map[string]any{"level":row},err)}
func (h *Handler) createSubject(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.SubjectWrite;if !decodeJSON(w,r,&p){return};row,err:=h.service.CreateSubject(r.Context(),auth.User,p);writeMutation(w,http.StatusCreated,map[string]any{"subject":row},err)}
func (h *Handler) updateSubject(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.SubjectPatch;if !decodeJSON(w,r,&p){return};row,err:=h.service.UpdateSubject(r.Context(),auth.User,chi.URLParam(r,"id"),p);writeMutation(w,http.StatusOK,map[string]any{"subject":row},err)}
func (h *Handler) createSkill(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.SkillWrite;if !decodeJSON(w,r,&p){return};row,err:=h.service.CreateSkill(r.Context(),auth.User,p);writeMutation(w,http.StatusCreated,map[string]any{"skill":row},err)}
func (h *Handler) updateSkill(w http.ResponseWriter,r *http.Request){ auth,ok:=h.authenticateMutation(w,r);if !ok{return};var p taxonomy.SkillPatch;if !decodeJSON(w,r,&p){return};row,err:=h.service.UpdateSkill(r.Context(),auth.User,chi.URLParam(r,"id"),p);writeMutation(w,http.StatusOK,map[string]any{"skill":row},err)}

func writeMutation(w http.ResponseWriter,status int,body any,err error){
	if err==nil{writeJSON(w,status,body);return}
	switch {
	case errors.Is(err,taxonomyapp.ErrInvalidInput): writeJSON(w,http.StatusBadRequest,map[string]string{"message":"Invalid taxonomy request"})
	case errors.Is(err,taxonomyapp.ErrForbidden): writeJSON(w,http.StatusForbidden,map[string]string{"message":"Forbidden"})
	case errors.Is(err,taxonomy.ErrNotFound): writeJSON(w,http.StatusNotFound,map[string]string{"message":"Taxonomy record not found"})
	case errors.Is(err,taxonomy.ErrConflict): writeJSON(w,http.StatusConflict,map[string]string{"message":"Taxonomy hierarchy conflict"})
	default: writeJSON(w,http.StatusInternalServerError,map[string]string{"message":"Internal server error"})
	}
}

func decodeJSON(w http.ResponseWriter,r *http.Request,dst any)bool{
	r.Body=http.MaxBytesReader(w,r.Body,64<<10);d:=json.NewDecoder(r.Body);d.DisallowUnknownFields()
	if err:=d.Decode(dst);err!=nil{writeJSON(w,http.StatusBadRequest,map[string]string{"message":"Invalid request"});return false};return true
}

func (h *Handler) bootstrap(w http.ResponseWriter, r *http.Request) {
	phase := strings.TrimSpace(r.URL.Query().Get("phase"))
	result, err := h.service.PublicBootstrap(r.Context(), phase)
	if errors.Is(err, taxonomyapp.ErrInvalidPhase) { http.Error(w, "invalid taxonomy bootstrap phase", http.StatusBadRequest); return }
	if err != nil { http.Error(w, "taxonomy unavailable", http.StatusInternalServerError); return }
	if phase == "" { phase = "full" }
	w.Header().Set("Cache-Control", "public, max-age=60, stale-while-revalidate=120")
	w.Header().Set("X-Taxonomy-Phase", phase)
	writeJSON(w, http.StatusOK, presentBootstrap(result))
}

type pathResponse struct { ID string `json:"id"`; Code string `json:"code"`; Name string `json:"name"`; ParentPathID string `json:"parentPathId,omitempty"`; Description string `json:"description"`; SortOrder int `json:"sortOrder"` }
type levelResponse struct { ID string `json:"id"`; PathID string `json:"pathId"`; Code string `json:"code"`; Name string `json:"name"`; SortOrder int `json:"sortOrder"` }
type subjectResponse struct { ID string `json:"id"`; PathID string `json:"pathId"`; LevelID string `json:"levelId,omitempty"`; Code string `json:"code"`; Name string `json:"name"`; SortOrder int `json:"sortOrder"` }
type skillResponse struct { ID string `json:"id"`; SubjectID string `json:"subjectId"`; ParentSkillID string `json:"parentSkillId,omitempty"`; Code string `json:"code"`; Name string `json:"name"`; Description string `json:"description"`; Kind string `json:"kind"`; SortOrder int `json:"sortOrder"` }

func presentBootstrap(value taxonomy.Bootstrap) map[string]any {
	paths:=make([]pathResponse,0,len(value.Paths));for _,row:=range value.Paths{paths=append(paths,pathResponse{row.ID,row.Code,row.Name,row.ParentPathID,row.Description,row.SortOrder})}
	levels:=make([]levelResponse,0,len(value.Levels));for _,row:=range value.Levels{levels=append(levels,levelResponse{row.ID,row.PathID,row.Code,row.Name,row.SortOrder})}
	subjects:=make([]subjectResponse,0,len(value.Subjects));for _,row:=range value.Subjects{subjects=append(subjects,subjectResponse{row.ID,row.PathID,row.LevelID,row.Code,row.Name,row.SortOrder})}
	skills:=make([]skillResponse,0,len(value.Skills));for _,row:=range value.Skills{skills=append(skills,skillResponse{row.ID,row.SubjectID,row.ParentSkillID,row.Code,row.Name,row.Description,row.Kind,row.SortOrder})}
	return map[string]any{"paths":paths,"levels":levels,"subjects":subjects,"skills":skills}
}

func writeJSON(w http.ResponseWriter,status int,body any){w.Header().Set("Content-Type","application/json; charset=utf-8");w.WriteHeader(status);_=json.NewEncoder(w).Encode(body)}
