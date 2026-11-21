package postgres

import (
	"context"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func (r *Repository) skillSections(ctx context.Context, includeArchived bool) ([]taxonomy.SkillSection, error) {
	rows, err := r.db.Query(ctx, `SELECT id::text, subject_id::text, name, sort_order, status FROM taxonomy_skill_sections WHERE $1 OR status='active' ORDER BY subject_id,sort_order,id`, includeArchived)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	sections := []taxonomy.SkillSection{}
	for rows.Next() {
		var section taxonomy.SkillSection
		if err := rows.Scan(&section.ID, &section.SubjectID, &section.Name, &section.SortOrder, &section.Status); err != nil {
			return nil, err
		}
		sections = append(sections, section)
	}
	return sections, rows.Err()
}
