package application

import (
	"context"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"regexp"
	"strconv"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

var (
	ErrForbidden    = errors.New("reporting operation forbidden")
	ErrInvalidInput = errors.New("invalid reporting request")
	ErrTooLarge     = errors.New("reporting export too large")
)

const (
	DefaultStudentLimit = 500
	DefaultResultLimit  = 2000
	DefaultAttemptLimit = 3000
	MaxStudentLimit     = 1000
	MaxResultLimit      = 5000
	MaxAttemptLimit     = 5000
	MaxPageLimit        = 100
	MaxExportRows       = 5000
)

var uuidPattern = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$`)

type Repository interface {
	ResolveScope(context.Context, identity.User, reporting.Query) (reporting.ResolvedScope, error)
	Overview(context.Context, reporting.ResolvedScope, reporting.Query) (reporting.Overview, error)
	Results(context.Context, reporting.ResolvedScope, reporting.Query, int, int) (reporting.ResultPage, error)
	ExportResults(context.Context, reporting.ResolvedScope, reporting.Query, int) ([]reporting.ResultItem, int, error)
}

type Service struct {
	repo Repository
	now  func() time.Time
}

func NewService(repo Repository) *Service {
	return &Service{repo: repo, now: time.Now}
}

func normalizeQuery(input reporting.Query) (reporting.Query, error) {
	input.SchoolID = strings.TrimSpace(input.SchoolID)
	input.ClassID = strings.TrimSpace(input.ClassID)
	input.PathID = strings.TrimSpace(input.PathID)
	input.SubjectID = strings.TrimSpace(input.SubjectID)
	for _, value := range []string{input.SchoolID, input.ClassID, input.PathID, input.SubjectID} {
		if value != "" && !uuidPattern.MatchString(value) {
			return reporting.Query{}, ErrInvalidInput
		}
	}
	if input.ClassID != "" && input.SchoolID == "" {
		return reporting.Query{}, ErrInvalidInput
	}
	if input.StudentLimit == 0 {
		input.StudentLimit = DefaultStudentLimit
	}
	if input.ResultLimit == 0 {
		input.ResultLimit = DefaultResultLimit
	}
	if input.AttemptLimit == 0 {
		input.AttemptLimit = DefaultAttemptLimit
	}
	if input.StudentLimit < 1 || input.StudentLimit > MaxStudentLimit ||
		input.ResultLimit < 1 || input.ResultLimit > MaxResultLimit ||
		input.AttemptLimit < 1 || input.AttemptLimit > MaxAttemptLimit {
		return reporting.Query{}, ErrInvalidInput
	}
	return input, nil
}

func ensureSupportedActor(actor identity.User) error {
	if strings.TrimSpace(actor.ID) == "" {
		return ErrForbidden
	}
	if actor.HasRole(identity.RoleAdmin) ||
		actor.HasRole(identity.RoleSchoolAdmin) ||
		actor.HasRole(identity.RoleSupervisor) ||
		actor.HasRole(identity.RoleTeacher) ||
		actor.HasRole(identity.RoleStudent) {
		return nil
	}
	return ErrForbidden
}

func (s *Service) Overview(
	ctx context.Context,
	actor identity.User,
	input reporting.Query,
) (reporting.Overview, error) {
	if err := ensureSupportedActor(actor); err != nil {
		return reporting.Overview{}, err
	}
	input, err := normalizeQuery(input)
	if err != nil {
		return reporting.Overview{}, err
	}
	scope, err := s.repo.ResolveScope(ctx, actor, input)
	if err != nil {
		return reporting.Overview{}, err
	}
	return s.repo.Overview(ctx, scope, input)
}

func (s *Service) Results(
	ctx context.Context,
	actor identity.User,
	input reporting.Query,
	page, limit int,
) (reporting.ResultPage, error) {
	if err := ensureSupportedActor(actor); err != nil {
		return reporting.ResultPage{}, err
	}
	input, err := normalizeQuery(input)
	if err != nil {
		return reporting.ResultPage{}, err
	}
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if page > 10000 || limit > MaxPageLimit {
		return reporting.ResultPage{}, ErrInvalidInput
	}
	scope, err := s.repo.ResolveScope(ctx, actor, input)
	if err != nil {
		return reporting.ResultPage{}, err
	}
	if !scope.CanDetail {
		return reporting.ResultPage{}, ErrForbidden
	}
	return s.repo.Results(ctx, scope, input, page, limit)
}

func (s *Service) ExportCSV(
	ctx context.Context,
	actor identity.User,
	input reporting.Query,
	writer io.Writer,
) (int, error) {
	if err := ensureSupportedActor(actor); err != nil {
		return 0, err
	}
	input, err := normalizeQuery(input)
	if err != nil {
		return 0, err
	}
	scope, err := s.repo.ResolveScope(ctx, actor, input)
	if err != nil {
		return 0, err
	}
	if !scope.CanExport {
		return 0, ErrForbidden
	}
	rows, total, err := s.repo.ExportResults(ctx, scope, input, MaxExportRows+1)
	if err != nil {
		return 0, err
	}
	if total > MaxExportRows || len(rows) > MaxExportRows {
		return total, ErrTooLarge
	}
	csvWriter := csv.NewWriter(writer)
	if err = csvWriter.Write([]string{
		"attempt_id","student_id","student_name","assessment_id","assessment_version","title",
		"path_id","subject_id","score","passed","correct","wrong","unanswered","time_spent_seconds","finalized_at",
	}); err != nil {
		return 0, err
	}
	for _, row := range rows {
		record := []string{
			row.AttemptID,row.StudentID,row.StudentName,row.AssessmentID,strconv.Itoa(row.AssessmentVersion),row.Title,
			row.PathID,row.SubjectID,fmt.Sprintf("%.3f",row.Score),strconv.FormatBool(row.Passed),
			strconv.Itoa(row.CorrectAnswers),strconv.Itoa(row.WrongAnswers),strconv.Itoa(row.Unanswered),
			strconv.Itoa(row.TimeSpentSeconds),row.FinalizedAt.UTC().Format(time.RFC3339),
		}
		if err = csvWriter.Write(record); err != nil {
			return 0, err
		}
	}
	csvWriter.Flush()
	if err = csvWriter.Error(); err != nil {
		return 0, err
	}
	return total, nil
}
