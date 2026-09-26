package postgres

import (
	"context"
	"errors"
	"time"

	"github.com/jackc/pgx/v5"

	learning "github.com/nasef6464/almeaago/internal/learning/domain"
)

func (r *Repository) InterventionEvidenceSnapshot(ctx context.Context, student, pathID, subjectID, skillID string, since *time.Time) (learning.InterventionEvidence, error) {
	args := []any{student, pathID, subjectID, skillID}
	filter := ""
	if since != nil {
		args = append(args, *since)
		filter = " AND me.occurred_at > $5"
	}
	var out learning.InterventionEvidence
	var accuracy *float64
	err := r.db.QueryRow(ctx, `
		SELECT COUNT(*)::int,
		       COUNT(*) FILTER (WHERE me.is_correct)::int,
		       CASE WHEN COUNT(*)=0 THEN NULL
		            ELSE ROUND(100.0*AVG(CASE WHEN me.is_correct THEN 1.0 ELSE 0.0 END),3)::float8 END
		FROM mastery_evidence me
		JOIN mastery_evidence_skills mes ON mes.evidence_id=me.id
		WHERE me.student_id=$1::uuid
		  AND me.path_id=$2::uuid
		  AND me.subject_id=$3::uuid
		  AND mes.skill_id=$4::uuid`+filter,
		args...,
	).Scan(&out.EvidenceCount, &out.Correct, &accuracy)
	if err != nil {
		return out, err
	}
	out.Accuracy = accuracy
	now := time.Now().UTC()
	out.MeasuredAt = &now
	return out, nil
}

func insertInterventionStudyPlan(ctx context.Context, tx pgx.Tx, student string, write learning.StudyPlanWrite, items []learning.StudyPlanItemSeed) (string, error) {
	var id string
	err := tx.QueryRow(ctx, `
		INSERT INTO study_plans(
			student_id,name,path_id,start_date,end_date,skip_completed_assessments,
			daily_minutes,preferred_start_time,status
		) VALUES($1::uuid,$2,$3::uuid,$4::date,$5::date,$6,$7,$8::time,$9)
		RETURNING id::text
	`, student, write.Name, write.PathID, write.StartDate, write.EndDate,
		write.SkipCompletedAssessments, write.DailyMinutes, write.PreferredStartTime, string(write.Status),
	).Scan(&id)
	if err != nil {
		return "", err
	}
	if err = insertStudyPlanDetails(ctx, tx, id, write, items); err != nil {
		return "", err
	}
	return id, nil
}

