package postgres

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

type AuditWriter interface {
	WriteTx(context.Context, pgx.Tx, operations.AuditEvent) error
}
type Repository struct {
	db    *pgxpool.Pool
	audit AuditWriter
}

func New(db *pgxpool.Pool, a AuditWriter) *Repository { return &Repository{db: db, audit: a} }

func (r *Repository) CanAuthor(ctx context.Context, userID, pathID, subjectID string) (bool, error) {
	var ok bool
	err := r.db.QueryRow(ctx, `
		SELECT EXISTS(SELECT 1 FROM content_trainer_path_scopes ps JOIN paths p ON p.id=ps.path_id WHERE ps.user_id=$1::uuid AND ps.path_id=$2::uuid AND p.status='active')
		OR EXISTS(SELECT 1 FROM content_trainer_subject_scopes ss JOIN subjects s ON s.id=ss.subject_id WHERE ss.user_id=$1::uuid AND ss.subject_id=$3::uuid AND s.path_id=$2::uuid AND s.status='active')
	`, userID, pathID, subjectID).Scan(&ok)
	return ok, err
}

func (r *Repository) validateRefs(ctx context.Context, tx pgx.Tx, w assessment.Write) error {
	var ok bool
	if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM subjects s JOIN paths p ON p.id=s.path_id WHERE p.id=$1::uuid AND s.id=$2::uuid AND p.status='active' AND s.status='active')`, w.Version.PathID, w.Version.SubjectID).Scan(&ok); err != nil {
		return err
	}
	if !ok {
		return assessment.ErrConflict
	}
	if w.OwnerType == assessment.OwnerSchool {
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM schools WHERE id=$1::uuid AND status='active')`, w.OwnerSchoolID).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return assessment.ErrConflict
		}
	}
	for _, q := range w.Questions {
		if err := tx.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM questions q JOIN question_versions v ON v.question_id=q.id AND v.version=$2 WHERE q.id=$1::uuid AND q.workflow_status<>'archived')`, q.QuestionID, q.QuestionVersion).Scan(&ok); err != nil {
			return err
		}
		if !ok {
			return assessment.ErrConflict
		}
	}
	return nil
}
func (r *Repository) auditTx(ctx context.Context, tx pgx.Tx, e operations.AuditEvent) error {
	if r.audit == nil {
		return errors.New("assessment audit writer is not configured")
	}
	return r.audit.WriteTx(ctx, tx, e)
}

func (r *Repository) Create(ctx context.Context, actor string, w assessment.Write) (assessment.Assessment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer tx.Rollback(ctx)
	if err = r.validateRefs(ctx, tx, w); err != nil {
		return assessment.Assessment{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `INSERT INTO assessments(assessment_code,owner_type,owner_user_id,owner_school_id,created_by,assigned_teacher_id,is_visible) VALUES($1,$2,NULLIF($3,'')::uuid,NULLIF($4,'')::uuid,$5::uuid,NULLIF($6,'')::uuid,$7) RETURNING id::text`, w.Code, string(w.OwnerType), w.OwnerUserID, w.OwnerSchoolID, actor, w.AssignedTeacherID, w.IsVisible).Scan(&id)
	if err != nil {
		return assessment.Assessment{}, mapError(err)
	}
	if err = insertVersion(ctx, tx, id, 1, actor, w); err != nil {
		return assessment.Assessment{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.create", ResourceType: "assessment", ResourceID: id}); err != nil {
		return assessment.Assessment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Assessment{}, err
	}
	return r.Get(ctx, id)
}
func insertVersion(ctx context.Context, tx pgx.Tx, id string, version int, actor string, w assessment.Write) error {
	v := w.Version
	_, err := tx.Exec(ctx, `INSERT INTO assessment_versions(assessment_id,version,title,description,path_id,subject_id,assessment_kind,access_type,normal_mode,show_explanations,show_answers,show_results_report,return_to_source_on_finish,max_attempts,passing_score,time_limit_seconds,randomize_questions,randomize_options,show_progress_bar,require_answer_before_next,allow_question_review,option_layout,mock_category,mock_target_score,mock_strict_section_lock,mock_presentation_mode,presentation,created_by,revision_note) VALUES($1::uuid,$2,$3,$4,$5::uuid,$6::uuid,$7,$8,NULLIF($9,''),$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NULLIF($23,''),$24,$25,NULLIF($26,''),$27::jsonb,$28::uuid,$29)`, id, version, v.Title, v.Description, v.PathID, v.SubjectID, string(v.Kind), string(v.AccessType), string(v.NormalMode), v.ShowExplanations, v.ShowAnswers, v.ShowResultsReport, v.ReturnToSourceOnFinish, v.MaxAttempts, v.PassingScore, v.TimeLimitSeconds, v.RandomizeQuestions, v.RandomizeOptions, v.ShowProgressBar, v.RequireAnswerBeforeNext, v.AllowQuestionReview, v.OptionLayout, v.MockCategory, v.MockTargetScore, v.MockStrictSectionLock, v.MockPresentationMode, string(v.Presentation), actor, v.RevisionNote)
	if err != nil {
		return mapError(err)
	}
	for _, s := range w.Sections {
		_, err = tx.Exec(ctx, `INSERT INTO assessment_sections(id,assessment_id,assessment_version,title,subject_id,sort_order,time_limit_seconds,domain,strict_lock) VALUES(COALESCE(NULLIF($1,'')::uuid,uuidv7()),$2::uuid,$3,$4,NULLIF($5,'')::uuid,$6,$7,$8,$9)`, s.ID, id, version, s.Title, s.SubjectID, s.SortOrder, s.TimeLimitSeconds, s.Domain, s.StrictLock)
		if err != nil {
			return mapError(err)
		}
	}
	for _, q := range w.Questions {
		_, err = tx.Exec(ctx, `INSERT INTO assessment_version_questions(assessment_id,assessment_version,question_id,question_version,section_id,sort_order,points) VALUES($1::uuid,$2,$3::uuid,$4,NULLIF($5,'')::uuid,$6,$7)`, id, version, q.QuestionID, q.QuestionVersion, q.SectionID, q.SortOrder, q.Points)
		if err != nil {
			return mapError(err)
		}
	}
	return nil
}
func (r *Repository) Update(ctx context.Context, actor, id string, rev int, w assessment.Write) (assessment.Assessment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer tx.Rollback(ctx)
	if err = r.validateRefs(ctx, tx, w); err != nil {
		return assessment.Assessment{}, err
	}
	var next int
	err = tx.QueryRow(ctx, `UPDATE assessments SET owner_type=$3,owner_user_id=NULLIF($4,'')::uuid,owner_school_id=NULLIF($5,'')::uuid,assigned_teacher_id=NULLIF($6,'')::uuid,is_visible=$7,current_version=current_version+1,revision=revision+1,updated_at=now() WHERE id=$1::uuid AND revision=$2 AND workflow_status NOT IN ('approved','archived') RETURNING current_version`, id, rev, string(w.OwnerType), w.OwnerUserID, w.OwnerSchoolID, w.AssignedTeacherID, w.IsVisible).Scan(&next)
	if err != nil {
		return assessment.Assessment{}, r.mapUpdate(ctx, tx, id, rev, err)
	}
	if err = insertVersion(ctx, tx, id, next, actor, w); err != nil {
		return assessment.Assessment{}, err
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.update", ResourceType: "assessment", ResourceID: id, Metadata: map[string]any{"version": next}}); err != nil {
		return assessment.Assessment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Assessment{}, err
	}
	return r.Get(ctx, id)
}
func (r *Repository) SetWorkflow(ctx context.Context, actor, id string, rev int, status assessment.WorkflowStatus, notes string) (assessment.Assessment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer tx.Rollback(ctx)
	var out string
	err = tx.QueryRow(ctx, `UPDATE assessments SET workflow_status=$3,reviewer_notes=$4,approved_by=CASE WHEN $3='approved' THEN $5::uuid ELSE NULL END,approved_at=CASE WHEN $3='approved' THEN now() ELSE NULL END,is_published=CASE WHEN $3='approved' THEN is_published ELSE false END,revision=revision+1,updated_at=now() WHERE id=$1::uuid AND revision=$2 RETURNING id::text`, id, rev, string(status), notes, actor).Scan(&out)
	if err != nil {
		return assessment.Assessment{}, r.mapUpdate(ctx, tx, id, rev, err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.workflow", ResourceType: "assessment", ResourceID: id, Metadata: map[string]any{"status": status}}); err != nil {
		return assessment.Assessment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Assessment{}, err
	}
	return r.Get(ctx, id)
}
func (r *Repository) SetPublication(ctx context.Context, actor, id string, rev int, published bool) (assessment.Assessment, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer tx.Rollback(ctx)
	var out string
	err = tx.QueryRow(ctx, `UPDATE assessments SET is_published=$3,published_version=CASE WHEN $3 THEN current_version ELSE NULL END,revision=revision+1,updated_at=now() WHERE id=$1::uuid AND revision=$2 AND (NOT $3 OR (workflow_status='approved' AND EXISTS(SELECT 1 FROM assessment_version_questions q WHERE q.assessment_id=assessments.id AND q.assessment_version=assessments.current_version))) RETURNING id::text`, id, rev, published).Scan(&out)
	if err != nil {
		return assessment.Assessment{}, r.mapUpdate(ctx, tx, id, rev, err)
	}
	if published {
		_, err = tx.Exec(ctx, `UPDATE assessment_versions SET version_status=CASE WHEN version=current_version THEN 'published' ELSE CASE WHEN version_status='published' THEN 'superseded' ELSE version_status END END,published_by=CASE WHEN version=current_version THEN $2::uuid ELSE published_by END,published_at=CASE WHEN version=current_version THEN now() ELSE published_at END FROM assessments WHERE assessment_id=$1::uuid AND assessments.id=$1::uuid`, id, actor)
		if err != nil {
			return assessment.Assessment{}, mapError(err)
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.publication", ResourceType: "assessment", ResourceID: id, Metadata: map[string]any{"isPublished": published}}); err != nil {
		return assessment.Assessment{}, err
	}
	if err = tx.Commit(ctx); err != nil {
		return assessment.Assessment{}, err
	}
	return r.Get(ctx, id)
}

func (r *Repository) Get(ctx context.Context, id string) (assessment.Assessment, error) {
	var a assessment.Assessment
	var ownerUser, ownerSchool, assigned string
	var published *int
	err := r.db.QueryRow(ctx, `SELECT a.id::text,a.assessment_code,a.owner_type,COALESCE(a.owner_user_id::text,''),COALESCE(a.owner_school_id::text,''),COALESCE(a.assigned_teacher_id::text,''),a.workflow_status,a.reviewer_notes,a.current_version,a.published_version,a.is_published,a.is_visible,a.revision,a.created_at,a.updated_at,v.title,v.description,v.path_id::text,COALESCE(v.subject_id::text,''),v.assessment_kind,v.access_type,COALESCE(v.normal_mode,''),v.max_attempts,v.passing_score,v.presentation FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.current_version WHERE a.id=$1::uuid`, id).Scan(&a.ID, &a.Code, &a.OwnerType, &ownerUser, &ownerSchool, &assigned, &a.WorkflowStatus, &a.ReviewerNotes, &a.CurrentVersion, &published, &a.IsPublished, &a.IsVisible, &a.Revision, &a.CreatedAt, &a.UpdatedAt, &a.Version.Title, &a.Version.Description, &a.Version.PathID, &a.Version.SubjectID, &a.Version.Kind, &a.Version.AccessType, &a.Version.NormalMode, &a.Version.MaxAttempts, &a.Version.PassingScore, &a.Version.Presentation)
	if err != nil {
		return assessment.Assessment{}, mapError(err)
	}
	a.OwnerUserID = ownerUser
	a.OwnerSchoolID = ownerSchool
	a.AssignedTeacherID = assigned
	a.PublishedVersion = published
	a.Version.Version = a.CurrentVersion
	rows, err := r.db.Query(ctx, `SELECT id::text,title,COALESCE(subject_id::text,''),sort_order,time_limit_seconds,domain,strict_lock FROM assessment_sections WHERE assessment_id=$1::uuid AND assessment_version=$2 ORDER BY sort_order,id`, id, a.CurrentVersion)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer rows.Close()
	for rows.Next() {
		var s assessment.Section
		if err = rows.Scan(&s.ID, &s.Title, &s.SubjectID, &s.SortOrder, &s.TimeLimitSeconds, &s.Domain, &s.StrictLock); err != nil {
			return assessment.Assessment{}, err
		}
		a.Sections = append(a.Sections, s)
	}
	if err = rows.Err(); err != nil {
		return assessment.Assessment{}, err
	}
	qrows, err := r.db.Query(ctx, `SELECT question_id::text,question_version,COALESCE(section_id::text,''),sort_order,points FROM assessment_version_questions WHERE assessment_id=$1::uuid AND assessment_version=$2 ORDER BY sort_order,question_id`, id, a.CurrentVersion)
	if err != nil {
		return assessment.Assessment{}, err
	}
	defer qrows.Close()
	for qrows.Next() {
		var q assessment.QuestionPlacement
		if err = qrows.Scan(&q.QuestionID, &q.QuestionVersion, &q.SectionID, &q.SortOrder, &q.Points); err != nil {
			return assessment.Assessment{}, err
		}
		a.Questions = append(a.Questions, q)
	}
	return a, qrows.Err()
}
func (r *Repository) List(ctx context.Context, q assessment.ListQuery) (assessment.Page, error) {
	parts := []string{"1=1"}
	args := []any{}
	add := func(expr string, v any) { args = append(args, v); parts = append(parts, fmt.Sprintf(expr, len(args))) }
	if q.PathID != "" {
		add("v.path_id=$%d::uuid", q.PathID)
	}
	if q.SubjectID != "" {
		add("v.subject_id=$%d::uuid", q.SubjectID)
	}
	if q.WorkflowStatus != "" {
		add("a.workflow_status=$%d", string(q.WorkflowStatus))
	}
	if q.Search != "" {
		add("(v.title ILIKE '%%'||$%d||'%%' OR a.assessment_code ILIKE '%%'||$%d||'%%')", q.Search)
	}
	if q.TeacherScopeUserID != "" {
		args = append(args, q.TeacherScopeUserID)
		i := len(args)
		parts = append(parts, fmt.Sprintf("(a.owner_user_id=$%d::uuid OR a.assigned_teacher_id=$%d::uuid)", i, i))
	}
	args = append(args, q.Limit+1, (q.Page-1)*q.Limit)
	rows, err := r.db.Query(ctx, `SELECT a.id::text,a.assessment_code,v.title,v.path_id::text,COALESCE(v.subject_id::text,''),v.assessment_kind,a.workflow_status,a.owner_type,a.revision,a.current_version,a.is_published,a.updated_at FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.current_version WHERE `+strings.Join(parts, " AND ")+` ORDER BY a.updated_at DESC,a.id DESC LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return assessment.Page{}, err
	}
	defer rows.Close()
	items := make([]assessment.Summary, 0, q.Limit+1)
	for rows.Next() {
		var x assessment.Summary
		if err = rows.Scan(&x.ID, &x.Code, &x.Title, &x.PathID, &x.SubjectID, &x.Kind, &x.WorkflowStatus, &x.OwnerType, &x.Revision, &x.CurrentVersion, &x.IsPublished, &x.UpdatedAt); err != nil {
			return assessment.Page{}, err
		}
		items = append(items, x)
	}
	if err = rows.Err(); err != nil {
		return assessment.Page{}, err
	}
	more := len(items) > q.Limit
	if more {
		items = items[:q.Limit]
	}
	return assessment.Page{Items: items, Page: q.Page, Limit: q.Limit, HasMore: more}, nil
}
func (r *Repository) mapUpdate(ctx context.Context, tx pgx.Tx, id string, rev int, err error) error {
	if !errors.Is(err, pgx.ErrNoRows) {
		return mapError(err)
	}
	var actual int
	e := tx.QueryRow(ctx, `SELECT revision FROM assessments WHERE id=$1::uuid`, id).Scan(&actual)
	if errors.Is(e, pgx.ErrNoRows) {
		return assessment.ErrNotFound
	}
	if e != nil {
		return e
	}
	if actual != rev {
		return assessment.ErrVersionConflict
	}
	return assessment.ErrConflict
}
func mapError(err error) error {
	if errors.Is(err, pgx.ErrNoRows) {
		return assessment.ErrNotFound
	}
	var p *pgconn.PgError
	if errors.As(err, &p) {
		switch p.Code {
		case "23505", "23503", "23514", "22P02":
			return assessment.ErrConflict
		}
	}
	return err
}
