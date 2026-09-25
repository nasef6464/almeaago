package postgres

import (
	"context"

	"github.com/jackc/pgx/v5"

	content "github.com/nasef6464/almeaago/internal/content/domain"
	operations "github.com/nasef6464/almeaago/internal/operations/domain"
)

func (r *Repository) CreateTopic(ctx context.Context, actorUserID string, command content.TopicCommand) (content.FoundationTopic, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := validateTopicParentTx(ctx, tx, "", command.ParentTopicID, command.PathID, command.SubjectID); err != nil {
		return content.FoundationTopic{}, err
	}
	var id string
	err = tx.QueryRow(ctx, `
		INSERT INTO foundation_topics (
			path_id,subject_id,parent_topic_id,code,title,description,sort_order,
			is_visible,is_locked,status,created_by
		)
		VALUES (
			$1::uuid,$2::uuid,NULLIF($3,'')::uuid,$4,$5,$6,$7,$8,$9,'active',$10::uuid
		)
		RETURNING id::text
	`, command.PathID, command.SubjectID, command.ParentTopicID, command.Code, command.Title,
		command.Description, command.SortOrder, command.IsVisible, command.IsLocked, actorUserID).Scan(&id)
	if err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if err := replaceTopicSkillsTx(ctx, tx, id, command.SkillLinks); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.foundation.topic.create", ResourceType: "foundation_topic", ResourceID: id,
		Metadata: map[string]any{"code": command.Code, "pathId": command.PathID, "subjectId": command.SubjectID},
	}); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.FoundationTopic{}, err
	}
	return r.GetTopic(ctx, id)
}

