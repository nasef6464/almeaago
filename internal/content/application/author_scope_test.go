package application

import (
	"context"
	"errors"
	"testing"
)

type authorScopeStub struct {
	allowed bool
	err     error
	calls   int
}

func (s *authorScopeStub) CanAuthor(context.Context, string, string, string) (bool, error) {
	s.calls++
	return s.allowed, s.err
}

type schoolAuthorScopeStub struct {
	allowed bool
	err     error
	calls   int
}

func (s *schoolAuthorScopeStub) CanTeachSubject(context.Context, string, string, string) (bool, error) {
	s.calls++
	return s.allowed, s.err
}

func TestCombinedAuthorScopeFallsBackToSchoolAssignment(t *testing.T) {
	platform := &authorScopeStub{}
	school := &schoolAuthorScopeStub{allowed: true}
	scope := NewCombinedAuthorScope(platform, school)

	ok, err := scope.CanAuthor(context.Background(), "teacher-1", "path-1", "subject-1")
	if err != nil {
		t.Fatal(err)
	}
	if !ok || platform.calls != 1 || school.calls != 1 {
		t.Fatalf("unexpected combined scope result ok=%v platform=%d school=%d", ok, platform.calls, school.calls)
	}
}

func TestCombinedAuthorScopeStopsOnPlatformError(t *testing.T) {
	sentinel := errors.New("platform scope failed")
	platform := &authorScopeStub{err: sentinel}
	school := &schoolAuthorScopeStub{allowed: true}
	scope := NewCombinedAuthorScope(platform, school)

	_, err := scope.CanAuthor(context.Background(), "teacher-1", "path-1", "subject-1")
	if !errors.Is(err, sentinel) {
		t.Fatalf("expected platform error, got %v", err)
	}
	if school.calls != 0 {
		t.Fatalf("school fallback must not mask platform errors: calls=%d", school.calls)
	}
}
