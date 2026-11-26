package contenthttp

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
)

type bulkDeleteRequest struct {
	IDs []string `json:"ids"`
}

func (h *Handler) deleteKind(kind, param string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth, ok := h.authenticate(w, r, true)
		if !ok {
			return
		}
		err := h.service.DeleteRecord(r.Context(), auth.User, kind, chi.URLParam(r, param))
		if errors.Is(err, contentapp.ErrHasDependencies) {
			writeJSON(w, http.StatusConflict, map[string]string{
				"message": "لا يمكن حذف هذا العنصر لارتباطه ببيانات أو طلاب نشطين",
			})
			return
		}
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"deleted": true})
	}
}

func (h *Handler) bulkDeleteKind(kind string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		auth, ok := h.authenticate(w, r, true)
		if !ok {
			return
		}
		var req bulkDeleteRequest
		if !decodeJSON(w, r, &req) {
			return
		}
		res, err := h.service.BulkDeleteRecords(r.Context(), auth.User, kind, req.IDs)
		if err != nil {
			writeError(w, err)
			return
		}
		writeJSON(w, http.StatusOK, res)
	}
}
