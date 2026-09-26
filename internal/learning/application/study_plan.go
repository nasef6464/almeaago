package application

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

const (
	studyPlanMaxSubjects   = 50
	studyPlanMaxCourses    = 50
	studyPlanMaxCandidates = 100
	studyPlanMaxItems      = 160
	studyPlanMaxDays       = 180
)

type StudyPlanRepository interface {
	CreateStudyPlan(context.Context, string, learning.StudyPlanWrite, []learning.StudyPlanItemSeed) (learning.StudyPlan, error)
	ListStudyPlans(context.Context, string, string, learning.StudyPlanStatus, int, int) (learning.StudyPlanPage, error)
	GetStudyPlan(context.Context, string, string) (learning.StudyPlan, error)
	UpdateStudyPlan(context.Context, string, string, learning.StudyPlanPatch, []learning.StudyPlanItemSeed) (learning.StudyPlan, error)
	DeleteStudyPlan(context.Context, string, string) error
	CompletedStudyPlanLessons(context.Context, string, []learning.StudyPlanLessonRef) (map[string]bool, error)
}

type StudyPlanTaxonomyResolver interface {
	ValidateStudyPlanScope(context.Context, string, []string) (bool, error)
}

type StudyPlanContentResolver interface {
	ValidateStudyPlanCourses(context.Context, string, []string, []string) (bool, error)
	ListStudyPlanResources(context.Context, string, []string, []string, int) ([]content.StudyPlanResource, error)
}

type StudyPlanAssessmentResolver interface {
	ListStudyPlanResources(context.Context, string, string, []string, []string, int) ([]assessment.StudyPlanResource, error)
}

type StudyPlanService struct {
	repo        StudyPlanRepository
	taxonomy    StudyPlanTaxonomyResolver
	content     StudyPlanContentResolver
	assessments StudyPlanAssessmentResolver
}

func NewStudyPlanService(
	repo StudyPlanRepository,
	taxonomy StudyPlanTaxonomyResolver,
	contentResolver StudyPlanContentResolver,
	assessmentResolver StudyPlanAssessmentResolver,
) *StudyPlanService {
	return &StudyPlanService{
		repo: repo, taxonomy: taxonomy, content: contentResolver, assessments: assessmentResolver,
	}
}

func uniquePlanIDs(values []string, max int) ([]string, error) {
	if len(values) > max {
		return nil, ErrInvalidInput
	}
	seen := map[string]struct{}{}
	out := make([]string, 0, len(values))
	for _, raw := range values {
		value := strings.TrimSpace(raw)
		if value == "" {
			return nil, ErrInvalidInput
		}
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		out = append(out, value)
	}
	return out, nil
}

func normalizeStudyPlanWrite(write learning.StudyPlanWrite) (learning.StudyPlanWrite, error) {
	write.Name = strings.TrimSpace(write.Name)
	write.PathID = strings.TrimSpace(write.PathID)
	write.StartDate = strings.TrimSpace(write.StartDate)
	write.EndDate = strings.TrimSpace(write.EndDate)
	write.PreferredStartTime = strings.TrimSpace(write.PreferredStartTime)
	if write.Name == "" || len(write.Name) > 160 || write.PathID == "" {
		return write, ErrInvalidInput
	}
	var err error
	write.SubjectIDs, err = uniquePlanIDs(write.SubjectIDs, studyPlanMaxSubjects)
	if err != nil {
		return write, err
	}
	write.CourseIDs, err = uniquePlanIDs(write.CourseIDs, studyPlanMaxCourses)
	if err != nil {
		return write, err
	}
	start, err := time.Parse("2006-01-02", write.StartDate)
	if err != nil {
		return write, ErrInvalidInput
	}
	end, err := time.Parse("2006-01-02", write.EndDate)
	if err != nil || end.Before(start) || end.Sub(start) > studyPlanMaxDays*24*time.Hour {
		return write, ErrInvalidInput
	}
	if write.DailyMinutes == 0 {
		write.DailyMinutes = 90
	}
	if write.DailyMinutes < 15 || write.DailyMinutes > 240 {
		return write, ErrInvalidInput
	}
	if write.PreferredStartTime == "" {
		write.PreferredStartTime = "17:00"
	}
	if _, err = time.Parse("15:04", write.PreferredStartTime); err != nil {
		return write, ErrInvalidInput
	}
	if write.Status == "" {
		write.Status = learning.StudyPlanActive
	}
	if !learning.ValidStudyPlanStatus(write.Status) {
		return write, ErrInvalidInput
	}
	offSeen := map[learning.StudyPlanWeekday]struct{}{}
	offDays := make([]learning.StudyPlanWeekday, 0, len(write.OffDays))
	for _, day := range write.OffDays {
		if !learning.ValidStudyPlanWeekday(day) {
			return write, ErrInvalidInput
		}
		if _, ok := offSeen[day]; ok {
			continue
		}
		offSeen[day] = struct{}{}
		offDays = append(offDays, day)
	}
	if len(offDays) >= 7 {
		return write, ErrInvalidInput
	}
	write.OffDays = offDays
	return write, nil
}

