package organizationshttp

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"
	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func (h *Handler) supervisorMoveStudent(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var move org.SupervisorClassMove
	if !decodeJSON(w, r, &move) {
		return
	}
	idempotent, err := h.service.SupervisorMoveStudent(r.Context(), auth.User, chi.URLParam(r, "schoolId"), chi.URLParam(r, "studentId"), move)
	switch {
	case errors.Is(err, org.ErrForbidden), errors.Is(err, orgapp.ErrForbidden):
		writeJSON(w, http.StatusForbidden, map[string]string{"message": "نقل الطالب غير متاح ضمن نطاق إشرافك الحالي."})
	case errors.Is(err, org.ErrConflict):
		writeJSON(w, http.StatusConflict, map[string]string{"message": "الطالب مرتبط بأكثر من فصل. راجع توزيع الفصول قبل النقل."})
	case err != nil:
		writeError(w, err)
	default:
		writeJSON(w, http.StatusOK, map[string]any{"classId": move.ClassID, "idempotent": idempotent})
	}
}
