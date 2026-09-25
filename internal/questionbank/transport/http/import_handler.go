package questionhttp

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	questionapp "github.com/nasef6464/almeaago/internal/questionbank/application"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func (h *Handler) importBatch(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	var payload struct {
		BatchID string                        `json:"batchId"`
		DryRun  *bool                         `json:"dryRun"`
		Items   []questionapp.ImportItemInput `json:"items"`
	}
	if !decodeImportJSON(w, r, &payload) {
		return
	}
	dryRun := true
	if payload.DryRun != nil {
		dryRun = *payload.DryRun
	}
	result, err := h.importService.Import(r.Context(), auth.User, questionapp.ImportBatchInput{
		BatchID: payload.BatchID,
		DryRun:  dryRun,
		Items:   payload.Items,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	status := http.StatusOK
	switch result.Status {
	case "INVALID":
		status = http.StatusBadRequest
	case "CONFLICT":
		status = http.StatusConflict
	case "IMPORTED":
		status = http.StatusCreated
	}
	writeJSON(w, status, presentImportResult(result))
}

func (h *Handler) getImportBatch(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, false)
	if !ok {
		return
	}
	batch, err := h.importService.GetBatch(r.Context(), auth.User, chi.URLParam(r, "batchId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"batch": presentImportBatch(batch)})
}

func (h *Handler) rollbackImportBatch(w http.ResponseWriter, r *http.Request) {
	auth, ok := h.authenticate(w, r, true)
	if !ok {
		return
	}
	batch, err := h.importService.Rollback(r.Context(), auth.User, chi.URLParam(r, "batchId"))
	if err != nil {
		writeError(w, err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"batch": presentImportBatch(batch)})
}

func presentImportResult(result question.ImportResult) map[string]any {
	body := map[string]any{
		"status":        result.Status,
		"mode":          result.Mode,
		"batchId":       result.BatchID,
		"requested":     result.Requested,
		"prepared":      result.Prepared,
		"inserted":      result.Inserted,
		"questionCodes": result.QuestionCodes,
		"issues":        result.Issues,
		"conflicts":     result.Conflicts,
	}
	if result.Batch != nil {
		body["batch"] = presentImportBatch(*result.Batch)
	}
	return body
}

func presentImportBatch(batch question.ImportBatch) map[string]any {
	return map[string]any{
		"batchId":            batch.BatchID,
		"status":             batch.Status,
		"requestedCount":     batch.RequestedCount,
		"insertedCount":      batch.InsertedCount,
		"manifestHash":       batch.ManifestHash,
		"report":             json.RawMessage(batch.Report),
		"preflightExpiresAt": batch.PreflightExpiresAt,
		"committedAt":        batch.CommittedAt,
		"createdAt":          batch.CreatedAt,
		"updatedAt":          batch.UpdatedAt,
		"rolledBackAt":       batch.RolledBackAt,
		"questions":          batch.Questions,
	}
}

func decodeImportJSON(w http.ResponseWriter, r *http.Request, dst any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8<<20)
	decoder := json.NewDecoder(r.Body)
	decoder.DisallowUnknownFields()
	if err := decoder.Decode(dst); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid import request"})
		return false
	}
	return true
}