func (s *StudyPlanService) validatePlanScope(ctx context.Context, write learning.StudyPlanWrite) error {
	if s.taxonomy == nil || s.content == nil {
		return ErrForbidden
	}
	ok, err := s.taxonomy.ValidateStudyPlanScope(ctx, write.PathID, write.SubjectIDs)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidInput
	}
	ok, err = s.content.ValidateStudyPlanCourses(ctx, write.PathID, write.SubjectIDs, write.CourseIDs)
	if err != nil {
		return err
	}
	if !ok {
		return ErrInvalidInput
	}
	return nil
}

func planWeekday(t time.Time) learning.StudyPlanWeekday {
	switch t.Weekday() {
	case time.Saturday:
		return learning.StudyPlanSaturday
	case time.Sunday:
		return learning.StudyPlanSunday
	case time.Monday:
		return learning.StudyPlanMonday
	case time.Tuesday:
		return learning.StudyPlanTuesday
	case time.Wednesday:
		return learning.StudyPlanWednesday
	case time.Thursday:
		return learning.StudyPlanThursday
	default:
		return learning.StudyPlanFriday
	}
}

func eligiblePlanDates(write learning.StudyPlanWrite) []string {
	start, _ := time.Parse("2006-01-02", write.StartDate)
	end, _ := time.Parse("2006-01-02", write.EndDate)
	off := map[learning.StudyPlanWeekday]struct{}{}
	for _, day := range write.OffDays {
		off[day] = struct{}{}
	}
	out := make([]string, 0, int(end.Sub(start)/(24*time.Hour))+1)
	for cursor := start; !cursor.After(end); cursor = cursor.AddDate(0, 0, 1) {
		if _, skip := off[planWeekday(cursor)]; skip {
			continue
		}
		out = append(out, cursor.Format("2006-01-02"))
	}
	return out
}

func planPhase(index, total int) learning.StudyPlanPhase {
	if total <= 2 {
		if index == total-1 {
			return learning.StudyPlanReview
		}
		return learning.StudyPlanPractice
	}
	if total <= 4 {
		if index == total-1 {
			return learning.StudyPlanReview
		}
		if index <= 1 {
			return learning.StudyPlanFoundation
		}
		return learning.StudyPlanPractice
	}
	ratio := float64(index+1) / float64(total)
	if ratio <= 0.55 {
		return learning.StudyPlanFoundation
	}
	if ratio <= 0.85 {
		return learning.StudyPlanPractice
	}
	return learning.StudyPlanReview
}

func addPlanMinutes(start string, minutes int) string {
	t, _ := time.Parse("15:04", start)
	t = t.Add(time.Duration(minutes) * time.Minute)
	return t.Format("15:04")
}

type planCandidate struct {
	itemType              learning.StudyPlanItemType
	subjectID             string
	lessonID              string
	courseID              string
	libraryItemID         string
	assessmentPlacementID string
	duration              int
	sortOrder             int
	completed             bool
	key                   string
}

func subjectRank(ids []string) map[string]int {
	out := make(map[string]int, len(ids))
	for i, id := range ids {
		out[id] = i
	}
	return out
}

