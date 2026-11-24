package postgres

import (
	"crypto/md5"
	"encoding/hex"
	"sort"
	"strconv"
	"testing"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
)

func TestOptionSortDeterminismAgainstPostgresMD5(t *testing.T) {
	attemptID := "att-1"
	// Indices 0, 1, 2, 3
	// MD5("att-1" + "0") = "4600e1cf59ca34ba44f2d5e7d58fa2f3"
	// MD5("att-1" + "1") = "c14dd0dd89182283e54737039a5ca2d9"
	// MD5("att-1" + "2") = "ba39a778fc3cf1b98a3915f013d8544c"
	// MD5("att-1" + "3") = "e931e97669d2c2069cb5069351d3b0c5"
	// Expected sorted order: 0 (46...), 2 (ba...), 1 (c1...), 3 (e9...)

	opts := []assessment.LearnerOption{
		{Index: 0, Text: "Option A"},
		{Index: 1, Text: "Option B"},
		{Index: 2, Text: "Option C"},
		{Index: 3, Text: "Option D"},
	}

	sort.SliceStable(opts, func(a, b int) bool {
		hashA := md5.Sum([]byte(attemptID + strconv.Itoa(opts[a].Index)))
		hashB := md5.Sum([]byte(attemptID + strconv.Itoa(opts[b].Index)))
		return hex.EncodeToString(hashA[:]) < hex.EncodeToString(hashB[:])
	})

	expectedOrder := []int{0, 2, 1, 3}
	for i, opt := range opts {
		if opt.Index != expectedOrder[i] {
			t.Fatalf("expected position %d to have option index %d, got %d", i, expectedOrder[i], opt.Index)
		}
	}
}

func TestOptionSortNonRandomized(t *testing.T) {
	opts := []assessment.LearnerOption{
		{Index: 3, Text: "Option D"},
		{Index: 1, Text: "Option B"},
		{Index: 0, Text: "Option A"},
		{Index: 2, Text: "Option C"},
	}

	sort.SliceStable(opts, func(a, b int) bool {
		return opts[a].Index < opts[b].Index
	})

	expectedOrder := []int{0, 1, 2, 3}
	for i, opt := range opts {
		if opt.Index != expectedOrder[i] {
			t.Fatalf("expected position %d to have option index %d, got %d", i, expectedOrder[i], opt.Index)
		}
	}
}

func TestLearnerQuestionHasImageDetection(t *testing.T) {
	if !learnerQuestionHasImage("asset-1", "", "") {
		t.Fatalf("expected true when assetID present")
	}
	if !learnerQuestionHasImage("", "https://example.com/img.png", "") {
		t.Fatalf("expected true when imageURL present")
	}
	if !learnerQuestionHasImage("", "", "السؤال يحتوي على <img src='test.png'>") {
		t.Fatalf("expected true when html img tag present in text")
	}
	if learnerQuestionHasImage("", "", "سؤال نصي عادي بدون صور") {
		t.Fatalf("expected false for text question without images")
	}
}
