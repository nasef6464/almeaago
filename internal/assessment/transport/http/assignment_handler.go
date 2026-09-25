package assessmenthttp
import("net/http";"github.com/go-chi/chi/v5";app "github.com/nasef6464/almeaago/internal/assessment/application";assessment "github.com/nasef6464/almeaago/internal/assessment/domain")
type AssignmentHandler struct{service *app.AssignmentService;auth Authenticator}
func NewAssignments(s *app.AssignmentService,a Authenticator)http.Handler{h:=&AssignmentHandler{service:s,auth:a};r:=chi.NewRouter();r.Get("/mine",h.mine);r.Post("/{id}/start",h.start);r.Post("/{id}/status",h.status);return r}
func(h *AssignmentHandler)authn(w http.ResponseWriter,r *http.Request,csrf bool)(anyAuth,bool){a,ok:=authenticateShared(h.auth,w,r,csrf);return anyAuth{a},ok}
type anyAuth struct{value interface{}}
func(h *AssignmentHandler)mine(w http.ResponseWriter,r *http.Request){a,ok:=h.authn(w,r,false);if!ok{return};auth:=a.value.(interface{ });_=auth;writeJSON(w,500,map[string]string{"message":"unreachable"})}
func(h *AssignmentHandler)start(w http.ResponseWriter,r *http.Request){writeJSON(w,500,map[string]string{"message":"unreachable"})}
func(h *AssignmentHandler)status(w http.ResponseWriter,r *http.Request){writeJSON(w,500,map[string]string{"message":"unreachable"})}
var _=assessment.AssignmentActive
