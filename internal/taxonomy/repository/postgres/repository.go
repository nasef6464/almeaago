package postgres

import (
	"context"

	"github.com/jackc/pgx/v5/pgxpool"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type Repository struct {
	db *pgxpool.Pool
}

func New(db *pgxpool.Pool) *Repository {
	return &Repository{db: db}
}

func (r *Repository) PublicBootstrap(ctx context.Context, includeSkills bool) (taxonomy.Bootstrap, error) {
	result := taxonomy.Bootstrap{
		Paths: []taxonomy.Path{}, Levels: []taxonomy.Level{},
		Subjects: []taxonomy.Subject{}, Skills: []taxonomy.Skill{},
	}

	pathRows, err := r.db.Query(ctx, `
		SELECT id::text, code, name, COALESCE(parent_path_id::text, ''), description, sort_order
		FROM paths
		WHERE status = 'active'
		ORDER BY sort_order, id
	`)
	if err != nil { return result, err }
	for pathRows.Next() {
		var row taxonomy.Path
		if err := pathRows.Scan(&row.ID, &row.Code, &row.Name, &row.ParentPathID, &row.Description, &row.SortOrder); err != nil {
			pathRows.Close(); return result, err
		}
		result.Paths = append(result.Paths, row)
	}
	if err := pathRows.Err(); err != nil { pathRows.Close(); return result, err }
	pathRows.Close()

	levelRows, err := r.db.Query(ctx, `
		SELECT l.id::text, l.path_id::text, l.code, l.name, l.sort_order
		FROM levels l
		JOIN paths p ON p.id = l.path_id AND p.status = 'active'
		WHERE l.status = 'active'
		ORDER BY p.sort_order, l.sort_order, l.id
	`)
	if err != nil { return result, err }
	for levelRows.Next() {
		var row taxonomy.Level
		if err := levelRows.Scan(&row.ID, &row.PathID, &row.Code, &row.Name, &row.SortOrder); err != nil {
			levelRows.Close(); return result, err
		}
		result.Levels = append(result.Levels, row)
	}
	if err := levelRows.Err(); err != nil { levelRows.Close(); return result, err }
	levelRows.Close()

	subjectRows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.path_id::text, COALESCE(s.level_id::text, ''), s.code, s.name, s.sort_order
		FROM subjects s
		JOIN paths p ON p.id = s.path_id AND p.status = 'active'
		LEFT JOIN levels l ON l.id = s.level_id
		WHERE s.status = 'active'
		  AND (s.level_id IS NULL OR l.status = 'active')
		ORDER BY p.sort_order, s.sort_order, s.id
	`)
	if err != nil { return result, err }
	for subjectRows.Next() {
		var row taxonomy.Subject
		if err := subjectRows.Scan(&row.ID, &row.PathID, &row.LevelID, &row.Code, &row.Name, &row.SortOrder); err != nil {
			subjectRows.Close(); return result, err
		}
		result.Subjects = append(result.Subjects, row)
	}
	if err := subjectRows.Err(); err != nil { subjectRows.Close(); return result, err }
	subjectRows.Close()

	if !includeSkills { return result, nil }

	skillRows, err := r.db.Query(ctx, `
		SELECT sk.id::text, sk.subject_id::text, COALESCE(sk.parent_skill_id::text, ''),
		       sk.code, sk.name, sk.description, sk.kind, sk.sort_order
		FROM skills sk
		JOIN subjects s ON s.id = sk.subject_id AND s.status = 'active'
		JOIN paths p ON p.id = s.path_id AND p.status = 'active'
		LEFT JOIN levels l ON l.id = s.level_id
		WHERE sk.status = 'active'
		  AND (s.level_id IS NULL OR l.status = 'active')
		ORDER BY p.sort_order, s.sort_order, sk.sort_order, sk.id
	`)
	if err != nil { return result, err }
	defer skillRows.Close()
	for skillRows.Next() {
		var row taxonomy.Skill
		if err := skillRows.Scan(&row.ID, &row.SubjectID, &row.ParentSkillID, &row.Code, &row.Name, &row.Description, &row.Kind, &row.SortOrder); err != nil {
			return result, err
		}
		result.Skills = append(result.Skills, row)
	}
	if err := skillRows.Err(); err != nil { return result, err }
	return result, nil
}
