package postgres

import "context"

// CourseCommerceScope exposes only the canonical scope Commerce needs to validate
// a Course product or entitlement decision. Commerce never owns Course lifecycle.
func (r *Repository) CourseCommerceScope(ctx context.Context, courseID string) (string, string, bool, error) {
	var pathID,subjectID string
	var eligible bool
	err:=r.db.QueryRow(ctx,`
SELECT path_id::text,subject_id::text,
       workflow_status='approved' AND is_published=true AND is_visible=true
FROM courses
WHERE id=$1::uuid
`,courseID).Scan(&pathID,&subjectID,&eligible)
	if err!=nil{return "","",false,mapError(err)}
	return pathID,subjectID,eligible,nil
}
