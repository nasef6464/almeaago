// Package application coordinates public preview readers; publication and access
// policy remain owned by Content and Questionbank, not this aggregator.
package application

import (
	"context"
	"errors"
	content "github.com/nasef6464/almeaago/internal/content/domain"
	discovery "github.com/nasef6464/almeaago/internal/discovery/domain"
	question "github.com/nasef6464/almeaago/internal/questionbank/domain"
	"net/url"
	"strings"
	"unicode/utf16"
)

var ErrInvalidInput = errors.New("invalid search query")

type ContentReader interface {
	SearchPublicCourses(context.Context, string, int) ([]content.PublicSearchPreview, error)
	SearchPublicLessons(context.Context, string, int) ([]content.PublicSearchPreview, error)
}
type QuestionReader interface {
	SearchPublicQuestions(context.Context, string, int) ([]question.PublicSearchPreview, error)
}
type Service struct {
	content   ContentReader
	questions QuestionReader
}

func NewService(content ContentReader, questions QuestionReader) *Service {
	return &Service{content: content, questions: questions}
}
func (s *Service) Search(ctx context.Context, in discovery.Query) (discovery.Payload, error) {
	in.Q = strings.TrimSpace(in.Q)
	if size := len(utf16.Encode([]rune(in.Q))); size < 1 || size > 120 || in.Limit < 1 || in.Limit > 20 {
		return discovery.Payload{}, ErrInvalidInput
	}
	switch in.Type {
	case "all", "course", "lesson", "question":
	default:
		return discovery.Payload{}, ErrInvalidInput
	}
	out := discovery.Payload{Q: in.Q, Type: in.Type, Results: discovery.Results{Courses: []discovery.Result{}, Lessons: []discovery.Result{}, Questions: []discovery.Result{}}}
	if in.Type == "all" || in.Type == "course" {
		rows, err := s.content.SearchPublicCourses(ctx, in.Q, in.Limit)
		if err != nil {
			return discovery.Payload{}, err
		}
		for _, row := range rows {
			out.Results.Courses = append(out.Results.Courses, discovery.Result{ID: row.ID, Title: row.Title, Subtitle: row.Subtitle, Route: "/course/" + url.PathEscape(row.ID), PathID: row.PathID, SubjectID: row.SubjectID})
		}
	}
	if in.Type == "all" || in.Type == "lesson" {
		rows, err := s.content.SearchPublicLessons(ctx, in.Q, in.Limit)
		if err != nil {
			return discovery.Payload{}, err
		}
		for _, row := range rows {
			route := "/dashboard"
			if row.PathID != "" && row.SubjectID != "" {
				route = categoryRoute(row.PathID, row.SubjectID)
			}
			section := ""
			out.Results.Lessons = append(out.Results.Lessons, discovery.Result{ID: row.ID, Title: row.Title, Subtitle: row.Subtitle, Route: route, PathID: row.PathID, SubjectID: row.SubjectID, SectionID: &section})
		}
	}
	if in.Type == "all" || in.Type == "question" {
		rows, err := s.questions.SearchPublicQuestions(ctx, in.Q, in.Limit)
		if err != nil {
			return discovery.Payload{}, err
		}
		for _, row := range rows {
			route := "/quizzes"
			if row.PathID != "" && row.SubjectID != "" {
				route = categoryRoute(row.PathID, row.SubjectID) + "&tab=tests"
			}
			section := ""
			out.Results.Questions = append(out.Results.Questions, discovery.Result{ID: row.ID, Title: row.Title, Subtitle: row.Subtitle, Route: route, PathID: row.PathID, SubjectID: row.SubjectID, SectionID: &section})
		}
	}
	return out, nil
}
func categoryRoute(pathID, subjectID string) string {
	return "/category/" + url.PathEscape(pathID) + "?subject=" + strings.ReplaceAll(url.QueryEscape(subjectID), "+", "%20")
}