func candidateTypeRank(phase learning.StudyPlanPhase, itemType learning.StudyPlanItemType) int {
	switch phase {
	case learning.StudyPlanFoundation:
		if itemType == learning.StudyPlanLesson {
			return 0
		}
		if itemType == learning.StudyPlanResource {
			return 1
		}
	case learning.StudyPlanPractice:
		if itemType == learning.StudyPlanAssessment {
			return 0
		}
		if itemType == learning.StudyPlanLesson {
			return 1
		}
	case learning.StudyPlanReview:
		if itemType == learning.StudyPlanAssessment {
			return 0
		}
		if itemType == learning.StudyPlanResource {
			return 1
		}
	}
	return 2
}

func (s *StudyPlanService) planCandidates(
	ctx context.Context,
	student string,
	write learning.StudyPlanWrite,
) ([]planCandidate, error) {
	if s.content == nil || s.assessments == nil {
		return nil, ErrForbidden
	}
	contentItems, err := s.content.ListStudyPlanResources(
		ctx, write.PathID, write.SubjectIDs, write.CourseIDs, studyPlanMaxCandidates,
	)
	if err != nil {
		return nil, err
	}
	assessmentItems, err := s.assessments.ListStudyPlanResources(
		ctx, student, write.PathID, write.SubjectIDs, write.CourseIDs, studyPlanMaxCandidates,
	)
	if err != nil {
		return nil, err
	}

	lessonRefs := make([]learning.StudyPlanLessonRef, 0, len(contentItems))
	for _, item := range contentItems {
		if item.Kind == content.StudyPlanLessonResource {
			lessonRefs = append(lessonRefs, learning.StudyPlanLessonRef{LessonID: item.ID, CourseID: item.CourseID})
		}
	}
	completedLessons, err := s.repo.CompletedStudyPlanLessons(ctx, student, lessonRefs)
	if err != nil {
		return nil, err
	}

	out := make([]planCandidate, 0, len(contentItems)+len(assessmentItems))
	for _, item := range contentItems {
		candidate := planCandidate{
			subjectID: item.SubjectID, courseID: item.CourseID, duration: item.DurationMinutes,
			sortOrder: item.SortOrder, key: string(item.Kind) + ":" + item.ID,
		}
		if item.Kind == content.StudyPlanLessonResource {
			candidate.itemType = learning.StudyPlanLesson
			candidate.lessonID = item.ID
			candidate.completed = completedLessons[item.ID+":"+item.CourseID]
		} else if item.Kind == content.StudyPlanLibraryResource {
			candidate.itemType = learning.StudyPlanResource
			candidate.libraryItemID = item.ID
		} else {
			continue
		}
		out = append(out, candidate)
	}
	for _, item := range assessmentItems {
		if write.SkipCompletedAssessments && item.Completed {
			continue
		}
		out = append(out, planCandidate{
			itemType: learning.StudyPlanAssessment, subjectID: item.SubjectID,
			courseID: item.CourseID, assessmentPlacementID: item.PlacementID,
			duration: item.DurationMinutes, sortOrder: item.SortOrder,
			completed: item.Completed, key: "assessment:" + item.PlacementID,
		})
	}
	return out, nil
}

