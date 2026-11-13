package domain

import (
	"testing"
	"time"
)

func TestPreparedQuizEligible(t *testing.T) {
	now := time.Date(2026, 11, 10, 20, 0, 0, 0, time.UTC)
	deadline := now.Add(time.Minute)
	base := PreparedQuizAudience{Published: true, Quiz: true, Mode: "saher", QuestionCount: 1, DueExclusive: &deadline}
	tests := []struct {
		name    string
		q       PreparedQuizAudience
		student string
		groups  []string
		now     time.Time
		want    bool
	}{
		{"public", base, "s1", nil, now, true},
		{"guest", base, "", nil, now, false},
		{"expired exactly at deadline", base, "s1", nil, deadline, false},
		{"target user", withTargets(base, []string{"s1"}, nil), "s1", nil, now, true},
		{"target group", withTargets(base, nil, []string{"g1"}), "s1", []string{"g1"}, now, true},
		{"user or group", withTargets(base, []string{"other"}, []string{"g1"}), "s1", []string{"g1"}, now, true},
		{"unrelated", withTargets(base, []string{"other"}, []string{"g1"}), "s1", []string{"g2"}, now, false},
		{"empty group is not a match", withTargets(base, nil, []string{""}), "s1", []string{""}, now, false},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := PreparedQuizEligible(tc.q, tc.student, tc.groups, tc.now); got != tc.want {
				t.Fatalf("got %v, want %v", got, tc.want)
			}
		})
	}
	for _, mutate := range []func(*PreparedQuizAudience){
		func(q *PreparedQuizAudience) { q.Published = false },
		func(q *PreparedQuizAudience) { q.Quiz = false },
		func(q *PreparedQuizAudience) { q.StandaloneMock = true },
		func(q *PreparedQuizAudience) { q.Mode = "regular" },
		func(q *PreparedQuizAudience) { q.QuestionCount = 0 },
	} {
		q := base
		mutate(&q)
		if PreparedQuizEligible(q, "s1", nil, now) {
			t.Fatalf("ineligible quiz accepted: %+v", q)
		}
	}
	q := base
	q.Mode = "central"
	if !PreparedQuizEligible(q, "s1", nil, now) {
		t.Fatal("central quiz rejected")
	}
}

func withTargets(q PreparedQuizAudience, users, groups []string) PreparedQuizAudience {
	q.TargetUserIDs, q.TargetGroupIDs = users, groups
	return q
}

func TestPreparedQuizDeadlineUsesFollowingLocalMidnight(t *testing.T) {
	zone := time.FixedZone("platform", 3*60*60)
	deadline, err := PreparedQuizDeadline("2026-11-10", zone)
	if err != nil || deadline == nil || !deadline.Equal(time.Date(2026, 11, 10, 21, 0, 0, 0, time.UTC)) {
		t.Fatalf("deadline = %v, %v", deadline, err)
	}
	if got, err := PreparedQuizDeadline("", zone); got != nil || err != nil {
		t.Fatalf("empty date = %v, %v", got, err)
	}
	if _, err := PreparedQuizDeadline("2026-02-30", zone); err == nil {
		t.Fatal("accepted invalid date")
	}
	if _, err := PreparedQuizDeadline("2026-11-10", nil); err == nil {
		t.Fatal("accepted unspecified timezone")
	}
}
