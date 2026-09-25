package application

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	media "github.com/nasef6464/almeaago/internal/media/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

var ErrDryRunRequired = errors.New("successful dry run required")

type ImportRepository interface {
	ImportConflicts(ctx context.Context, questionCodes, sourceItemIDs, imageHashes []string) ([]question.ImportConflict, error)
	ValidateImportBatch(ctx context.Context, commands []question.ImportCommand) ([]question.ImportIssue, error)
	WriteImportBatch(ctx context.Context, actorUserID, batchID string, commands []question.ImportCommand) (question.ImportBatch, error)
	GetImportBatch(ctx context.Context, batchID string) (question.ImportBatch, error)
	RollbackImportBatch(ctx context.Context, actorUserID, batchID string) (question.ImportBatch, error)
}

type ImportMediaResolver interface {
	Get(ctx context.Context, actor identity.User, assetID string) (media.Asset, error)
}

type ImportValidationStore interface {
	Put(ctx context.Context, batchID, digest string, ttl time.Duration) error
	Consume(ctx context.Context, batchID, digest string) (bool, error)
}

type ImportService struct {
	repo       ImportRepository
	media      ImportMediaResolver
	validations ImportValidationStore
	validationTTL time.Duration
}

func NewImportService(
	repo ImportRepository,
	mediaResolver ImportMediaResolver,
	validations ImportValidationStore,
	validationTTL time.Duration,
) *ImportService {
	return &ImportService{
		repo: repo,
		media: mediaResolver,
		validations: validations,
		validationTTL: validationTTL,
	}
}

type ImportBatchInput struct {
	BatchID string            `json:"batchId"`
	DryRun  bool              `json:"dryRun"`
	Items   []ImportItemInput `json:"items"`
}

type ImportItemInput struct {
	QuestionCode string       `json:"questionCode"`
	Version      VersionInput `json:"version"`
}

type importSourceMeta struct {
	DocumentCode          string `json:"documentCode"`
	SourceItemID          string `json:"sourceItemId"`
	ImageHash             string `json:"imageHash"`
	PDFPageIndex          int    `json:"pdfPageIndex"`
	PrintedPageNumber     int    `json:"printedPageNumber"`
	PrintedQuestionNumber int    `json:"printedQuestionNumber"`
}

func (s *ImportService) Import(ctx context.Context, actor identity.User, input ImportBatchInput) (question.ImportResult, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return question.ImportResult{}, ErrForbidden
	}
	batchID := normalizeBatchID(input.BatchID)
	if !validBatchID(batchID) || len(input.Items) < 1 || len(input.Items) > 100 {
		return question.ImportResult{}, ErrInvalidInput
	}
	if s.media == nil || s.validations == nil {
		return question.ImportResult{}, errors.New("question import dependencies are not configured")
	}

	result := question.ImportResult{
		BatchID:       batchID,
		Requested:     len(input.Items),
		QuestionCodes: make([]string, 0, len(input.Items)),
		Issues:        []question.ImportIssue{},
		Conflicts:     []question.ImportConflict{},
	}

	commands := make([]question.ImportCommand, 0, len(input.Items))
	codes := make([]string, 0, len(input.Items))
	sourceIDs := make([]string, 0, len(input.Items))
	hashes := make([]string, 0, len(input.Items))
	seenCodes := map[string]bool{}
	seenSources := map[string]bool{}
	seenHashes := map[string]bool{}

	for index, item := range input.Items {
		command, issue := s.normalizeImportItem(ctx, actor, batchID, index, item)
		if issue != nil {
			result.Issues = append(result.Issues, *issue)
			continue
		}
		code := command.Create.QuestionCode
		sourceID := command.Provenance.SourceItemID
		imageHash := command.Provenance.ImageHash
		result.QuestionCodes = append(result.QuestionCodes, code)

		duplicate := false
		if seenCodes[code] {
			result.Issues = append(result.Issues, importIssue(index, code, "DUPLICATE_QUESTION_CODE", "questionCode is duplicated inside the batch"))
			duplicate = true
		}
		if seenSources[sourceID] {
			result.Issues = append(result.Issues, importIssue(index, code, "DUPLICATE_SOURCE_ITEM_ID", "sourceItemId is duplicated inside the batch"))
			duplicate = true
		}
		if seenHashes[imageHash] {
			result.Issues = append(result.Issues, importIssue(index, code, "DUPLICATE_IMAGE_HASH", "imageHash is duplicated inside the batch"))
			duplicate = true
		}
		seenCodes[code], seenSources[sourceID], seenHashes[imageHash] = true, true, true
		if duplicate {
			continue
		}
		codes = append(codes, code)
		sourceIDs = append(sourceIDs, sourceID)
		hashes = append(hashes, imageHash)
		commands = append(commands, command)
	}
	result.Prepared = len(commands)
	if len(result.Issues) > 0 || len(commands) != len(input.Items) {
		result.Status = "INVALID"
		result.Mode = mode(input.DryRun)
		return result, nil
	}

	conflicts, err := s.repo.ImportConflicts(ctx, codes, sourceIDs, hashes)
	if err != nil {
		return question.ImportResult{}, err
	}
	if len(conflicts) > 0 {
		result.Status = "CONFLICT"
		result.Mode = mode(input.DryRun)
		result.Conflicts = conflicts
		return result, nil
	}

	taxonomyIssues, err := s.repo.ValidateImportBatch(ctx, commands)
	if err != nil {
		return question.ImportResult{}, err
	}
	if len(taxonomyIssues) > 0 {
		result.Status = "INVALID"
		result.Mode = mode(input.DryRun)
		result.Issues = append(result.Issues, taxonomyIssues...)
		return result, nil
	}

	digest, err := importDigest(batchID, commands)
	if err != nil {
		return question.ImportResult{}, err
	}
	if input.DryRun {
		if err := s.validations.Put(ctx, batchID, digest, s.validationTTL); err != nil {
			return question.ImportResult{}, err
		}
		result.Status = "PASS"
		result.Mode = "DRY_RUN"
		return result, nil
	}

	ok, err := s.validations.Consume(ctx, batchID, digest)
	if err != nil {
		return question.ImportResult{}, err
	}
	if !ok {
		return question.ImportResult{}, ErrDryRunRequired
	}
	batch, err := s.repo.WriteImportBatch(ctx, actor.ID, batchID, commands)
	if err != nil {
		return question.ImportResult{}, err
	}
	result.Status = "IMPORTED"
	result.Mode = "WRITE"
	result.Inserted = batch.InsertedCount
	result.Batch = &batch
	return result, nil
}

