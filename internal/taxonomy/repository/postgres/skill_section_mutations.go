package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

func (r *Repository) CreateSkillSection(ctx context.Context, actor string, write taxonomy.SkillSectionWrite) (taxonomy.SkillSection, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return taxonomy.SkillSection{}, err
	}
	defer tx.Rollback(ctx)
	var row taxonomy.SkillSection
	err = tx.QueryRow(ctx, `INSERT INTO taxonomy_skill_sections(subject_id,name,sort_order)
		SELECT s.id,$2,$3 FROM subjects s JOIN paths p ON p.id=s.path_id AND p.status='active'
		LEFT JOIN levels l ON l.id=s.level_id AND l.path_id=s.path_id
		WHERE s.id=$1::uuid AND s.status='active' AND (s.level_id IS NULL OR l.status='active')
		RETURNING id::text,subject_id::text,name,sort_order,status`, write.SubjectID, write.Name, write.SortOrder).Scan(&row.ID, &row.SubjectID, &row.Name, &row.SortOrder, &row.Status)
	if err != nil {
		return taxonomy.SkillSection{}, mapMutationError(err)
	}
	if err = writeTaxonomyAudit(ctx, tx, actor, "taxonomy.skill_section.create", "skill_section", row.ID); err != nil {
		return taxonomy.SkillSection{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return taxonomy.SkillSection{}, err
	}
	return row, nil
}

func (r *Repository) UpdateSkillSection(ctx context.Context, actor, id string, patch taxonomy.SkillSectionPatch) (taxonomy.SkillSection, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return taxonomy.SkillSection{}, err
	}
	defer tx.Rollback(ctx)
	var row taxonomy.SkillSection
	err = tx.QueryRow(ctx, `UPDATE taxonomy_skill_sections SET name=COALESCE($2,name),sort_order=COALESCE($3,sort_order),status=COALESCE($4,status),updated_at=now() WHERE id=$1::uuid RETURNING id::text,subject_id::text,name,sort_order,status`, id, patch.Name, patch.SortOrder, patch.Status).Scan(&row.ID, &row.SubjectID, &row.Name, &row.SortOrder, &row.Status)
	if err != nil {
		return taxonomy.SkillSection{}, mapMutationError(err)
	}
	if err = writeTaxonomyAudit(ctx, tx, actor, "taxonomy.skill_section.update", "skill_section", row.ID); err != nil {
		return taxonomy.SkillSection{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return taxonomy.SkillSection{}, err
	}
	return row, nil
}

func (r *Repository) SetSkillSection(ctx context.Context, actor, skillID, sectionID string) (taxonomy.Skill, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return taxonomy.Skill{}, err
	}
	defer tx.Rollback(ctx)
	var row taxonomy.Skill
	err = tx.QueryRow(ctx, `UPDATE skills sk SET section_id=NULLIF($2,'')::uuid,updated_at=now() WHERE sk.id=$1::uuid AND sk.kind='main' AND ($2='' OR EXISTS (SELECT 1 FROM taxonomy_skill_sections sec WHERE sec.id=NULLIF($2,'')::uuid AND sec.subject_id=sk.subject_id AND sec.status='active')) RETURNING sk.id::text,sk.subject_id::text,COALESCE(sk.parent_skill_id::text,''),sk.code,sk.name,sk.description,sk.kind,sk.sort_order,COALESCE(sk.section_id::text,'')`, skillID, sectionID).Scan(&row.ID, &row.SubjectID, &row.ParentSkillID, &row.Code, &row.Name, &row.Description, &row.Kind, &row.SortOrder, &row.SectionID)
	if err == pgx.ErrNoRows {
		return taxonomy.Skill{}, taxonomy.ErrConflict
	}
	if err != nil {
		return taxonomy.Skill{}, mapMutationError(err)
	}
	if err = writeTaxonomyAudit(ctx, tx, actor, "taxonomy.skill.section.update", "skill", row.ID); err != nil {
		return taxonomy.Skill{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return taxonomy.Skill{}, err
	}
	return row, nil
}
