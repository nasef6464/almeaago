package domain

// PublicCourse exposes only fields safe for the anonymous homepage. Staff
// ownership, revisions and unpublished metadata must not leave this read model.
type PublicCourse struct {
 ID string `json:"id"`
 Title string `json:"title"`
 InstructorName string `json:"instructorName"`
 ThumbnailURL string `json:"thumbnailUrl"`
}