func (s *ImportService) GetBatch(ctx context.Context, actor identity.User, batchID string) (question.ImportBatch, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return question.ImportBatch{}, ErrForbidden
	}
	batchID = normalizeBatchID(batchID)
	if !validBatchID(batchID) {
		return question.ImportBatch{}, ErrInvalidInput
	}
	return s.repo.GetImportBatch(ctx, batchID)
}

func (s *ImportService) Rollback(ctx context.Context, actor identity.User, batchID string) (question.ImportBatch, error) {
	if !actor.HasRole(identity.RoleAdmin) {
		return question.ImportBatch{}, ErrForbidden
	}
	batchID = normalizeBatchID(batchID)
	if !validBatchID(batchID) {
		return question.ImportBatch{}, ErrInvalidInput
	}
	return s.repo.RollbackImportBatch(ctx, actor.ID, batchID)
}

func (s *ImportService) normalizeImportItem(
	ctx context.Context,
	actor identity.User,
	batchID string,
	index int,
	item ImportItemInput,
) (question.ImportCommand, *question.ImportIssue) {
	code := strings.ToUpper(strings.TrimSpace(item.QuestionCode))
	var source importSourceMeta
	if len(item.Version.SourceMeta) == 0 || json.Unmarshal(item.Version.SourceMeta, &source) != nil {
		issue := importIssue(index, code, "INVALID_SOURCE_META", "canonical sourceMeta is required")
		return question.ImportCommand{}, &issue
	}
	source.DocumentCode = strings.ToUpper(strings.TrimSpace(source.DocumentCode))
	source.SourceItemID = strings.ToUpper(strings.TrimSpace(source.SourceItemID))
	source.ImageHash = strings.ToLower(strings.TrimSpace(source.ImageHash))
	if !validDocumentCode(source.DocumentCode) || source.PDFPageIndex < 1 || source.PrintedPageNumber < 1 ||
		source.PrintedQuestionNumber < 0 || !validSHA256Hex(source.ImageHash) {
		issue := importIssue(index, code, "INVALID_SOURCE_IDENTITY", "source coordinates or imageHash are invalid")
		return question.ImportCommand{}, &issue
	}

	expectedCode := fmt.Sprintf(
		"QDR-QNT-%s-P%03d-Q%02d",
		source.DocumentCode,
		source.PrintedPageNumber,
		source.PrintedQuestionNumber,
	)
	if code != expectedCode {
		issue := importIssue(index, code, "QUESTION_CODE_MISMATCH", "questionCode must match canonical source identity: "+expectedCode)
		return question.ImportCommand{}, &issue
	}
	expectedSourceID := fmt.Sprintf(
		"%s-PDF%03d-P%03d-N%02d",
		source.DocumentCode,
		source.PDFPageIndex,
		source.PrintedPageNumber,
		source.PrintedQuestionNumber,
	)
	if source.SourceItemID != expectedSourceID {
		issue := importIssue(index, code, "SOURCE_ITEM_MISMATCH", "sourceItemId must match canonical source identity: "+expectedSourceID)
		return question.ImportCommand{}, &issue
	}

	versionInput := item.Version
	versionInput.Source = "imported"
	versionInput.SourceMeta = normalizeImportSourceMeta(item.Version.SourceMeta, source, batchID)
	version, err := normalizeVersion(versionInput)
	if err != nil {
		issue := importIssue(index, code, "INVALID_QUESTION", "question version validation failed")
		return question.ImportCommand{}, &issue
	}
	if version.ImageAssetID == "" {
		issue := importIssue(index, code, "IMAGE_REQUIRED", "V2 quantitative import requires a verified WebP image asset")
		return question.ImportCommand{}, &issue
	}

	asset, err := s.media.Get(ctx, actor, version.ImageAssetID)
	if err != nil {
		issue := importIssue(index, code, "MEDIA_NOT_VERIFIED", "image asset is not available")
		return question.ImportCommand{}, &issue
	}
	expectedKey := "questions/v2/" + code + "/" + source.ImageHash + ".webp"
	if asset.Status != media.StatusActive || asset.MimeType != "image/webp" ||
		!strings.EqualFold(asset.SHA256, source.ImageHash) || asset.ObjectKey != expectedKey {
		issue := importIssue(index, code, "MEDIA_IDENTITY_MISMATCH", "verified image asset does not match questionCode/imageHash")
		return question.ImportCommand{}, &issue
	}

	create := question.CreateCommand{
		QuestionCode: code,
		PathID:       version.PathID,
		SubjectID:    version.SubjectID,
		OwnerType:    question.OwnerPlatform,
		Version:      version,
		SkillLinks:   append([]question.SkillLink(nil), version.SkillLinks...),
	}
	return question.ImportCommand{
		Create: create,
		Provenance: question.ImportProvenance{
			DocumentCode:          source.DocumentCode,
			SourceItemID:          source.SourceItemID,
			ImageHash:             source.ImageHash,
			PDFPageIndex:          source.PDFPageIndex,
			PrintedPageNumber:     source.PrintedPageNumber,
			PrintedQuestionNumber: source.PrintedQuestionNumber,
		},
	}, nil
}

