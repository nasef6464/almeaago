package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

// Embedded image options may be imported as AI-only text without visible
// options. The learner still needs a numbered, answerable choice per entry.
func TestEmbeddedAIOptionsMaterializeLabelOnlyChoices(t *testing.T) {
	repo := &repoStub{}
	v := baseVersion()
	v.TextContent = ""
	v.ImageAssetID = "image-1"
	v.OptionsEmbeddedInImage = true
	v.Explanation = "شرح"
	v.Options = nil
	v.AIContext = json.RawMessage(`{"optionTexts":["نص داخلي أ","نص داخلي ب","نص داخلي ج","نص داخلي د"]}`)
	_, err := NewService(repo).Create(context.Background(), actor(identity.RoleAdmin), CreateInput{QuestionCode: "IMAGE-AI-OPTIONS", Version: v})
	if err != nil {
		t.Fatalf("valid imported image question rejected: %v", err)
	}
	if len(repo.create.Version.Options) != 4 {
		t.Fatalf("expected 4 answerable choices, got %d", len(repo.create.Version.Options))
	}
	for i, option := range repo.create.Version.Options {
		if option.Index != i || option.Text != "" || option.AssetID != "" {
			t.Fatalf("choice %d must contain only its index: %+v", i, option)
		}
	}
}

func TestEmbeddedAIOptionsRejectInvalidCorrectIndex(t *testing.T) {
	v := baseVersion()
	v.ImageAssetID = "image-1"
	v.OptionsEmbeddedInImage = true
	v.Options = nil
	v.AIContext = json.RawMessage(`{"optionTexts":["داخلي أ","داخلي ب"]}`)
	wrong := 2
	v.CorrectOptionIndex = &wrong
	_, err := NewService(&repoStub{}).Create(context.Background(), actor(identity.RoleAdmin), CreateInput{QuestionCode: "INVALID-IMAGE-OPTIONS", Version: v})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("expected invalid correct answer index, got %v", err)
	}
}
