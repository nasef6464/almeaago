package application

import (
	"context"
	"errors"
	"strings"
	"time"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
	parents "github.com/nasef6464/almeaago/internal/parents/domain"
)

var (
	ErrForbidden    = errors.New("parent operation forbidden")
	ErrInvalidInput = errors.New("invalid parent request")
)

type AuthorityResolver interface {
	ParentAuthority(context.Context, identity.User) (org.ParentAuthority, error)
}

type StudentDirectory interface {
	ParentStudentProfiles(context.Context, []string) ([]identity.ParentStudentProfile, error)
}

type AssessmentReader interface {
	ParentStudentAssessmentSnapshots(context.Context, []string, time.Time, int) (map[string]assessment.ParentStudentAssessmentSnapshot, error)
	ParentStudentResults(context.Context, string, int, int) (assessment.ParentResultPage, error)
}

type LearningReader interface {
	ParentStudentLearningSnapshots(context.Context, []string, int) (map[string]learning.ParentStudentLearningSnapshot, error)
}

type Service struct {
	authority AuthorityResolver
	students  StudentDirectory
	assess    AssessmentReader
	learning  LearningReader
	now       func() time.Time
}

func NewService(authority AuthorityResolver, students StudentDirectory, assess AssessmentReader, learningReader LearningReader) *Service {
	return &Service{authority: authority, students: students, assess: assess, learning: learningReader, now: time.Now}
}