func normalizeImportSourceMeta(raw json.RawMessage, source importSourceMeta, batchID string) json.RawMessage {
	var values map[string]any
	if json.Unmarshal(raw, &values) != nil || values == nil {
		values = map[string]any{}
	}
	values["documentCode"] = source.DocumentCode
	values["sourceItemId"] = source.SourceItemID
	values["imageHash"] = source.ImageHash
	values["pdfPageIndex"] = source.PDFPageIndex
	values["printedPageNumber"] = source.PrintedPageNumber
	values["printedQuestionNumber"] = source.PrintedQuestionNumber
	values["importBatchId"] = batchID
	normalized, _ := json.Marshal(values)
	return normalized
}

func importDigest(batchID string, commands []question.ImportCommand) (string, error) {
	raw, err := json.Marshal(struct {
		BatchID  string                   `json:"batchId"`
		Commands []question.ImportCommand `json:"commands"`
	}{BatchID: batchID, Commands: commands})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}

func importIssue(index int, code, issueCode, message string) question.ImportIssue {
	return question.ImportIssue{Index: index, QuestionCode: code, Code: issueCode, Message: message}
}

func mode(dryRun bool) string {
	if dryRun {
		return "DRY_RUN"
	}
	return "WRITE"
}

func normalizeBatchID(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func validBatchID(value string) bool {
	if len(value) < 8 || len(value) > 160 {
		return false
	}
	for index, ch := range value {
		if (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '.' || ch == '_' || ch == '-' {
			if index == 0 && (ch == '.' || ch == '_' || ch == '-') {
				return false
			}
			continue
		}
		return false
	}
	return true
}

func validDocumentCode(value string) bool {
	if value == "" || len(value) > 80 {
		return false
	}
	for _, ch := range value {
		if (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '_' || ch == '-' {
			continue
		}
		return false
	}
	return true
}

func validSHA256Hex(value string) bool {
	if len(value) != 64 {
		return false
	}
	for _, ch := range value {
		if (ch >= '0' && ch <= '9') || (ch >= 'a' && ch <= 'f') {
			continue
		}
		return false
	}
	return true
}
