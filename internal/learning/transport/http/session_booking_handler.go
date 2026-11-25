package learninghttp

import (
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type SessionBookingHandler struct {
	service *learningapp.SessionBookingService
	auth    Authenticator
}

func NewSessionBookings(service *learningapp.SessionBookingService, auth Authenticator) http.Handler {
	h := &SessionBookingHandler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Use(func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "private, no-store")
			next.ServeHTTP(w, r)
		})
	})
	r.Post("/", h.create)
	r.Get("/mine", h.listMine)
	r.Patch("/{bookingId}/cancel", h.cancelMine)
	r.Get("/teacher", h.listTeacher)
	r.Patch("/teacher/{bookingId}/reject", h.rejectTeacher)
	r.Get("/admin", h.listAdmin)
	r.Patch("/admin/{bookingId}", h.adminUpdate)
	return r
}

func (h *SessionBookingHandler) create(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	var in learning.SessionBookingCreate
	if !decodeLearningWriteJSON(w, r, &in, 32<<10) {
		return
	}
	booking, created, err := h.service.Create(r.Context(), a.User, in)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	status := http.StatusOK
	if created {
		status = http.StatusCreated
	}
	writeJSON(w, status, map[string]any{"booking": booking})
}

func (h *SessionBookingHandler) listMine(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, false)
	if !ok {
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeBookingError(w, err)
		return
	}
	items, err := h.service.ListMine(r.Context(), a.User, limit)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bookings": items})
}

func (h *SessionBookingHandler) cancelMine(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	booking, err := h.service.CancelMine(r.Context(), a.User, chi.URLParam(r, "bookingId"))
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"booking": booking})
}

func (h *SessionBookingHandler) listTeacher(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, false)
	if !ok {
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeBookingError(w, err)
		return
	}
	items, err := h.service.ListTeacher(r.Context(), a.User, limit)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bookings": items})
}

func (h *SessionBookingHandler) rejectTeacher(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	booking, err := h.service.RejectTeacher(r.Context(), a.User, chi.URLParam(r, "bookingId"))
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"booking": booking})
}

func (h *SessionBookingHandler) listAdmin(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, false)
	if !ok {
		return
	}
	limit, err := parsePositive(r.URL.Query().Get("limit"))
	if err != nil {
		writeBookingError(w, err)
		return
	}
	items, err := h.service.ListAdmin(r.Context(), a.User, r.URL.Query().Get("status"), limit)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"bookings": items})
}

func (h *SessionBookingHandler) adminUpdate(w http.ResponseWriter, r *http.Request) {
	a, ok := (&Handler{auth: h.auth}).authn(w, r, true)
	if !ok {
		return
	}
	var in learning.SessionBookingAdminPatch
	if !decodeLearningWriteJSON(w, r, &in, 16<<10) {
		return
	}
	booking, err := h.service.AdminUpdate(r.Context(), a.User, chi.URLParam(r, "bookingId"), in)
	if err != nil {
		writeBookingError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"booking": booking})
}

func writeBookingError(w http.ResponseWriter, err error) {
	if errors.Is(err, learningapp.ErrBookingPastDate) {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "اختر تاريخًا قادمًا أو تاريخ اليوم للحجز."})
		return
	}
	writeError(w, err)
}
