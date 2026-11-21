package postgres

import taxonomy "github.com/nasef6464/almeaago/internal/taxonomy/domain"

// Hide descendants when an ancestor is hidden or inactive (and thus absent).
func filterPublicVisibility(b taxonomy.Bootstrap) taxonomy.Bootstrap {
	paths := make(map[string]taxonomy.Path, len(b.Paths))
	for _, p := range b.Paths {
		paths[p.ID] = p
	}
	visiblePaths := make(map[string]bool, len(paths))
	var visiblePath func(string, map[string]bool) bool
	visiblePath = func(id string, seen map[string]bool) bool {
		p, ok := paths[id]
		if !ok || seen[id] || (p.IsVisible != nil && !*p.IsVisible) {
			return false
		}
		if p.ParentPathID == "" {
			return true
		}
		seen[id] = true
		return visiblePath(p.ParentPathID, seen)
	}
	keptPaths := b.Paths[:0]
	for _, p := range b.Paths {
		if visiblePath(p.ID, map[string]bool{}) {
			visiblePaths[p.ID] = true
			keptPaths = append(keptPaths, p)
		}
	}
	b.Paths = keptPaths
	visibleLevels := make(map[string]bool)
	levels := b.Levels[:0]
	for _, l := range b.Levels {
		if visiblePaths[l.PathID] && (l.IsVisible == nil || *l.IsVisible) {
			visibleLevels[l.ID] = true
			levels = append(levels, l)
		}
	}
	b.Levels = levels
	visibleSubjects := make(map[string]bool)
	subjects := b.Subjects[:0]
	for _, s := range b.Subjects {
		if visiblePaths[s.PathID] && (s.LevelID == "" || visibleLevels[s.LevelID]) && (s.IsVisible == nil || *s.IsVisible) {
			visibleSubjects[s.ID] = true
			subjects = append(subjects, s)
		}
	}
	b.Subjects = subjects
	sections := b.Sections[:0]
	for _, section := range b.Sections {
		if visibleSubjects[section.SubjectID] {
			sections = append(sections, section)
		}
	}
	b.Sections = sections
	skills := b.Skills[:0]
	for _, s := range b.Skills {
		if visibleSubjects[s.SubjectID] {
			skills = append(skills, s)
		}
	}
	b.Skills = skills
	return b
}
