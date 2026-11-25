package postgres

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) ReadLearningEvidence(
	ctx context.Context,
	actor identity.User,
	query learning.LearningEvidenceQuery,
) (learning.LearningEvidenceReport, error) {
	// 1. Resolve authorized school/class scope per role
	var allowedSchools []string
	var allowedClasses []string
	isAdmin := actor.HasRole(identity.RoleAdmin)

	if !isAdmin {
		switch {
		case actor.HasRole(identity.RoleTeacher):
			rows, err := r.db.Query(ctx, `
				SELECT DISTINCT ta.school_id::text, ta.class_id::text
				FROM teacher_assignments ta
				JOIN schools s ON s.id = ta.school_id AND s.status = 'active'
				JOIN classes c ON c.id = ta.class_id AND c.status = 'active'
				WHERE ta.user_id::text = $1
				  AND ta.status = 'active'
				  AND (ta.subject_id IS NULL OR ta.subject_id::text = $2)
			`, actor.ID, query.SubjectID)
			if err != nil {
				return learning.LearningEvidenceReport{}, err
			}
			schoolSet := map[string]struct{}{}
			for rows.Next() {
				var sID, cID string
				if err := rows.Scan(&sID, &cID); err != nil {
					rows.Close()
					return learning.LearningEvidenceReport{}, err
				}
				schoolSet[sID] = struct{}{}
				allowedClasses = append(allowedClasses, cID)
			}
			rows.Close()
			for sID := range schoolSet {
				allowedSchools = append(allowedSchools, sID)
			}

		case actor.HasRole(identity.RoleSchoolAdmin):
			if query.SchoolID == "" {
				return learning.LearningEvidenceReport{}, learningapp.ErrForbidden
			}
			var permitted bool
			err := r.db.QueryRow(ctx, `
				SELECT EXISTS (
					SELECT 1
					FROM school_memberships sm
					JOIN schools s ON s.id = sm.school_id AND s.status = 'active'
					JOIN school_contracts sc ON sc.school_id = s.id AND sc.status = 'active'
					WHERE sm.user_id::text = $1
					  AND sm.school_id::text = $2
					  AND sm.role = 'school_admin'
					  AND sm.status = 'active'
					  AND 'SCHOOL_INTELLIGENCE' = ANY(sc.enabled_modules)
					  AND 'SCHOOL_REPORTS_DETAILED_VIEW' = ANY(sm.permissions)
				)
			`, actor.ID, query.SchoolID).Scan(&permitted)
			if err != nil || !permitted {
				return learning.LearningEvidenceReport{}, learningapp.ErrForbidden
			}
			allowedSchools = []string{query.SchoolID}
			rows, err := r.db.Query(ctx, `
				SELECT id::text FROM classes WHERE school_id::text = $1 AND status = 'active'
			`, query.SchoolID)
			if err != nil {
				return learning.LearningEvidenceReport{}, err
			}
			for rows.Next() {
				var cID string
				if err := rows.Scan(&cID); err != nil {
					rows.Close()
					return learning.LearningEvidenceReport{}, err
				}
				allowedClasses = append(allowedClasses, cID)
			}
			rows.Close()

		case actor.HasRole(identity.RoleSupervisor):
			rows, err := r.db.Query(ctx, `
				SELECT DISTINCT sc.school_id::text, COALESCE(sc.class_id::text, '')
				FROM school_supervisor_scopes sc
				JOIN schools s ON s.id = sc.school_id AND s.status = 'active'
				WHERE sc.supervisor_user_id::text = $1
				  AND sc.status = 'active'
			`, actor.ID)
			if err != nil {
				return learning.LearningEvidenceReport{}, err
			}
			schoolSet := map[string]struct{}{}
			for rows.Next() {
				var sID, cID string
				if err := rows.Scan(&sID, &cID); err != nil {
					rows.Close()
					return learning.LearningEvidenceReport{}, err
				}
				schoolSet[sID] = struct{}{}
				if cID != "" {
					allowedClasses = append(allowedClasses, cID)
				}
			}
			rows.Close()
			for sID := range schoolSet {
				allowedSchools = append(allowedSchools, sID)
			}
		}

		if query.SchoolID != "" && !containsStr(allowedSchools, query.SchoolID) {
			return learning.LearningEvidenceReport{}, learningapp.ErrForbidden
		}
		if query.ClassID != "" && !containsStr(allowedClasses, query.ClassID) {
			return learning.LearningEvidenceReport{}, learningapp.ErrForbidden
		}
	}

	// 2. Load scoped active students
	type studentRow struct {
		id   string
		name string
	}
	var students []studentRow
	if !isAdmin && len(allowedSchools) == 0 && len(allowedClasses) == 0 {
		return emptyEvidenceReport(query), nil
	}

	studentSQL := `
		SELECT DISTINCT u.id::text, COALESCE(NULLIF(btrim(u.name), ''), u.email) AS display_name
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'student'
		WHERE u.status = 'active'
	`
	args := []any{}
	argIdx := 1
	if query.ClassID != "" {
		studentSQL += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM class_memberships cm WHERE cm.user_id = u.id AND cm.class_id::text = $%d AND cm.status = 'active')`, argIdx)
		args = append(args, query.ClassID)
		argIdx++
	} else if !isAdmin && len(allowedClasses) > 0 {
		studentSQL += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM class_memberships cm WHERE cm.user_id = u.id AND cm.class_id::text = ANY($%d::text[]) AND cm.status = 'active')`, argIdx)
		args = append(args, allowedClasses)
		argIdx++
	} else if query.SchoolID != "" {
		studentSQL += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM school_memberships sm WHERE sm.user_id = u.id AND sm.school_id::text = $%d AND sm.role = 'student' AND sm.status = 'active')`, argIdx)
		args = append(args, query.SchoolID)
		argIdx++
	} else if !isAdmin {
		studentSQL += fmt.Sprintf(` AND EXISTS (SELECT 1 FROM school_memberships sm WHERE sm.user_id = u.id AND sm.school_id::text = ANY($%d::text[]) AND sm.role = 'student' AND sm.status = 'active')`, argIdx)
		args = append(args, allowedSchools)
		argIdx++
	}
	if query.Search != "" {
		studentSQL += fmt.Sprintf(` AND COALESCE(NULLIF(btrim(u.name), ''), u.email) ILIKE $%d`, argIdx)
		args = append(args, "%"+query.Search+"%")
		argIdx++
	}
	studentSQL += ` ORDER BY display_name ASC, u.id::text ASC`

	sRows, err := r.db.Query(ctx, studentSQL, args...)
	if err != nil {
		return learning.LearningEvidenceReport{}, err
	}
	for sRows.Next() {
		var s studentRow
		if err := sRows.Scan(&s.id, &s.name); err != nil {
			sRows.Close()
			return learning.LearningEvidenceReport{}, err
		}
		students = append(students, s)
	}
	sRows.Close()
	if err := sRows.Err(); err != nil {
		return learning.LearningEvidenceReport{}, err
	}
	if len(students) == 0 {
		return emptyEvidenceReport(query), nil
	}

	studentIDs := make([]string, len(students))
	for i, s := range students {
		studentIDs[i] = s.id
	}

	// 3. Aggregate mastery_evidence separated by source within cutoff window
	cutoff := time.Now().UTC().Add(-time.Duration(query.Days) * 24 * time.Hour)
	evSQL := `
		SELECT
			me.student_id::text,
			mes.skill_id::text,
			COALESCE(NULLIF(btrim(sk.name), ''), mes.skill_id::text) AS skill_name,
			COUNT(*) FILTER (WHERE me.answered)::int AS questions,
			COUNT(*) FILTER (WHERE me.answered AND me.is_correct)::int AS correct,
			COUNT(DISTINCT me.source_attempt_id)::int AS tests,
			MAX(me.occurred_at) AS latest_at
		FROM mastery_evidence me
		JOIN mastery_evidence_skills mes ON mes.evidence_id = me.id
		LEFT JOIN skills sk ON sk.id = mes.skill_id
		JOIN assessments a ON a.id = me.assessment_id
		WHERE me.student_id::text = ANY($1::text[])
		  AND me.subject_id::text = $2
		  AND me.occurred_at >= $3
	`
	evArgs := []any{studentIDs, query.SubjectID, cutoff}
	evIdx := 4
	if query.Source == "school_assessment" {
		evSQL += ` AND a.owner_type = 'school'`
		if query.SchoolID != "" {
			evSQL += fmt.Sprintf(` AND a.school_id::text = $%d`, evIdx)
			evArgs = append(evArgs, query.SchoolID)
			evIdx++
		} else if !isAdmin && len(allowedSchools) > 0 {
			evSQL += fmt.Sprintf(` AND a.school_id::text = ANY($%d::text[])`, evIdx)
			evArgs = append(evArgs, allowedSchools)
			evIdx++
		}
	} else {
		evSQL += ` AND a.owner_type <> 'school'`
	}
	if query.PathID != "" {
		evSQL += fmt.Sprintf(` AND me.path_id::text = $%d`, evIdx)
		evArgs = append(evArgs, query.PathID)
		evIdx++
	}
	if query.QuizID != "" {
		evSQL += fmt.Sprintf(` AND me.assessment_id::text = $%d`, evIdx)
		evArgs = append(evArgs, query.QuizID)
		evIdx++
	}
	evSQL += ` GROUP BY me.student_id, mes.skill_id, sk.name`

	evRows, err := r.db.Query(ctx, evSQL, evArgs...)
	if err != nil {
		return learning.LearningEvidenceReport{}, err
	}
	skillsByStudent := map[string][]learning.LearningEvidenceSkill{}
	for evRows.Next() {
		var stID, skID, skName string
		var qCount, cCount, tCount int
		var latest time.Time
		if err := evRows.Scan(&stID, &skID, &skName, &qCount, &cCount, &tCount, &latest); err != nil {
			evRows.Close()
			return learning.LearningEvidenceReport{}, err
		}
		acc, status := learning.ClassifySkillEvidence(qCount, cCount, 0)
		t := latest
		skillsByStudent[stID] = append(skillsByStudent[stID], learning.LearningEvidenceSkill{
			ID:        skID,
			Name:      skName,
			Accuracy:  acc,
			Questions: qCount,
			Correct:   cCount,
			Tests:     tCount,
			LatestAt:  &t,
			Status:    status,
		})
	}
	evRows.Close()

	// 4. Classify students, build summary, filter, and paginate
	summary := map[learning.EvidenceStatus]int{
		learning.EvidenceUnmeasured:   0,
		learning.EvidenceInsufficient: 0,
		learning.EvidenceSupport:      0,
		learning.EvidenceDeveloping:   0,
		learning.EvidenceReady:        0,
	}
	filtered := make([]learning.LearningEvidenceStudent, 0, len(students))
	for _, st := range students {
		skills := skillsByStudent[st.id]
		if skills == nil {
			skills = []learning.LearningEvidenceSkill{}
		}
		sort.Slice(skills, func(i, j int) bool {
			ai, aj := 101, 101
			if skills[i].Accuracy != nil {
				ai = *skills[i].Accuracy
			}
			if skills[j].Accuracy != nil {
				aj = *skills[j].Accuracy
			}
			if ai != aj {
				return ai < aj
			}
			return skills[i].Name < skills[j].Name
		})
		if len(skills) > 24 {
			skills = skills[:24]
		}
		status := learning.ClassifyStudentEvidence(skills)
		summary[status]++
		if query.Status != "" && string(status) != query.Status {
			continue
		}
		filtered = append(filtered, learning.LearningEvidenceStudent{
			ID:         st.id,
			Name:       st.name,
			Status:     status,
			SkillCount: len(skills),
			Skills:     skills,
		})
	}

	total := len(students)
	filteredTotal := len(filtered)
	offset := (query.Page - 1) * query.Limit
	var paged []learning.LearningEvidenceStudent
	if offset >= filteredTotal {
		paged = []learning.LearningEvidenceStudent{}
	} else {
		end := offset + query.Limit
		if end > filteredTotal {
			end = filteredTotal
		}
		paged = filtered[offset:end]
	}

	return learning.LearningEvidenceReport{
		Source:        query.Source,
		SubjectID:     query.SubjectID,
		Days:          query.Days,
		Policy:        learning.DefaultLearningEvidencePolicy,
		Coverage:      "complete",
		Total:         total,
		FilteredTotal: filteredTotal,
		Page:          query.Page,
		Limit:         query.Limit,
		Summary:       summary,
		Students:      paged,
	}, nil
}

func emptyEvidenceReport(query learning.LearningEvidenceQuery) learning.LearningEvidenceReport {
	return learning.LearningEvidenceReport{
		Source:    query.Source,
		SubjectID: query.SubjectID,
		Days:      query.Days,
		Policy:    learning.DefaultLearningEvidencePolicy,
		Coverage:  "complete",
		Page:      query.Page,
		Limit:     query.Limit,
		Summary: map[learning.EvidenceStatus]int{
			learning.EvidenceUnmeasured:   0,
			learning.EvidenceInsufficient: 0,
			learning.EvidenceSupport:      0,
			learning.EvidenceDeveloping:   0,
			learning.EvidenceReady:        0,
		},
		Students: []learning.LearningEvidenceStudent{},
	}
}

func containsStr(list []string, target string) bool {
	target = strings.TrimSpace(target)
	for _, item := range list {
		if item == target {
			return true
		}
	}
	return false
}
