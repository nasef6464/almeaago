package postgres

import (
	"context"
	"strconv"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	identity "github.com/nasef6464/almeaago/internal/identity/domain"
	reporting "github.com/nasef6464/almeaago/internal/reporting/domain"
)

type ReportRepository struct {
	db *pgxpool.Pool
}

func NewReportRepository(db *pgxpool.Pool) *ReportRepository {
	return &ReportRepository{db: db}
}

func hasRole(roles []identity.Role, target identity.Role) bool {
	for _, role := range roles {
		if role == target {
			return true
		}
	}
	return false
}

func (r *ReportRepository) ResolveScope(
	ctx context.Context,
	actor identity.User,
	query reporting.Query,
) (reporting.ResolvedScope, error) {
	switch {
	case hasRole(actor.Roles, identity.RoleAdmin):
		return r.resolveAdminScope(ctx, actor, query)
	case hasRole(actor.Roles, identity.RoleSchoolAdmin):
		return r.resolveSchoolAdminScope(ctx, actor, query)
	case hasRole(actor.Roles, identity.RoleSupervisor):
		return r.resolveSupervisorScope(ctx, actor, query)
	case hasRole(actor.Roles, identity.RoleTeacher):
		return r.resolveTeacherScope(ctx, actor, query)
	case hasRole(actor.Roles, identity.RoleStudent):
		if query.SchoolID != "" || query.ClassID != "" {
			return reporting.ResolvedScope{}, reporting.ErrForbidden
		}
		return reporting.ResolvedScope{
			Kind:         reporting.ScopeStudent,
			ActorUserID:  actor.ID,
			StudentIDs:   []string{actor.ID},
			StudentCount: 1,
			CanDetail:    true,
			CanExport:    true,
		}, nil
	default:
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
}

func (r *ReportRepository) resolveAdminScope(
	ctx context.Context,
	actor identity.User,
	query reporting.Query,
) (reporting.ResolvedScope, error) {
	if query.SchoolID == "" {
		if query.ClassID != "" {
			return reporting.ResolvedScope{}, reporting.ErrForbidden
		}
		ids, total, err := r.samplePlatformStudents(ctx, query.StudentLimit)
		if err != nil {
			return reporting.ResolvedScope{}, err
		}
		return reporting.ResolvedScope{
			Kind: reporting.ScopePlatform, ActorUserID: actor.ID,
			StudentIDs: ids, StudentCount: total, CanDetail: true, CanExport: true,
		}, nil
	}
	ids, total, err := r.sampleSchoolStudents(ctx, query.SchoolID, query.ClassID, query.StudentLimit)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	return reporting.ResolvedScope{
		Kind: reporting.ScopeSchool, ActorUserID: actor.ID, SchoolID: query.SchoolID, ClassID: query.ClassID,
		StudentIDs: ids, StudentCount: total, CanDetail: true, CanExport: true,
	}, nil
}

func (r *ReportRepository) resolveSchoolAdminScope(
	ctx context.Context,
	actor identity.User,
	query reporting.Query,
) (reporting.ResolvedScope, error) {
	if query.SchoolID == "" {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	var canAggregate, canDetail, canExport bool
	err := r.db.QueryRow(ctx, `
		SELECT
			EXISTS(
				SELECT 1
				FROM school_memberships sm
				JOIN school_membership_permissions p ON p.membership_id=sm.id
				WHERE sm.school_id=$1::uuid AND sm.user_id=$2::uuid
				  AND sm.role='school_admin' AND sm.status='active'
				  AND p.permission='SCHOOL_REPORTS_AGGREGATE_VIEW'
			),
			EXISTS(
				SELECT 1
				FROM school_memberships sm
				JOIN school_membership_permissions p ON p.membership_id=sm.id
				WHERE sm.school_id=$1::uuid AND sm.user_id=$2::uuid
				  AND sm.role='school_admin' AND sm.status='active'
				  AND p.permission='SCHOOL_REPORTS_DETAILED_VIEW'
			),
			EXISTS(
				SELECT 1
				FROM school_memberships sm
				JOIN school_membership_permissions p ON p.membership_id=sm.id
				WHERE sm.school_id=$1::uuid AND sm.user_id=$2::uuid
				  AND sm.role='school_admin' AND sm.status='active'
				  AND p.permission='SCHOOL_REPORTS_EXPORT'
			)
	`, query.SchoolID, actor.ID).Scan(&canAggregate, &canDetail, &canExport)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	if !canAggregate {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	ids, total, err := r.sampleSchoolStudents(ctx, query.SchoolID, query.ClassID, query.StudentLimit)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	return reporting.ResolvedScope{
		Kind: reporting.ScopeSchool, ActorUserID: actor.ID, SchoolID: query.SchoolID, ClassID: query.ClassID,
		StudentIDs: ids, StudentCount: total, CanDetail: canDetail, CanExport: canExport,
	}, nil
}

func (r *ReportRepository) resolveSupervisorScope(
	ctx context.Context,
	actor identity.User,
	query reporting.Query,
) (reporting.ResolvedScope, error) {
	if query.SchoolID == "" {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	var allowed bool
	if query.ClassID != "" {
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM school_supervisor_scopes ss
				WHERE ss.supervisor_user_id=$1::uuid
				  AND ss.school_id=$2::uuid
				  AND ss.status='active'
				  AND (ss.scope_type='school' OR (ss.scope_type='class' AND ss.class_id=$3::uuid))
			)
		`, actor.ID, query.SchoolID, query.ClassID).Scan(&allowed)
		if err != nil {
			return reporting.ResolvedScope{}, err
		}
	} else {
		err := r.db.QueryRow(ctx, `
			SELECT EXISTS(
				SELECT 1 FROM school_supervisor_scopes ss
				WHERE ss.supervisor_user_id=$1::uuid
				  AND ss.school_id=$2::uuid
				  AND ss.status='active'
				  AND ss.scope_type='school'
			)
		`, actor.ID, query.SchoolID).Scan(&allowed)
		if err != nil {
			return reporting.ResolvedScope{}, err
		}
	}
	if !allowed {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	ids, total, err := r.sampleSchoolStudents(ctx, query.SchoolID, query.ClassID, query.StudentLimit)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	return reporting.ResolvedScope{
		Kind: reporting.ScopeSupervisor, ActorUserID: actor.ID, SchoolID: query.SchoolID, ClassID: query.ClassID,
		StudentIDs: ids, StudentCount: total, CanDetail: true, CanExport: false,
	}, nil
}

func (r *ReportRepository) resolveTeacherScope(
	ctx context.Context,
	actor identity.User,
	query reporting.Query,
) (reporting.ResolvedScope, error) {
	if query.SchoolID == "" {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	var allowed bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(
			SELECT 1
			FROM school_memberships sm
			JOIN teaching_assignments ta
			  ON ta.school_id=sm.school_id
			 AND ta.teacher_id=sm.user_id
			 AND ta.status='active'
			WHERE sm.school_id=$1::uuid
			  AND sm.user_id=$2::uuid
			  AND sm.role='teacher'
			  AND sm.status='active'
			  AND ($3='' OR ta.class_id=NULLIF($3,'')::uuid)
			  AND ($4='' OR ta.subject_id IS NULL OR ta.subject_id=NULLIF($4,'')::uuid)
		)
	`, query.SchoolID, actor.ID, query.ClassID, query.SubjectID).Scan(&allowed)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	if !allowed {
		return reporting.ResolvedScope{}, reporting.ErrForbidden
	}
	ids, total, err := r.sampleTeacherStudents(ctx, actor.ID, query, query.StudentLimit)
	if err != nil {
		return reporting.ResolvedScope{}, err
	}
	return reporting.ResolvedScope{
		Kind: reporting.ScopeTeacher, ActorUserID: actor.ID, SchoolID: query.SchoolID, ClassID: query.ClassID,
		StudentIDs: ids, StudentCount: total, CanDetail: true, CanExport: false,
	}, nil
}

func (r *ReportRepository) samplePlatformStudents(ctx context.Context, limit int) ([]string, int, error) {
	var total int
	if err := r.db.QueryRow(ctx, `
		SELECT count(*)::int
		FROM users u
		WHERE u.status='active'
		  AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='student')
	`).Scan(&total); err != nil {
		return nil, 0, err
	}
	rows, err := r.db.Query(ctx, `
		SELECT u.id::text
		FROM users u
		WHERE u.status='active'
		  AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='student')
		ORDER BY u.id
		LIMIT $1
	`, limit)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	ids, err := scanIDs(rows)
	return ids, total, err
}

func (r *ReportRepository) sampleSchoolStudents(
	ctx context.Context,
	schoolID, classID string,
	limit int,
) ([]string, int, error) {
	args := []any{schoolID}
	where := `
		FROM school_memberships sm
		JOIN users u ON u.id=sm.user_id AND u.status='active'
		WHERE sm.school_id=$1::uuid AND sm.role='student' AND sm.status='active'
	`
	if classID != "" {
		args = append(args, classID)
		where += ` AND EXISTS(
			SELECT 1 FROM class_memberships cm
			JOIN classes c ON c.id=cm.class_id AND c.school_id=sm.school_id AND c.status='active'
			WHERE cm.user_id=u.id AND cm.class_id=$2::uuid AND cm.status='active'
		)`
	}
	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(DISTINCT u.id)::int "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limitParam := len(args) + 1
	listArgs := append(append([]any{}, args...), limit)
	rows, err := r.db.Query(ctx, `
		SELECT DISTINCT u.id::text
	`+where+`
		ORDER BY u.id::text
		LIMIT $`+strconv.Itoa(limitParam), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	ids, err := scanIDs(rows)
	return ids, total, err
}

func (r *ReportRepository) sampleTeacherStudents(
	ctx context.Context,
	teacherID string,
	query reporting.Query,
	limit int,
) ([]string, int, error) {
	args := []any{teacherID, query.SchoolID}
	where := `
		FROM users u
		WHERE u.status='active'
		  AND EXISTS(SELECT 1 FROM user_roles ur WHERE ur.user_id=u.id AND ur.role='student')
		  AND EXISTS(
			SELECT 1
			FROM class_memberships cm
			JOIN classes c ON c.id=cm.class_id AND c.school_id=$2::uuid AND c.status='active'
			JOIN teaching_assignments ta
			  ON ta.school_id=c.school_id
			 AND ta.class_id=c.id
			 AND ta.teacher_id=$1::uuid
			 AND ta.status='active'
			WHERE cm.user_id=u.id AND cm.status='active'
	`
	if query.ClassID != "" {
		args = append(args, query.ClassID)
		where += " AND ta.class_id=$" + strconv.Itoa(len(args)) + "::uuid"
	}
	if query.SubjectID != "" {
		args = append(args, query.SubjectID)
		where += " AND (ta.subject_id IS NULL OR ta.subject_id=$" + strconv.Itoa(len(args)) + "::uuid)"
	}
	where += ")"
	var total int
	if err := r.db.QueryRow(ctx, "SELECT count(*)::int "+where, args...).Scan(&total); err != nil {
		return nil, 0, err
	}
	limitParam := len(args) + 1
	listArgs := append(append([]any{}, args...), limit)
	rows, err := r.db.Query(ctx, "SELECT u.id::text "+where+" ORDER BY u.id LIMIT $"+strconv.Itoa(limitParam), listArgs...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()
	ids, err := scanIDs(rows)
	return ids, total, err
}

type rowsScanner interface {
	Next() bool
	Scan(...any) error
	Err() error
}

func scanIDs(rows rowsScanner) ([]string, error) {
	out := []string{}
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

func resultScopeClause(scope reporting.ResolvedScope, query reporting.Query, start int) (string, []any) {
	args := []any{}
	add := func(value any) string {
		args = append(args, value)
		return "$" + strconv.Itoa(start+len(args)-1)
	}
	clauses := []string{}

	switch scope.Kind {
	case reporting.ScopeStudent:
		clauses = append(clauses, "a.student_id="+add(scope.ActorUserID)+"::uuid")
	case reporting.ScopePlatform:
		// Platform admin can report across all canonical result rows.
	case reporting.ScopeSchool, reporting.ScopeSupervisor, reporting.ScopeTeacher:
		school := add(scope.SchoolID)
		contextClause := `(
			(a.assignment_id IS NOT NULL AND EXISTS(
				SELECT 1 FROM assessment_assignments aa
				WHERE aa.id=a.assignment_id AND aa.school_id=`+school+`::uuid
			))
			OR
			(a.session_id IS NOT NULL AND EXISTS(
				SELECT 1 FROM assessment_sessions ase
				WHERE ase.id=a.session_id AND ase.school_id=`+school+`::uuid
			))
		)`
		clauses = append(clauses, contextClause)
		clauses = append(clauses, `EXISTS(
			SELECT 1
			FROM school_memberships report_sm
			WHERE report_sm.school_id=`+school+`::uuid
			  AND report_sm.user_id=a.student_id
			  AND report_sm.role='student'
			  AND report_sm.status='active'
		)`)
		if scope.ClassID != "" {
			classParam := add(scope.ClassID)
			clauses = append(clauses, `EXISTS(
				SELECT 1 FROM class_memberships report_cm
				JOIN classes report_c
				  ON report_c.id=report_cm.class_id
				 AND report_c.school_id=`+school+`::uuid
				 AND report_c.status='active'
				WHERE report_cm.user_id=a.student_id
				  AND report_cm.class_id=`+classParam+`::uuid
				  AND report_cm.status='active'
			)`)
			clauses = append(clauses, `(
				(a.assignment_id IS NOT NULL AND EXISTS(
					SELECT 1 FROM assessment_assignment_classes aac
					WHERE aac.assignment_id=a.assignment_id AND aac.class_id=`+classParam+`::uuid
				))
				OR
				(a.session_id IS NOT NULL AND EXISTS(
					SELECT 1 FROM assessment_sessions ase
					WHERE ase.id=a.session_id AND ase.class_id=`+classParam+`::uuid
				))
			)`)
		}
		if scope.Kind == reporting.ScopeTeacher {
			actor := add(scope.ActorUserID)
			clauses = append(clauses, `EXISTS(
				SELECT 1
				FROM teaching_assignments ta
				WHERE ta.teacher_id=`+actor+`::uuid
				  AND ta.school_id=`+school+`::uuid
				  AND ta.status='active'
				  AND (ta.subject_id IS NULL OR ta.subject_id=v.subject_id)
				  AND (
					(a.assignment_id IS NOT NULL AND EXISTS(
						SELECT 1 FROM assessment_assignment_classes aac
						WHERE aac.assignment_id=a.assignment_id AND aac.class_id=ta.class_id
					))
					OR
					(a.session_id IS NOT NULL AND EXISTS(
						SELECT 1 FROM assessment_sessions ase
						WHERE ase.id=a.session_id AND ase.class_id=ta.class_id
					))
				  )
			)`)
		}
	}
	if query.PathID != "" {
		clauses = append(clauses, "v.path_id="+add(query.PathID)+"::uuid")
	}
	if query.SubjectID != "" {
		clauses = append(clauses, "v.subject_id="+add(query.SubjectID)+"::uuid")
	}
	if len(clauses) == 0 {
		return "", args
	}
	return " AND " + strings.Join(clauses, " AND "), args
}

func (r *ReportRepository) Overview(
	ctx context.Context,
	scope reporting.ResolvedScope,
	query reporting.Query,
) (reporting.Overview, error) {
	out := reporting.Overview{
		Scope: reporting.ScopeSummary{
			Kind: scope.Kind, SchoolID: scope.SchoolID, ClassID: scope.ClassID,
			StudentCount: scope.StudentCount, SampledStudentCount: len(scope.StudentIDs),
			IsTruncated: scope.StudentCount > len(scope.StudentIDs),
			Limits: reporting.AppliedLimits{
				Students: query.StudentLimit, Results: query.ResultLimit, Attempts: query.AttemptLimit,
			},
			CanDetail: scope.CanDetail, CanExport: scope.CanExport,
		},
		WeakestSkills: []reporting.SkillAggregate{},
	}
	if len(scope.StudentIDs) == 0 {
		return out, nil
	}

	baseArgs := []any{scope.StudentIDs}
	scopeClause, scopeArgs := resultScopeClause(scope, query, 2)
	baseArgs = append(baseArgs, scopeArgs...)

	countSQL := `
		SELECT count(*)::int
		FROM assessment_results r
		JOIN assessment_attempts a ON a.id=r.attempt_id
		JOIN assessment_versions v ON v.assessment_id=r.assessment_id AND v.version=r.assessment_version
		WHERE r.student_id::text=ANY($1::text[])
	` + scopeClause
	var totalResults int
	if err := r.db.QueryRow(ctx, countSQL, baseArgs...).Scan(&totalResults); err != nil {
		return reporting.Overview{}, err
	}
	out.Assessment.ResultCount = totalResults

	resultLimitParam := len(baseArgs) + 1
	resultArgs := append(append([]any{}, baseArgs...), query.ResultLimit)
	var sampledResults, passed int
	var average float64
	err := r.db.QueryRow(ctx, `
		WITH sampled AS (
			SELECT r.score,r.passed
			FROM assessment_results r
			JOIN assessment_attempts a ON a.id=r.attempt_id
			JOIN assessment_versions v ON v.assessment_id=r.assessment_id AND v.version=r.assessment_version
			WHERE r.student_id::text=ANY($1::text[])
	`+scopeClause+`
			ORDER BY r.finalized_at DESC,r.attempt_id DESC
			LIMIT $`+strconv.Itoa(resultLimitParam)+`
		)
		SELECT count(*)::int,
		       COALESCE(avg(score),0)::float8,
		       count(*) FILTER(WHERE passed)::int
		FROM sampled
	`, resultArgs...).Scan(&sampledResults, &average, &passed)
	if err != nil {
		return reporting.Overview{}, err
	}
	out.Assessment.SampledResultCount = sampledResults
	out.Assessment.ResultsTruncated = totalResults > sampledResults
	out.Assessment.AverageScore = average
	out.Assessment.Passed = passed
	out.Assessment.Failed = sampledResults - passed
	if sampledResults > 0 {
		out.Assessment.PassRate = float64(passed) / float64(sampledResults) * 100
	}

	attemptCountSQL := `
		SELECT count(*)::int
		FROM assessment_attempts a
		JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version
		LEFT JOIN assessment_results r ON r.attempt_id=a.id
		WHERE a.student_id::text=ANY($1::text[])
	` + scopeClause
	var totalAttempts int
	if err = r.db.QueryRow(ctx, attemptCountSQL, baseArgs...).Scan(&totalAttempts); err != nil {
		return reporting.Overview{}, err
	}
	out.Assessment.AttemptCount = totalAttempts
	if totalAttempts > query.AttemptLimit {
		out.Assessment.SampledAttemptCount = query.AttemptLimit
		out.Assessment.AttemptsTruncated = true
	} else {
		out.Assessment.SampledAttemptCount = totalAttempts
	}

	skillLimitParam := len(baseArgs) + 1
	skillArgs := append(append([]any{}, baseArgs...), query.AttemptLimit)
	skillRows, err := r.db.Query(ctx, `
		WITH sampled_evidence AS (
			SELECT me.id,me.student_id,me.is_correct
			FROM mastery_evidence me
			JOIN assessment_attempts a ON a.id=me.source_attempt_id
			JOIN assessment_versions v ON v.assessment_id=a.assessment_id AND v.version=a.assessment_version
			LEFT JOIN assessment_results r ON r.attempt_id=a.id
			WHERE me.student_id::text=ANY($1::text[])
	`+scopeClause+`
			ORDER BY me.occurred_at DESC,me.id DESC
			LIMIT $`+strconv.Itoa(skillLimitParam)+`
		)
		SELECT
			mes.skill_id::text,
			s.name,
			count(*)::int,
			count(DISTINCT se.student_id)::int,
			(avg(CASE WHEN se.is_correct THEN 100.0 ELSE 0.0 END))::float8
		FROM sampled_evidence se
		JOIN mastery_evidence_skills mes ON mes.evidence_id=se.id
		JOIN skills s ON s.id=mes.skill_id
		GROUP BY mes.skill_id,s.name
		HAVING count(*) >= 3
		   AND avg(CASE WHEN se.is_correct THEN 100.0 ELSE 0.0 END) < 50
		ORDER BY avg(CASE WHEN se.is_correct THEN 100.0 ELSE 0.0 END) ASC,count(*) DESC,mes.skill_id
		LIMIT 10
	`, skillArgs...)
	if err != nil {
		return reporting.Overview{}, err
	}
	defer skillRows.Close()
	for skillRows.Next() {
		var item reporting.SkillAggregate
		if err = skillRows.Scan(
			&item.SkillID,&item.SkillName,&item.EvidenceCount,&item.AffectedStudents,&item.Mastery,
		); err != nil {
			return reporting.Overview{}, err
		}
		out.WeakestSkills = append(out.WeakestSkills,item)
	}
	if err = skillRows.Err(); err != nil {
		return reporting.Overview{}, err
	}
	return out,nil
}

func (r *ReportRepository) Results(
	ctx context.Context,
	scope reporting.ResolvedScope,
	query reporting.Query,
	page, limit int,
) (reporting.ResultPage, error) {
	return r.resultPage(ctx,scope,query,page,limit,false)
}

func (r *ReportRepository) resultPage(
	ctx context.Context,
	scope reporting.ResolvedScope,
	query reporting.Query,
	page, limit int,
	export bool,
) (reporting.ResultPage, error) {
	scopeClause, args := resultScopeClause(scope, query, 1)
	base := `
		FROM assessment_results r
		JOIN assessment_attempts a ON a.id=r.attempt_id
		JOIN assessment_versions v ON v.assessment_id=r.assessment_id AND v.version=r.assessment_version
		JOIN users u ON u.id=r.student_id
		WHERE 1=1
	`+scopeClause
	var total int
	if err := r.db.QueryRow(ctx,"SELECT count(*)::int "+base,args...).Scan(&total); err != nil {
		return reporting.ResultPage{},err
	}
	limitParam:=len(args)+1
	offsetParam:=len(args)+2
	listArgs:=append(append([]any{},args...),limit,(page-1)*limit)
	rows,err:=r.db.Query(ctx,`
		SELECT r.attempt_id::text,r.student_id::text,u.name,r.assessment_id::text,r.assessment_version,
		       v.title,v.path_id::text,COALESCE(v.subject_id::text,''),r.score::float8,r.passed,
		       r.correct_answers,r.wrong_answers,r.unanswered,r.time_spent_seconds,r.finalized_at
	`+base+`
		ORDER BY r.finalized_at DESC,r.attempt_id DESC
		LIMIT $`+strconv.Itoa(limitParam)+` OFFSET $`+strconv.Itoa(offsetParam),listArgs...)
	if err != nil {
		return reporting.ResultPage{},err
	}
	defer rows.Close()
	out:=reporting.ResultPage{Items:[]reporting.ResultItem{},Page:page,Limit:limit,Total:total}
	for rows.Next(){
		var item reporting.ResultItem
		if err=rows.Scan(
			&item.AttemptID,&item.StudentID,&item.StudentName,&item.AssessmentID,&item.AssessmentVersion,
			&item.Title,&item.PathID,&item.SubjectID,&item.Score,&item.Passed,
			&item.CorrectAnswers,&item.WrongAnswers,&item.Unanswered,&item.TimeSpentSeconds,&item.FinalizedAt,
		);err!=nil{return out,err}
		out.Items=append(out.Items,item)
	}
	if err=rows.Err();err!=nil{return out,err}
	out.HasMore=(page-1)*limit+len(out.Items)<total
	_ = export
	return out,nil
}

func (r *ReportRepository) ExportResults(
	ctx context.Context,
	scope reporting.ResolvedScope,
	query reporting.Query,
	limit int,
) ([]reporting.ResultItem, int, error) {
	page,err:=r.resultPage(ctx,scope,query,1,limit,false)
	if err!=nil{return nil,0,err}
	return page.Items,page.Total,nil
}