func (r *Repository) UpdateTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int, command content.TopicCommand) (content.FoundationTopic, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	var current int
	var currentCode, status string
	if err := tx.QueryRow(ctx, `
		SELECT revision,code,status
		FROM foundation_topics
		WHERE id=$1::uuid
		FOR UPDATE
	`, topicID).Scan(&current, &currentCode, &status); err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if current != expectedRevision {
		return content.FoundationTopic{}, content.ErrVersionConflict
	}
	if status == "archived" || currentCode != command.Code {
		return content.FoundationTopic{}, content.ErrConflict
	}
	if err := r.validateTaxonomyTx(ctx, tx, command.PathID, command.SubjectID, command.SkillLinks); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := validateTopicParentTx(ctx, tx, topicID, command.ParentTopicID, command.PathID, command.SubjectID); err != nil {
		return content.FoundationTopic{}, err
	}
	_, err = tx.Exec(ctx, `
		UPDATE foundation_topics
		SET path_id=$2::uuid,subject_id=$3::uuid,parent_topic_id=NULLIF($4,'')::uuid,
			title=$5,description=$6,sort_order=$7,is_visible=$8,is_locked=$9,
			revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, topicID, command.PathID, command.SubjectID, command.ParentTopicID, command.Title,
		command.Description, command.SortOrder, command.IsVisible, command.IsLocked)
	if err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if err := replaceTopicSkillsTx(ctx, tx, topicID, command.SkillLinks); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.foundation.topic.update", ResourceType: "foundation_topic", ResourceID: topicID,
		Metadata: map[string]any{"fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.FoundationTopic{}, err
	}
	return r.GetTopic(ctx, topicID)
}

func (r *Repository) GetTopic(ctx context.Context, topicID string) (content.FoundationTopic, error) {
	var row content.FoundationTopic
	var parentID, createdBy string
	err := r.db.QueryRow(ctx, `
		SELECT id::text,path_id::text,subject_id::text,COALESCE(parent_topic_id::text,''),
			code,title,description,sort_order,is_visible,is_locked,status,COALESCE(created_by::text,''),
			revision,created_at,updated_at
		FROM foundation_topics
		WHERE id=$1::uuid
	`, topicID).Scan(
		&row.ID, &row.PathID, &row.SubjectID, &parentID, &row.Code, &row.Title, &row.Description,
		&row.SortOrder, &row.IsVisible, &row.IsLocked, &row.Status, &createdBy, &row.Revision,
		&row.CreatedAt, &row.UpdatedAt,
	)
	if err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	row.ParentTopicID = parentID
	row.CreatedBy = createdBy
	links, err := r.loadTopicSkills(ctx, topicID)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	row.SkillLinks = links
	return row, nil
}

func (r *Repository) ListTopics(ctx context.Context, query content.ListQuery) (content.TopicPage, error) {
	rows, err := r.db.Query(ctx, `
		SELECT id::text,path_id::text,subject_id::text,COALESCE(parent_topic_id::text,''),
			code,title,description,sort_order,is_visible,is_locked,status,COALESCE(created_by::text,''),
			revision,created_at,updated_at
		FROM foundation_topics t
		WHERE ($1='' OR t.path_id=$1::uuid)
		  AND ($2='' OR t.subject_id=$2::uuid)
		  AND ($3='' OR t.status=$3)
		  AND ($4='' OR lower(t.title) LIKE '%' || lower($4) || '%' OR lower(t.code) LIKE '%' || lower($4) || '%')
		ORDER BY t.path_id,t.subject_id,t.parent_topic_id NULLS FIRST,t.sort_order,t.id
		LIMIT $5 OFFSET $6
	`, query.PathID, query.SubjectID, query.Status, query.Search, query.Limit+1, (query.Page-1)*query.Limit)
	if err != nil {
		return content.TopicPage{}, mapError(err)
	}
	defer rows.Close()
	items := make([]content.FoundationTopic, 0, query.Limit+1)
	for rows.Next() {
		var row content.FoundationTopic
		var parentID, createdBy string
		if err := rows.Scan(
			&row.ID, &row.PathID, &row.SubjectID, &parentID, &row.Code, &row.Title, &row.Description,
			&row.SortOrder, &row.IsVisible, &row.IsLocked, &row.Status, &createdBy, &row.Revision,
			&row.CreatedAt, &row.UpdatedAt,
		); err != nil {
			return content.TopicPage{}, err
		}
		row.ParentTopicID = parentID
		row.CreatedBy = createdBy
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

func (r *Repository) ArchiveTopic(ctx context.Context, actorUserID, topicID string, expectedRevision int) (content.FoundationTopic, error) {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return content.FoundationTopic{}, err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var current int
	var status string
	if err := tx.QueryRow(ctx, `SELECT revision,status FROM foundation_topics WHERE id=$1::uuid FOR UPDATE`, topicID).Scan(&current, &status); err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if current != expectedRevision {
		return content.FoundationTopic{}, content.ErrVersionConflict
	}
	if status == "archived" {
		return content.FoundationTopic{}, content.ErrConflict
	}
	var childCount int
	if err := tx.QueryRow(ctx, `
		SELECT count(*) FROM foundation_topics
		WHERE parent_topic_id=$1::uuid AND status<>'archived'
	`, topicID).Scan(&childCount); err != nil {
		return content.FoundationTopic{}, err
	}
	if childCount > 0 {
		return content.FoundationTopic{}, content.ErrConflict
	}
	if _, err := tx.Exec(ctx, `
		UPDATE foundation_topics
		SET status='archived',is_visible=false,revision=revision+1,updated_at=now()
		WHERE id=$1::uuid
	`, topicID); err != nil {
		return content.FoundationTopic{}, mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.foundation.topic.archive", ResourceType: "foundation_topic", ResourceID: topicID,
		Metadata: map[string]any{"fromRevision": current, "toRevision": current + 1},
	}); err != nil {
		return content.FoundationTopic{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return content.FoundationTopic{}, err
	}
	return r.GetTopic(ctx, topicID)
}

func (r *Repository) LinkTopicLesson(ctx context.Context, actorUserID, topicID, lessonID string, sortOrder int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var topicPath, topicSubject, lessonPath, lessonSubject string
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text FROM foundation_topics
		WHERE id=$1::uuid AND status='active'
		FOR UPDATE
	`, topicID).Scan(&topicPath, &topicSubject); err != nil {
		return mapError(err)
	}
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text FROM lessons
		WHERE id=$1::uuid AND workflow_status<>'archived'
	`, lessonID).Scan(&lessonPath, &lessonSubject); err != nil {
		return mapError(err)
	}
	if topicPath != lessonPath || topicSubject != lessonSubject {
		return content.ErrConflict
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO topic_lessons(topic_id,lesson_id,sort_order)
		VALUES($1::uuid,$2::uuid,$3)
		ON CONFLICT(topic_id,lesson_id) DO UPDATE SET sort_order=EXCLUDED.sort_order
	`, topicID, lessonID, sortOrder); err != nil {
		return mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.foundation.lesson.link", ResourceType: "foundation_topic", ResourceID: topicID,
		Metadata: map[string]any{"lessonId": lessonID, "sortOrder": sortOrder},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func (r *Repository) LinkTopicLibrary(ctx context.Context, actorUserID, topicID, libraryItemID string, sortOrder int) error {
	tx, err := r.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback(ctx) }()
	var topicPath, topicSubject, itemPath, itemSubject string
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text FROM foundation_topics
		WHERE id=$1::uuid AND status='active'
		FOR UPDATE
	`, topicID).Scan(&topicPath, &topicSubject); err != nil {
		return mapError(err)
	}
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text FROM library_items
		WHERE id=$1::uuid AND workflow_status<>'archived'
	`, libraryItemID).Scan(&itemPath, &itemSubject); err != nil {
		return mapError(err)
	}
	if topicPath != itemPath || topicSubject != itemSubject {
		return content.ErrConflict
	}
	if _, err := tx.Exec(ctx, `
		INSERT INTO topic_library_items(topic_id,library_item_id,sort_order)
		VALUES($1::uuid,$2::uuid,$3)
		ON CONFLICT(topic_id,library_item_id) DO UPDATE SET sort_order=EXCLUDED.sort_order
	`, topicID, libraryItemID, sortOrder); err != nil {
		return mapError(err)
	}
	if err := r.writeAudit(ctx, tx, operations.AuditEvent{
		ActorUserID: actorUserID, Action: "content.foundation.library.link", ResourceType: "foundation_topic", ResourceID: topicID,
		Metadata: map[string]any{"libraryItemId": libraryItemID, "sortOrder": sortOrder},
	}); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

