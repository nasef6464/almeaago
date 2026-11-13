package postgres

import "context"

// The returned attempt is owned by this student and still within its deadline.
func (r *Repository) LatestSelfQuizAttempt(ctx context.Context, student string) (string, error) {
	var id string
	err := r.db.QueryRow(ctx, `SELECT id::text FROM assessment_attempts WHERE student_id=$1::uuid AND assessment_id IS NULL AND status='in_progress' AND (expires_at IS NULL OR expires_at>clock_timestamp()) ORDER BY started_at DESC,id DESC LIMIT 1`, student).Scan(&id)
	return id, mapError(err)
}
