package postgres

import (
	"context"
	"errors"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorAssessments returns only explicit audiences in this school, plus
// explicitly marked untargeted central drafts owned by this same school.
// A school-scoped assignment with no audience must never widen access.
func (d *SchoolDirectorDirectory) DirectorAssessments(ctx context.Context, schoolID string) (org.DirectorAssessmentWorkspace, error) {
	workspace := org.DirectorAssessmentWorkspace{
		Assessments: make([]org.SchoolDirectorAssessment, 0),
		Classes:     make([]org.DirectorOverviewClass, 0),
	}
	var active bool
	if err := d.db.QueryRow(ctx, `SELECT true FROM schools WHERE id=$1::uuid AND status='active'`, schoolID).Scan(&active); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return org.DirectorAssessmentWorkspace{}, org.ErrNotFound
		}
		return org.DirectorAssessmentWorkspace{}, err
	}
	classes, err := d.db.Query(ctx, `
		SELECT id::text, name FROM classes
		WHERE school_id=$1::uuid AND status='active'
		ORDER BY lower(name), id`, schoolID)
	if err != nil {
		return org.DirectorAssessmentWorkspace{}, err
	}
	for classes.Next() {
		var classroom org.DirectorOverviewClass
		if err := classes.Scan(&classroom.ClassID, &classroom.ClassName); err != nil {
			classes.Close()
			return org.DirectorAssessmentWorkspace{}, err
		}
		workspace.Classes = append(workspace.Classes, classroom)
	}
	if err := classes.Err(); err != nil {
		classes.Close()
		return org.DirectorAssessmentWorkspace{}, err
	}
	classes.Close()

	rows, err := d.db.Query(ctx, `
		SELECT a.id::text, v.title, coalesce(v.subject_id::text,''), a.is_published,
			coalesce((
			  SELECT array_agg(DISTINCT targeting.group_id ORDER BY targeting.group_id)
			  FROM (
			    SELECT aa.school_id::text AS group_id
			    FROM assessment_assignments aa
			    WHERE aa.assessment_id=a.id AND aa.school_id=$1::uuid
			      AND aa.status<>'cancelled' AND aa.targets_entire_school
			    UNION ALL
			    SELECT ac.class_id::text AS group_id
			    FROM assessment_assignments aa
			    JOIN assessment_assignment_classes ac ON ac.assignment_id=aa.id
			    JOIN classes c ON c.id=ac.class_id
			    WHERE aa.assessment_id=a.id AND (aa.school_id=$1::uuid OR aa.school_id IS NULL)
			      AND aa.status<>'cancelled' AND c.school_id=$1::uuid AND c.status='active'
			  ) targeting
			), ARRAY[]::text[])
		FROM assessments a
		JOIN assessment_versions v ON v.assessment_id=a.id
		 AND v.version=CASE WHEN a.is_published THEN a.published_version ELSE a.current_version END
		WHERE (
		  EXISTS (
		    SELECT 1 FROM assessment_assignments aa
		    WHERE aa.assessment_id=a.id AND aa.status<>'cancelled'
		      AND (aa.school_id=$1::uuid OR aa.school_id IS NULL)
		      AND (
		        (aa.targets_entire_school AND aa.school_id=$1::uuid)
		        OR EXISTS (
		          SELECT 1 FROM assessment_assignment_classes ac
		          JOIN classes c ON c.id=ac.class_id
		          WHERE ac.assignment_id=aa.id AND c.school_id=$1::uuid AND c.status='active'
		        )
		        OR EXISTS (
		          SELECT 1 FROM assessment_assignment_users au
		          JOIN school_memberships sm ON sm.user_id=au.user_id
		          WHERE au.assignment_id=aa.id AND sm.school_id=$1::uuid
		            AND sm.role='student' AND sm.status IN ('active','suspended')
		        )
		      )
		  ) OR (
		    a.owner_type='school' AND a.owner_school_id=$1::uuid
		    AND a.is_school_central_draft AND NOT a.is_published
		    AND NOT EXISTS (
		      SELECT 1 FROM assessment_assignments aa
		      WHERE aa.assessment_id=a.id AND aa.status<>'cancelled'
		        AND (aa.targets_entire_school
		          OR EXISTS (SELECT 1 FROM assessment_assignment_classes ac WHERE ac.assignment_id=aa.id)
		          OR EXISTS (SELECT 1 FROM assessment_assignment_users au WHERE au.assignment_id=aa.id))
		    )
		  )
		)
		ORDER BY a.created_at DESC, a.id DESC
		LIMIT 100`, schoolID)
	if err != nil {
		return org.DirectorAssessmentWorkspace{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var item org.SchoolDirectorAssessment
		if err := rows.Scan(&item.ID, &item.Title, &item.SubjectID, &item.IsPublished, &item.TargetGroupIDs); err != nil {
			return org.DirectorAssessmentWorkspace{}, err
		}
		workspace.Assessments = append(workspace.Assessments, item)
	}
	if err := rows.Err(); err != nil {
		return org.DirectorAssessmentWorkspace{}, err
	}
	return workspace, nil
}