func validateTopicParentTx(ctx context.Context, tx pgx.Tx, topicID, parentID, pathID, subjectID string) error {
	if parentID == "" {
		return nil
	}
	if parentID == topicID {
		return content.ErrConflict
	}
	var parentPath, parentSubject, parentStatus string
	if err := tx.QueryRow(ctx, `
		SELECT path_id::text,subject_id::text,status
		FROM foundation_topics
		WHERE id=$1::uuid
	`, parentID).Scan(&parentPath, &parentSubject, &parentStatus); err != nil {
		return mapError(err)
	}
	if parentPath != pathID || parentSubject != subjectID || parentStatus == "archived" {
		return content.ErrConflict
	}
	if topicID == "" {
		return nil
	}
	var cycle bool
	if err := tx.QueryRow(ctx, `
		WITH RECURSIVE descendants AS (
			SELECT id FROM foundation_topics WHERE parent_topic_id=$1::uuid
			UNION ALL
			SELECT child.id
			FROM foundation_topics child
			JOIN descendants d ON child.parent_topic_id=d.id
		)
		SELECT EXISTS(SELECT 1 FROM descendants WHERE id=$2::uuid)
	`, topicID, parentID).Scan(&cycle); err != nil {
		return err
	}
	if cycle {
		return content.ErrConflict
	}
	return nil
}

func replaceTopicSkillsTx(ctx context.Context, tx pgx.Tx, topicID string, links []content.SkillLink) error {
	if _, err := tx.Exec(ctx, `DELETE FROM topic_skill_links WHERE topic_id=$1::uuid`, topicID); err != nil {
		return err
	}
	for _, link := range links {
		if _, err := tx.Exec(ctx, `
			INSERT INTO topic_skill_links(topic_id,skill_id,relation_type)
			VALUES($1::uuid,$2::uuid,$3)
		`, topicID, link.SkillID, link.RelationType); err != nil {
			return mapError(err)
		}
	}
	return nil
}

func (r *Repository) loadTopicSkills(ctx context.Context, topicID string) ([]content.SkillLink, error) {
	rows, err := r.db.Query(ctx, `
		SELECT skill_id::text,relation_type FROM topic_skill_links
		WHERE topic_id=$1::uuid
		ORDER BY CASE relation_type WHEN 'primary' THEN 0 ELSE 1 END,skill_id
	`, topicID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []content.SkillLink{}
	for rows.Next() {
		var item content.SkillLink
		if err := rows.Scan(&item.SkillID, &item.RelationType); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}
