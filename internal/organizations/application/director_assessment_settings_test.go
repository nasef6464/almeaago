package application

import (
	"context"
	"errors"
	"testing"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

func TestDirectorAssessmentSettingsValidation(t *testing.T) {
	const school = "00000000-0000-0000-0000-000000000101"
	base := org.DirectorAssessmentCreate{Title: "اختبار موحد", TargetScope: "school", PathID: "00000000-0000-0000-0000-000000000201", SubjectID: "00000000-0000-0000-0000-000000000202", QuestionIDs: []string{"00000000-0000-0000-0000-000000000301"}, RequestKey: "00000000-0000-0000-0000-000000000401"}
	contexts := []org.SchoolContext{{SchoolID: school, Role: identity.RoleSchoolAdmin, Permissions: []string{org.PermissionSchoolAssessmentsManage}, Modules: []string{string(org.ModuleSchoolAssessments)}}}
	intPtr := func(i int) *int { return &i }
	floatPtr := func(f float64) *float64 { return &f }
	strPtr := func(v string) *string { return &v }
	boolPtr := func(b bool) *bool { return &b }
	tests := []struct {
		name     string
		settings *org.DirectorAssessmentSettings
		want     error
	}{
		{"legacy without settings", nil, nil},
		{"valid zero unlimited", &org.DirectorAssessmentSettings{MaxAttempts: intPtr(1), PassingScore: floatPtr(0), TimeLimitMinutes: intPtr(0), RandomizeQuestions: boolPtr(false), OptionLayout: strPtr("two_columns")}, nil},
		{"attempt zero", &org.DirectorAssessmentSettings{MaxAttempts: intPtr(0)}, ErrInvalidInput},
		{"attempt over 100", &org.DirectorAssessmentSettings{MaxAttempts: intPtr(101)}, ErrInvalidInput},
		{"score negative", &org.DirectorAssessmentSettings{PassingScore: floatPtr(-1)}, ErrInvalidInput},
		{"score over 100", &org.DirectorAssessmentSettings{PassingScore: floatPtr(101)}, ErrInvalidInput},
		{"time negative", &org.DirectorAssessmentSettings{TimeLimitMinutes: intPtr(-1)}, ErrInvalidInput},
		{"time over day", &org.DirectorAssessmentSettings{TimeLimitMinutes: intPtr(1441)}, ErrInvalidInput},
		{"bad layout", &org.DirectorAssessmentSettings{OptionLayout: strPtr("tiny")}, ErrInvalidInput},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			input := base
			input.Settings = tt.settings
			repo := &repositoryMock{contexts: contexts}
			_, err := NewService(repo, repo).DirectorCreateAssessment(context.Background(), schoolAdminActor(), school, input)
			if !errors.Is(err, tt.want) {
				t.Fatalf("want %v got %v", tt.want, err)
			}
			if tt.want == nil && repo.lastDirectorAssessmentCreate == nil {
				t.Fatal("valid settings not passed")
			}
			if tt.want != nil && repo.lastDirectorAssessmentCreate != nil {
				t.Fatal("invalid settings reached repository")
			}
		})
	}
}
