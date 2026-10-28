package postgres

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
	org "github.com/nasef6464/almeaago/internal/organizations/domain"
)

// DirectorCreateAssessment never invokes the platform-wide assessment creator:
// school-owned publication and explicit school audiences have separate rules.
func (r *Repository) DirectorCreateAssessment(
	ctx context.Context,
	actorUserID, schoolID string,
	input org.DirectorAssessmentCreate,
) (org.DirectorAssessmentCreated, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return org.DirectorAssessmentCreated{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	created, err := createDirectorAssessmentTx(ctx, tx, r.audit, actorUserID, schoolID, input)
	if err != nil {
		return org.DirectorAssessmentCreated{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return org.DirectorAssessmentCreated{}, err
	}
	return created, nil
}

func (r *Repository) DirectorAssessmentQuestions(
	ctx context.Context,
	actorUserID, schoolID, pathID, subjectID, search string,
	page, limit int,
) (org.DirectorAssessmentQuestionPage, error) {
	return listDirectorAssessmentQuestions(ctx, r.db, actorUserID, schoolID, pathID, subjectID, search, page, limit)
}

type directorAssessmentQueryer interface {
	Query(context.Context, string, ...any) (pgx.Rows, error)
}

func listDirectorAssessmentQuestions(ctx context.Context, q directorAssessmentQueryer, actorUserID, schoolID, pathID, subjectID, search string, page, limit int) (org.DirectorAssessmentQuestionPage, error) {
	rows, err := q.Query(ctx, `
		SELECT q.id::text,q.question_code,qv.text_content,qv.question_type,
		       COALESCE(a.public_url,''),qv.image_alt,q.current_version
		FROM questions q
		JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version
		LEFT JOIN assets a ON a.id=qv.image_asset_id AND a.status='active'
		WHERE q.workflow_status='approved' AND q.path_id=$3::uuid AND q.subject_id=$4::uuid
		  AND qv.question_type IN ('mcq','true_false') AND qv.correct_option_index IS NOT NULL
		  AND ($5='' OR q.question_code ILIKE '%'||$5||'%' OR qv.text_content ILIKE '%'||$5||'%')
		  AND EXISTS (
		    SELECT 1 FROM schools s
		    JOIN school_memberships sm ON sm.school_id=s.id
		    JOIN school_membership_permissions smp ON smp.membership_id=sm.id
		    JOIN school_contracts sc ON sc.school_id=s.id
		    JOIN school_contract_modules scm ON scm.contract_id=sc.id
		    WHERE s.id=$1::uuid AND s.status='active'
		      AND sm.user_id=$2::uuid AND sm.role='school_admin' AND sm.status='active'
		      AND smp.permission='SCHOOL_ASSESSMENTS_MANAGE'
		      AND sc.status='active'
		      AND (sc.valid_from IS NULL OR sc.valid_from<=now())
		      AND (sc.valid_until IS NULL OR sc.valid_until>=now())
		      AND scm.module_code='SCHOOL_ASSESSMENTS' AND scm.enabled=true
		  )
		ORDER BY q.question_code,q.id
		LIMIT $6 OFFSET $7
	`, schoolID, actorUserID, pathID, subjectID, search, limit+1, (page-1)*limit)
	if err != nil {
		return org.DirectorAssessmentQuestionPage{}, err
	}
	defer rows.Close()
	result := org.DirectorAssessmentQuestionPage{Items: make([]org.DirectorAssessmentQuestion, 0, limit)}
	for rows.Next() {
		var row org.DirectorAssessmentQuestion
		if err := rows.Scan(&row.ID, &row.QuestionCode, &row.Text, &row.Type, &row.ImageURL, &row.ImageAlt, &row.CurrentVersion); err != nil {
			return org.DirectorAssessmentQuestionPage{}, err
		}
		if len(result.Items) == limit {
			result.HasMore = true
			break
		}
		result.Items = append(result.Items, row)
	}
	return result, rows.Err()
}

func directorAssessmentFingerprint(write org.DirectorAssessmentCreate) (string, error) {
	// Stable typed serialization: question order is significant and normalized by
	// the application layer before reaching the transaction.
	data, err := json.Marshal(struct {
		Title       string   `json:"title"`
		ClassID     string   `json:"classId"`
		ClassIDs    []string `json:"classIds,omitempty"`
		StudentIDs  []string `json:"studentIds,omitempty"`
		TargetScope string   `json:"targetScope"`
		PathID      string   `json:"pathId"`
		SubjectID   string   `json:"subjectId"`
		QuestionIDs []string `json:"questionIds"`
	}{write.Title, write.ClassID, write.ClassIDs, write.StudentIDs, write.TargetScope, write.PathID, write.SubjectID, write.QuestionIDs})
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

func createDirectorAssessmentTx(
	ctx context.Context,
	tx pgx.Tx,
	audit AuditWriter,
	actorUserID, schoolID string,
	input org.DirectorAssessmentCreate,
) (org.DirectorAssessmentCreated, error) {
	var empty org.DirectorAssessmentCreated
	if audit == nil {
		return empty, errAuditWriterUnavailable
	}
	fingerprint, err := directorAssessmentFingerprint(input)
	if err != nil {
		return empty, err
	}

	// Repeat authorization inside this transaction. Authorization from the
	// application service alone is insufficient if a director is revoked just
	// before a request reaches PostgreSQL.
	var permittedSchool string
	err = tx.QueryRow(ctx, `
		SELECT s.id::text
		FROM schools s
		JOIN school_memberships sm ON sm.school_id=s.id
		JOIN school_membership_permissions smp ON smp.membership_id=sm.id
		JOIN school_contracts sc ON sc.school_id=s.id
		JOIN school_contract_modules scm ON scm.contract_id=sc.id
		WHERE s.id=$1::uuid AND s.status='active'
		  AND sm.user_id=$2::uuid AND sm.role='school_admin' AND sm.status='active'
		  AND smp.permission='SCHOOL_ASSESSMENTS_MANAGE'
		  AND sc.status='active'
		  AND (sc.valid_from IS NULL OR sc.valid_from<=now())
		  AND (sc.valid_until IS NULL OR sc.valid_until>=now())
		  AND scm.module_code='SCHOOL_ASSESSMENTS' AND scm.enabled=true
		FOR SHARE OF s,sm,smp,sc,scm
	`, schoolID, actorUserID).Scan(&permittedSchool)
	if errors.Is(err, pgx.ErrNoRows) {
		return empty, org.ErrNotFound
	}
	if err != nil {
		return empty, err
	}

	// Reserve (school,requestKey) before creating any resource. A concurrent
	// identical request waits for the first commit then reuses its assessment.
	reserved, err := tx.Exec(ctx, `
		INSERT INTO school_assessment_create_requests(
		  school_id,request_key,actor_user_id,request_fingerprint
		) VALUES ($1::uuid,$2::uuid,$3::uuid,$4)
		ON CONFLICT (school_id,request_key) DO NOTHING
	`, schoolID, input.RequestKey, actorUserID, fingerprint)
	if err != nil {
		return empty, err
	}
	if reserved.RowsAffected() == 0 {
		var oldActor, oldFingerprint, oldAssessmentID, oldTitle, oldClassID, oldScope string
		err = tx.QueryRow(ctx, `
			SELECT r.actor_user_id::text,r.request_fingerprint,r.assessment_id::text,
			       av.title,COALESCE(aac.class_id::text,''),
			       CASE WHEN aa.targets_entire_school THEN 'school'
			            WHEN (SELECT COUNT(*) FROM assessment_assignment_classes classes WHERE classes.assignment_id=aa.id)>1 THEN 'classes'
			            ELSE 'class' END
			FROM school_assessment_create_requests r
			JOIN assessment_versions av ON av.assessment_id=r.assessment_id AND av.version=1
			JOIN assessment_assignments aa ON aa.assessment_id=r.assessment_id AND aa.assessment_version=1
			LEFT JOIN LATERAL (
			  SELECT class_id FROM assessment_assignment_classes
			  WHERE assignment_id=aa.id ORDER BY class_id LIMIT 1
			) aac ON true
			WHERE r.school_id=$1::uuid AND r.request_key=$2::uuid
			FOR SHARE OF r
		`, schoolID, input.RequestKey).Scan(&oldActor, &oldFingerprint, &oldAssessmentID, &oldTitle, &oldClassID, &oldScope)
		if errors.Is(err, pgx.ErrNoRows) {
			return empty, org.ErrConflict
		}
		if err != nil {
			return empty, err
		}
		if oldActor != actorUserID || oldFingerprint != fingerprint {
			return empty, org.ErrConflict
		}
		if input.TargetScope == "selected" {
			oldScope = "selected"
		}
		if oldScope == "classes" || oldScope == "selected" {
			oldClassID = ""
		}
		return org.DirectorAssessmentCreated{AssessmentID: oldAssessmentID, Title: oldTitle, ClassID: oldClassID, ClassIDs: input.ClassIDs, StudentIDs: input.StudentIDs, TargetScope: oldScope}, nil
	}

	if input.TargetScope == "class" {
		var activeClass string
		err = tx.QueryRow(ctx, `
			SELECT id::text FROM classes
			WHERE id=$1::uuid AND school_id=$2::uuid AND status='active'
			FOR SHARE
		`, input.ClassID, schoolID).Scan(&activeClass)
		if errors.Is(err, pgx.ErrNoRows) {
			return empty, org.ErrNotFound
		}
		if err != nil {
			return empty, err
		}
	} else if input.TargetScope == "classes" || input.TargetScope == "selected" {
		// Lock every selected class while publishing. Partial matches cannot
		// create a test: all classes must be active in this one school.
		for _, classID := range input.ClassIDs {
			var activeClass string
			err = tx.QueryRow(ctx, `
				SELECT id::text FROM classes
				WHERE id=$1::uuid AND school_id=$2::uuid AND status='active'
				FOR SHARE
			`, classID, schoolID).Scan(&activeClass)
			if errors.Is(err, pgx.ErrNoRows) {
				return empty, org.ErrNotFound
			}
			if err != nil {
				return empty, err
			}
		}
	} else if input.TargetScope != "school" {
		return empty, org.ErrConflict
	}
	if input.TargetScope == "selected" {
		for _, studentID := range input.StudentIDs {
			var eligibleStudent string
			err = tx.QueryRow(ctx, `
				SELECT membership.user_id::text FROM school_memberships membership
				JOIN users student ON student.id=membership.user_id
				WHERE membership.school_id=$1::uuid AND membership.user_id=$2::uuid
				 AND membership.role='student' AND membership.status='active' AND student.status='active'
				FOR SHARE OF membership,student
			`, schoolID, studentID).Scan(&eligibleStudent)
			if errors.Is(err, pgx.ErrNoRows) {
				return empty, org.ErrNotFound
			}
			if err != nil {
				return empty, err
			}
		}
	}

	var selectedSubject string
	err = tx.QueryRow(ctx, `
		SELECT sub.id::text
		FROM subjects sub JOIN paths p ON p.id=sub.path_id
		WHERE p.id=$1::uuid AND p.status='active' AND sub.id=$2::uuid
		FOR SHARE OF sub,p
	`, input.PathID, input.SubjectID).Scan(&selectedSubject)
	if errors.Is(err, pgx.ErrNoRows) {
		return empty, org.ErrNotFound
	}
	if err != nil {
		return empty, err
	}

	versions := make([]int, 0, len(input.QuestionIDs))
	for _, questionID := range input.QuestionIDs {
		var currentVersion int
		err = tx.QueryRow(ctx, `
			SELECT q.current_version
			FROM questions q
			JOIN question_versions qv ON qv.question_id=q.id AND qv.version=q.current_version
			WHERE q.id=$1::uuid AND q.path_id=$2::uuid AND q.subject_id=$3::uuid
			  AND q.workflow_status='approved'
			  AND qv.question_type IN ('mcq','true_false') AND qv.correct_option_index IS NOT NULL
			FOR SHARE OF q,qv
		`, questionID, input.PathID, input.SubjectID).Scan(&currentVersion)
		if errors.Is(err, pgx.ErrNoRows) {
			return empty, org.ErrNotFound
		}
		if err != nil {
			return empty, err
		}
		versions = append(versions, currentVersion)
	}

	var assessmentID string
	code := fmt.Sprintf("SCH-%s-%s", schoolID, input.RequestKey)
	err = tx.QueryRow(ctx, `
		INSERT INTO assessments(
		  assessment_code,owner_type,owner_school_id,created_by,
		  workflow_status,approved_by,approved_at,current_version,published_version,
		  is_published,is_visible,is_school_central_draft
		) VALUES ($1,'school',$2::uuid,$3::uuid,
		  'approved',$3::uuid,now(),1,1,true,true,false)
		RETURNING id::text
	`, code, schoolID, actorUserID).Scan(&assessmentID)
	if err != nil {
		return empty, err
	}
	_, err = tx.Exec(ctx, `
		INSERT INTO assessment_versions(
		  assessment_id,version,title,path_id,subject_id,
		  assessment_kind,normal_mode,version_status,
		  access_type,created_by,published_by,published_at
		) VALUES ($1::uuid,1,$2,$3::uuid,$4::uuid,
		  'normal','exam','published','private',$5::uuid,$5::uuid,now())
	`, assessmentID, input.Title, input.PathID, input.SubjectID, actorUserID)
	if err != nil {
		return empty, err
	}
	for order, questionID := range input.QuestionIDs {
		if _, err = tx.Exec(ctx, `
			INSERT INTO assessment_version_questions(
			 assessment_id,assessment_version,question_id,question_version,sort_order
			) VALUES ($1::uuid,1,$2::uuid,$3,$4)
		`, assessmentID, questionID, versions[order], order); err != nil {
			return empty, err
		}
	}
	var assignmentID string
	err = tx.QueryRow(ctx, `
		INSERT INTO assessment_assignments(
		  assessment_id,assessment_version,school_id,status,created_by,targets_entire_school
		) VALUES ($1::uuid,1,$2::uuid,'active',$3::uuid,$4)
		RETURNING id::text
	`, assessmentID, schoolID, actorUserID, input.TargetScope == "school").Scan(&assignmentID)
	if err != nil {
		return empty, err
	}
	if input.TargetScope == "class" {
		if _, err = tx.Exec(ctx, `
			INSERT INTO assessment_assignment_classes(assignment_id,class_id)
			VALUES ($1::uuid,$2::uuid)
		`, assignmentID, input.ClassID); err != nil {
			return empty, err
		}
	} else if input.TargetScope == "classes" || input.TargetScope == "selected" {
		for _, classID := range input.ClassIDs {
			if _, err = tx.Exec(ctx, `
				INSERT INTO assessment_assignment_classes(assignment_id,class_id)
				VALUES ($1::uuid,$2::uuid)
			`, assignmentID, classID); err != nil {
				return empty, err
			}
		}
	}
	if input.TargetScope == "selected" {
		for _, studentID := range input.StudentIDs {
			if _, err = tx.Exec(ctx, `
				INSERT INTO assessment_assignment_users(assignment_id,user_id)
				VALUES ($1::uuid,$2::uuid)
			`, assignmentID, studentID); err != nil {
				return empty, err
			}
		}
	}
	_, err = tx.Exec(ctx, `
		UPDATE school_assessment_create_requests
		SET assessment_id=$3::uuid
		WHERE school_id=$1::uuid AND request_key=$2::uuid
	`, schoolID, input.RequestKey, assessmentID)
	if err != nil {
		return empty, err
	}
	if err := audit.WriteTx(ctx, tx, operations.AuditEvent{
		ActorUserID:  actorUserID,
		Action:       "schools.director.assessment.create",
		ResourceType: "assessment",
		ResourceID:   assessmentID,
		Metadata: map[string]any{
			"schoolId": schoolID, "classId": input.ClassID, "classIds": input.ClassIDs,
			"studentCount": len(input.StudentIDs),
			"targetScope":  input.TargetScope, "questionCount": len(input.QuestionIDs),
		},
	}); err != nil {
		return empty, err
	}
	return org.DirectorAssessmentCreated{
		AssessmentID: assessmentID,
		Title:        input.Title,
		ClassID:      input.ClassID,
		ClassIDs:     input.ClassIDs,
		StudentIDs:   input.StudentIDs,
		TargetScope:  input.TargetScope,
	}, nil
}
