package postgres

import (
	"context"

	assessment "github.com/nasef6464/almeaago/internal/assessment/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) ListPreparedQuizGroups(ctx context.Context) ([]assessment.PreparedQuizGroup, error) {
	rows, err := r.db.Query(ctx, `SELECT g.id::text,g.name,g.group_type,COALESCE(g.legacy_id,''),count(m.user_id)::int FROM prepared_quiz_groups g LEFT JOIN prepared_quiz_group_members m ON m.group_id=g.id GROUP BY g.id ORDER BY g.name,g.id`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []assessment.PreparedQuizGroup{}
	for rows.Next() {
		var g assessment.PreparedQuizGroup
		if err = rows.Scan(&g.ID, &g.Name, &g.GroupType, &g.LegacyID, &g.MemberCount); err != nil {
			return nil, err
		}
		out = append(out, g)
	}
	return out, rows.Err()
}

func (r *Repository) CreatePreparedQuizGroup(ctx context.Context, actor string, g assessment.PreparedQuizGroup) (assessment.PreparedQuizGroup, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return g, err
	}
	defer tx.Rollback(ctx)
	err = tx.QueryRow(ctx, `INSERT INTO prepared_quiz_groups(name,group_type,legacy_id) VALUES($1,$2,NULLIF($3,'')) RETURNING id::text`, g.Name, g.GroupType, g.LegacyID).Scan(&g.ID)
	if err != nil {
		return g, mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.prepared_group.create", ResourceType: "prepared_quiz_group", ResourceID: g.ID, Metadata: map[string]any{"groupType": g.GroupType}}); err != nil {
		return g, err
	}
	if err = tx.Commit(ctx); err != nil {
		return g, err
	}
	return g, nil
}

func (r *Repository) ListPreparedQuizGroupMembers(ctx context.Context, groupID string) ([]string, error) {
	var exists bool
	if err := r.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM prepared_quiz_groups WHERE id=$1::uuid)`, groupID).Scan(&exists); err != nil {
		return nil, mapError(err)
	}
	if !exists {
		return nil, assessment.ErrNotFound
	}
	rows, err := r.db.Query(ctx, `SELECT user_id::text FROM prepared_quiz_group_members WHERE group_id=$1::uuid ORDER BY user_id`, groupID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var id string
		if err = rows.Scan(&id); err != nil {
			return nil, err
		}
		out = append(out, id)
	}
	return out, rows.Err()
}

// Read members and their display information in one statement so userIds and
// members in the API cannot disagree if membership changes concurrently.
func (r *Repository) ListPreparedQuizGroupMemberDetails(ctx context.Context, groupID string) ([]assessment.PreparedQuizGroupMember, error) {
	rows, err := r.db.Query(ctx, `SELECT g.id::text,COALESCE(u.id::text,''),COALESCE(u.name,''),COALESCE(u.email,'') FROM prepared_quiz_groups g LEFT JOIN prepared_quiz_group_members m ON m.group_id=g.id LEFT JOIN users u ON u.id=m.user_id WHERE g.id=$1::uuid ORDER BY u.name,u.id`, groupID)
	if err != nil {
		return nil, mapError(err)
	}
	defer rows.Close()
	out := []assessment.PreparedQuizGroupMember{}
	found := false
	for rows.Next() {
		var group string
		var member assessment.PreparedQuizGroupMember
		if err = rows.Scan(&group, &member.ID, &member.Name, &member.Email); err != nil {
			return nil, err
		}
		found = true
		if member.ID != "" {
			out = append(out, member)
		}
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	if !found {
		return nil, assessment.ErrNotFound
	}
	return out, nil
}

func (r *Repository) SetPreparedQuizGroupMember(ctx context.Context, actor, groupID, userID string, add bool) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	var lockedID string
	if err = tx.QueryRow(ctx, `SELECT id::text FROM prepared_quiz_groups WHERE id=$1::uuid FOR UPDATE`, groupID).Scan(&lockedID); err != nil {
		return mapError(err)
	}
	if add {
		_, err = tx.Exec(ctx, `INSERT INTO prepared_quiz_group_members(group_id,user_id) VALUES($1::uuid,$2::uuid) ON CONFLICT DO NOTHING`, groupID, userID)
	} else {
		_, err = tx.Exec(ctx, `DELETE FROM prepared_quiz_group_members WHERE group_id=$1::uuid AND user_id=$2::uuid`, groupID, userID)
	}
	if err != nil {
		return mapError(err)
	}
	if err = r.auditTx(ctx, tx, operations.AuditEvent{ActorUserID: actor, Action: "assessment.prepared_group.member", ResourceType: "prepared_quiz_group", ResourceID: groupID, Metadata: map[string]any{"userId": userID, "added": add}}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}
