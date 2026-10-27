package postgres

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorOverview derives every count from the school audience rather than
// a limited student/teacher list loaded by the browser. One SQL statement
// keeps the counters and classroom snapshot internally consistent.
func (d *SchoolDirectorDirectory) DirectorOverview(ctx context.Context, schoolID string) (org.DirectorOverview, error) {
	var overview org.DirectorOverview
	var classroomsJSON []byte
	err := d.db.QueryRow(ctx, `
		SELECT s.id::text, s.name,
			(SELECT count(DISTINCT sm.user_id)::int
			 FROM school_memberships sm
			 WHERE sm.school_id=s.id AND sm.role='student' AND sm.status IN ('active','suspended')),
			(SELECT count(*)::int FROM classes c
			 WHERE c.school_id=s.id AND c.status='active'),
			(SELECT count(DISTINCT ta.teacher_id)::int
			 FROM teaching_assignments ta
			 JOIN classes c ON c.id=ta.class_id
			 WHERE ta.school_id=s.id AND c.school_id=s.id
			   AND ta.status='active' AND c.status='active'),
			(SELECT count(DISTINCT supervisor_user_id)::int
			 FROM school_supervisor_scopes ss
			 WHERE ss.school_id=s.id AND ss.status='active'),
			(SELECT count(DISTINCT a.id)::int
			 FROM assessments a
			 JOIN assessment_assignments aa ON aa.assessment_id=a.id
			 WHERE a.is_published
			   AND aa.status<>'cancelled'
			   AND (aa.school_id=s.id OR aa.school_id IS NULL)
			   AND (
			     (aa.targets_entire_school AND aa.school_id=s.id) OR
			     EXISTS (
			       SELECT 1 FROM assessment_assignment_classes ac
			       JOIN classes c ON c.id=ac.class_id
			       WHERE ac.assignment_id=aa.id AND c.school_id=s.id AND c.status='active'
			     ) OR EXISTS (
			       SELECT 1 FROM assessment_assignment_users au
			       JOIN school_memberships sm ON sm.user_id=au.user_id
			       WHERE au.assignment_id=aa.id AND sm.school_id=s.id
			         AND sm.role='student' AND sm.status IN ('active','suspended')
			     )
			   )),
			(SELECT count(*)::int FROM classroom_sessions cs
			 WHERE cs.school_id=s.id AND cs.status='ended'),
			(SELECT coalesce(jsonb_agg(
				jsonb_build_object('classId',c.id::text,'className',c.name)
				ORDER BY lower(c.name),c.id
			),'[]'::jsonb)
			 FROM classes c WHERE c.school_id=s.id AND c.status='active')
		FROM schools s WHERE s.id=$1::uuid AND s.status='active'
	`, schoolID).Scan(
		&overview.School.SchoolID,
		&overview.School.SchoolName,
		&overview.Metrics.Students,
		&overview.Metrics.Classes,
		&overview.Metrics.Teachers,
		&overview.Metrics.Supervisors,
		&overview.Metrics.SchoolAssessments,
		&overview.Metrics.CompletedSmartClasses,
		&classroomsJSON,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return org.DirectorOverview{}, org.ErrNotFound
		}
		return org.DirectorOverview{}, err
	}
	if err := json.Unmarshal(classroomsJSON, &overview.Classes); err != nil {
		return org.DirectorOverview{}, err
	}
	return overview, nil
}
