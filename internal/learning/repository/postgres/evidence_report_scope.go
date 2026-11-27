package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"
	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	learningapp "github.com/nasef6464/almeaago/internal/learning/application"
	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

type evidenceScope struct {
	schools      []string
	classes      []string
	wholeSchools []string
}

func (r *Repository) resolveEvidenceScope(ctx context.Context, actor identity.User, q learning.LearningEvidenceQuery) (evidenceScope, error) {
	var result evidenceScope
	var rows pgx.Rows
	var err error
	switch {
	case actor.HasRole(identity.RoleTeacher):
		rows, err = r.db.Query(ctx, `
			SELECT DISTINCT ta.school_id::text, ta.class_id::text, false
			FROM teaching_assignments ta
			JOIN schools s ON s.id=ta.school_id AND s.status='active'
			JOIN classes c ON c.id=ta.class_id AND c.school_id=s.id AND c.status='active'
			JOIN subjects subj ON subj.id=ta.subject_id AND subj.status='active'
			JOIN paths p ON p.id=subj.path_id AND p.status='active'
			JOIN school_memberships sm ON sm.school_id=s.id AND sm.user_id=ta.teacher_id
				AND sm.role='teacher' AND sm.status='active'
			WHERE ta.teacher_id::text=$1 AND ta.status='active'
				AND ta.subject_id::text=$2
				AND ($3='' OR s.id::text=$3)
		`, actor.ID, q.SubjectID, q.SchoolID)
	case actor.HasRole(identity.RoleSchoolAdmin):
		if q.SchoolID == "" {
			return result, learningapp.ErrForbidden
		}
		rows, err = r.db.Query(ctx, `
			SELECT DISTINCT s.id::text, COALESCE(c.id::text,''), true
			FROM school_memberships sm
			JOIN schools s ON s.id=sm.school_id AND s.status='active'
			JOIN school_membership_permissions p ON p.membership_id=sm.id
				AND p.permission='SCHOOL_REPORTS_DETAILED_VIEW'
			JOIN school_contracts sc ON sc.school_id=s.id AND sc.status='active'
				AND (sc.valid_from IS NULL OR sc.valid_from<=now())
				AND (sc.valid_until IS NULL OR sc.valid_until>=now())
			JOIN school_contract_modules m ON m.contract_id=sc.id
				AND m.module_code='SCHOOL_INTELLIGENCE' AND m.enabled
			LEFT JOIN classes c ON c.school_id=s.id AND c.status='active'
			WHERE sm.user_id::text=$1 AND sm.school_id::text=$2
				AND sm.role='school_admin' AND sm.status='active'
		`, actor.ID, q.SchoolID)
	case actor.HasRole(identity.RoleSupervisor):
		rows, err = r.db.Query(ctx, `
			SELECT DISTINCT s.id::text, COALESCE(c.id::text,''), sc.scope_type='school'
			FROM school_supervisor_scopes sc
			JOIN schools s ON s.id=sc.school_id AND s.status='active'
			JOIN school_memberships sm ON sm.school_id=s.id AND sm.user_id=sc.supervisor_user_id
				AND sm.role='supervisor' AND sm.status='active'
			LEFT JOIN classes c ON c.school_id=s.id AND c.status='active'
				AND (sc.scope_type='school' OR c.id=sc.class_id)
			WHERE sc.supervisor_user_id::text=$1 AND sc.status='active'
				AND ($2='' OR s.id::text=$2)
				AND (sc.scope_type='school' OR c.id IS NOT NULL)
		`, actor.ID, q.SchoolID)
	default:
		return result, learningapp.ErrForbidden
	}
	if err != nil {
		return result, err
	}
	defer rows.Close()
	for rows.Next() {
		var schoolID, classID string
		var wholeSchool bool
		if err := rows.Scan(&schoolID, &classID, &wholeSchool); err != nil {
			return result, err
		}
		if !containsStr(result.schools, schoolID) {
			result.schools = append(result.schools, schoolID)
		}
		if classID != "" && !containsStr(result.classes, classID) {
			result.classes = append(result.classes, classID)
		}
		if wholeSchool && !containsStr(result.wholeSchools, schoolID) {
			result.wholeSchools = append(result.wholeSchools, schoolID)
		}
	}
	if err := rows.Err(); err != nil {
		return result, err
	}
	if (q.SchoolID != "" && !containsStr(result.schools, q.SchoolID)) ||
		(q.ClassID != "" && !containsStr(result.classes, q.ClassID)) {
		return result, learningapp.ErrForbidden
	}
	return result, nil
}
