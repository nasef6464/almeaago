package contenthttp

import (
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

func TestPresentLearnerTopicCarriesActualScope(t *testing.T) {
	got := presentLearnerTopic(content.LearnerTopic{PathID: "path-a", SubjectID: "subject-a", Topic: content.LearnerTopicSummary{ID: "topic-a"}})
	if got["id"] != "topic-a" || got["pathId"] != "path-a" || got["subjectId"] != "subject-a" {
		t.Fatalf("learner topic scope missing from response: %+v", got)
	}
}

func TestPresentLearnerTopicKeepsPriceClassSeparateFromAccess(t *testing.T) {
	paidUnlocked := presentLearnerTopicSummary(content.LearnerTopicSummary{ID: "paid", IsFree: false, IsLocked: false})
	free := presentLearnerTopicSummary(content.LearnerTopicSummary{ID: "free", IsFree: true, IsLocked: false})
	if paidUnlocked["isFree"] != false || paidUnlocked["isLocked"] != false || free["isFree"] != true {
		t.Fatalf("incorrect topic price/access projection: paid=%+v free=%+v", paidUnlocked, free)
	}
}
