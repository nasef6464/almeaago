package postgres

import (
	"context"
	"encoding/json"
	"errors"
	"strings"

	"github.com/jackc/pgx/v5"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// Authorization is repeated inside SQL so a revoked contract, permission or
// membership can never be bypassed by a concurrently valid service context.
const schoolEligibleAssessmentStudentsSQL = `
WITH permitted_school AS (
  SELECT s.id FROM schools s
  WHERE s.id=$1::uuid AND s.status='active'
    AND EXISTS (
      SELECT 1 FROM school_memberships staff
      JOIN users staff_user ON staff_user.id=staff.user_id
      JOIN school_membership_permissions permission ON permission.membership_id=staff.id
      JOIN school_contracts contract ON contract.school_id=staff.school_id
      JOIN school_contract_modules module ON module.contract_id=contract.id
      WHERE staff.school_id=s.id AND staff.user_id=$2::uuid
        AND staff.role='school_admin' AND staff.status='active' AND staff_user.status='active'
        AND permission.permission='SCHOOL_ASSESSMENTS_MANAGE'
        AND contract.status='active'
        AND (contract.valid_from IS NULL OR contract.valid_from<=now())
        AND (contract.valid_until IS NULL OR contract.valid_until>=now())
        AND module.module_code='SCHOOL_ASSESSMENTS' AND module.enabled=true
    )
), candidates AS (
  SELECT DISTINCT student.id,student.name,
    COALESCE((
      SELECT c.name FROM class_memberships cm
      JOIN classes c ON c.id=cm.class_id AND c.school_id=ps.id AND c.status='active'
      WHERE cm.user_id=student.id AND cm.status='active'
      ORDER BY c.name,c.id LIMIT 1
    ),'') AS class_name
  FROM permitted_school ps
  JOIN school_memberships learner ON learner.school_id=ps.id
    AND learner.role='student' AND learner.status='active'
  JOIN users student ON student.id=learner.user_id AND student.status='active'
  WHERE $3='' OR student.name ILIKE '%'||$3||'%' ESCAPE '\'
), paged AS (
  SELECT * FROM candidates ORDER BY name,id LIMIT $4 OFFSET (($5-1)*$4)
)
SELECT (SELECT COUNT(*)::int FROM candidates),
  COALESCE((SELECT jsonb_agg(jsonb_build_object(
    'studentId',p.id::text,'name',p.name,'className',p.class_name
  ) ORDER BY p.name,p.id) FROM paged p),'[]'::jsonb)
FROM permitted_school LIMIT 1`

func (r *Repository) DirectorAssessmentEligibleStudents(ctx context.Context, actorUserID, schoolID, search string, page, limit int) (org.DirectorAssessmentStudentPage, error) {
	return readDirectorAssessmentEligibleStudents(ctx, r.db, actorUserID, schoolID, search, page, limit)
}

func readDirectorAssessmentEligibleStudents(ctx context.Context, db schoolAssessmentLearnerRow, actorUserID, schoolID, search string, page, limit int) (org.DirectorAssessmentStudentPage, error) {
	result := org.DirectorAssessmentStudentPage{Items: []org.DirectorAssessmentCandidate{}, Page: page, Limit: limit}
	escaped := strings.NewReplacer(`\`, `\\`, `%`, `\%`, `_`, `\_`).Replace(search)
	var rows []byte
	err := db.QueryRow(ctx, schoolEligibleAssessmentStudentsSQL, schoolID, actorUserID, escaped, limit, page).Scan(&result.Total, &rows)
	if errors.Is(err, pgx.ErrNoRows) {
		return result, org.ErrNotFound
	}
	if err != nil {
		return result, err
	}
	if err = json.Unmarshal(rows, &result.Items); err != nil {
		return result, err
	}
	result.HasMore = page*limit < result.Total
	return result, nil
}
