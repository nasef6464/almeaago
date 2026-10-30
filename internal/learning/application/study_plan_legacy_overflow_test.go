package application

import (
    "context"
    "fmt"
    "testing"

    content "github.com/nasef6464/almeaago/internal/content/domain"
    learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

// Legacy utils/studentPlanSchedule.ts schedules the full duration of the first
// task even if it exceeds the daily budget, and appends unfinished tasks to the
// last eligible day. Do not silently discard study tasks on a short plan.
func TestStudyPlanPreservesLastDayOverflowAndOriginalDurations(t *testing.T) {
    write := validPlanWrite()
    write.StartDate = "2026-09-26"
    write.EndDate = "2026-09-26"
    write.DailyMinutes = 15
    resources := []content.StudyPlanResource{
        {Kind: content.StudyPlanLessonResource, ID: "lesson-a", CourseID: "course-1", SubjectID: "subject-1", DurationMinutes: 30, SortOrder: 1},
        {Kind: content.StudyPlanLessonResource, ID: "lesson-b", CourseID: "course-1", SubjectID: "subject-1", DurationMinutes: 20, SortOrder: 2},
        {Kind: content.StudyPlanLessonResource, ID: "lesson-c", CourseID: "course-1", SubjectID: "subject-1", DurationMinutes: 10, SortOrder: 3},
    }
    s := NewStudyPlanService(&studyPlanRepoStub{}, studyPlanTaxonomyStub{ok:true}, studyPlanContentStub{ok:true,items:resources}, studyPlanAssessmentStub{})
    items, err := s.generateItems(context.Background(), "student-1", write)
    if err != nil { t.Fatal(err) }
    if len(items) != 3 { t.Fatalf("Legacy keeps all 3 tasks on the last date; got %d: %#v", len(items), items) }
    wantTimes := []string{"17:00", "17:30", "17:50"}
    wantDurations := []int{30, 20, 10}
    for i, item := range items {
        if item.ScheduledDate != write.EndDate || item.ScheduledTime != wantTimes[i] || item.DurationMinutes != wantDurations[i] || item.SortOrder != i {
            t.Fatalf("task %d should retain Legacy date/time/duration/order: %#v", i, item)
        }
    }
}

func TestStudyPlanOverflowKeepsSafetyCap(t *testing.T) {
    write := validPlanWrite()
    write.StartDate = "2026-09-26"
    write.EndDate = "2026-09-26"
    write.DailyMinutes = 15
    resources := make([]content.StudyPlanResource, 0, 100)
    for i := 0; i < 100; i++ {
        resources = append(resources, content.StudyPlanResource{
            Kind: content.StudyPlanLessonResource, ID: fmt.Sprintf("lesson-%03d", i),
            CourseID: "course-1", SubjectID: "subject-1", DurationMinutes: 15, SortOrder: i,
        })
    }
    s := NewStudyPlanService(&studyPlanRepoStub{}, studyPlanTaxonomyStub{ok:true}, studyPlanContentStub{ok:true,items:resources}, studyPlanAssessmentStub{})
    items, err := s.generateItems(context.Background(), "student-1", write)
    if err != nil { t.Fatal(err) }
    if len(items) != 100 { t.Fatalf("expected 100 eligible lessons without silent loss, got %d", len(items)) }
    if len(items) > studyPlanMaxItems { t.Fatalf("exceeded safe bound: %d", len(items)) }
    for i, item := range items {
        if item.ScheduledDate != write.EndDate || item.SortOrder != i {
            t.Fatalf("task %d is not ordered on final date: %#v", i, item)
        }
    }
}

var _ = learning.StudyPlanLesson
