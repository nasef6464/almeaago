package postgres

import "context"

// ValidCommerceScope validates canonical active Taxonomy IDs for Commerce package items.
func (r *Repository) ValidCommerceScope(ctx context.Context, pathID, subjectID string) (bool, error) {
	var ok bool
	switch {
	case pathID != "" && subjectID == "":
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM paths WHERE id=$1::uuid AND status='active')`, pathID).Scan(&ok)
		return ok, err
	case pathID == "" && subjectID != "":
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subjects s JOIN paths p ON p.id=s.path_id WHERE s.id=$1::uuid AND s.status='active' AND p.status='active')`, subjectID).Scan(&ok)
		return ok, err
	case pathID != "" && subjectID != "":
		err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subjects s JOIN paths p ON p.id=s.path_id WHERE p.id=$1::uuid AND s.id=$2::uuid AND s.status='active' AND p.status='active')`, pathID, subjectID).Scan(&ok)
		return ok, err
	default:
		return false, nil
	}
}
