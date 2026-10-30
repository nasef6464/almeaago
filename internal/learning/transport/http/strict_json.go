package learninghttp

import (
    "bytes"
    "encoding/json"
    "io"
    "net/http"
)

// decodeLearningWriteJSON accepts exactly one JSON object. A trailing document
// must never be silently ignored before a learner write reaches the service.
// Keep each route's existing byte cap and unknown-field rejection.
func decodeLearningWriteJSON(w http.ResponseWriter, r *http.Request, out any, maxBytes int64) bool {
    badRequest := func() bool {
        writeJSON(w, http.StatusBadRequest, map[string]string{"message": "Invalid request body"})
        return false
    }

    decoder := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxBytes))
    var raw json.RawMessage
    if err := decoder.Decode(&raw); err != nil {
        return badRequest()
    }
    trimmed := bytes.TrimSpace(raw)
    if len(trimmed) == 0 || trimmed[0] != '{' {
        return badRequest()
    }
    var trailing json.RawMessage
    if err := decoder.Decode(&trailing); err != io.EOF {
        return badRequest()
    }
    payload := json.NewDecoder(bytes.NewReader(raw))
    payload.DisallowUnknownFields()
    if err := payload.Decode(out); err != nil {
        return badRequest()
    }
    return true
}
