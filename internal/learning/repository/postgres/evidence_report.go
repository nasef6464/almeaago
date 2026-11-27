package postgres

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) ReadLearningEvidence(
	ctx context.Context,
	actor identity.User,
	query learning.LearningEvidenceQuery,
) (learning.LearningEvidenceReport, error) {
	isAdmin := actor.HasRole(identity.RoleAdmin)
	var scope evidenceScope
	if !isAdmin {
		var err error
		scope, err = r.resolveEvidenceScope(ctx, actor, query)
		if err != nil {
			return learning.LearningEvidenceReport{}, err
		}
		if len(scope.schools) == 0 {
			return emptyEvidenceReport(query), nil
		}
	}

	// 2. Load scoped active students
	type studentRow struct {
		id   string
		name string
	}
	var students []studentRow
	studentSQL := `
		SELECT DISTINCT u.id::text, COALESCE(NULLIF(btrim(u.name), ''), u.email) AS display_name
		FROM users u
		JOIN user_roles ur ON ur.user_id = u.id AND ur.role = 'student'
		WHERE u.status = 'active'
	`
	args := []any{}
	argIdx := 1
	if query.SchoolID != "" {
		studentSQL += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM school_memberships sm
			WHERE sm.user_id=u.id AND sm.school_id::text=$%d AND sm.role='student' AND sm.status='active'
		)`, argIdx)
		args = append(args, query.SchoolID)
		argIdx++
	}
	if query.ClassID != "" {
		studentSQL += fmt.Sprintf(` AND EXISTS (
			SELECT 1 FROM class_memberships cm
			JOIN classes c ON c.id=cm.class_id AND c.status='active'
			JOIN school_memberships sm ON sm.school_id=c.school_id AND sm.user_id=cm.user_id
				AND sm.role='student' AND sm.status='active'
			WHERE cm.user_id=u.id AND c.id::text=$%d AND cm.status='active'
				AND ($%d='' OR c.school_id::text=$%d)
		)`, argIdx, argIdx+1, argIdx+1)
		args = append(args, query.ClassID, query.SchoolID)
		argIdx += 2
	} else if !isAdmin {
		studentSQL += fmt.Sprintf(` AND (
			EXISTS (
				SELECT 1 FROM class_memberships cm
				JOIN classes c ON c.id=cm.class_id AND c.status='active'
				JOIN school_memberships sm ON sm.school_id=c.school_id AND sm.user_id=cm.user_id
					AND sm.role='student' AND sm.status='active'
				WHERE cm.user_id=u.id AND c.id::text=ANY($%d::text[]) AND cm.status='active'
			)
			OR EXISTS (
				SELECT 1 FROM school_memberships sm
				WHERE sm.user_id=u.id AND sm.school_id::text=ANY($%d::text[])
					AND sm.role='student' AND sm.status='active'
			)
		)`, argIdx, argIdx+1)
		args = append(args, scope.classes, scope.wholeSchools)
		argIdx += 2
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
			COUNT(DISTINCT COALESCE(me.source_attempt_id,me.self_attempt_id))::int AS tests,
			MAX(me.occurred_at) AS latest_at
		FROM mastery_evidence me
		JOIN mastery_evidence_skills mes ON mes.evidence_id = me.id
		LEFT JOIN skills sk ON sk.id = mes.skill_id
		LEFT JOIN assessments a ON a.id = me.assessment_id
		WHERE me.student_id::text = ANY($1::text[])
		  AND me.subject_id::text = $2
		  AND me.occurred_at >= $3
	`
	evArgs := []any{studentIDs, query.SubjectID, cutoff}
	evIdx := 4
	if query.Source == "school_assessment" {
		evSQL += ` AND a.owner_type='school' AND EXISTS (
			SELECT 1 FROM school_memberships sm
			WHERE sm.user_id=me.student_id AND sm.school_id=a.owner_school_id
				AND sm.role='student' AND sm.status='active'
		)`
		if query.SchoolID != "" {
			evSQL += fmt.Sprintf(` AND a.owner_school_id::text = $%d`, evIdx)
			evArgs = append(evArgs, query.SchoolID)
			evIdx++
		} else if query.ClassID != "" {
			evSQL += fmt.Sprintf(` AND a.owner_school_id=(SELECT school_id FROM classes WHERE id::text=$%d)`, evIdx)
			evArgs = append(evArgs, query.ClassID)
			evIdx++
		} else if !isAdmin {
			evSQL += fmt.Sprintf(` AND a.owner_school_id::text = ANY($%d::text[])`, evIdx)
			evArgs = append(evArgs, scope.schools)
			evIdx++
		}
	} else {
		evSQL += ` AND (me.self_attempt_id IS NOT NULL OR a.owner_type<>'school')`
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
	if err := evRows.Err(); err != nil {
		return learning.LearningEvidenceReport{}, err
	}

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
