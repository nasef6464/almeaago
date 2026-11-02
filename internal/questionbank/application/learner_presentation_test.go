package application

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
)

func TestImageOnlyChoicesKeepSeparateEmptyTextAndPresentation(t *testing.T) {
	repo := &repoStub{}
	v := baseVersion()
	v.TextContent = ""
	v.ImageAssetID = "image-1"
	v.OptionsEmbeddedInImage = true
	v.Explanation = "شرح"
	v.Options = []OptionInput{{}, {}, {}, {}}
	v.SourceMeta = json.RawMessage(`{"learnerPresentation":{"questionNumber":"٣","showQuestionNumber":false,"optionLabelStyle":"latin","optionLabels":["A","B","C","D"]}}`)
	_, err := NewService(repo).Create(context.Background(), actor(identity.RoleAdmin), CreateInput{QuestionCode: "LABELS", Version: v})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.create.Version.Options) != 4 || repo.create.Version.Options[0].Text != "" {
		t.Fatalf("text/labels not separate: %+v", repo.create.Version.Options)
	}
	row := question.Question{Version: question.QuestionVersion{QuestionType: question.QuestionMCQ, ImageAssetID: "image-1", Explanation: "شرح", OptionsEmbeddedInImage: true, CorrectOptionIndex: v.CorrectOptionIndex}, Options: repo.create.Version.Options}
	if err = validatePublishable(row); err != nil {
		t.Fatal(err)
	}
}

func TestTextQuestionAcceptsExplicitLabelOnlyChoices(t *testing.T) {
	repo := &repoStub{}
	v := baseVersion()
	v.Options = []OptionInput{{}, {}, {}, {}}
	v.SourceMeta = json.RawMessage(`{"learnerPresentation":{"showOptionLabels":true,"showOptionText":false,"optionLabelStyle":"latin"}}`)
	_, err := NewService(repo).Create(context.Background(), actor(identity.RoleAdmin), CreateInput{QuestionCode: "LABELS-ONLY", Version: v})
	if err != nil || len(repo.create.Version.Options) != 4 || repo.create.Version.Options[0].Text != "" {
		t.Fatalf("label only choices rejected: %+v %v", repo.create.Version.Options, err)
	}
}

func TestRejectEmptyTextOutsideEmbeddedImageAndInvisibleChoices(t *testing.T) {
	for _, tc := range []struct {
		name  string
		setup func(*VersionInput)
	}{
		{"empty text without image", func(v *VersionInput) { v.Options = []OptionInput{{}, {Text: "2"}} }},
		{"labels and text both hidden", func(v *VersionInput) {
			v.SourceMeta = json.RawMessage(`{"learnerPresentation":{"showOptionLabels":false,"showOptionText":false}}`)
		}},
		{"embedded choices with hidden labels and empty text", func(v *VersionInput) {
			v.ImageAssetID = "image"
			v.OptionsEmbeddedInImage = true
			v.Options = []OptionInput{{}, {}}
			v.SourceMeta = json.RawMessage(`{"learnerPresentation":{"showOptionLabels":false,"showOptionText":true}}`)
		}},
		{"invalid label style", func(v *VersionInput) {
			v.SourceMeta = json.RawMessage(`{"learnerPresentation":{"optionLabelStyle":"other"}}`)
		}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			v := baseVersion()
			tc.setup(&v)
			_, err := NewService(&repoStub{}).Create(context.Background(), actor(identity.RoleAdmin), CreateInput{QuestionCode: "TEST", Version: v})
			if !errors.Is(err, ErrInvalidInput) {
				t.Fatalf("expected invalid input: %v", err)
			}
		})
	}
}
