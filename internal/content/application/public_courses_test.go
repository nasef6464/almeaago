package application

import (
	"context"
	"testing"

	content "github.com/nasef6464/almeaago/internal/content/domain"
)

type publicCourseStub struct{ Repository }

func (publicCourseStub) ListPublicCourses(_ context.Context, limit int) ([]content.PublicCourse, error) {
	return []content.PublicCourse{{ID: "visible-1", Title: "Visible", InstructorName: "Teacher"}}, nil
}
func TestPublicCoursesBoundedAndDelegated(t *testing.T) {
	service := NewService(publicCourseStub{})
	for _, limit := range []int{0, -1, 101} {
		if _, err := service.PublicCourses(context.Background(), limit); err != ErrInvalidInput {
			t.Fatalf("limit %d: %v", limit, err)
		}
	}
	rows, err := service.PublicCourses(context.Background(), 3)
	if err != nil || len(rows) != 1 || rows[0].ID != "visible-1" {
		t.Fatalf("public rows=%+v err=%v", rows, err)
	}
}