func (s *StudyPlanService) generateItems(
	ctx context.Context,
	student string,
	write learning.StudyPlanWrite,
) ([]learning.StudyPlanItemSeed, error) {
	dates := eligiblePlanDates(write)
	if len(dates) == 0 {
		return nil, ErrInvalidInput
	}
	candidates, err := s.planCandidates(ctx, student, write)
	if err != nil {
		return nil, err
	}
	if len(candidates) == 0 {
		return []learning.StudyPlanItemSeed{}, nil
	}

	subjects := subjectRank(write.SubjectIDs)
	remaining := append([]planCandidate(nil), candidates...)
	items := make([]learning.StudyPlanItemSeed, 0, min(len(remaining), studyPlanMaxItems))
	globalOrder := 0
	for dayIndex, date := range dates {
		if len(remaining) == 0 || len(items) >= studyPlanMaxItems {
			break
		}
		phase := planPhase(dayIndex, len(dates))
		sort.SliceStable(remaining, func(i, j int) bool {
			if remaining[i].completed != remaining[j].completed {
				return !remaining[i].completed
			}
			ti := candidateTypeRank(phase, remaining[i].itemType)
			tj := candidateTypeRank(phase, remaining[j].itemType)
			if ti != tj {
				return ti < tj
			}
			ri, iok := subjects[remaining[i].subjectID]
			rj, jok := subjects[remaining[j].subjectID]
			if !iok {
				ri = 1 << 20
			}
			if !jok {
				rj = 1 << 20
			}
			if ri != rj {
				return ri < rj
			}
			if remaining[i].sortOrder != remaining[j].sortOrder {
				return remaining[i].sortOrder < remaining[j].sortOrder
			}
			return remaining[i].key < remaining[j].key
		})

		consumed := 0
		used := 0
		for len(remaining) > 0 && len(items) < studyPlanMaxItems {
			next := remaining[0]
			duration := next.duration
			if duration < 10 {
				duration = 10
			}
			if duration > write.DailyMinutes {
				duration = write.DailyMinutes
			}
			if consumed > 0 && consumed+duration > write.DailyMinutes {
				break
			}
			items = append(items, learning.StudyPlanItemSeed{
				SubjectID: next.subjectID, ItemType: next.itemType, LessonID: next.lessonID,
				CourseID: next.courseID, LibraryItemID: next.libraryItemID,
				AssessmentPlacementID: next.assessmentPlacementID,
				ScheduledDate: date, ScheduledTime: addPlanMinutes(write.PreferredStartTime, consumed),
				DurationMinutes: duration, Phase: phase, SortOrder: globalOrder,
			})
			globalOrder++
			consumed += duration
			remaining = remaining[1:]
			used++
			if consumed >= write.DailyMinutes || used >= 20 {
				break
			}
		}
	}
	return items, nil
}

func (s *StudyPlanService) Create(
	ctx context.Context,
	actor identity.User,
	write learning.StudyPlanWrite,
) (learning.StudyPlan, error) {
	if requireStudent(actor) != nil {
		return learning.StudyPlan{}, ErrForbidden
	}
	var err error
	write, err = normalizeStudyPlanWrite(write)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	if err = s.validatePlanScope(ctx, write); err != nil {
		return learning.StudyPlan{}, err
	}
	items, err := s.generateItems(ctx, actor.ID, write)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	plan, err := s.repo.CreateStudyPlan(ctx, actor.ID, write, items)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	return s.hydrate(ctx, actor.ID, plan)
}

func (s *StudyPlanService) List(
	ctx context.Context,
	actor identity.User,
	pathID string,
	status learning.StudyPlanStatus,
	page, limit int,
) (learning.StudyPlanPage, error) {
	if requireStudent(actor) != nil {
		return learning.StudyPlanPage{}, ErrForbidden
	}
	pathID = strings.TrimSpace(pathID)
	if pathID == "" {
		return learning.StudyPlanPage{}, ErrInvalidInput
	}
	if status == "" {
		status = learning.StudyPlanActive
	}
	if !learning.ValidStudyPlanStatus(status) {
		return learning.StudyPlanPage{}, ErrInvalidInput
	}
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return learning.StudyPlanPage{}, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}
	if s.taxonomy == nil {
		return learning.StudyPlanPage{}, ErrForbidden
	}
	ok, err := s.taxonomy.ValidateStudyPlanScope(ctx, pathID, nil)
	if err != nil {
		return learning.StudyPlanPage{}, err
	}
	if !ok {
		return learning.StudyPlanPage{}, ErrInvalidInput
	}
	return s.repo.ListStudyPlans(ctx, actor.ID, pathID, status, page, limit)
}

