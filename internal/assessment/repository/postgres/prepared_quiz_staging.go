package postgres

import (
	"context"
	"encoding/json"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

// StagePreparedQuiz atomically replaces staged targets and writes an audit
// record; a failure leaves the previous audience unchanged. Caller must first
// authorize the actor to administer the assessment.
func (r *Repository) StagePreparedQuiz(ctx context.Context, actor, assessmentID string, in assessment.PreparedQuizStage) error {
	if (in.Mode != "saher" && in.Mode != "central") || (in.AudienceType != "public" && in.AudienceType != "targeted") ||
		(in.AudienceType == "public" && len(in.UserIDs)+len(in.GroupIDs) != 0) ||
		(in.AudienceType == "targeted" && len(in.UserIDs)+len(in.GroupIDs) == 0) {
		return assessment.ErrConflict
	}
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var kind string
	err = tx.QueryRow(ctx, `SELECT v.assessment_kind FROM assessments a JOIN assessment_versions v ON v.assessment_id=a.id AND v.version=a.current_version WHERE a.id=$1::uuid FOR UPDATE OF a`, assessmentID).Scan(&kind)
	if err != nil {
		return mapError(err)
	}
	if kind != "normal" {
		return assessment.ErrConflict
	}
	tag, err := tx.Exec(ctx, `INSERT INTO prepared_quiz_distributions(assessment_id,mode,audience_type,due_exclusive) VALUES($1::uuid,$2,$3,$4) ON CONFLICT(assessment_id) DO UPDATE SET mode=EXCLUDED.mode,audience_type=EXCLUDED.audience_type,due_exclusive=EXCLUDED.due_exclusive,updated_at=now() WHERE NOT prepared_quiz_distributions.enabled`, assessmentID, in.Mode, in.AudienceType, in.DueExclusive)
	if err != nil {
		return mapError(err)
	}
	if tag.RowsAffected() != 1 {
		return assessment.ErrConflict
	}
	if _, err = tx.Exec(ctx, `DELETE FROM prepared_quiz_target_users WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, `DELETE FROM prepared_quiz_target_groups WHERE assessment_id=$1::uuid`, assessmentID); err != nil {
		return err
	}
	for _, id := range in.UserIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO prepared_quiz_target_users(assessment_id,user_id) VALUES($1::uuid,$2::uuid)`, assessmentID, id); err != nil {
			return mapError(err)
		}
	}
	for _, id := range in.GroupIDs {
		if _, err = tx.Exec(ctx, `INSERT INTO prepared_quiz_target_groups(assessment_id,group_id) VALUES($1::uuid,$2::uuid)`, assessmentID, id); err != nil {
			return mapError(err)
		}
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.prepared.stage", ResourceType: "assessment", ResourceID: assessmentID, Metadata: map[string]any{"mode": in.Mode, "audienceType": in.AudienceType}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) GetPreparedQuizStage(ctx context.Context, assessmentID string) (assessment.PreparedQuizStage, error) {
	var out assessment.PreparedQuizStage
	var usersJSON []byte
	err := r.db.QueryRow(ctx, `SELECT mode,audience_type,due_exclusive,enabled,was_enabled,
	 ARRAY(SELECT user_id::text FROM prepared_quiz_target_users WHERE assessment_id=d.assessment_id ORDER BY user_id),
	 ARRAY(SELECT group_id::text FROM prepared_quiz_target_groups WHERE assessment_id=d.assessment_id ORDER BY group_id),
	 COALESCE((SELECT jsonb_agg(jsonb_build_object('id',u.id::text,'name',u.name,'email',u.email) ORDER BY u.name,u.id) FROM prepared_quiz_target_users tu JOIN users u ON u.id=tu.user_id WHERE tu.assessment_id=d.assessment_id),'[]'::jsonb)
	 FROM prepared_quiz_distributions d WHERE assessment_id=$1::uuid`, assessmentID).Scan(&out.Mode, &out.AudienceType, &out.DueExclusive, &out.Enabled, &out.WasEnabled, &out.UserIDs, &out.GroupIDs, &usersJSON)
	if err != nil {
		return out, mapError(err)
	}
	if err = json.Unmarshal(usersJSON, &out.TargetUsers); err != nil {
		return out, err
	}
	return out, nil
}
