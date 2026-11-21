package domain

// SubjectAccessGuideCounts describes configured visibility, before entitlements.
type SubjectAccessGuideCounts struct {
	FoundationFree int
	FoundationPaid int
	LibraryFree    int
	LibraryPaid    int
}

// Course IDs stay server-side; an overflow is reported instead of silently
// claiming that a partial list represents the whole subject.
type SubjectGuideCourses struct {
	IDs     []string
	HasMore bool
}
