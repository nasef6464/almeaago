package postgres

import (
	"context"
	"encoding/json"

	"github.com/jackc/pgx/v5/pgxpool"

	taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"
)

type pathPresRaw struct {
	Color            string                `json:"color,omitempty"`
	Icon             string                `json:"icon,omitempty"`
	IconURL          string                `json:"iconUrl,omitempty"`
	IconStyle        string                `json:"iconStyle,omitempty"`
	ShowInNavbar     *bool                 `json:"showInNavbar,omitempty"`
	ShowSubjectCards *bool                 `json:"showSubjectCards,omitempty"`
	ShowMockExamCard *bool                 `json:"showMockExamCard,omitempty"`
	ShowPackageCard  *bool                 `json:"showPackageCard,omitempty"`
	Settings         taxonomy.PathSettings `json:"settings,omitempty"`
}

type levelPresRaw struct {
	Icon    string `json:"icon,omitempty"`
	IconURL string `json:"iconUrl,omitempty"`
}

type subjectPresRaw struct {
	Color     string `json:"color,omitempty"`
	Icon      string `json:"icon,omitempty"`
	IconURL   string `json:"iconUrl,omitempty"`
	IconStyle string `json:"iconStyle,omitempty"`
}

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
		SELECT id::text, code, name, COALESCE(parent_path_id::text, ''), description, sort_order, COALESCE(presentation, '{}'::jsonb)
		FROM paths
		WHERE status = 'active'
		ORDER BY sort_order, id
	`)
	if err != nil {
		return result, err
	}
	for pathRows.Next() {
		var row taxonomy.Path
		var presBytes []byte
		if err := pathRows.Scan(&row.ID, &row.Code, &row.Name, &row.ParentPathID, &row.Description, &row.SortOrder, &presBytes); err != nil {
			pathRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres pathPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Color = pres.Color
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
				row.IconStyle = pres.IconStyle
				row.ShowInNavbar = pres.ShowInNavbar
				row.ShowSubjectCards = pres.ShowSubjectCards
				row.ShowMockExamCard = pres.ShowMockExamCard
				row.ShowPackageCard = pres.ShowPackageCard
				row.Settings = pres.Settings
			}
		}
		result.Paths = append(result.Paths, row)
	}
	if err := pathRows.Err(); err != nil {
		pathRows.Close()
		return result, err
	}
	pathRows.Close()

	levelRows, err := r.db.Query(ctx, `
		SELECT l.id::text, l.path_id::text, l.code, l.name, l.sort_order, COALESCE(l.presentation, '{}'::jsonb)
		FROM levels l
		JOIN paths p ON p.id = l.path_id AND p.status = 'active'
		WHERE l.status = 'active'
		ORDER BY p.sort_order, l.sort_order, l.id
	`)
	if err != nil {
		return result, err
	}
	for levelRows.Next() {
		var row taxonomy.Level
		var presBytes []byte
		if err := levelRows.Scan(&row.ID, &row.PathID, &row.Code, &row.Name, &row.SortOrder, &presBytes); err != nil {
			levelRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres levelPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
			}
		}
		result.Levels = append(result.Levels, row)
	}
	if err := levelRows.Err(); err != nil {
		levelRows.Close()
		return result, err
	}
	levelRows.Close()

	subjectRows, err := r.db.Query(ctx, `
		SELECT s.id::text, s.path_id::text, COALESCE(s.level_id::text, ''), s.code, s.name, s.sort_order, COALESCE(s.presentation, '{}'::jsonb)
		FROM subjects s
		JOIN paths p ON p.id = s.path_id AND p.status = 'active'
		LEFT JOIN levels l ON l.id = s.level_id
		WHERE s.status = 'active'
		  AND (s.level_id IS NULL OR l.status = 'active')
		ORDER BY p.sort_order, s.sort_order, s.id
	`)
	if err != nil {
		return result, err
	}
	for subjectRows.Next() {
		var row taxonomy.Subject
		var presBytes []byte
		if err := subjectRows.Scan(&row.ID, &row.PathID, &row.LevelID, &row.Code, &row.Name, &row.SortOrder, &presBytes); err != nil {
			subjectRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres subjectPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Color = pres.Color
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
				row.IconStyle = pres.IconStyle
			}
		}
		result.Subjects = append(result.Subjects, row)
	}
	if err := subjectRows.Err(); err != nil {
		subjectRows.Close()
		return result, err
	}
	subjectRows.Close()

	if !includeSkills {
		return result, nil
	}

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
	if err != nil {
		return result, err
	}
	defer skillRows.Close()
	for skillRows.Next() {
		var row taxonomy.Skill
		if err := skillRows.Scan(&row.ID, &row.SubjectID, &row.ParentSkillID, &row.Code, &row.Name, &row.Description, &row.Kind, &row.SortOrder); err != nil {
			return result, err
		}
		result.Skills = append(result.Skills, row)
	}
	if err := skillRows.Err(); err != nil {
		return result, err
	}
	return result, nil
}

func (r *Repository) AdminBootstrap(ctx context.Context) (taxonomy.Bootstrap, error) {
	result := taxonomy.Bootstrap{
		Paths: []taxonomy.Path{}, Levels: []taxonomy.Level{},
		Subjects: []taxonomy.Subject{}, Skills: []taxonomy.Skill{},
	}

	pathRows, err := r.db.Query(ctx, `
		SELECT id::text, code, name, COALESCE(parent_path_id::text, ''), description, sort_order, status, COALESCE(presentation, '{}'::jsonb)
		FROM paths
		ORDER BY sort_order, id
	`)
	if err != nil {
		return result, err
	}
	for pathRows.Next() {
		var row taxonomy.Path
		var presBytes []byte
		if err := pathRows.Scan(&row.ID, &row.Code, &row.Name, &row.ParentPathID, &row.Description, &row.SortOrder, &row.Status, &presBytes); err != nil {
			pathRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres pathPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Color = pres.Color
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
				row.IconStyle = pres.IconStyle
				row.ShowInNavbar = pres.ShowInNavbar
				row.ShowSubjectCards = pres.ShowSubjectCards
				row.ShowMockExamCard = pres.ShowMockExamCard
				row.ShowPackageCard = pres.ShowPackageCard
				row.Settings = pres.Settings
			}
		}
		result.Paths = append(result.Paths, row)
	}
	if err := pathRows.Err(); err != nil {
		pathRows.Close()
		return result, err
	}
	pathRows.Close()

	levelRows, err := r.db.Query(ctx, `
		SELECT id::text, path_id::text, code, name, sort_order, status, COALESCE(presentation, '{}'::jsonb)
		FROM levels
		ORDER BY path_id, sort_order, id
	`)
	if err != nil {
		return result, err
	}
	for levelRows.Next() {
		var row taxonomy.Level
		var presBytes []byte
		if err := levelRows.Scan(&row.ID, &row.PathID, &row.Code, &row.Name, &row.SortOrder, &row.Status, &presBytes); err != nil {
			levelRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres levelPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
			}
		}
		result.Levels = append(result.Levels, row)
	}
	if err := levelRows.Err(); err != nil {
		levelRows.Close()
		return result, err
	}
	levelRows.Close()

	subjectRows, err := r.db.Query(ctx, `
		SELECT id::text, path_id::text, COALESCE(level_id::text, ''), code, name, sort_order, status, COALESCE(presentation, '{}'::jsonb)
		FROM subjects
		ORDER BY path_id, sort_order, id
	`)
	if err != nil {
		return result, err
	}
	for subjectRows.Next() {
		var row taxonomy.Subject
		var presBytes []byte
		if err := subjectRows.Scan(&row.ID, &row.PathID, &row.LevelID, &row.Code, &row.Name, &row.SortOrder, &row.Status, &presBytes); err != nil {
			subjectRows.Close()
			return result, err
		}
		if len(presBytes) > 0 {
			var pres subjectPresRaw
			if err := json.Unmarshal(presBytes, &pres); err == nil {
				row.Color = pres.Color
				row.Icon = pres.Icon
				row.IconURL = pres.IconURL
				row.IconStyle = pres.IconStyle
			}
		}
		result.Subjects = append(result.Subjects, row)
	}
	if err := subjectRows.Err(); err != nil {
		subjectRows.Close()
		return result, err
	}
	subjectRows.Close()

	skillRows, err := r.db.Query(ctx, `
		SELECT id::text, subject_id::text, COALESCE(parent_skill_id::text, ''),
		       code, name, description, kind, sort_order, status
		FROM skills
		ORDER BY subject_id, kind, sort_order, id
	`)
	if err != nil {
		return result, err
	}
	defer skillRows.Close()
	for skillRows.Next() {
		var row taxonomy.Skill
		if err := skillRows.Scan(&row.ID, &row.SubjectID, &row.ParentSkillID, &row.Code, &row.Name, &row.Description, &row.Kind, &row.SortOrder, &row.Status); err != nil {
			return result, err
		}
		result.Skills = append(result.Skills, row)
	}
	if err := skillRows.Err(); err != nil {
		return result, err
	}
	return result, nil
}

// ValidateMasteryGoalScope is Taxonomy's narrow read contract for learner goals.
// It validates only active canonical path/subject identity; Learning owns goal state.
func (r *Repository) ValidateMasteryGoalScope(ctx context.Context, pathID, subjectID string) (bool, error) {
	if subjectID == "" {
		var ok bool
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1
				FROM paths p
				WHERE p.id=$1::uuid AND p.status='active'
			)
		`, pathID).Scan(&ok)
		return ok, err
	}
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM subjects s
			JOIN paths p ON p.id=s.path_id
			LEFT JOIN levels l ON l.id=s.level_id
			WHERE p.id=$1::uuid
			  AND s.id=$2::uuid
			  AND p.status='active'
			  AND s.status='active'
			  AND (s.level_id IS NULL OR l.status='active')
		)
	`, pathID, subjectID).Scan(&ok)
	return ok, err
}

// ValidateStudyPlanScope is Taxonomy's bounded read contract for learner Study Plans.
// Empty subjectIDs means "all active subjects under this path"; otherwise every ID must be
// active and belong to the exact active path.
func (r *Repository) ValidateStudyPlanScope(ctx context.Context, pathID string, subjectIDs []string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1 FROM paths p
			WHERE p.id=$1::uuid AND p.status='active'
		)
		AND NOT EXISTS(
			SELECT 1
			FROM unnest($2::text[]) requested(subject_id)
			LEFT JOIN subjects s
			  ON s.id::text=requested.subject_id
			 AND s.path_id=$1::uuid
			 AND s.status='active'
			 AND (s.level_id IS NULL OR EXISTS (
			   SELECT 1 FROM levels l WHERE l.id=s.level_id AND l.status='active'
			 ))
			WHERE s.id IS NULL
		)
	`, pathID, subjectIDs).Scan(&ok)
	return ok, err
}
