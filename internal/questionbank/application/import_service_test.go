package application

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	media "github.com/nasef6464/almeaago/internal/media/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

type importRepoStub struct {
	conflicts []question.ImportConflict
	issues    []question.ImportIssue
	written   []question.ImportCommand
}

func (r *importRepoStub) ImportConflicts(context.Context, []string, []string, []string) ([]question.ImportConflict, error) {
	return r.conflicts, nil
}

func (r *importRepoStub) ValidateImportBatch(context.Context, []question.ImportCommand) ([]question.ImportIssue, error) {
	return r.issues, nil
}

func (r *importRepoStub) WriteImportBatch(_ context.Context, actor, batchID string, commands []question.ImportCommand) (question.ImportBatch, error) {
	r.written = append([]question.ImportCommand(nil), commands...)
	items := make([]question.ImportedQuestion, 0, len(commands))
	for index, command := range commands {
		items = append(items, question.ImportedQuestion{
			ID:             "question-" + string(rune('1'+index)),
			QuestionCode:   command.Create.QuestionCode,
			WorkflowStatus: question.WorkflowDraft,
		})
	}
	return question.ImportBatch{
		BatchID: batchID, Status: "imported", RequestedCount: len(commands),
		InsertedCount: len(commands), CreatedBy: actor, Questions: items,
	}, nil
}

func (r *importRepoStub) GetImportBatch(context.Context, string) (question.ImportBatch, error) {
	return question.ImportBatch{}, nil
}

func (r *importRepoStub) RollbackImportBatch(context.Context, string, string) (question.ImportBatch, error) {
	return question.ImportBatch{}, nil
}

type importMediaStub struct {
	assets map[string]media.Asset
}

func (m importMediaStub) Get(_ context.Context, _ identity.User, assetID string) (media.Asset, error) {
	asset, ok := m.assets[assetID]
	if !ok {
		return media.Asset{}, media.ErrNotFound
	}
	return asset, nil
}

type validationStoreStub struct {
	values map[string]string
}

func (s *validationStoreStub) Put(_ context.Context, batchID, digest string, _ time.Duration) error {
	if s.values == nil {
		s.values = map[string]string{}
	}
	s.values[batchID] = digest
	return nil
}

func (s *validationStoreStub) Consume(_ context.Context, batchID, digest string) (bool, error) {
	if s.values[batchID] != digest {
		return false, nil
	}
	delete(s.values, batchID)
	return true, nil
}

func importAdmin() identity.User {
	return identity.User{ID: "11111111-1111-7111-8111-111111111111", Roles: []identity.Role{identity.RoleAdmin}}
}

func validImportItem(hash string) ImportItemInput {
	correct := 1
	source, _ := json.Marshal(map[string]any{
		"documentCode":          "DOC1",
		"sourceItemId":          "DOC1-PDF004-P012-N03",
		"imageHash":             hash,
		"pdfPageIndex":          4,
		"printedPageNumber":     12,
		"printedQuestionNumber": 3,
	})
	return ImportItemInput{
		QuestionCode: "QDR-QNT-DOC1-P012-Q03",
		Version: VersionInput{
			PathID:             "path-1",
			SubjectID:          "subject-1",
			QuestionType:       question.QuestionMCQ,
			ImageAssetID:       "asset-1",
			ImageAlt:           "صورة السؤال",
			CorrectOptionIndex: &correct,
			Explanation:        "شرح",
			SourceMeta:         source,
			Options:            []OptionInput{{Text: "A"}, {Text: "B"}},
			SkillLinks:         []SkillLinkInput{{SkillID: "skill-main", RelationType: question.RelationMain}},
		},
	}
}

