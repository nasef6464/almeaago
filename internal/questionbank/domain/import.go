package domain

import (
	"encoding/json"
	"time"
)

type ImportProvenance struct {
	DocumentCode          string
	SourceItemID          string
	ImageHash             string
	PDFPageIndex          int
	PrintedPageNumber     int
	PrintedQuestionNumber int
}

type ImportCommand struct {
	Create     CreateCommand
	Provenance ImportProvenance
}

type ImportConflict struct {
	ID             string
	QuestionCode   string
	SourceItemID   string
	ImageHash      string
	ImportBatchID  string
	WorkflowStatus WorkflowStatus
}

type ImportIssue struct {
	Index        int    `json:"index"`
	QuestionCode string `json:"questionCode"`
	Code         string `json:"code"`
	Message      string `json:"message"`
}

type ImportedQuestion struct {
	ID             string
	QuestionCode   string
	WorkflowStatus WorkflowStatus
}

type ImportBatch struct {
	BatchID            string
	Status             string
	RequestedCount     int
	InsertedCount      int
	CreatedBy          string
	ManifestHash       string
	Report             json.RawMessage
	PreflightExpiresAt *time.Time
	CommittedAt        *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
	RolledBackAt       *time.Time
	Questions          []ImportedQuestion
}

type ImportResult struct {
	Status        string
	Mode          string
	BatchID       string
	Requested     int
	Prepared      int
	Inserted      int
	QuestionCodes []string
	Issues        []ImportIssue
	Conflicts     []ImportConflict
	Batch         *ImportBatch
}
