package contenthttp

import (
	"net/http"

	"github.com/go-chi/chi/v5"

	contentapp "github.com/nasef6464/almeaago/internal/content/application"
)

func NewLibrary(service *contentapp.Service, auth Authenticator) http.Handler {
	h := &Handler{service: service, auth: auth}
	r := chi.NewRouter()
	r.Get("/", h.listLibrary)
	r.Post("/", h.createLibrary)
	r.Get("/{id}", h.getLibrary)
	r.Put("/{id}", h.updateLibrary)
	r.Patch("/{id}/workflow", h.libraryWorkflow)
	return r
}

func (h *Handler) listLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	query, ok := parseListQuery(w, r)
	if !ok {
		return
	}
	page, err := h.service.ListLibraryItems(r.Context(), auth.User, query)
	if err != nil {
		writeError(w, err)
		return
	}
	items := make([]map[string]any, 0, len(page.Items))
	for _, row := range page.Items {
		items = append(items, presentLibrarySummary(row))
	}
	writeJSON(w, http.StatusOK, map[string]any{"items": items, "page": page.Page, "limit": page.Limit, "hasMore": page.HasMore})
}

func (h *Handler) createLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.LibraryInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.CreateLibraryItem(r.Context(), auth.User, input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusCreated, map[string]any{"item": presentLibrary(row)})
}

func (h *Handler) getLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	row, err := h.service.StaffLibraryItem(r.Context(), auth.User, chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": presentLibrary(row)})
}

func (h *Handler) updateLibrary(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.UpdateLibraryInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.UpdateLibraryItem(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": presentLibrary(row)})
}

func (h *Handler) libraryWorkflow(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var input contentapp.WorkflowInput
	if !decodeJSON(w, r, &input) {
		return
	}
	row, err := h.service.SetLibraryWorkflow(r.Context(), auth.User, chi.URLParam(r, "id"), input)
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"item": presentLibrary(row)})
}
