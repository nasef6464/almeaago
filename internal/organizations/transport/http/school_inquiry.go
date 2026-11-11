package organizationshttp

import (
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	orgapp "github.com/nasef6464/almeaago/internal/organizations/application"
	orgdomain "github.com/nasef6464/almeaago/internal/organizations/domain"
)

type createSchoolInquiryRequest struct {
	RefNumber           string   `json:"refNumber"`
	SchoolName          string   `json:"schoolName"`
	City                string   `json:"city"`
	DirectorName        string   `json:"directorName"`
	Phone               string   `json:"phone"`
	Email               string   `json:"email"`
	StudentCount        int      `json:"studentCount"`
	TierID              string   `json:"tierId"`
	TierName            string   `json:"tierName"`
	Paths               []string `json:"paths"`
	Notes               string   `json:"notes"`
	TotalAnnualEstimate float64  `json:"totalAnnualEstimate"`
	CreatedAt           string   `json:"createdAt,omitempty"`
}

type createSchoolInquiryResponse struct {
	Success   bool   `json:"success"`
	RefNumber string `json:"refNumber"`
	ID        string `json:"id"`
}

func (h *Handler) createSchoolInquiry(w http.ResponseWriter, r *http.Request) {
	if h.inquiryService == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"message": "School inquiry service unavailable",
		})
		return
	}

	// Limit request payload to prevent payload bomb
	r.Body = http.MaxBytesReader(w, r.Body, 64<<10)

	var req createSchoolInquiryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "Invalid request body",
		})
		return
	}

	// Mandatory field validation: must reject missing school_name, director_name, or phone with HTTP 400
	schoolName := strings.TrimSpace(req.SchoolName)
	directorName := strings.TrimSpace(req.DirectorName)
	phone := strings.TrimSpace(req.Phone)

	if schoolName == "" || directorName == "" || phone == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"message": "school_name, director_name, and phone are required",
		})
		return
	}

	inquiry, err := h.inquiryService.SubmitInquiry(r.Context(), orgdomain.SchoolInquiryCreate{
		RefNumber:           strings.TrimSpace(req.RefNumber),
		SchoolName:          schoolName,
		City:                strings.TrimSpace(req.City),
		DirectorName:        directorName,
		Phone:               phone,
		Email:               strings.TrimSpace(req.Email),
		StudentCount:        req.StudentCount,
		TierID:              strings.TrimSpace(req.TierID),
		TierName:            strings.TrimSpace(req.TierName),
		Paths:               req.Paths,
		Notes:               strings.TrimSpace(req.Notes),
		TotalAnnualEstimate: req.TotalAnnualEstimate,
	})

	if err != nil {
		switch {
		case errors.Is(err, orgapp.ErrInvalidInput):
			writeJSON(w, http.StatusBadRequest, map[string]string{
				"message": "Invalid request parameters",
			})
		case errors.Is(err, orgdomain.ErrConflict):
			writeJSON(w, http.StatusConflict, map[string]string{
				"message": "An inquiry with this reference number already exists",
			})
		default:
			writeJSON(w, http.StatusInternalServerError, map[string]string{
				"message": "Internal server error while saving inquiry",
			})
		}
		return
	}

	writeJSON(w, http.StatusCreated, createSchoolInquiryResponse{
		Success:   true,
		RefNumber: inquiry.RefNumber,
		ID:        inquiry.ID,
	})
}
