package domain

import "time"

type Status string

const (
	StatusPendingUpload   Status = "pending_upload"
	StatusActive          Status = "active"
	StatusOrphanCandidate Status = "orphan_candidate"
	StatusArchived        Status = "archived"
)

type UploadKind string

const (
	UploadQuestionImage       UploadKind = "question_image"
	UploadQuestionImportImage UploadKind = "question_import_image"
	UploadExplanationAudio    UploadKind = "explanation_audio"
)

type Asset struct {
	ID              string
	ObjectKey       string
	PublicURL       string
	MimeType        string
	SizeBytes       int64
	SHA256          string
	Version         int
	Status          Status
	CreatedBy       string
	UploadExpiresAt *time.Time
	VerifiedAt      *time.Time
	CreatedAt       time.Time
}

type UploadTarget struct {
	URL       string
	Headers   map[string]string
	ExpiresAt time.Time
}

type ObjectInfo struct {
	Exists    bool
	SizeBytes int64
	MimeType  string
	SHA256    string
}

type ReserveRequest struct {
	ObjectKey       string
	PublicURL       string
	MimeType        string
	SizeBytes       int64
	SHA256          string
	UploadExpiresAt time.Time
}