func (r *Repository) CreateSchoolIntervention(
	ctx context.Context,
	actor string,
	input learning.InterventionCreate,
	plan learning.StudyPlanWrite,
	items []learning.StudyPlanItemSeed,
	baseline learning.InterventionEvidence,
) (learning.SchoolIntervention, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	defer tx.Rollback(ctx)

	planID, err := insertInterventionStudyPlan(ctx, tx, input.StudentID, plan, items)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO school_interventions(
			school_id,class_id,student_id,path_id,subject_id,skill_id,study_plan_id,
			status,assigned_by,follow_up_at,remediation_threshold,minimum_evidence,
			baseline_evidence_count,baseline_correct,baseline_accuracy
		) VALUES(
			$1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::uuid,
			'active',$8::uuid,$9,$10,$11,$12,$13,$14
		)
		RETURNING id::text
	`, input.SchoolID, input.ClassID, input.StudentID, input.PathID, input.SubjectID,
		input.SkillID, planID, actor, input.FollowUpAt, input.RemediationThreshold,
		input.MinimumEvidence, baseline.EvidenceCount, baseline.Correct, baseline.Accuracy).Scan(&id)
	if err != nil {
		return learning.SchoolIntervention{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return learning.SchoolIntervention{}, err
	}
	return r.GetSchoolIntervention(ctx, id)
}

const interventionColumns = `
	id::text,school_id::text,class_id::text,student_id::text,path_id::text,subject_id::text,
	skill_id::text,action_type,study_plan_id::text,status,assigned_by::text,follow_up_at,
	remediation_threshold::float8,minimum_evidence,
	baseline_evidence_count,baseline_correct,baseline_accuracy::float8,
	outcome_evidence_count,outcome_correct,outcome_accuracy::float8,outcome_measured_at,
	created_at,updated_at
`

type interventionScanner interface{ Scan(...any) error }

func scanIntervention(row interventionScanner) (learning.SchoolIntervention, error) {
	var out learning.SchoolIntervention
	var outcomeCount, outcomeCorrect *int
	var outcomeAccuracy *float64
	var outcomeMeasured *time.Time
	err := row.Scan(
		&out.ID,&out.SchoolID,&out.ClassID,&out.StudentID,&out.PathID,&out.SubjectID,
		&out.SkillID,&out.ActionType,&out.StudyPlanID,&out.Status,&out.AssignedBy,&out.FollowUpAt,
		&out.RemediationThreshold,&out.MinimumEvidence,
		&out.Baseline.EvidenceCount,&out.Baseline.Correct,&out.Baseline.Accuracy,
		&outcomeCount,&outcomeCorrect,&outcomeAccuracy,&outcomeMeasured,&out.CreatedAt,&out.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return out, learning.ErrNotFound
		}
		return out, err
	}
	if outcomeCount != nil && outcomeCorrect != nil {
		out.Outcome = &learning.InterventionEvidence{
			EvidenceCount:*outcomeCount,Correct:*outcomeCorrect,Accuracy:outcomeAccuracy,MeasuredAt:outcomeMeasured,
		}
	}
	baselineMeasured := out.CreatedAt
	out.Baseline.MeasuredAt = &baselineMeasured
	return out, nil
}

func (r *Repository) GetSchoolIntervention(ctx context.Context, id string) (learning.SchoolIntervention, error) {
	return scanIntervention(r.db.QueryRow(ctx, `SELECT `+interventionColumns+` FROM school_interventions WHERE id=$1::uuid`, id))
}

func (r *Repository) ListSchoolInterventions(ctx context.Context, schoolID, classID string, status learning.InterventionStatus, page, limit int) (learning.InterventionPage, error) {
	args := []any{schoolID, string(status), limit+1, (page-1)*limit}
	classFilter := ""
	if classID != "" {
		args = append(args, classID)
		classFilter = " AND class_id=$5::uuid"
	}
	rows, err := r.db.Query(ctx, `
		SELECT `+interventionColumns+`
		FROM school_interventions
		WHERE school_id=$1::uuid AND status=$2`+classFilter+`
		ORDER BY created_at DESC,id DESC
		LIMIT $3 OFFSET $4
	`, args...)
	if err != nil {
		return learning.InterventionPage{}, err
	}
	defer rows.Close()
	out := learning.InterventionPage{Page:page,Limit:limit}
	for rows.Next() {
		item, scanErr := scanIntervention(rows)
		if scanErr != nil {
			return out, scanErr
		}
		out.Items = append(out.Items,item)
	}
	if err=rows.Err(); err!=nil { return out,err }
	if len(out.Items)>limit { out.HasMore=true;out.Items=out.Items[:limit] }
	return out,nil
}

func (r *Repository) ListStudentInterventions(ctx context.Context, student string, status learning.InterventionStatus, page, limit int) (learning.InterventionPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT `+interventionColumns+`
		FROM school_interventions
		WHERE student_id=$1::uuid AND status=$2
		ORDER BY updated_at DESC,id DESC
		LIMIT $3 OFFSET $4
	`, student,string(status),limit+1,(page-1)*limit)
	if err != nil { return learning.InterventionPage{},err }
	defer rows.Close()
	out:=learning.InterventionPage{Page:page,Limit:limit}
	for rows.Next(){
		item,scanErr:=scanIntervention(rows);if scanErr!=nil{return out,scanErr}
		out.Items=append(out.Items,item)
	}
	if err=rows.Err();err!=nil{return out,err}
	if len(out.Items)>limit{out.HasMore=true;out.Items=out.Items[:limit]}
	return out,nil
}

func (r *Repository) PatchSchoolIntervention(ctx context.Context, actor,id string, patch learning.InterventionPatch) (learning.SchoolIntervention,error) {
	tag,err:=r.db.Exec(ctx,`
		UPDATE school_interventions
		SET status=$3,follow_up_at=$4,remediation_threshold=$5,minimum_evidence=$6,updated_at=now()
		WHERE id=$1::uuid AND updated_at=$2
	`,id,patch.ExpectedUpdatedAt,string(patch.Status),patch.FollowUpAt,patch.RemediationThreshold,patch.MinimumEvidence)
	if err!=nil{return learning.SchoolIntervention{},err}
	if tag.RowsAffected()==0{return learning.SchoolIntervention{},learning.ErrConflict}
	return r.GetSchoolIntervention(ctx,id)
}

func (r *Repository) MeasureSchoolIntervention(ctx context.Context, actor,id string, expected time.Time, snapshot learning.InterventionEvidence) (learning.SchoolIntervention,error) {
	tag,err:=r.db.Exec(ctx,`
		UPDATE school_interventions
		SET outcome_evidence_count=$3,outcome_correct=$4,outcome_accuracy=$5,
		    outcome_measured_at=$6,updated_at=now()
		WHERE id=$1::uuid AND updated_at=$2
	`,id,expected,snapshot.EvidenceCount,snapshot.Correct,snapshot.Accuracy,snapshot.MeasuredAt)
	if err!=nil{return learning.SchoolIntervention{},err}
	if tag.RowsAffected()==0{return learning.SchoolIntervention{},learning.ErrConflict}
	return r.GetSchoolIntervention(ctx,id)
}
