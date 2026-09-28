package reportinghttp

import (
	"errors"
	"testing"
	"time"

	reportingapp "github.com/nasef6464/almeaago/internal/reporting/application"
)

func TestParseDateRangeUsesInclusiveDateTo(t *testing.T) {
	fromAt, toAt, err := parseDateRange("2026-09-01", "2026-09-28")
	if err != nil {
		t.Fatal(err)
	}
	if fromAt == nil || fromAt.Format("2006-01-02") != "2026-09-01" {
		t.Fatalf("unexpected from date: %v", fromAt)
	}
	if toAt == nil || toAt.Format("2006-01-02") != "2026-09-29" {
		t.Fatalf("dateTo must become an exclusive next-day boundary: %v", toAt)
	}
}

func TestParseDateRangeRejectsInvalidOrInvertedDates(t *testing.T) {
	if _, _, err := parseDateRange("not-a-date", ""); !errors.Is(err, reportingapp.ErrInvalidInput) {
		t.Fatalf("expected invalid date error, got %v", err)
	}
	if _, _, err := parseDateRange("2026-09-29", "2026-09-28"); !errors.Is(err, reportingapp.ErrInvalidInput) {
		t.Fatalf("expected inverted range error, got %v", err)
	}
}

func TestParseDateRangeNormalizesUTC(t *testing.T) {
	fromAt, toAt, err := parseDateRange("", "2026-09-28")
	if err != nil {
		t.Fatal(err)
	}
	if fromAt != nil {
		t.Fatalf("unexpected from date: %v", fromAt)
	}
	if toAt == nil || toAt.Location() != time.UTC {
		t.Fatalf("expected UTC exclusive bound: %v", toAt)
	}
}