func importServiceFixture(hash string) (*ImportService, *importRepoStub, *validationStoreStub) {
	repo := &importRepoStub{}
	store := &validationStoreStub{values: map[string]string{}}
	mediaResolver := importMediaStub{assets: map[string]media.Asset{
		"asset-1": {
			ID: "asset-1", Status: media.StatusActive, MimeType: "image/webp",
			SHA256: hash, ObjectKey: "questions/v2/QDR-QNT-DOC1-P012-Q03/" + hash + ".webp",
		},
	}}
	return NewImportService(repo, mediaResolver, store, 30*time.Minute), repo, store
}

func TestImportRequiresSuccessfulMatchingDryRunBeforeWrite(t *testing.T) {
	hash := strings.Repeat("a", 64)
	service, repo, _ := importServiceFixture(hash)
	input := ImportBatchInput{BatchID: "BATCH-001", Items: []ImportItemInput{validImportItem(hash)}}

	if _, err := service.Import(context.Background(), importAdmin(), input); !errors.Is(err, ErrDryRunRequired) {
		t.Fatalf("expected dry-run requirement, got %v", err)
	}
	if len(repo.written) != 0 {
		t.Fatal("write must not happen before matching dry run")
	}

	input.DryRun = true
	result, err := service.Import(context.Background(), importAdmin(), input)
	if err != nil || result.Status != "PASS" {
		t.Fatalf("expected PASS dry run, result=%#v err=%v", result, err)
	}

	input.DryRun = false
	result, err = service.Import(context.Background(), importAdmin(), input)
	if err != nil {
		t.Fatalf("unexpected write error: %v", err)
	}
	if result.Status != "IMPORTED" || len(repo.written) != 1 {
		t.Fatalf("unexpected import result=%#v written=%d", result, len(repo.written))
	}
	if repo.written[0].Create.Version.Source != "imported" || repo.written[0].Create.OwnerType != question.OwnerPlatform {
		t.Fatalf("import must force platform draft/imported semantics: %#v", repo.written[0])
	}
}

func TestImportDryRunDigestRejectsChangedPayload(t *testing.T) {
	hash := strings.Repeat("b", 64)
	service, _, _ := importServiceFixture(hash)
	input := ImportBatchInput{BatchID: "BATCH-002", DryRun: true, Items: []ImportItemInput{validImportItem(hash)}}
	if _, err := service.Import(context.Background(), importAdmin(), input); err != nil {
		t.Fatalf("dry run failed: %v", err)
	}
	input.DryRun = false
	input.Items[0].Version.Explanation = "changed after dry run"
	if _, err := service.Import(context.Background(), importAdmin(), input); !errors.Is(err, ErrDryRunRequired) {
		t.Fatalf("expected changed payload to require a new dry run, got %v", err)
	}
}

func TestImportRejectsCanonicalIdentityMismatch(t *testing.T) {
	hash := strings.Repeat("c", 64)
	service, _, _ := importServiceFixture(hash)
	item := validImportItem(hash)
	item.QuestionCode = "QDR-QNT-DOC1-P012-Q04"
	result, err := service.Import(context.Background(), importAdmin(), ImportBatchInput{
		BatchID: "BATCH-003", DryRun: true, Items: []ImportItemInput{item},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "INVALID" || len(result.Issues) != 1 || result.Issues[0].Code != "QUESTION_CODE_MISMATCH" {
		t.Fatalf("unexpected result: %#v", result)
	}
}

func TestImportRejectsUnverifiedOrMismatchedImageAsset(t *testing.T) {
	hash := strings.Repeat("d", 64)
	service, _, _ := importServiceFixture(hash)
	item := validImportItem(hash)
	item.Version.ImageAssetID = "missing"
	result, err := service.Import(context.Background(), importAdmin(), ImportBatchInput{
		BatchID: "BATCH-004", DryRun: true, Items: []ImportItemInput{item},
	})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Status != "INVALID" || len(result.Issues) != 1 || result.Issues[0].Code != "MEDIA_NOT_VERIFIED" {
		t.Fatalf("unexpected result: %#v", result)
	}
}
