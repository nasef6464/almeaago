package application

import (
	"context"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	"testing"
)

type topicEntitlementRepo struct{ repoStub }

func (r *topicEntitlementRepo) GetLearnerTopic(context.Context, string) (content.LearnerTopic, error) {
	return content.LearnerTopic{PathID: "path", SubjectID: "subject", Topic: content.LearnerTopicSummary{ID: "topic", IsLocked: true}}, nil
}
func TestTopicLockReflectsFoundationEntitlement(t *testing.T) {
	repo := &topicEntitlementRepo{}
	access := &foundationAccessStub{}
	s := NewServiceWithAuthorScope(repo, repo, access)
	student := identity.User{ID: "student", Roles: []identity.Role{identity.RoleStudent}}
	denied, err := s.LearnerTopic(context.Background(), student, "topic")
	if err != nil || !denied.Topic.IsLocked {
		t.Fatalf("denied=%+v err=%v", denied, err)
	}
	access.allow = true
	allowed, err := s.LearnerTopic(context.Background(), student, "topic")
	if err != nil || allowed.Topic.IsLocked || access.path != "path" || access.subject != "subject" {
		t.Fatalf("allowed=%+v err=%v", allowed, err)
	}
	guest, err := s.LearnerTopic(context.Background(), identity.User{}, "topic")
	if err != nil || !guest.Topic.IsLocked {
		t.Fatalf("guest=%+v err=%v", guest, err)
	}
}