func normalizePage(page, limit int) (int, int, error) {
	if page < 1 {
		page = 1
	}
	if page > 10000 {
		return 0, 0, ErrInvalidInput
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return page, limit, nil
}

func (s *Service) authorityFor(ctx context.Context, actor identity.User) (org.ParentAuthority, error) {
	if strings.TrimSpace(actor.ID) == "" || !actor.HasRole(identity.RoleParent) {
		return org.ParentAuthority{}, ErrForbidden
	}
	if s.authority == nil {
		return org.ParentAuthority{}, errors.New("parent authority resolver is not configured")
	}
	return s.authority.ParentAuthority(ctx, actor)
}

type relationshipScope struct {
	studentID string
	schoolIDs []string
}

func relationshipScopes(authority org.ParentAuthority) []relationshipScope {
	out := make([]relationshipScope, 0, len(authority.Relationships))
	index := make(map[string]int, len(authority.Relationships))
	for _, row := range authority.Relationships {
		studentID := strings.TrimSpace(row.StudentID)
		if studentID == "" || row.Status != "active" {
			continue
		}
		i, exists := index[studentID]
		if !exists {
			index[studentID] = len(out)
			out = append(out, relationshipScope{studentID: studentID, schoolIDs: []string{}})
			i = len(out) - 1
		}
		schoolID := strings.TrimSpace(row.SchoolID)
		if schoolID == "" {
			continue
		}
		seen := false
		for _, existing := range out[i].schoolIDs {
			if existing == schoolID {
				seen = true
				break
			}
		}
		if !seen {
			out[i].schoolIDs = append(out[i].schoolIDs, schoolID)
		}
	}
	return out
}

func pageScopes(scopes []relationshipScope, page, limit int) ([]relationshipScope, bool) {
	start := (page - 1) * limit
	if start >= len(scopes) {
		return []relationshipScope{}, false
	}
	end := start + limit
	hasMore := end < len(scopes)
	if end > len(scopes) {
		end = len(scopes)
	}
	return scopes[start:end], hasMore
}

func scopeIDs(scopes []relationshipScope) []string {
	ids := make([]string, 0, len(scopes))
	for _, scope := range scopes {
		ids = append(ids, scope.studentID)
	}
	return ids
}

func profileMap(rows []identity.ParentStudentProfile) map[string]identity.ParentStudentProfile {
	out := make(map[string]identity.ParentStudentProfile, len(rows))
	for _, row := range rows {
		out[row.ID] = row
	}
	return out
}

func (s *Service) Authority(ctx context.Context, actor identity.User) (org.ParentAuthority, error) {
	return s.authorityFor(ctx, actor)
}

func (s *Service) Dashboard(ctx context.Context, actor identity.User, page, limit int) (parents.Dashboard, error) {
	page, limit, err := normalizePage(page, limit)
	if err != nil {
		return parents.Dashboard{}, err
	}
	authority, err := s.authorityFor(ctx, actor)
	if err != nil {
		return parents.Dashboard{}, err
	}
	allScopes := relationshipScopes(authority)
	selected, hasMore := pageScopes(allScopes, page, limit)
	out := parents.Dashboard{
		Children: []parents.ChildSummary{},
		Summary: parents.DashboardSummary{TotalChildren: len(allScopes)},
		Page: page, Limit: limit, HasMore: hasMore,
	}
	if len(selected) == 0 {
		return out, nil
	}
	ids := scopeIDs(selected)
	profiles, err := s.students.ParentStudentProfiles(ctx, ids)
	if err != nil {
		return parents.Dashboard{}, err
	}
	assessmentRows, err := s.assess.ParentStudentAssessmentSnapshots(ctx, ids, s.now().UTC().Add(-7*24*time.Hour), 3)
	if err != nil {
		return parents.Dashboard{}, err
	}
	learningRows, err := s.learning.ParentStudentLearningSnapshots(ctx, ids, 5)
	if err != nil {
		return parents.Dashboard{}, err
	}
	profilesByID := profileMap(profiles)
	weightedScore := 0.0
	for _, scope := range selected {
		profile, ok := profilesByID[scope.studentID]
		if !ok {
			continue
		}
		a := assessmentRows[scope.studentID]
		l := learningRows[scope.studentID]
		child := parents.ChildSummary{
			LinkedStudent: parents.LinkedStudent{
				StudentID: scope.studentID, Name: profile.Name, AvatarURL: profile.AvatarURL, SchoolIDs: scope.schoolIDs,
			},
			WeeklyStudyMinutes: (a.WeeklyStudySeconds + 30) / 60,
			WeeklyAssessmentCount: a.WeeklyAssessmentCount,
			WeeklyAverageScore: a.WeeklyAverageScore,
			RecentResults: a.RecentResults,
			WeakSkills: l.WeakSkills,
		}
		if len(l.WeakSkills) > 0 {
			child.NextAction = l.WeakSkills[0].RecommendedAction
		}
		out.Children = append(out.Children, child)
		out.Summary.WeeklyAssessmentCount += a.WeeklyAssessmentCount
		out.Summary.WeakSkills += len(l.WeakSkills)
		weightedScore += a.WeeklyAverageScore * float64(a.WeeklyAssessmentCount)
	}
	out.Summary.VisibleChildren = len(out.Children)
	if out.Summary.WeeklyAssessmentCount > 0 {
		out.Summary.WeeklyAverageScore = weightedScore / float64(out.Summary.WeeklyAssessmentCount)
	}
	return out, nil
}

func (s *Service) Results(ctx context.Context, actor identity.User, studentID string, page, limit int) (assessment.ParentResultPage, error) {
	page, limit, err := normalizePage(page, limit)
	if err != nil {
		return assessment.ParentResultPage{}, err
	}
	studentID = strings.TrimSpace(studentID)
	if studentID == "" {
		return assessment.ParentResultPage{}, ErrInvalidInput
	}
	authority, err := s.authorityFor(ctx, actor)
	if err != nil {
		return assessment.ParentResultPage{}, err
	}
	allowed := false
	for _, scope := range relationshipScopes(authority) {
		if scope.studentID == studentID {
			allowed = true
			break
		}
	}
	if !allowed {
		return assessment.ParentResultPage{}, ErrForbidden
	}
	return s.assess.ParentStudentResults(ctx, studentID, page, limit)
}

func (s *Service) WeeklyReport(ctx context.Context, actor identity.User, page, limit int) (parents.WeeklyReport, error) {
	page, limit, err := normalizePage(page, limit)
	if err != nil {
		return parents.WeeklyReport{}, err
	}
	authority, err := s.authorityFor(ctx, actor)
	if err != nil {
		return parents.WeeklyReport{}, err
	}
	allScopes := relationshipScopes(authority)
	selected, hasMore := pageScopes(allScopes, page, limit)
	end := s.now().UTC()
	start := end.Add(-7 * 24 * time.Hour)
	out := parents.WeeklyReport{
		PeriodStart: start, PeriodEnd: end, Children: []parents.WeeklyChildReport{},
		Page: page, Limit: limit, HasMore: hasMore,
	}
	if len(selected) == 0 {
		return out, nil
	}
	ids := scopeIDs(selected)
	profiles, err := s.students.ParentStudentProfiles(ctx, ids)
	if err != nil {
		return parents.WeeklyReport{}, err
	}
	assessmentRows, err := s.assess.ParentStudentAssessmentSnapshots(ctx, ids, start, 1)
	if err != nil {
		return parents.WeeklyReport{}, err
	}
	learningRows, err := s.learning.ParentStudentLearningSnapshots(ctx, ids, 3)
	if err != nil {
		return parents.WeeklyReport{}, err
	}
	profilesByID := profileMap(profiles)
	for _, scope := range selected {
		profile, ok := profilesByID[scope.studentID]
		if !ok {
			continue
		}
		a := assessmentRows[scope.studentID]
		l := learningRows[scope.studentID]
		row := parents.WeeklyChildReport{
			LinkedStudent: parents.LinkedStudent{
				StudentID: scope.studentID, Name: profile.Name, AvatarURL: profile.AvatarURL, SchoolIDs: scope.schoolIDs,
			},
			AssessmentCount: a.WeeklyAssessmentCount,
			AverageScore: a.WeeklyAverageScore,
			StudyMinutes: (a.WeeklyStudySeconds + 30) / 60,
			WeakSkills: l.WeakSkills,
		}
		if len(l.WeakSkills) > 0 {
			row.NextAction = l.WeakSkills[0].RecommendedAction
		}
		out.Children = append(out.Children, row)
	}
	return out, nil
}
