package postgres

import (
	"context"
	"fmt"
	"strings"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateTopic(ctx context.Context, actorUserID string, write content.TopicWrite) (content.FoundationTopic, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, nil); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := validateTopicParentTx(ctx, tx, "", write.ParentTopicID, write.PathID, write.SubjectID); err != nil {
		return content.FoundationTopic{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO foundation_topics (path_id,subject_id,parent_topic_id,code,title,description,sort_order,status,is_visible,is_locked,created_by)
		VALUES ($1::uuid,$2::uuid,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,$10,$11::uuid)
		RETURNING id::text
	`, write.PathID, write.SubjectID, write.ParentTopicID, write.Code, write.Title, write.Description, write.SortOrder,
		string(write.Status), write.IsVisible, write.IsLocked, actorUserID).Scan(&id)
	if err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if err := replaceTopicSkillsTx(ctx, tx, id, write.SkillIDs); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.foundation_topic.create", ResourceType: "foundation_topic", ResourceID: id}); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.FoundationTopic{}, err
	}
	return r.GetTopic(ctx, id)
}

func (r *Repository) UpdateTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int, write content.TopicWrite) (content.FoundationTopic, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	if err := r.validateContentRefsTx(ctx, tx, write.PathID, write.SubjectID, write.SkillIDs, nil); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := validateTopicParentTx(ctx, tx, topicID, write.ParentTopicID, write.PathID, write.SubjectID); err != nil {
		return content.FoundationTopic{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		UPDATE foundation_topics SET path_id=$3::uuid,subject_id=$4::uuid,parent_topic_id=NULLIF($5,'')::uuid,
			code=$6,title=$7,description=$8,sort_order=$9,status=$10,is_visible=$11,is_locked=$12,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid AND revision=$2
		RETURNING id::text
	`, topicID, expectedRevision, write.PathID, write.SubjectID, write.ParentTopicID, write.Code, write.Title,
		write.Description, write.SortOrder, string(write.Status), write.IsVisible, write.IsLocked).Scan(&id)
	if err != nil {
		return content.FoundationTopic{}, mapUpdateError(ctx, tx, "foundation_topics", topicID, expectedRevision, err)
	}
	if err := replaceTopicSkillsTx(ctx, tx, id, write.SkillIDs); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{ActorUserID: actorUserID, Action: "content.foundation_topic.update", ResourceType: "foundation_topic", ResourceID: id}); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.FoundationTopic{}, err
	}
	return r.GetTopic(ctx, id)
}

func (r *Repository) GetTopic(ctx context.Context, topicID string) (content.FoundationTopic, error) {
	var row content.FoundationTopic
	var parentID, createdBy string
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,COALESCE(parent_topic_id::text,''),code,title,description,sort_order,status,
			is_visible,is_locked,COALESCE(created_by::text,''),revision,created_at,updated_at
		FROM foundation_topics WHERE id=$1::uuid
	`, topicID).Scan(&row.ID, &row.PathID, &row.SubjectID, &parentID, &row.Code, &row.Title, &row.Description,
		&row.SortOrder, &row.Status, &row.IsVisible, &row.IsLocked, &createdBy, &row.Revision, &row.CreatedAt, &row.UpdatedAt)
	if err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	row.ParentTopicID, row.CreatedBy = parentID, createdBy
	row.SkillIDs, err = r.loadIDs(ctx, `SELECT skill_id::text FROM topic_skill_links WHERE topic_id=$1::uuid ORDER BY CASE relation_type WHEN 'primary' THEN 0 ELSE 1 END,skill_id`, topicID)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	return row, nil
}

func (r *Repository) ListTopics(ctx context.Context, query content.TopicQuery) (content.TopicPage, error) {
	parts := []string{"1=1"}
	args := []any{}
	add := func(expr string, value any) {
		args = append(args, value)
		parts = append(parts, fmt.Sprintf(expr, len(args)))
	}
	if query.PathID != "" {
		add("t.path_id=$%d::uuid", query.PathID)
	}
	if query.SubjectID != "" {
		add("t.subject_id=$%d::uuid", query.SubjectID)
	}
	if query.ParentID != "" {
		add("t.parent_topic_id=$%d::uuid", query.ParentID)
	}
	if query.Search != "" {
		add("t.title ILIKE '%%' || $%d || '%%'", query.Search)
	}
	if query.Status != "" {
		add("t.status=$%d", string(query.Status))
	}
	args = append(args, query.Limit+1, (query.Page-1)*query.Limit)
	rows, err := r.db.Query(ctx, `
		SELECT t.id::text,t.path_id::text,t.subject_id::text,COALESCE(t.parent_topic_id::text,''),t.code,t.title,
			t.sort_order,t.status,t.is_visible,t.is_locked,t.revision,t.updated_at
		FROM foundation_topics t WHERE `+strings.Join(parts, " AND ")+`
		ORDER BY t.sort_order,t.id
		LIMIT $`+fmt.Sprint(len(args)-1)+` OFFSET $`+fmt.Sprint(len(args)), args...)
	if err != nil {
		return content.TopicPage{}, err
	}
	defer rows.Close()
	items := make([]content.FoundationTopic, 0, query.Limit+1)
	for rows.Next() {
		var row content.FoundationTopic
		var parentID string
		if err := rows.Scan(&row.ID, &row.PathID, &row.SubjectID, &parentID, &row.Code, &row.Title,
			&row.SortOrder, &row.Status, &row.IsVisible, &row.IsLocked, &row.Revision, &row.UpdatedAt); err != nil {
			return content.TopicPage{}, err
		}
		row.ParentTopicID = parentID
		items = append(items, row)
	}
	if err := rows.Err(); err != nil {
		return content.TopicPage{}, err
	}
	hasMore := len(items) > query.Limit
	if hasMore {
		items = items[:query.Limit]
	}
	return content.TopicPage{Items: items, Page: query.Page, Limit: query.Limit, HasMore: hasMore}, nil
}
