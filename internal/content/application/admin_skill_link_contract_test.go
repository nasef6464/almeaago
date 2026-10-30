package application

import (
	"context"
	"errors"
	"reflect"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
)

// These contracts are consumed by the admin library/foundation editors.
// A delayed taxonomy read must not turn a persisted skill list into an
// implicit unlink request. The backend must reject empty links and preserve
// the explicit list through application -> repository.
type adminSkillLinkRepo struct {
	*repoStub
	library         content.LibraryItem
	topic           content.FoundationTopic
	savedLibrary    content.LibraryWrite
	savedTopic      content.TopicWrite
	libraryRevision int
	topicRevision   int
}

func (r *adminSkillLinkRepo) GetLibraryItem(context.Context, string) (content.LibraryItem, error) {
	return r.library, nil
}
func (r *adminSkillLinkRepo) UpdateLibraryItem(_ context.Context, _, _ string, revision int, write content.LibraryWrite) (content.LibraryItem, error) {
	r.savedLibrary = write
	r.libraryRevision = revision
	return content.LibraryItem{SkillIDs: write.SkillIDs}, nil
}
func (r *adminSkillLinkRepo) GetTopic(context.Context, string) (content.FoundationTopic, error) {
	return r.topic, nil
}
func (r *adminSkillLinkRepo) UpdateTopic(_ context.Context, _, _ string, revision int, write content.TopicWrite) (content.FoundationTopic, error) {
	r.savedTopic = write
	r.topicRevision = revision
	return content.FoundationTopic{SkillIDs: write.SkillIDs}, nil
}

func TestAdminLibraryAndFoundationSkillLinkRoundTrip(t *testing.T) {
	actor := staffActor(identity.RoleAdmin)
	links := []string{"skill-1", "skill-2"}
	repo := &adminSkillLinkRepo{
		repoStub: &repoStub{},
		library: content.LibraryItem{
			ID: "library-1", PathID: "path-1", SubjectID: "subject-1",
			OwnerType: content.OwnerPlatform, WorkflowStatus: content.WorkflowDraft,
			SkillIDs: links,
		},
		topic: content.FoundationTopic{
			ID: "topic-1", PathID: "path-1", SubjectID: "subject-1",
			Code: "FOUND-1", Status: content.TopicActive, SkillIDs: links,
		},
	}
	service := NewService(repo)

	libInput := UpdateLibraryInput{
		ExpectedRevision: 4,
		LibraryInput: LibraryInput{
			PathID: "path-1", SubjectID: "subject-1", Title: "ملخص الأعداد",
			ItemType: content.LibraryLink, ExternalURL: "https://example.com/file",
			SkillIDs: links,
		},
	}
	library, err := service.UpdateLibraryItem(context.Background(), actor, "library-1", libInput)
	if err != nil {
		t.Fatalf("library update failed: %v", err)
	}
	if repo.libraryRevision != 4 || !reflect.DeepEqual(repo.savedLibrary.SkillIDs, links) || !reflect.DeepEqual(library.SkillIDs, links) {
		t.Fatalf("library skill links or revision lost: revision=%d write=%v response=%v", repo.libraryRevision, repo.savedLibrary.SkillIDs, library.SkillIDs)
	}

	topicInput := UpdateTopicInput{
		ExpectedRevision: 7,
		TopicInput: TopicInput{
			PathID: "path-1", SubjectID: "subject-1", Code: "FOUND-1",
			Title: "تأسيس الأعداد", Status: content.TopicActive,
			SkillIDs: links,
		},
	}
	topic, err := service.UpdateTopic(context.Background(), actor, "topic-1", topicInput)
	if err != nil {
		t.Fatalf("foundation update failed: %v", err)
	}
	if repo.topicRevision != 7 || !reflect.DeepEqual(repo.savedTopic.SkillIDs, links) || !reflect.DeepEqual(topic.SkillIDs, links) {
		t.Fatalf("foundation skill links or revision lost: revision=%d write=%v response=%v", repo.topicRevision, repo.savedTopic.SkillIDs, topic.SkillIDs)
	}

	// Missing links are not interpreted as a safe no-op by the write API.
	// The UI must wait for taxonomy before submitting, not send [].
	libInput.SkillIDs = nil
	if _, err := service.UpdateLibraryItem(context.Background(), actor, "library-1", libInput); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty library skill links must be rejected: %v", err)
	}
	topicInput.SkillIDs = nil
	if _, err := service.UpdateTopic(context.Background(), actor, "topic-1", topicInput); !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("empty foundation skill links must be rejected: %v", err)
	}
}
