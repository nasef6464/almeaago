package domain

type AccessType string
type PlacementAccessType string

const (
	AccessFree       AccessType = "free"
	AccessPaid       AccessType = "paid"
	AccessPrivate    AccessType = "private"
	AccessCourseOnly AccessType = "course_only"

	PlacementAccessInherit PlacementAccessType = "inherit"
	PlacementAccessFree    PlacementAccessType = "free"
	PlacementAccessPaid    PlacementAccessType = "paid"
	PlacementAccessPackage PlacementAccessType = "package"
)

func ValidAccessType(v AccessType) bool {
	return v == AccessFree || v == AccessPaid || v == AccessPrivate || v == AccessCourseOnly
}

func ValidPlacementAccessType(v PlacementAccessType) bool {
	return v == PlacementAccessInherit || v == PlacementAccessFree || v == PlacementAccessPaid || v == PlacementAccessPackage
}

type AccessContext struct {
	AssessmentID   string
	AssessmentKind Kind
	BaseAccess     AccessType
	PlacementID    string
	PlacementSlot  PlacementSlot
	PlacementAccess PlacementAccessType
	PathID         string
	SubjectID      string
	CourseID       string
}