func (s *StudyPlanService) Get(ctx context.Context, actor identity.User, id string) (learning.StudyPlan, error) {
	if requireStudent(actor) != nil {
		return learning.StudyPlan{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return learning.StudyPlan{}, ErrInvalidInput
	}
	plan, err := s.repo.GetStudyPlan(ctx, actor.ID, id)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	return s.hydrate(ctx, actor.ID, plan)
}

func (s *StudyPlanService) Update(
	ctx context.Context,
	actor identity.User,
	id string,
	patch learning.StudyPlanPatch,
) (learning.StudyPlan, error) {
	if requireStudent(actor) != nil {
		return learning.StudyPlan{}, ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" || patch.ExpectedUpdatedAt.IsZero() {
		return learning.StudyPlan{}, ErrInvalidInput
	}
	write, err := normalizeStudyPlanWrite(patch.StudyPlanWrite)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	patch.StudyPlanWrite = write
	if err = s.validatePlanScope(ctx, write); err != nil {
		return learning.StudyPlan{}, err
	}
	items, err := s.generateItems(ctx, actor.ID, write)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	plan, err := s.repo.UpdateStudyPlan(ctx, actor.ID, id, patch, items)
	if err != nil {
		return learning.StudyPlan{}, err
	}
	return s.hydrate(ctx, actor.ID, plan)
}

func (s *StudyPlanService) Delete(ctx context.Context, actor identity.User, id string) error {
	if requireStudent(actor) != nil {
		return ErrForbidden
	}
	id = strings.TrimSpace(id)
	if id == "" {
		return ErrInvalidInput
	}
	return s.repo.DeleteStudyPlan(ctx, actor.ID, id)
}

func (s *StudyPlanService) hydrate(
	ctx context.Context,
	student string,
	plan learning.StudyPlan,
) (learning.StudyPlan, error) {
	contentItems, err := s.content.ListStudyPlanResources(
		ctx, plan.PathID, plan.SubjectIDs, plan.CourseIDs, studyPlanMaxCandidates,
	)
	if err != nil {
		return plan, err
	}
	assessmentItems, err := s.assessments.ListStudyPlanResources(
		ctx, student, plan.PathID, plan.SubjectIDs, plan.CourseIDs, studyPlanMaxCandidates,
	)
	if err != nil {
		return plan, err
	}
	contentByKey := map[string]content.StudyPlanResource{}
	for _, item := range contentItems {
		contentByKey[string(item.Kind)+":"+item.ID+":"+item.CourseID] = item
		if item.Kind == content.StudyPlanLibraryResource {
			contentByKey[string(item.Kind)+":"+item.ID+":"] = item
		}
	}
	assessmentByID := map[string]assessment.StudyPlanResource{}
	for _, item := range assessmentItems {
		assessmentByID[item.PlacementID] = item
	}
	refs := make([]learning.StudyPlanLessonRef, 0)
	for _, item := range plan.Items {
		if item.ItemType == learning.StudyPlanLesson {
			refs = append(refs, learning.StudyPlanLessonRef{LessonID: item.LessonID, CourseID: item.CourseID})
		}
	}
	completedLessons, err := s.repo.CompletedStudyPlanLessons(ctx, student, refs)
	if err != nil {
		return plan, err
	}
	for i := range plan.Items {
		item := &plan.Items[i]
		item.Available = false
		switch item.ItemType {
		case learning.StudyPlanLesson:
			if resource, ok := contentByKey["lesson:"+item.LessonID+":"+item.CourseID]; ok {
				item.Title = resource.Title
				item.Completed = completedLessons[item.LessonID+":"+item.CourseID]
				item.Available = true
			}
		case learning.StudyPlanResource:
			if resource, ok := contentByKey["resource:"+item.LibraryItemID+":"]; ok {
				item.Title = resource.Title
				item.ExternalURL = resource.ExternalURL
				item.Available = true
			}
		case learning.StudyPlanAssessment:
			if resource, ok := assessmentByID[item.AssessmentPlacementID]; ok {
				item.Title = resource.Title
				item.Completed = resource.Completed
				item.Available = resource.CanStart || resource.Completed
				item.AssessmentSlot = string(resource.Slot)
			}
		}
		if item.Title == "" {
			item.Title = fmt.Sprintf("مهمة %d", item.SortOrder+1)
		}
	}
	return plan, nil
}

func ParseStudyPlanTime(value string) (int, int, error) {
	t, err := time.Parse("15:04", strings.TrimSpace(value))
	if err != nil {
		return 0, 0, ErrInvalidInput
	}
	hour, _ := strconv.Atoi(t.Format("15"))
	minute, _ := strconv.Atoi(t.Format("04"))
	return hour, minute, nil
}
